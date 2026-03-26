/**
 * openai-handler.ts - OpenAI Chat Completions API 
 *
 *  OpenAI  Anthropic  Cursor 
 * 、、Cursor IDE Agent 
 */

import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
    OpenAIChatRequest,
    OpenAIMessage,
    OpenAIChatCompletion,
    OpenAIChatCompletionChunk,
    OpenAIToolCall,
    OpenAIContentPart,
    OpenAITool,
} from './openai-types.js';
import type {
    AnthropicRequest,
    AnthropicMessage,
    AnthropicContentBlock,
    AnthropicTool,
    CursorChatRequest,
    CursorSSEEvent,
} from './types.js';
import { convertToCursorRequest, parseToolCalls, hasToolCalls } from './converter.js';
import { sendCursorRequest, sendCursorRequestFull } from './cursor-client.js';
import { getConfig } from './config.js';
import { createRequestLogger } from './logger.js';
import { createIncrementalTextStreamer, hasLeadingThinking, splitLeadingThinkingBlocks, stripThinkingTags } from './streaming-text.js';
import {
    autoContinueCursorToolResponseFull,
    autoContinueCursorToolResponseStream,
    isRefusal,
    sanitizeResponse,
    isIdentityProbe,
    isToolCapabilityQuestion,
    buildRetryRequest,
    extractThinking,
    CLAUDE_IDENTITY_RESPONSE,
    CLAUDE_TOOLS_RESPONSE,
    MAX_REFUSAL_RETRIES,
    estimateInputTokens,
} from './handler.js';

function chatId(): string {
    return 'chatcmpl-' + uuidv4().replace(/-/g, '').substring(0, 24);
}

function toolCallId(): string {
    return 'call_' + uuidv4().replace(/-/g, '').substring(0, 24);
}

class OpenAIRequestError extends Error {
    status: number;
    type: string;
    code: string;

    constructor(message: string, status = 400, type = 'invalid_request_error', code = 'invalid_request') {
        super(message);
        this.name = 'OpenAIRequestError';
        this.status = status;
        this.type = type;
        this.code = code;
    }
}

function stringifyUnknownContent(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/** OpenAI client asked for JSON — never substitute plain-text identity blurb as the completion body. */
function wantsStructuredJson(body: OpenAIChatRequest): boolean {
    const t = body.response_format?.type;
    return t === 'json_object' || t === 'json_schema';
}

function wantsStructuredJsonRecord(body: Record<string, unknown>): boolean {
    const rf = body.response_format as { type?: string } | undefined;
    const t = rf?.type;
    return t === 'json_object' || t === 'json_schema';
}

const JSON_REFUSAL_FALLBACK =
    '{"error":"model_refused","message":"Upstream output was empty or classified as refusal; retry or adjust prompts."}';
const JSON_TOOLS_FALLBACK =
    '{"error":"tool_capabilities_unavailable","message":"Configure tools in your client."}';

function refusalFallbackOpenAI(body: OpenAIChatRequest, kind: 'identity' | 'tools'): string {
    if (!wantsStructuredJson(body)) {
        return kind === 'tools' ? CLAUDE_TOOLS_RESPONSE : CLAUDE_IDENTITY_RESPONSE;
    }
    return kind === 'tools' ? JSON_TOOLS_FALLBACK : JSON_REFUSAL_FALLBACK;
}

/** Plain-text refusal stand-ins must not break `response_format: json_object` clients. */
function proseOrJsonFallback(body: OpenAIChatRequest, prose: string): string {
    return wantsStructuredJson(body) ? JSON_REFUSAL_FALLBACK : prose;
}

/**
 * If the model returned a JSON object (possibly fenced), do not treat it as a "refusal" — refusal regexes
 * often false-positive on phrases inside JSON strings (e.g. "I can help you with things like…").
 */
function extractFirstBalancedJsonObject(text: string): string | null {
    const s = text.trim();
    const i = s.indexOf('{');
    if (i === -1) return null;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
        const c = s[j];
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return s.slice(i, j + 1);
        }
    }
    return null;
}

function tryParseTopLevelJsonObject(text: string): Record<string, unknown> | null {
    const raw = (text || '').trim();
    if (!raw) return null;
    const tryParse = (s: string): Record<string, unknown> | null => {
        try {
            const v = JSON.parse(s) as unknown;
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
        } catch { /* ignore */ }
        return null;
    };
    let o = tryParse(raw);
    if (o) return o;
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/im);
    if (fence) {
        o = tryParse(fence[1].trim());
        if (o) return o;
    }
    const extracted = extractFirstBalancedJsonObject(raw);
    if (extracted) {
        o = tryParse(extracted);
        if (o) return o;
    }
    return null;
}

/** For json_object requests: valid JSON output must not trigger refusal retries or model_refused fallback. */
function countsAsRefusalForOpenAIRetry(text: string, body: OpenAIChatRequest): boolean {
    if (wantsStructuredJson(body) && tryParseTopLevelJsonObject(text)) {
        return false;
    }
    return isRefusal(text);
}

function unsupportedImageFileError(fileId?: string): OpenAIRequestError {
    const suffix = fileId ? ` (file_id: ${fileId})` : '';
    return new OpenAIRequestError(
        `Unsupported content part: image_file${suffix}. This proxy does not support OpenAI Files API image references. Please send the image as image_url, input_image, data URI, or a local file path instead.`,
        400,
        'invalid_request_error',
        'unsupported_content_part'
    );
}

// ==================== OpenAI → Anthropic ====================

/**
 *  OpenAI Chat Completions  Anthropic 
 *  convertToCursorRequest 
 */
function convertToAnthropicRequest(body: OpenAIChatRequest): AnthropicRequest {
    const rawMessages: AnthropicMessage[] = [];
    let systemPrompt: string | undefined;

    // ★ response_format  JSON 
    let jsonFormatSuffix = '';
    if (body.response_format && body.response_format.type !== 'text') {
        jsonFormatSuffix = '\n\nRespond in plain JSON format without markdown wrapping.';
        if (body.response_format.type === 'json_schema' && body.response_format.json_schema?.schema) {
            jsonFormatSuffix += ` Schema: ${JSON.stringify(body.response_format.json_schema.schema)}`;
        }
    }

    for (const msg of body.messages) {
        switch (msg.role) {
            case 'system':
                systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + extractOpenAIContent(msg);
                break;

            case 'user': {
                //  content  tool_result Anthropic 
                const contentBlocks = extractOpenAIContentBlocks(msg);
                if (Array.isArray(contentBlocks)) {
                    rawMessages.push({ role: 'user', content: contentBlocks });
                } else {
                    rawMessages.push({ role: 'user', content: contentBlocks || '' });
                }
                break;
            }

            case 'assistant': {
                const blocks: AnthropicContentBlock[] = [];
                const contentBlocks = extractOpenAIContentBlocks(msg);
                if (typeof contentBlocks === 'string' && contentBlocks) {
                    blocks.push({ type: 'text', text: contentBlocks });
                } else if (Array.isArray(contentBlocks)) {
                    blocks.push(...contentBlocks);
                }

                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    for (const tc of msg.tool_calls) {
                        let args: Record<string, unknown> = {};
                        try {
                            args = JSON.parse(tc.function.arguments);
                        } catch {
                            args = { input: tc.function.arguments };
                        }
                        blocks.push({
                            type: 'tool_use',
                            id: tc.id,
                            name: tc.function.name,
                            input: args,
                        });
                    }
                }

                rawMessages.push({
                    role: 'assistant',
                    content: blocks.length > 0 ? blocks : (typeof contentBlocks === 'string' ? contentBlocks : ''),
                });
                break;
            }

            case 'tool': {
                rawMessages.push({
                    role: 'user',
                    content: [{
                        type: 'tool_result',
                        tool_use_id: msg.tool_call_id,
                        content: extractOpenAIContent(msg),
                    }] as AnthropicContentBlock[],
                });
                break;
            }
        }
    }

    // Anthropic API  user/assistant 
    const messages = mergeConsecutiveRoles(rawMessages);

    // ★ response_format:  JSON  user 
    if (jsonFormatSuffix) {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                const content = messages[i].content;
                if (typeof content === 'string') {
                    messages[i].content = content + jsonFormatSuffix;
                } else if (Array.isArray(content)) {
                    const lastTextBlock = [...content].reverse().find(b => b.type === 'text');
                    if (lastTextBlock && lastTextBlock.text) {
                        lastTextBlock.text += jsonFormatSuffix;
                    } else {
                        content.push({ type: 'text', text: jsonFormatSuffix.trim() });
                    }
                }
                break;
            }
        }
    }

    //  OpenAI  Cursor 
    const tools: AnthropicTool[] | undefined = body.tools?.map((t: OpenAITool | Record<string, unknown>) => {
        // Cursor IDE { name, description, input_schema }
        if ('function' in t && t.function) {
            const fn = (t as OpenAITool).function;
            return {
                name: fn.name,
                description: fn.description,
                input_schema: fn.parameters || { type: 'object', properties: {} },
            };
        }
        // Cursor 
        const flat = t as Record<string, unknown>;
        return {
            name: (flat.name as string) || '',
            description: flat.description as string | undefined,
            input_schema: (flat.input_schema as Record<string, unknown>) || { type: 'object', properties: {} },
        };
    });

    return {
        model: body.model,
        messages,
        max_tokens: Math.max(body.max_tokens || body.max_completion_tokens || 8192, 8192),
        stream: body.stream,
        system: systemPrompt,
        tools,
        temperature: body.temperature,
        top_p: body.top_p,
        stop_sequences: body.stop
            ? (Array.isArray(body.stop) ? body.stop : [body.stop])
            : undefined,
        // ★ Thinking config.yaml 
        // enabled=true:  thinking
        // enabled=false:  thinking
        // :  'thinking'  reasoning_effort 
        ...(() => {
            const tc = getConfig().thinking;
            if (tc && tc.enabled) return { thinking: { type: 'enabled' as const } };
            if (tc && !tc.enabled) return {};
            //  → 
            const modelHint = body.model?.toLowerCase().includes('thinking');
            const effortHint = !!(body as unknown as Record<string, unknown>).reasoning_effort;
            return (modelHint || effortHint) ? { thinking: { type: 'enabled' as const } } : {};
        })(),
    };
}

/**
 * Anthropic API 
 */
function mergeConsecutiveRoles(messages: AnthropicMessage[]): AnthropicMessage[] {
    if (messages.length <= 1) return messages;

    const merged: AnthropicMessage[] = [];
    for (const msg of messages) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
            //  content
            const lastBlocks = toBlocks(last.content);
            const newBlocks = toBlocks(msg.content);
            last.content = [...lastBlocks, ...newBlocks];
        } else {
            merged.push({ ...msg });
        }
    }
    return merged;
}

/**
 *  content  AnthropicContentBlock 
 */
function toBlocks(content: string | AnthropicContentBlock[]): AnthropicContentBlock[] {
    if (typeof content === 'string') {
        return content ? [{ type: 'text', text: content }] : [];
    }
    return content || [];
}

/**
 *  OpenAI 
 * 
 *   - : { type: 'text'|'input_text', text: '...' }
 *   - OpenAI : { type: 'image_url', image_url: { url: '...' } }
 *   - Anthropic : { type: 'image', source: { type: 'url', url: '...' } }
 *   - : { type: 'input_image', image_url: { url: '...' } }
 */
function extractOpenAIContentBlocks(msg: OpenAIMessage): string | AnthropicContentBlock[] {
    if (msg.content === null || msg.content === undefined) return '';
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
        const blocks: AnthropicContentBlock[] = [];
        for (const p of msg.content as (OpenAIContentPart | Record<string, unknown>)[]) {
            if ((p.type === 'text' || p.type === 'input_text') && (p as OpenAIContentPart).text) {
                blocks.push({ type: 'text', text: (p as OpenAIContentPart).text! });
            } else if (p.type === 'image_url' && (p as OpenAIContentPart).image_url?.url) {
                const url = (p as OpenAIContentPart).image_url!.url;
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        blocks.push({
                            type: 'image',
                            source: { type: 'base64', media_type: match[1], data: match[2] }
                        });
                    }
                } else {
                    // HTTP(S)/local URL —  source.data preprocessImages() /
                    blocks.push({
                        type: 'image',
                        source: { type: 'url', media_type: 'image/jpeg', data: url }
                    });
                }
            } else if (p.type === 'image' && (p as any).source) {
                // ★ Anthropic  OpenAI  Anthropic 
                const source = (p as any).source;
                const imageUrl = source.url || source.data;
                if (source.type === 'base64' && source.data) {
                    blocks.push({
                        type: 'image',
                        source: { type: 'base64', media_type: source.media_type || 'image/jpeg', data: source.data }
                    });
                } else if (imageUrl) {
                    if (imageUrl.startsWith('data:')) {
                        const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            blocks.push({
                                type: 'image',
                                source: { type: 'base64', media_type: match[1], data: match[2] }
                            });
                        }
                    } else {
                        blocks.push({
                            type: 'image',
                            source: { type: 'url', media_type: source.media_type || 'image/jpeg', data: imageUrl }
                        });
                    }
                }
            } else if (p.type === 'input_image' && (p as any).image_url?.url) {
                // ★ input_image  API 
                const url = (p as any).image_url.url;
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        blocks.push({
                            type: 'image',
                            source: { type: 'base64', media_type: match[1], data: match[2] }
                        });
                    }
                } else {
                    blocks.push({
                        type: 'image',
                        source: { type: 'url', media_type: 'image/jpeg', data: url }
                    });
                }
            } else if (p.type === 'image_file' && (p as any).image_file) {
                const fileId = (p as any).image_file.file_id as string | undefined;
                console.log(`[OpenAI] ⚠️  image_file  (file_id: ${fileId || 'unknown'})`);
                throw unsupportedImageFileError(fileId);
            } else if ((p.type === 'image_url' || p.type === 'input_image') && (p as any).url) {
                // ★  URL  url  image_url.url
                const url = (p as any).url as string;
                if (url.startsWith('data:')) {
                    const match = url.match(/^data:([^;]+);base64,(.+)$/);
                    if (match) {
                        blocks.push({
                            type: 'image',
                            source: { type: 'base64', media_type: match[1], data: match[2] }
                        });
                    }
                } else {
                    blocks.push({
                        type: 'image',
                        source: { type: 'url', media_type: 'image/jpeg', data: url }
                    });
                }
            } else if (p.type === 'tool_use') {
                // Anthropic  tool_use 
                blocks.push(p as unknown as AnthropicContentBlock);
            } else if (p.type === 'tool_result') {
                // Anthropic  tool_result 
                blocks.push(p as unknown as AnthropicContentBlock);
            } else {
                // ★ 
                const anyP = p as Record<string, unknown>;
                const possibleUrl = (anyP.url || anyP.file_path || anyP.path ||
                    (anyP.image_url as any)?.url || anyP.data) as string | undefined;
                if (possibleUrl && typeof possibleUrl === 'string') {
                    const looksLikeImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(possibleUrl) ||
                        possibleUrl.startsWith('data:image/');
                    if (looksLikeImage) {
                        console.log(`[OpenAI] 🔄  "${p.type}"  →  image block`);
                        if (possibleUrl.startsWith('data:')) {
                            const match = possibleUrl.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) {
                                blocks.push({
                                    type: 'image',
                                    source: { type: 'base64', media_type: match[1], data: match[2] }
                                });
                            }
                        } else {
                            blocks.push({
                                type: 'image',
                                source: { type: 'url', media_type: 'image/jpeg', data: possibleUrl }
                            });
                        }
                    }
                }
            }
        }
        return blocks.length > 0 ? blocks : '';
    }
    return stringifyUnknownContent(msg.content);
}

/**
 * 
 */
function extractOpenAIContent(msg: OpenAIMessage): string {
    const blocks = extractOpenAIContentBlocks(msg);
    if (typeof blocks === 'string') return blocks;
    return blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// ====================  ====================

export async function handleOpenAIChatCompletions(req: Request, res: Response): Promise<void> {
    const body = req.body as OpenAIChatRequest;

    const log = createRequestLogger({
        method: req.method,
        path: req.path,
        model: body.model,
        stream: !!body.stream,
        hasTools: (body.tools?.length ?? 0) > 0,
        toolCount: body.tools?.length ?? 0,
        messageCount: body.messages?.length ?? 0,
        apiFormat: 'openai',
    });

    log.startPhase('receive', '');
    log.recordOriginalRequest(body);
    log.info('OpenAI', 'receive', ` OpenAI Chat `, {
        model: body.model,
        messageCount: body.messages?.length,
        stream: body.stream,
        toolCount: body.tools?.length ?? 0,
    });

    // ★  content 
    if (body.messages) {
        for (let i = 0; i < body.messages.length; i++) {
            const msg = body.messages[i];
            if (typeof msg.content === 'string') {
                // 
                if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(msg.content)) {
                    console.log(`[OpenAI] 📋 [${i}] role=${msg.role} content=(${msg.content.length}chars) ⚠️ : ${msg.content.substring(0, 200)}`);
                }
            } else if (Array.isArray(msg.content)) {
                const types = (msg.content as any[]).map(p => {
                    if (p.type === 'image_url') return `image_url(${(p.image_url?.url || p.url || '?').substring(0, 60)})`;
                    if (p.type === 'image') return `image(${p.source?.type || '?'})`;
                    if (p.type === 'input_image') return `input_image`;
                    if (p.type === 'image_file') return `image_file`;
                    return p.type;
                });
                if (types.some(t => t !== 'text')) {
                    console.log(`[OpenAI] 📋 [${i}] role=${msg.role} blocks: [${types.join(', ')}]`);
                }
            }
        }
    }

    try {
        // Step 1: OpenAI → Anthropic 
        log.startPhase('convert', ' (OpenAI→Anthropic)');
        const anthropicReq = convertToAnthropicRequest(body);
        log.endPhase();

        //  convertToCursorRequest → preprocessImages() 

        // Step 1.6:  Anthropic handler 
        if (isIdentityProbe(anthropicReq)) {
            log.intercepted(' (OpenAI)');
            const mockText = "I am Claude, an advanced AI programming assistant created by Anthropic. I am ready to help you write code, debug, and answer your technical questions. Please let me know what we should work on!";
            if (body.stream) {
                return handleOpenAIMockStream(res, body, mockText);
            } else {
                return handleOpenAIMockNonStream(res, body, mockText);
            }
        }

        // Step 2: Anthropic → Cursor 
        const cursorReq = await convertToCursorRequest(anthropicReq);

        if (body.stream) {
            await handleOpenAIStream(res, cursorReq, body, anthropicReq);
        } else {
            await handleOpenAINonStream(res, cursorReq, body, anthropicReq);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.fail(message);
        const status = err instanceof OpenAIRequestError ? err.status : 500;
        const type = err instanceof OpenAIRequestError ? err.type : 'server_error';
        const code = err instanceof OpenAIRequestError ? err.code : 'internal_error';
        res.status(status).json({
            error: {
                message,
                type,
                code,
            },
        });
    }
}

// ====================  ====================

function handleOpenAIMockStream(res: Response, body: OpenAIChatRequest, mockText: string): void {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    const id = chatId();
    const created = Math.floor(Date.now() / 1000);
    writeOpenAISSE(res, {
        id, object: 'chat.completion.chunk', created, model: body.model,
        choices: [{ index: 0, delta: { role: 'assistant', content: mockText }, finish_reason: null }],
    });
    writeOpenAISSE(res, {
        id, object: 'chat.completion.chunk', created, model: body.model,
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    });
    res.write('data: [DONE]\n\n');
    res.end();
}

function handleOpenAIMockNonStream(res: Response, body: OpenAIChatRequest, mockText: string): void {
    res.json({
        id: chatId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content: mockText },
            finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 15, completion_tokens: 35, total_tokens: 50 },
    });
}

function writeOpenAITextDelta(
    res: Response,
    id: string,
    created: number,
    model: string,
    text: string,
): void {
    if (!text) return;
    writeOpenAISSE(res, {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
            index: 0,
            delta: { content: text },
            finish_reason: null,
        }],
    });
}

function buildOpenAIUsage(
    anthropicReq: AnthropicRequest,
    outputText: string,
): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
    const promptTokens = estimateInputTokens(anthropicReq);
    const completionTokens = Math.ceil(outputText.length / 3);
    return {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
    };
}

function writeOpenAIReasoningDelta(
    res: Response,
    id: string,
    created: number,
    model: string,
    reasoningContent: string,
): void {
    if (!reasoningContent) return;
    writeOpenAISSE(res, {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
            index: 0,
            delta: { reasoning_content: reasoningContent } as Record<string, unknown>,
            finish_reason: null,
        }],
    });
}

async function handleOpenAIIncrementalTextStream(
    res: Response,
    cursorReq: CursorChatRequest,
    body: OpenAIChatRequest,
    anthropicReq: AnthropicRequest,
    streamMeta: { id: string; created: number; model: string },
): Promise<void> {
    let activeCursorReq = cursorReq;
    let retryCount = 0;
    const thinkingEnabled = anthropicReq.thinking?.type === 'enabled';
    let finalRawResponse = '';
    let finalVisibleText = '';
    let finalReasoningContent = '';
    let streamer = createIncrementalTextStreamer({
        transform: sanitizeResponse,
        isBlockedPrefix: (text) => isRefusal(text.substring(0, 300)),
    });
    let reasoningSent = false;

    const executeAttempt = async (): Promise<{
        rawResponse: string;
        visibleText: string;
        reasoningContent: string;
        streamer: ReturnType<typeof createIncrementalTextStreamer>;
    }> => {
        let rawResponse = '';
        let visibleText = '';
        let leadingBuffer = '';
        let leadingResolved = false;
        let reasoningContent = '';
        const attemptStreamer = createIncrementalTextStreamer({
            transform: sanitizeResponse,
            isBlockedPrefix: (text) => isRefusal(text.substring(0, 300)),
        });

        const flushVisible = (chunk: string): void => {
            if (!chunk) return;
            visibleText += chunk;
            const delta = attemptStreamer.push(chunk);
            if (!delta) return;

            if (thinkingEnabled && reasoningContent && !reasoningSent) {
                writeOpenAIReasoningDelta(res, streamMeta.id, streamMeta.created, streamMeta.model, reasoningContent);
                reasoningSent = true;
            }
            writeOpenAITextDelta(res, streamMeta.id, streamMeta.created, streamMeta.model, delta);
        };

        await sendCursorRequest(activeCursorReq, (event: CursorSSEEvent) => {
            if (event.type !== 'text-delta' || !event.delta) return;

            rawResponse += event.delta;

            if (!leadingResolved) {
                leadingBuffer += event.delta;
                const split = splitLeadingThinkingBlocks(leadingBuffer);

                if (split.startedWithThinking) {
                    if (!split.complete) return;
                    reasoningContent = split.thinkingContent;
                    leadingResolved = true;
                    leadingBuffer = '';
                    flushVisible(split.remainder);
                    return;
                }

                leadingResolved = true;
                const buffered = leadingBuffer;
                leadingBuffer = '';
                flushVisible(buffered);
                return;
            }

            flushVisible(event.delta);
        });

        return {
            rawResponse,
            visibleText,
            reasoningContent,
            streamer: attemptStreamer,
        };
    };

    while (true) {
        const attempt = await executeAttempt();
        finalRawResponse = attempt.rawResponse;
        finalVisibleText = attempt.visibleText;
        finalReasoningContent = attempt.reasoningContent;
        streamer = attempt.streamer;

        const textForRefusalCheck = finalVisibleText;

        if (!streamer.hasSentText() && isRefusal(textForRefusalCheck) && retryCount < MAX_REFUSAL_RETRIES) {
            retryCount++;
            const retryBody = buildRetryRequest(anthropicReq, retryCount - 1);
            activeCursorReq = await convertToCursorRequest(retryBody);
            reasoningSent = false;
            continue;
        }

        break;
    }

    const refusalText = finalVisibleText;
    const usedFallback = !streamer.hasSentText() && isRefusal(refusalText);

    let finalTextToSend: string;
    if (usedFallback) {
        finalTextToSend = isToolCapabilityQuestion(anthropicReq)
            ? refusalFallbackOpenAI(body, 'tools')
            : refusalFallbackOpenAI(body, 'identity');
    } else {
        finalTextToSend = streamer.finish();
    }

    if (!usedFallback && thinkingEnabled && finalReasoningContent && !reasoningSent) {
        writeOpenAIReasoningDelta(res, streamMeta.id, streamMeta.created, streamMeta.model, finalReasoningContent);
        reasoningSent = true;
    }

    writeOpenAITextDelta(res, streamMeta.id, streamMeta.created, streamMeta.model, finalTextToSend);

    writeOpenAISSE(res, {
        id: streamMeta.id,
        object: 'chat.completion.chunk',
        created: streamMeta.created,
        model: streamMeta.model,
        choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
        }],
        usage: buildOpenAIUsage(anthropicReq, streamer.hasSentText() ? (finalVisibleText || finalRawResponse) : finalTextToSend),
    });

    res.write('data: [DONE]\n\n');
    res.end();
}

// ==================== OpenAI SSE  ====================

async function handleOpenAIStream(
    res: Response,
    cursorReq: CursorChatRequest,
    body: OpenAIChatRequest,
    anthropicReq: AnthropicRequest,
): Promise<void> {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const id = chatId();
    const created = Math.floor(Date.now() / 1000);
    const model = body.model;
    const hasTools = (body.tools?.length ?? 0) > 0;

    //  role delta
    writeOpenAISSE(res, {
        id, object: 'chat.completion.chunk', created, model,
        choices: [{
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null,
        }],
    });

    let fullResponse = '';
    let sentText = '';
    let activeCursorReq = cursorReq;
    let retryCount = 0;

    // 
    const executeStream = async (onTextDelta?: (delta: string) => void) => {
        fullResponse = '';
        await sendCursorRequest(activeCursorReq, (event: CursorSSEEvent) => {
            if (event.type !== 'text-delta' || !event.delta) return;
            fullResponse += event.delta;
            onTextDelta?.(event.delta);
        });
    };

    try {
        if (!hasTools && (!body.response_format || body.response_format.type === 'text')) {
            await handleOpenAIIncrementalTextStream(res, cursorReq, body, anthropicReq, { id, created, model });
            return;
        }

        // ★  +  Anthropic handler 
        const thinkingEnabled = anthropicReq.thinking?.type === 'enabled';
        const hybridStreamer = createIncrementalTextStreamer({
            warmupChars: 300,   // ★ 
            transform: sanitizeResponse,
            isBlockedPrefix: (text) => isRefusal(text.substring(0, 300)),
        });
        let toolMarkerDetected = false;
        let pendingText = '';
        let hybridThinkingContent = '';
        let hybridLeadingBuffer = '';
        let hybridLeadingResolved = false;
        const TOOL_MARKER = '```json action';
        const MARKER_LOOKBACK = TOOL_MARKER.length + 2;
        let hybridTextSent = false;
        let hybridReasoningSent = false;

        const pushToStreamer = (text: string): void => {
            if (!text || toolMarkerDetected) return;
            pendingText += text;
            const idx = pendingText.indexOf(TOOL_MARKER);
            if (idx >= 0) {
                const before = pendingText.substring(0, idx);
                if (before) {
                    const d = hybridStreamer.push(before);
                    if (d) {
                        if (thinkingEnabled && hybridThinkingContent && !hybridReasoningSent) {
                            writeOpenAIReasoningDelta(res, id, created, model, hybridThinkingContent);
                            hybridReasoningSent = true;
                        }
                        writeOpenAITextDelta(res, id, created, model, d);
                        hybridTextSent = true;
                    }
                }
                toolMarkerDetected = true;
                pendingText = '';
                return;
            }
            const safeEnd = pendingText.length - MARKER_LOOKBACK;
            if (safeEnd > 0) {
                const safe = pendingText.substring(0, safeEnd);
                pendingText = pendingText.substring(safeEnd);
                const d = hybridStreamer.push(safe);
                if (d) {
                    if (thinkingEnabled && hybridThinkingContent && !hybridReasoningSent) {
                        writeOpenAIReasoningDelta(res, id, created, model, hybridThinkingContent);
                        hybridReasoningSent = true;
                    }
                    writeOpenAITextDelta(res, id, created, model, d);
                    hybridTextSent = true;
                }
            }
        };

        const processHybridDelta = (delta: string): void => {
            if (!hybridLeadingResolved) {
                hybridLeadingBuffer += delta;
                const split = splitLeadingThinkingBlocks(hybridLeadingBuffer);
                if (split.startedWithThinking) {
                    if (!split.complete) return;
                    hybridThinkingContent = split.thinkingContent;
                    hybridLeadingResolved = true;
                    hybridLeadingBuffer = '';
                    pushToStreamer(split.remainder);
                    return;
                }
                if (hybridLeadingBuffer.trimStart().length < 10) return;
                hybridLeadingResolved = true;
                const buffered = hybridLeadingBuffer;
                hybridLeadingBuffer = '';
                pushToStreamer(buffered);
                return;
            }
            pushToStreamer(delta);
        };

        await executeStream(processHybridDelta);

        // flush 
        if (!hybridLeadingResolved && hybridLeadingBuffer) {
            hybridLeadingResolved = true;
            const split = splitLeadingThinkingBlocks(hybridLeadingBuffer);
            if (split.startedWithThinking && split.complete) {
                hybridThinkingContent = split.thinkingContent;
                pushToStreamer(split.remainder);
            } else {
                pushToStreamer(hybridLeadingBuffer);
            }
        }
        if (pendingText && !toolMarkerDetected) {
            const d = hybridStreamer.push(pendingText);
            if (d) {
                if (thinkingEnabled && hybridThinkingContent && !hybridReasoningSent) {
                    writeOpenAIReasoningDelta(res, id, created, model, hybridThinkingContent);
                    hybridReasoningSent = true;
                }
                writeOpenAITextDelta(res, id, created, model, d);
                hybridTextSent = true;
            }
            pendingText = '';
        }
        const hybridRemaining = hybridStreamer.finish();
        if (hybridRemaining) {
            if (thinkingEnabled && hybridThinkingContent && !hybridReasoningSent) {
                writeOpenAIReasoningDelta(res, id, created, model, hybridThinkingContent);
                hybridReasoningSent = true;
            }
            writeOpenAITextDelta(res, id, created, model, hybridRemaining);
            hybridTextSent = true;
        }

        // ★ Thinking 
        let reasoningContent: string | undefined = hybridThinkingContent || undefined;
        if (hasLeadingThinking(fullResponse)) {
            const { thinkingContent: extracted, strippedText } = extractThinking(fullResponse);
            if (extracted) {
                if (thinkingEnabled && !reasoningContent) {
                    reasoningContent = extracted;
                }
                fullResponse = strippedText;
            }
        }

        //  + 
        const shouldRetryRefusal = () => {
            if (hybridTextSent) return false;  // ，
            if (!isRefusal(fullResponse)) return false;
            if (hasTools && hasToolCalls(fullResponse)) return false;
            return true;
        };

        while (shouldRetryRefusal() && retryCount < MAX_REFUSAL_RETRIES) {
            retryCount++;
            const retryBody = buildRetryRequest(anthropicReq, retryCount - 1);
            activeCursorReq = await convertToCursorRequest(retryBody);
            await executeStream();  // 
        }
        if (shouldRetryRefusal()) {
            if (!hasTools) {
                if (isToolCapabilityQuestion(anthropicReq)) {
                    fullResponse = refusalFallbackOpenAI(body, 'tools');
                } else {
                    fullResponse = refusalFallbackOpenAI(body, 'identity');
                }
            } else {
                fullResponse = proseOrJsonFallback(
                    body,
                    'I understand the request. Let me analyze the information and proceed with the appropriate action.',
                );
            }
        }

        // 
        if (hasTools && fullResponse.trim().length < 10 && retryCount < MAX_REFUSAL_RETRIES) {
            retryCount++;
            activeCursorReq = await convertToCursorRequest(anthropicReq);
            await executeStream();
        }

        if (hasTools) {
            fullResponse = await autoContinueCursorToolResponseStream(activeCursorReq, fullResponse, hasTools);
        }

        let finishReason: 'stop' | 'tool_calls' = 'stop';

        // ★  reasoning_content
        if (reasoningContent && !hybridReasoningSent) {
            writeOpenAISSE(res, {
                id, object: 'chat.completion.chunk', created, model,
                choices: [{
                    index: 0,
                    delta: { reasoning_content: reasoningContent } as Record<string, unknown>,
                    finish_reason: null,
                }],
            });
        }

        if (hasTools && hasToolCalls(fullResponse)) {
            const { toolCalls, cleanText } = parseToolCalls(fullResponse);

            if (toolCalls.length > 0) {
                finishReason = 'tool_calls';

                //  — 
                if (!hybridTextSent) {
                    let cleanOutput = isRefusal(cleanText) ? '' : cleanText;
                    cleanOutput = sanitizeResponse(cleanOutput);
                    if (cleanOutput) {
                        writeOpenAISSE(res, {
                            id, object: 'chat.completion.chunk', created, model,
                            choices: [{
                                index: 0,
                                delta: { content: cleanOutput },
                                finish_reason: null,
                            }],
                        });
                    }
                }

                //  name+id arguments
                for (let i = 0; i < toolCalls.length; i++) {
                    const tc = toolCalls[i];
                    const tcId = toolCallId();
                    const argsStr = JSON.stringify(tc.arguments);

                    //  name + id arguments 
                    writeOpenAISSE(res, {
                        id, object: 'chat.completion.chunk', created, model,
                        choices: [{
                            index: 0,
                            delta: {
                                ...(i === 0 ? { content: null } : {}),
                                tool_calls: [{
                                    index: i,
                                    id: tcId,
                                    type: 'function',
                                    function: { name: tc.name, arguments: '' },
                                }],
                            },
                            finish_reason: null,
                        }],
                    });

                    //  arguments (128 /)
                    const CHUNK_SIZE = 128;
                    for (let j = 0; j < argsStr.length; j += CHUNK_SIZE) {
                        writeOpenAISSE(res, {
                            id, object: 'chat.completion.chunk', created, model,
                            choices: [{
                                index: 0,
                                delta: {
                                    tool_calls: [{
                                        index: i,
                                        function: { arguments: argsStr.slice(j, j + CHUNK_SIZE) },
                                    }],
                                },
                                finish_reason: null,
                            }],
                        });
                    }
                }
            } else {
                // 
                if (!hybridTextSent) {
                    let textToSend = fullResponse;
                    if (isRefusal(fullResponse)) {
                        textToSend = proseOrJsonFallback(
                            body,
                            'I understand the request. Let me proceed with the appropriate action. Could you clarify what specific task you would like me to perform?',
                        );
                    } else {
                        textToSend = sanitizeResponse(fullResponse);
                    }
                    writeOpenAISSE(res, {
                        id, object: 'chat.completion.chunk', created, model,
                        choices: [{
                            index: 0,
                            delta: { content: textToSend },
                            finish_reason: null,
                        }],
                    });
                }
            }
        } else {
            //  — 
            if (!hybridTextSent) {
                let sanitized = sanitizeResponse(fullResponse);
                // ★ response_format  markdown 
                if (body.response_format && body.response_format.type !== 'text') {
                    sanitized = stripMarkdownJsonWrapper(sanitized);
                }
                if (sanitized) {
                    writeOpenAISSE(res, {
                        id, object: 'chat.completion.chunk', created, model,
                        choices: [{
                            index: 0,
                            delta: { content: sanitized },
                            finish_reason: null,
                        }],
                    });
                }
            }
        }

        //  chunk usage usage  OpenAI /
        writeOpenAISSE(res, {
            id, object: 'chat.completion.chunk', created, model,
            choices: [{
                index: 0,
                delta: {},
                finish_reason: finishReason,
            }],
            usage: buildOpenAIUsage(anthropicReq, fullResponse),
        });

        res.write('data: [DONE]\n\n');

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        writeOpenAISSE(res, {
            id, object: 'chat.completion.chunk', created, model,
            choices: [{
                index: 0,
                delta: { content: `\n\n[Error: ${message}]` },
                finish_reason: 'stop',
            }],
        });
        res.write('data: [DONE]\n\n');
    }

    res.end();
}

// ====================  ====================

async function handleOpenAINonStream(
    res: Response,
    cursorReq: CursorChatRequest,
    body: OpenAIChatRequest,
    anthropicReq: AnthropicRequest,
): Promise<void> {
    let activeCursorReq = cursorReq;
    let fullText = await sendCursorRequestFull(activeCursorReq);
    const hasTools = (body.tools?.length ?? 0) > 0;

    // 

    // ★ Thinking  —  thinking  isRefusal 
    const thinkingEnabled = anthropicReq.thinking?.type === 'enabled';
    let reasoningContent: string | undefined;
    if (hasLeadingThinking(fullText)) {
        const { thinkingContent: extracted, strippedText } = extractThinking(fullText);
        if (extracted) {
            if (thinkingEnabled) {
                reasoningContent = extracted;
            }
            // thinking 
            fullText = strippedText;
        }
    }

    //  +  thinking 
    const shouldRetry = () =>
        countsAsRefusalForOpenAIRetry(fullText, body) && !(hasTools && hasToolCalls(fullText));

    if (shouldRetry()) {
        for (let attempt = 0; attempt < MAX_REFUSAL_RETRIES; attempt++) {
            // 
            const retryBody = buildRetryRequest(anthropicReq, attempt);
            const retryCursorReq = await convertToCursorRequest(retryBody);
            activeCursorReq = retryCursorReq;
            fullText = await sendCursorRequestFull(activeCursorReq);
            //  thinking
            if (hasLeadingThinking(fullText)) {
                fullText = extractThinking(fullText).strippedText;
            }
            if (!shouldRetry()) break;
        }
        if (shouldRetry()) {
            if (hasTools) {
                // 
                fullText = proseOrJsonFallback(
                    body,
                    'I understand the request. Let me analyze the information and proceed with the appropriate action.',
                );
            } else if (isToolCapabilityQuestion(anthropicReq)) {
                // 
                fullText = refusalFallbackOpenAI(body, 'tools');
            } else {
                // 
                fullText = refusalFallbackOpenAI(body, 'identity');
            }
        }
    }

    if (hasTools) {
        fullText = await autoContinueCursorToolResponseFull(activeCursorReq, fullText, hasTools);
    }

    let content: string | null = fullText;
    let toolCalls: OpenAIToolCall[] | undefined;
    let finishReason: 'stop' | 'tool_calls' = 'stop';

    if (hasTools) {
        const parsed = parseToolCalls(fullText);

        if (parsed.toolCalls.length > 0) {
            finishReason = 'tool_calls';
            // 
            let cleanText = parsed.cleanText;
            if (isRefusal(cleanText)) {
                // 
                cleanText = '';
            }
            content = sanitizeResponse(cleanText) || null;

            toolCalls = parsed.toolCalls.map(tc => ({
                id: toolCallId(),
                type: 'function' as const,
                function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.arguments),
                },
            }));
        } else {
            // 
            if (countsAsRefusalForOpenAIRetry(fullText, body)) {
                content = proseOrJsonFallback(
                    body,
                    'I understand the request. Let me proceed with the appropriate action. Could you clarify what specific task you would like me to perform?',
                );
            } else {
                content = sanitizeResponse(fullText);
            }
        }
    } else {
        // 
        content = sanitizeResponse(fullText);
        // ★ response_format  markdown 
        if (body.response_format && body.response_format.type !== 'text' && content) {
            content = stripMarkdownJsonWrapper(content);
        }
    }

    const response: OpenAIChatCompletion = {
        id: chatId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content,
                ...(toolCalls ? { tool_calls: toolCalls } : {}),
                ...(reasoningContent ? { reasoning_content: reasoningContent } as Record<string, unknown> : {}),
            },
            finish_reason: finishReason,
        }],
        usage: buildOpenAIUsage(anthropicReq, fullText),
    };

    res.json(response);
}

// ====================  ====================

/**
 *  Markdown  JSON 
 *  ```json\n...\n```  ```\n...\n``` 
 */
function stripMarkdownJsonWrapper(text: string): string {
    if (!text) return text;
    const trimmed = text.trim();
    const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n\s*```$/);
    if (match) {
        return match[1].trim();
    }
    return text;
}

function writeOpenAISSE(res: Response, data: OpenAIChatCompletionChunk): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
    }
}

// ==================== /v1/responses  ====================

/**
 *  Responses API SSE 
 * event: {eventType}\ndata: {json}\n\n
 *  Chat Completions  "data: {json}\n\n" Responses API  event: 
 */
function writeResponsesSSE(res: Response, eventType: string, data: Record<string, unknown>): void {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
        (res as unknown as { flush: () => void }).flush();
    }
}

function responsesId(): string {
    return 'resp_' + uuidv4().replace(/-/g, '').substring(0, 24);
}

function responsesItemId(): string {
    return 'item_' + uuidv4().replace(/-/g, '').substring(0, 24);
}

/**
 *  Responses API  response 
 */
function buildResponseObject(
    id: string,
    model: string,
    status: 'in_progress' | 'completed',
    output: Record<string, unknown>[],
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number },
): Record<string, unknown> {
    return {
        id,
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        status,
        model,
        output,
        ...(usage ? { usage } : {}),
    };
}

/**
 *  OpenAI Codex / Responses API  /v1/responses 
 *
 * ★ Responses API  Chat Completions 
 * Codex  event: response.created / response.output_text.delta / response.completed 
 *  data: {"object":"chat.completion.chunk",...} 
 */
export async function handleOpenAIResponses(req: Request, res: Response): Promise<void> {
    try {
        const body = req.body;
        const isStream = (body.stream as boolean) ?? true;

        // Step 1:  Responses → Chat Completions → Anthropic → Cursor
        const chatBody = responsesToChatCompletions(body);
        const anthropicReq = convertToAnthropicRequest(chatBody);
        const cursorReq = await convertToCursorRequest(anthropicReq);

        // 
        if (isIdentityProbe(anthropicReq)) {
            const mockText = "I am Claude, an advanced AI programming assistant created by Anthropic. I am ready to help you write code, debug, and answer your technical questions.";
            if (isStream) {
                return handleResponsesStreamMock(res, body, mockText);
            } else {
                return handleResponsesNonStreamMock(res, body, mockText);
            }
        }

        if (isStream) {
            await handleResponsesStream(res, cursorReq, body, anthropicReq);
        } else {
            await handleResponsesNonStream(res, cursorReq, body, anthropicReq);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[OpenAI] /v1/responses :`, message);
        const status = err instanceof OpenAIRequestError ? err.status : 500;
        const type = err instanceof OpenAIRequestError ? err.type : 'server_error';
        const code = err instanceof OpenAIRequestError ? err.code : 'internal_error';
        res.status(status).json({
            error: { message, type, code },
        });
    }
}

/**
 *  —  (Responses API SSE )
 */
function handleResponsesStreamMock(res: Response, body: Record<string, unknown>, mockText: string): void {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const respId = responsesId();
    const itemId = responsesItemId();
    const model = (body.model as string) || 'gpt-4';

    emitResponsesTextStream(res, respId, itemId, model, mockText, 0, { input_tokens: 15, output_tokens: 35, total_tokens: 50 });
    res.end();
}

/**
 *  —  (Responses API JSON )
 */
function handleResponsesNonStreamMock(res: Response, body: Record<string, unknown>, mockText: string): void {
    const respId = responsesId();
    const itemId = responsesItemId();
    const model = (body.model as string) || 'gpt-4';

    res.json(buildResponseObject(respId, model, 'completed', [{
        id: itemId,
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: mockText, annotations: [] }],
    }], { input_tokens: 15, output_tokens: 35, total_tokens: 50 }));
}

/**
 *  Responses API 
 *  response.created  response.completed 
 */
function emitResponsesTextStream(
    res: Response,
    respId: string,
    itemId: string,
    model: string,
    fullText: string,
    outputIndex: number,
    usage: { input_tokens: number; output_tokens: number; total_tokens: number },
    toolCallItems?: Record<string, unknown>[],
): void {
    //  + 
    const messageItem: Record<string, unknown> = {
        id: itemId,
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: fullText, annotations: [] }],
    };
    const allOutputItems = toolCallItems ? [...toolCallItems, messageItem] : [messageItem];

    // 1. response.created
    writeResponsesSSE(res, 'response.created', buildResponseObject(respId, model, 'in_progress', []));

    // 2. response.in_progress
    writeResponsesSSE(res, 'response.in_progress', buildResponseObject(respId, model, 'in_progress', []));

    // 3.  output item
    writeResponsesSSE(res, 'response.output_item.added', {
        output_index: outputIndex,
        item: {
            id: itemId,
            type: 'message',
            role: 'assistant',
            status: 'in_progress',
            content: [],
        },
    });

    // 4. content part
    writeResponsesSSE(res, 'response.content_part.added', {
        output_index: outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: '', annotations: [] },
    });

    // 5. 
    if (fullText) {
        //  ( 100 )
        const CHUNK_SIZE = 100;
        for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
            writeResponsesSSE(res, 'response.output_text.delta', {
                output_index: outputIndex,
                content_index: 0,
                delta: fullText.slice(i, i + CHUNK_SIZE),
            });
        }
    }

    // 6. response.output_text.done
    writeResponsesSSE(res, 'response.output_text.done', {
        output_index: outputIndex,
        content_index: 0,
        text: fullText,
    });

    // 7. response.content_part.done
    writeResponsesSSE(res, 'response.content_part.done', {
        output_index: outputIndex,
        content_index: 0,
        part: { type: 'output_text', text: fullText, annotations: [] },
    });

    // 8. response.output_item.done (message)
    writeResponsesSSE(res, 'response.output_item.done', {
        output_index: outputIndex,
        item: messageItem,
    });

    // 9. response.completed — ★  Codex 
    writeResponsesSSE(res, 'response.completed', buildResponseObject(respId, model, 'completed', allOutputItems, usage));
}

/**
 * Responses API 
 *
 * ★  Chat Completions 
 * 1.  event:  SSE  data-only
 * 2.  response.completed  Codex  "stream closed before response.completed"
 * 3.  function_call  output item 
 */
async function handleResponsesStream(
    res: Response,
    cursorReq: CursorChatRequest,
    body: Record<string, unknown>,
    anthropicReq: AnthropicRequest,
): Promise<void> {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const respId = responsesId();
    const model = (body.model as string) || 'gpt-4';
    const hasTools = (anthropicReq.tools?.length ?? 0) > 0;

    //  Chat Completions 
    let fullResponse = '';
    let activeCursorReq = cursorReq;
    let retryCount = 0;

    // ★  504
    const keepaliveInterval = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
            if (typeof (res as unknown as { flush: () => void }).flush === 'function') {
                (res as unknown as { flush: () => void }).flush();
            }
        } catch { /* connection already closed */ }
    }, 15000);

    try {
        const executeStream = async () => {
            fullResponse = '';
            await sendCursorRequest(activeCursorReq, (event: CursorSSEEvent) => {
                if (event.type !== 'text-delta' || !event.delta) return;
                fullResponse += event.delta;
            });
        };

        await executeStream();

        // Thinking 
        if (hasLeadingThinking(fullResponse)) {
            const { strippedText } = extractThinking(fullResponse);
            fullResponse = strippedText;
        }

        //  + 
        const shouldRetryRefusal = () => {
            if (!isRefusal(fullResponse)) return false;
            if (hasTools && hasToolCalls(fullResponse)) return false;
            return true;
        };

        while (shouldRetryRefusal() && retryCount < MAX_REFUSAL_RETRIES) {
            retryCount++;
            const retryBody = buildRetryRequest(anthropicReq, retryCount - 1);
            activeCursorReq = await convertToCursorRequest(retryBody);
            await executeStream();
            if (hasLeadingThinking(fullResponse)) {
                fullResponse = extractThinking(fullResponse).strippedText;
            }
        }

        if (shouldRetryRefusal()) {
            if (isToolCapabilityQuestion(anthropicReq)) {
                fullResponse = wantsStructuredJsonRecord(body) ? JSON_TOOLS_FALLBACK : CLAUDE_TOOLS_RESPONSE;
            } else {
                fullResponse = wantsStructuredJsonRecord(body) ? JSON_REFUSAL_FALLBACK : CLAUDE_IDENTITY_RESPONSE;
            }
        }

        if (hasTools) {
            fullResponse = await autoContinueCursorToolResponseStream(activeCursorReq, fullResponse, hasTools);
        }

        // 
        fullResponse = sanitizeResponse(fullResponse);

        //  usage
        const inputTokens = estimateInputTokens(anthropicReq);
        const outputTokens = Math.ceil(fullResponse.length / 3);
        const usage = { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens };

        // ★  + Responses API 
        if (hasTools && hasToolCalls(fullResponse)) {
            const { toolCalls, cleanText } = parseToolCalls(fullResponse);

            if (toolCalls.length > 0) {
                // 1. response.created + response.in_progress
                writeResponsesSSE(res, 'response.created', buildResponseObject(respId, model, 'in_progress', []));
                writeResponsesSSE(res, 'response.in_progress', buildResponseObject(respId, model, 'in_progress', []));

                const allOutputItems: Record<string, unknown>[] = [];
                let outputIndex = 0;

                // 2.  → function_call output item
                for (const tc of toolCalls) {
                    const callId = toolCallId();
                    const fcItemId = responsesItemId();
                    const argsStr = JSON.stringify(tc.arguments);

                    // output_item.added (function_call)
                    writeResponsesSSE(res, 'response.output_item.added', {
                        output_index: outputIndex,
                        item: {
                            id: fcItemId,
                            type: 'function_call',
                            name: tc.name,
                            call_id: callId,
                            arguments: '',
                            status: 'in_progress',
                        },
                    });

                    // function_call_arguments.delta — 
                    const CHUNK_SIZE = 128;
                    for (let j = 0; j < argsStr.length; j += CHUNK_SIZE) {
                        writeResponsesSSE(res, 'response.function_call_arguments.delta', {
                            output_index: outputIndex,
                            delta: argsStr.slice(j, j + CHUNK_SIZE),
                        });
                    }

                    // function_call_arguments.done
                    writeResponsesSSE(res, 'response.function_call_arguments.done', {
                        output_index: outputIndex,
                        arguments: argsStr,
                    });

                    // output_item.done (function_call)
                    const completedFcItem = {
                        id: fcItemId,
                        type: 'function_call',
                        name: tc.name,
                        call_id: callId,
                        arguments: argsStr,
                        status: 'completed',
                    };
                    writeResponsesSSE(res, 'response.output_item.done', {
                        output_index: outputIndex,
                        item: completedFcItem,
                    });

                    allOutputItems.push(completedFcItem);
                    outputIndex++;
                }

                // 3.  message output item
                let textContent = sanitizeResponse(isRefusal(cleanText) ? '' : cleanText);
                if (textContent) {
                    const msgItemId = responsesItemId();
                    writeResponsesSSE(res, 'response.output_item.added', {
                        output_index: outputIndex,
                        item: { id: msgItemId, type: 'message', role: 'assistant', status: 'in_progress', content: [] },
                    });
                    writeResponsesSSE(res, 'response.content_part.added', {
                        output_index: outputIndex, content_index: 0,
                        part: { type: 'output_text', text: '', annotations: [] },
                    });
                    writeResponsesSSE(res, 'response.output_text.delta', {
                        output_index: outputIndex, content_index: 0, delta: textContent,
                    });
                    writeResponsesSSE(res, 'response.output_text.done', {
                        output_index: outputIndex, content_index: 0, text: textContent,
                    });
                    writeResponsesSSE(res, 'response.content_part.done', {
                        output_index: outputIndex, content_index: 0,
                        part: { type: 'output_text', text: textContent, annotations: [] },
                    });
                    const msgItem = {
                        id: msgItemId, type: 'message', role: 'assistant', status: 'completed',
                        content: [{ type: 'output_text', text: textContent, annotations: [] }],
                    };
                    writeResponsesSSE(res, 'response.output_item.done', { output_index: outputIndex, item: msgItem });
                    allOutputItems.push(msgItem);
                }

                // 4. response.completed — ★ Codex 
                writeResponsesSSE(res, 'response.completed', buildResponseObject(respId, model, 'completed', allOutputItems, usage));
            } else {
                // → 
                const msgItemId = responsesItemId();
                emitResponsesTextStream(res, respId, msgItemId, model, fullResponse, 0, usage);
            }
        } else {
            // 
            const msgItemId = responsesItemId();
            emitResponsesTextStream(res, respId, msgItemId, model, fullResponse, 0, usage);
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        //  response.completed Codex 
        try {
            const errorText = `[Error: ${message}]`;
            const errorItemId = responsesItemId();
            writeResponsesSSE(res, 'response.created', buildResponseObject(respId, model, 'in_progress', []));
            writeResponsesSSE(res, 'response.output_item.added', {
                output_index: 0,
                item: { id: errorItemId, type: 'message', role: 'assistant', status: 'in_progress', content: [] },
            });
            writeResponsesSSE(res, 'response.content_part.added', {
                output_index: 0, content_index: 0,
                part: { type: 'output_text', text: '', annotations: [] },
            });
            writeResponsesSSE(res, 'response.output_text.delta', {
                output_index: 0, content_index: 0, delta: errorText,
            });
            writeResponsesSSE(res, 'response.output_text.done', {
                output_index: 0, content_index: 0, text: errorText,
            });
            writeResponsesSSE(res, 'response.content_part.done', {
                output_index: 0, content_index: 0,
                part: { type: 'output_text', text: errorText, annotations: [] },
            });
            writeResponsesSSE(res, 'response.output_item.done', {
                output_index: 0,
                item: { id: errorItemId, type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: errorText, annotations: [] }] },
            });
            writeResponsesSSE(res, 'response.completed', buildResponseObject(respId, model, 'completed', [{
                id: errorItemId, type: 'message', role: 'assistant', status: 'completed',
                content: [{ type: 'output_text', text: errorText, annotations: [] }],
            }], { input_tokens: 0, output_tokens: 10, total_tokens: 10 }));
        } catch { /* ignore double error */ }
    } finally {
        clearInterval(keepaliveInterval);
    }

    res.end();
}

/**
 * Responses API 
 */
async function handleResponsesNonStream(
    res: Response,
    cursorReq: CursorChatRequest,
    body: Record<string, unknown>,
    anthropicReq: AnthropicRequest,
): Promise<void> {
    let activeCursorReq = cursorReq;
    let fullText = await sendCursorRequestFull(activeCursorReq);
    const hasTools = (anthropicReq.tools?.length ?? 0) > 0;

    // Thinking 
    if (hasLeadingThinking(fullText)) {
        fullText = extractThinking(fullText).strippedText;
    }

    //  + 
    const shouldRetry = () => isRefusal(fullText) && !(hasTools && hasToolCalls(fullText));
    if (shouldRetry()) {
        for (let attempt = 0; attempt < MAX_REFUSAL_RETRIES; attempt++) {
            const retryBody = buildRetryRequest(anthropicReq, attempt);
            const retryCursorReq = await convertToCursorRequest(retryBody);
            activeCursorReq = retryCursorReq;
            fullText = await sendCursorRequestFull(activeCursorReq);
            if (hasLeadingThinking(fullText)) {
                fullText = extractThinking(fullText).strippedText;
            }
            if (!shouldRetry()) break;
        }
        if (shouldRetry()) {
            if (isToolCapabilityQuestion(anthropicReq)) {
                fullText = wantsStructuredJsonRecord(body) ? JSON_TOOLS_FALLBACK : CLAUDE_TOOLS_RESPONSE;
            } else {
                fullText = wantsStructuredJsonRecord(body) ? JSON_REFUSAL_FALLBACK : CLAUDE_IDENTITY_RESPONSE;
            }
        }
    }

    if (hasTools) {
        fullText = await autoContinueCursorToolResponseFull(activeCursorReq, fullText, hasTools);
    }

    fullText = sanitizeResponse(fullText);

    const respId = responsesId();
    const model = (body.model as string) || 'gpt-4';
    const inputTokens = estimateInputTokens(anthropicReq);
    const outputTokens = Math.ceil(fullText.length / 3);
    const usage = { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens };

    const output: Record<string, unknown>[] = [];

    if (hasTools && hasToolCalls(fullText)) {
        const { toolCalls, cleanText } = parseToolCalls(fullText);
        for (const tc of toolCalls) {
            output.push({
                id: responsesItemId(),
                type: 'function_call',
                name: tc.name,
                call_id: toolCallId(),
                arguments: JSON.stringify(tc.arguments),
                status: 'completed',
            });
        }
        const textContent = sanitizeResponse(isRefusal(cleanText) ? '' : cleanText);
        if (textContent) {
            output.push({
                id: responsesItemId(),
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'output_text', text: textContent, annotations: [] }],
            });
        }
    } else {
        output.push({
            id: responsesItemId(),
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: fullText, annotations: [] }],
        });
    }

    res.json(buildResponseObject(respId, model, 'completed', output, usage));
}

/**
 *  OpenAI Responses API  Chat Completions 
 *
 * Responses API  `input`  `messages` Chat Completions 
 */
export function responsesToChatCompletions(body: Record<string, unknown>): OpenAIChatRequest {
    const messages: OpenAIMessage[] = [];

    // 
    if (body.instructions && typeof body.instructions === 'string') {
        messages.push({ role: 'system', content: body.instructions });
    }

    //  input
    const input = body.input;
    if (typeof input === 'string') {
        messages.push({ role: 'user', content: input });
    } else if (Array.isArray(input)) {
        for (const item of input as Record<string, unknown>[]) {
            // function_call_output  role  type
            if (item.type === 'function_call_output') {
                messages.push({
                    role: 'tool',
                    content: stringifyUnknownContent(item.output),
                    tool_call_id: (item.call_id as string) || '',
                });
                continue;
            }
            const role = (item.role as string) || 'user';
            if (role === 'system' || role === 'developer') {
                const text = extractOpenAIContent({
                    role: 'system',
                    content: (item.content as string | OpenAIContentPart[] | null) ?? null,
                } as OpenAIMessage);
                messages.push({ role: 'system', content: text });
            } else if (role === 'user') {
                const rawContent = (item.content as string | OpenAIContentPart[] | null) ?? null;
                const normalizedContent = typeof rawContent === 'string'
                    ? rawContent
                    : Array.isArray(rawContent) && rawContent.every(b => b.type === 'input_text')
                        ? rawContent.map(b => b.text || '').join('\n')
                        : rawContent;
                messages.push({
                    role: 'user',
                    content: normalizedContent || '',
                });
            } else if (role === 'assistant') {
                const blocks = Array.isArray(item.content) ? item.content as Array<Record<string, unknown>> : [];
                const text = blocks.filter(b => b.type === 'output_text').map(b => b.text as string).join('\n');
                // 
                const toolCallBlocks = blocks.filter(b => b.type === 'function_call');
                const toolCalls: OpenAIToolCall[] = toolCallBlocks.map(b => ({
                    id: (b.call_id as string) || toolCallId(),
                    type: 'function' as const,
                    function: {
                        name: (b.name as string) || '',
                        arguments: (b.arguments as string) || '{}',
                    },
                }));
                messages.push({
                    role: 'assistant',
                    content: text || null,
                    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
                });
            }
        }
    }

    // 
    const tools: OpenAITool[] | undefined = Array.isArray(body.tools)
        ? (body.tools as Array<Record<string, unknown>>).map(t => {
            if (t.type === 'function') {
                return {
                    type: 'function' as const,
                    function: {
                        name: (t.name as string) || '',
                        description: t.description as string | undefined,
                        parameters: t.parameters as Record<string, unknown> | undefined,
                    },
                };
            }
            return {
                type: 'function' as const,
                function: {
                    name: (t.name as string) || '',
                    description: t.description as string | undefined,
                    parameters: t.parameters as Record<string, unknown> | undefined,
                },
            };
        })
        : undefined;

    return {
        model: (body.model as string) || 'gpt-4',
        messages,
        stream: (body.stream as boolean) ?? true,
        temperature: body.temperature as number | undefined,
        max_tokens: (body.max_output_tokens as number) || 8192,
        tools,
    };
}
