/**
 * logger.ts — request/pipeline logging (v4) for the EziLearning Cursor proxy.
 *
 * Stores full request params, model responses, converted Cursor payloads,
 * phase timings, TTFT, titles, optional JSONL persistence, and serves the web UI.
 */

import { EventEmitter } from 'events';
import { existsSync, mkdirSync, appendFileSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { getConfig } from './config.js';

// --- Types ---

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSource = 'Handler' | 'OpenAI' | 'Cursor' | 'Auth' | 'System' | 'Converter';
export type LogPhase = 
    | 'receive' | 'auth' | 'convert' | 'intercept' | 'send'
    | 'response' | 'refusal' | 'retry' | 'truncation' | 'continuation'
    | 'thinking' | 'toolparse' | 'sanitize' | 'stream' | 'complete' | 'error';

export interface LogEntry {
    id: string;
    requestId: string;
    timestamp: number;
    level: LogLevel;
    source: LogSource;
    phase: LogPhase;
    message: string;
    details?: unknown;
    duration?: number;
}

export interface PhaseTiming {
    phase: LogPhase;
    label: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

/** Full per-request payload for the log viewer */
export interface RequestPayload {
    /** Original body (Anthropic or OpenAI shape) */
    originalRequest?: unknown;
    systemPrompt?: string;
    messages?: Array<{ role: string; contentPreview: string; contentLength: number; hasImages?: boolean }>;
    tools?: Array<{ name: string; description?: string }>;

    /** After conversion — Cursor-shaped request summary */
    cursorRequest?: unknown;
    cursorMessages?: Array<{ role: string; contentPreview: string; contentLength: number }>;

    rawResponse?: string;
    finalResponse?: string;
    thinkingContent?: string;
    toolCalls?: unknown[];
    retryResponses?: Array<{ attempt: number; response: string; reason: string }>;
    continuationResponses?: Array<{ index: number; response: string; dedupedLength: number }>;
}

export interface RequestSummary {
    requestId: string;
    startTime: number;
    endTime?: number;
    method: string;
    path: string;
    model: string;
    stream: boolean;
    apiFormat: 'anthropic' | 'openai' | 'responses';
    hasTools: boolean;
    toolCount: number;
    messageCount: number;
    status: 'processing' | 'success' | 'error' | 'intercepted';
    responseChars: number;
    retryCount: number;
    continuationCount: number;
    stopReason?: string;
    error?: string;
    toolCallsDetected: number;
    ttft?: number;
    cursorApiTime?: number;
    phaseTimings: PhaseTiming[];
    thinkingChars: number;
    systemPromptLength: number;
    /** Title from last user message (truncated) */
    title?: string;
}

// --- In-memory stores ---

const MAX_ENTRIES = 5000;
const MAX_REQUESTS = 200;

let logCounter = 0;
const logEntries: LogEntry[] = [];
const requestSummaries: Map<string, RequestSummary> = new Map();
const requestPayloads: Map<string, RequestPayload> = new Map();
const requestOrder: string[] = [];

const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);

function shortId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// --- JSONL log files (optional) ---
/** Current log file name prefix; legacy `cursor2api-*.jsonl` is still read and cleaned up */
const LOG_FILE_PREFIX = 'ezilearning-cursor-proxy';
const LOG_FILE_PREFIX_LEGACY = 'cursor2api';

function isProxyLogFile(name: string): boolean {
    return name.endsWith('.jsonl') &&
        (name.startsWith(`${LOG_FILE_PREFIX}-`) || name.startsWith(`${LOG_FILE_PREFIX_LEGACY}-`));
}

function logFileDateStem(name: string): string {
    if (name.startsWith(`${LOG_FILE_PREFIX}-`)) return name.slice(LOG_FILE_PREFIX.length + 1, -'.jsonl'.length);
    if (name.startsWith(`${LOG_FILE_PREFIX_LEGACY}-`)) return name.slice(LOG_FILE_PREFIX_LEGACY.length + 1, -'.jsonl'.length);
    return '';
}

function getLogDir(): string | null {
    const cfg = getConfig();
    if (!cfg.logging?.file_enabled) return null;
    return cfg.logging.dir || './logs';
}

function getLogFilePath(): string | null {
    const dir = getLogDir();
    if (!dir) return null;
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return join(dir, `${LOG_FILE_PREFIX}-${date}.jsonl`);
}

function ensureLogDir(): void {
    const dir = getLogDir();
    if (dir && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function persistRequest(summary: RequestSummary, payload: RequestPayload): void {
    const filepath = getLogFilePath();
    if (!filepath) return;
    try {
        ensureLogDir();
        const record = { timestamp: Date.now(), summary, payload };
        appendFileSync(filepath, JSON.stringify(record) + '\n', 'utf-8');
    } catch (e) {
        console.warn('[Logger] Failed to append log file:', e);
    }
}

export function loadLogsFromFiles(): void {
    const dir = getLogDir();
    if (!dir || !existsSync(dir)) return;
    try {
        const cfg = getConfig();
        const maxDays = cfg.logging?.max_days || 7;
        const cutoff = Date.now() - maxDays * 86400000;
        
        const files = readdirSync(dir)
            .filter(isProxyLogFile)
            .sort();
        
        for (const f of files) {
            const dateStr = logFileDateStem(f);
            const fileDate = new Date(dateStr).getTime();
            if (fileDate < cutoff) {
                try { unlinkSync(join(dir, f)); } catch { /* ignore */ }
                continue;
            }
        }
        
        const validFiles = readdirSync(dir)
            .filter(isProxyLogFile)
            .sort()
            .slice(-2);
        
        let loaded = 0;
        for (const f of validFiles) {
            const content = readFileSync(join(dir, f), 'utf-8');
            const lines = content.split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const record = JSON.parse(line);
                    if (record.summary && record.summary.requestId) {
                        const s = record.summary as RequestSummary;
                        const p = record.payload as RequestPayload || {};
                        if (!requestSummaries.has(s.requestId)) {
                            requestSummaries.set(s.requestId, s);
                            requestPayloads.set(s.requestId, p);
                            requestOrder.push(s.requestId);
                            loaded++;
                        }
                    }
                } catch { /* skip malformed lines */ }
            }
        }
        
        // Trim to MAX_REQUESTS
        while (requestOrder.length > MAX_REQUESTS) {
            const oldId = requestOrder.shift()!;
            requestSummaries.delete(oldId);
            requestPayloads.delete(oldId);
        }
        
        if (loaded > 0) {
            console.log(`[Logger] Loaded ${loaded} request(s) from log files`);
        }
    } catch (e) {
        console.warn('[Logger] Failed to load log files:', e);
    }
}

export function clearAllLogs(): { cleared: number } {
    const count = requestSummaries.size;
    logEntries.length = 0;
    requestSummaries.clear();
    requestPayloads.clear();
    requestOrder.length = 0;
    logCounter = 0;
    
    const dir = getLogDir();
    if (dir && existsSync(dir)) {
        try {
            const files = readdirSync(dir).filter(isProxyLogFile);
            for (const f of files) {
                try { unlinkSync(join(dir, f)); } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }
    
    return { cleared: count };
}

// --- Stats ---

export function getStats() {
    let success = 0, error = 0, intercepted = 0, processing = 0;
    let totalTime = 0, timeCount = 0, totalTTFT = 0, ttftCount = 0;
    for (const s of requestSummaries.values()) {
        if (s.status === 'success') success++;
        else if (s.status === 'error') error++;
        else if (s.status === 'intercepted') intercepted++;
        else if (s.status === 'processing') processing++;
        if (s.endTime) { totalTime += s.endTime - s.startTime; timeCount++; }
        if (s.ttft) { totalTTFT += s.ttft; ttftCount++; }
    }
    return {
        totalRequests: requestSummaries.size,
        successCount: success, errorCount: error,
        interceptedCount: intercepted, processingCount: processing,
        avgResponseTime: timeCount > 0 ? Math.round(totalTime / timeCount) : 0,
        avgTTFT: ttftCount > 0 ? Math.round(totalTTFT / ttftCount) : 0,
        totalLogEntries: logEntries.length,
    };
}

// --- Public API ---

export function createRequestLogger(opts: {
    method: string;
    path: string;
    model: string;
    stream: boolean;
    hasTools: boolean;
    toolCount: number;
    messageCount: number;
    apiFormat?: 'anthropic' | 'openai' | 'responses';
    systemPromptLength?: number;
}): RequestLogger {
    const requestId = shortId();
    const summary: RequestSummary = {
        requestId, startTime: Date.now(),
        method: opts.method, path: opts.path, model: opts.model,
        stream: opts.stream,
        apiFormat: opts.apiFormat || (opts.path.includes('chat/completions') ? 'openai' :
                   opts.path.includes('responses') ? 'responses' : 'anthropic'),
        hasTools: opts.hasTools, toolCount: opts.toolCount,
        messageCount: opts.messageCount,
        status: 'processing', responseChars: 0,
        retryCount: 0, continuationCount: 0, toolCallsDetected: 0,
        phaseTimings: [], thinkingChars: 0,
        systemPromptLength: opts.systemPromptLength || 0,
    };
    const payload: RequestPayload = {};
    
    requestSummaries.set(requestId, summary);
    requestPayloads.set(requestId, payload);
    requestOrder.push(requestId);
    
    while (requestOrder.length > MAX_REQUESTS) {
        const oldId = requestOrder.shift()!;
        requestSummaries.delete(oldId);
        requestPayloads.delete(oldId);
    }

    const toolInfo = opts.hasTools ? ` tools=${opts.toolCount}` : '';
    const fmtTag = summary.apiFormat === 'openai' ? ' [OAI]' : summary.apiFormat === 'responses' ? ' [RSP]' : '';
    console.log(`\x1b[36m⟶\x1b[0m [${requestId}] ${opts.method} ${opts.path}${fmtTag} | model=${opts.model} stream=${opts.stream}${toolInfo} msgs=${opts.messageCount}`);
    
    return new RequestLogger(requestId, summary, payload);
}

export function getAllLogs(opts?: { requestId?: string; level?: LogLevel; source?: LogSource; limit?: number; since?: number }): LogEntry[] {
    let result = logEntries;
    if (opts?.requestId) result = result.filter(e => e.requestId === opts.requestId);
    if (opts?.level) {
        const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
        const minLevel = levels[opts.level];
        result = result.filter(e => levels[e.level] >= minLevel);
    }
    if (opts?.source) result = result.filter(e => e.source === opts.source);
    if (opts?.since) result = result.filter(e => e.timestamp > opts!.since!);
    if (opts?.limit) result = result.slice(-opts.limit);
    return result;
}

export function getRequestSummaries(limit?: number): RequestSummary[] {
    const ids = limit ? requestOrder.slice(-limit) : requestOrder;
    return ids.map(id => requestSummaries.get(id)!).filter(Boolean).reverse();
}

export function getRequestPayload(requestId: string): RequestPayload | undefined {
    return requestPayloads.get(requestId);
}

export function subscribeToLogs(listener: (entry: LogEntry) => void): () => void {
    logEmitter.on('log', listener);
    return () => logEmitter.off('log', listener);
}

export function subscribeToSummaries(listener: (summary: RequestSummary) => void): () => void {
    logEmitter.on('summary', listener);
    return () => logEmitter.off('summary', listener);
}

function addEntry(entry: LogEntry): void {
    logEntries.push(entry);
    while (logEntries.length > MAX_ENTRIES) logEntries.shift();
    logEmitter.emit('log', entry);
}

// --- RequestLogger ---

export class RequestLogger {
    readonly requestId: string;
    private summary: RequestSummary;
    private payload: RequestPayload;
    private activePhase: PhaseTiming | null = null;
    
    constructor(requestId: string, summary: RequestSummary, payload: RequestPayload) {
        this.requestId = requestId;
        this.summary = summary;
        this.payload = payload;
    }
    
    private log(level: LogLevel, source: LogSource, phase: LogPhase, message: string, details?: unknown): void {
        addEntry({
            id: `log_${++logCounter}`,
            requestId: this.requestId,
            timestamp: Date.now(),
            level, source, phase, message, details,
            duration: Date.now() - this.summary.startTime,
        });
    }
    
    // --- Phase timing ---
    startPhase(phase: LogPhase, label: string): void {
        if (this.activePhase && !this.activePhase.endTime) {
            this.activePhase.endTime = Date.now();
            this.activePhase.duration = this.activePhase.endTime - this.activePhase.startTime;
        }
        const t: PhaseTiming = { phase, label, startTime: Date.now() };
        this.activePhase = t;
        this.summary.phaseTimings.push(t);
    }
    endPhase(): void {
        if (this.activePhase && !this.activePhase.endTime) {
            this.activePhase.endTime = Date.now();
            this.activePhase.duration = this.activePhase.endTime - this.activePhase.startTime;
        }
    }
    
    // --- Shortcuts ---
    debug(source: LogSource, phase: LogPhase, message: string, details?: unknown): void { this.log('debug', source, phase, message, details); }
    info(source: LogSource, phase: LogPhase, message: string, details?: unknown): void { this.log('info', source, phase, message, details); }
    warn(source: LogSource, phase: LogPhase, message: string, details?: unknown): void {
        this.log('warn', source, phase, message, details);
        console.log(`\x1b[33m⚠\x1b[0m [${this.requestId}] ${message}`);
    }
    error(source: LogSource, phase: LogPhase, message: string, details?: unknown): void {
        this.log('error', source, phase, message, details);
        console.error(`\x1b[31m✗\x1b[0m [${this.requestId}] ${message}`);
    }
    
    // --- Metrics ---
    recordTTFT(): void { this.summary.ttft = Date.now() - this.summary.startTime; }
    recordCursorApiTime(startTime: number): void { this.summary.cursorApiTime = Date.now() - startTime; }
    
    /** Record incoming client request */
    recordOriginalRequest(body: any): void {
        // system
        if (typeof body.system === 'string') {
            this.payload.systemPrompt = body.system;
        } else if (Array.isArray(body.system)) {
            this.payload.systemPrompt = body.system.map((b: any) => b.text || '').join('\n');
        }
        
        if (Array.isArray(body.messages)) {
            const MAX_MSG = 100000;
            this.payload.messages = body.messages.map((m: any) => {
                let fullContent = '';
                let contentLength = 0;
                let hasImages = false;
                if (typeof m.content === 'string') {
                    fullContent = m.content.length > MAX_MSG ? m.content.substring(0, MAX_MSG) + '\n... [truncated]' : m.content;
                    contentLength = m.content.length;
                } else if (Array.isArray(m.content)) {
                    const textParts = m.content.filter((c: any) => c.type === 'text');
                    const imageParts = m.content.filter((c: any) => c.type === 'image' || c.type === 'image_url' || c.type === 'input_image');
                    hasImages = imageParts.length > 0;
                    const text = textParts.map((c: any) => c.text || '').join('\n');
                    fullContent = text.length > MAX_MSG ? text.substring(0, MAX_MSG) + '\n... [truncated]' : text;
                    contentLength = text.length;
                    if (hasImages) fullContent += `\n[+${imageParts.length} images]`;
                }
                return { role: m.role, contentPreview: fullContent, contentLength, hasImages };
            });
            
            // Title from last user message
            const userMsgs = body.messages.filter((m: any) => m.role === 'user');
            if (userMsgs.length > 0) {
                const lastUser = userMsgs[userMsgs.length - 1];
                let text = '';
                if (typeof lastUser.content === 'string') {
                    text = lastUser.content;
                } else if (Array.isArray(lastUser.content)) {
                    text = lastUser.content
                        .filter((c: any) => c.type === 'text')
                        .map((c: any) => c.text || '')
                        .join(' ');
                }
                // Strip XML wrappers
                text = text.replace(/<[a-zA-Z_-]+>[\s\S]*?<\/[a-zA-Z_-]+>/gi, '');
                // Strip CC trailing boilerplate
                text = text.replace(/First,\s*think\s+step\s+by\s+step[\s\S]*$/i, '');
                text = text.replace(/Respond with the appropriate action[\s\S]*$/i, '');
                // Normalize whitespace
                text = text.replace(/\s+/g, ' ').trim();
                this.summary.title = text.length > 80 ? text.substring(0, 77) + '...' : text;
            }
        }
        
        // tools (full descriptions; truncation is a runtime config concern)
        if (Array.isArray(body.tools)) {
            this.payload.tools = body.tools.map((t: any) => ({
                name: t.name || t.function?.name || 'unknown',
                description: t.description || t.function?.description || '',
            }));
        }
        
        // Strip huge base64 from stored copy
        this.payload.originalRequest = this.sanitizeForStorage(body);
    }
    
    recordCursorRequest(cursorReq: any): void {
        if (Array.isArray(cursorReq.messages)) {
            const MAX_MSG = 100000;
            this.payload.cursorMessages = cursorReq.messages.map((m: any) => {
                // Cursor uses parts[]
                let text = '';
                if (m.parts && Array.isArray(m.parts)) {
                    text = m.parts.map((p: any) => p.text || '').join('\n');
                } else if (typeof m.content === 'string') {
                    text = m.content;
                } else if (m.content) {
                    text = JSON.stringify(m.content);
                }
                const fullContent = text.length > MAX_MSG ? text.substring(0, MAX_MSG) + '\n... [truncated]' : text;
                return {
                    role: m.role,
                    contentPreview: fullContent,
                    contentLength: text.length,
                };
            });
        }
        // Metadata only for cursor request
        this.payload.cursorRequest = {
            model: cursorReq.model,
            messageCount: cursorReq.messages?.length,
            totalChars: cursorReq.messages?.reduce((sum: number, m: any) => {
                if (m.parts && Array.isArray(m.parts)) {
                    return sum + m.parts.reduce((s: number, p: any) => s + (p.text?.length || 0), 0);
                }
                const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
                return sum + text.length;
            }, 0),
        };
    }
    
    recordRawResponse(text: string): void {
        this.payload.rawResponse = text;
    }
    
    recordFinalResponse(text: string): void {
        this.payload.finalResponse = text;
    }
    
    recordThinking(content: string): void {
        this.payload.thinkingContent = content;
        this.summary.thinkingChars = content.length;
    }
    
    recordToolCalls(calls: unknown[]): void {
        this.payload.toolCalls = calls;
    }
    
    recordRetryResponse(attempt: number, response: string, reason: string): void {
        if (!this.payload.retryResponses) this.payload.retryResponses = [];
        this.payload.retryResponses.push({ attempt, response, reason });
    }
    
    recordContinuationResponse(index: number, response: string, dedupedLength: number): void {
        if (!this.payload.continuationResponses) this.payload.continuationResponses = [];
        this.payload.continuationResponses.push({ index, response: response.substring(0, 2000), dedupedLength });
    }
    
    private sanitizeForStorage(obj: any): any {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this.sanitizeForStorage(item));
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'data' && typeof value === 'string' && (value as string).length > 1000) {
                result[key] = `[base64 data: ${(value as string).length} chars]`;
            } else if (key === 'source' && typeof value === 'object' && (value as any)?.type === 'base64') {
                result[key] = { type: 'base64', media_type: (value as any).media_type, data: `[${((value as any).data?.length || 0)} chars]` };
            } else if (typeof value === 'object') {
                result[key] = this.sanitizeForStorage(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }
    
    // --- Summary ---
    updateSummary(updates: Partial<RequestSummary>): void {
        Object.assign(this.summary, updates);
        logEmitter.emit('summary', this.summary);
    }
    
    complete(responseChars: number, stopReason?: string): void {
        this.endPhase();
        const duration = Date.now() - this.summary.startTime;
        this.summary.endTime = Date.now();
        this.summary.status = 'success';
        this.summary.responseChars = responseChars;
        this.summary.stopReason = stopReason;
        this.log('info', 'System', 'complete', `done (${duration}ms, ${responseChars} chars, stop=${stopReason})`);
        logEmitter.emit('summary', this.summary);
        
        persistRequest(this.summary, this.payload);
        
        const retryInfo = this.summary.retryCount > 0 ? ` retry=${this.summary.retryCount}` : '';
        const contInfo = this.summary.continuationCount > 0 ? ` cont=${this.summary.continuationCount}` : '';
        const toolInfo = this.summary.toolCallsDetected > 0 ? ` tools_called=${this.summary.toolCallsDetected}` : '';
        const ttftInfo = this.summary.ttft ? ` ttft=${this.summary.ttft}ms` : '';
        console.log(`\x1b[32m⟵\x1b[0m [${this.requestId}] ${duration}ms | ${responseChars} chars | stop=${stopReason || 'end_turn'}${ttftInfo}${retryInfo}${contInfo}${toolInfo}`);
    }
    
    intercepted(reason: string): void {
        this.summary.status = 'intercepted';
        this.summary.endTime = Date.now();
        this.log('info', 'System', 'intercept', reason);
        logEmitter.emit('summary', this.summary);
        persistRequest(this.summary, this.payload);
        console.log(`\x1b[35m⊘\x1b[0m [${this.requestId}] intercepted: ${reason}`);
    }
    
    fail(error: string): void {
        this.endPhase();
        this.summary.status = 'error';
        this.summary.endTime = Date.now();
        this.summary.error = error;
        this.log('error', 'System', 'error', error);
        logEmitter.emit('summary', this.summary);
        persistRequest(this.summary, this.payload);
    }
}
