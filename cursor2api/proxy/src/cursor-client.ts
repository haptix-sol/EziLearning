/**
 * cursor-client.ts - Cursor API 
 *
 * 
 * 1.  https://cursor.com/api/chat Chrome TLS  headers
 * 2.  SSE 
 * 3.  2 
 *
 * x-is-human token  Cursor 。
 */

import type { CursorChatRequest, CursorSSEEvent } from './types.js';
import { getConfig } from './config.js';
import { getProxyFetchOptions } from './proxy-agent.js';

const CURSOR_CHAT_API = 'https://cursor.com/api/chat';

// Chrome 
function getChromeHeaders(): Record<string, string> {
    const config = getConfig();
    return {
        'Content-Type': 'application/json',
        'sec-ch-ua-platform': '"Windows"',
        'x-path': '/api/chat',
        'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        'x-method': 'POST',
        'sec-ch-ua-bitness': '"64"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-platform-version': '"19.0.0"',
        'origin': 'https://cursor.com',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://cursor.com/',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'priority': 'u=1, i',
        'user-agent': config.fingerprint.userAgent,
        'x-is-human': '',  // Cursor 
    };
}

// ==================== API  ====================

/**
 *  Cursor /api/chat 
 */
export async function sendCursorRequest(
    req: CursorChatRequest,
    onChunk: (event: CursorSSEEvent) => void,
    externalSignal?: AbortSignal,
): Promise<void> {
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await sendCursorRequestInner(req, onChunk, externalSignal);
            return;
        } catch (err) {
            // 
            if (externalSignal?.aborted) throw err;
            // ★  — 
            if (err instanceof Error && err.message === 'DEGENERATE_LOOP_ABORTED') return;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[Cursor]  (${attempt}/${maxRetries}): ${msg.substring(0, 100)}`);
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 2000));
            } else {
                throw err;
            }
        }
    }
}

async function sendCursorRequestInner(
    req: CursorChatRequest,
    onChunk: (event: CursorSSEEvent) => void,
    externalSignal?: AbortSignal,
): Promise<void> {
    const headers = getChromeHeaders();

    //  handler 

    const config = getConfig();
    const controller = new AbortController();
    //  controller
    if (externalSignal) {
        if (externalSignal.aborted) { controller.abort(); }
        else { externalSignal.addEventListener('abort', () => controller.abort(), { once: true }); }
    }

    // ★ Idle Timeout。
    // 。
    // 、。
    const IDLE_TIMEOUT_MS = config.timeout * 1000; //  timeout 
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            console.warn(`[Cursor] （${config.timeout}s ），`);
            controller.abort();
        }, IDLE_TIMEOUT_MS);
    };

    // 
    resetIdleTimer();

    try {
        const resp = await fetch(CURSOR_CHAT_API, {
            method: 'POST',
            headers,
            body: JSON.stringify(req),
            signal: controller.signal,
            ...getProxyFetchOptions(),
        } as any);

        if (!resp.ok) {
            const body = await resp.text();
            throw new Error(`Cursor API : HTTP ${resp.status} - ${body}`);
        }

        if (!resp.body) {
            throw new Error('Cursor API  body');
        }

        //  SSE 
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Degenerate repeat detector: model may loop on junk tokens (e.g. </s>)
        // Abort the stream when the same delta repeats too many times
        let lastDelta = '';
        let repeatCount = 0;
        const REPEAT_THRESHOLD = 8;       //  delta  8  → 
        let degenerateAborted = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 
            resetIdleTimer();

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                    const event: CursorSSEEvent = JSON.parse(data);

                    // ★ 
                    if (event.type === 'text-delta' && event.delta) {
                        const trimmedDelta = event.delta.trim();
                        //  token
                        if (trimmedDelta.length > 0 && trimmedDelta.length <= 20) {
                            if (trimmedDelta === lastDelta) {
                                repeatCount++;
                                if (repeatCount >= REPEAT_THRESHOLD) {
                                    console.warn(`[Cursor] ⚠️ : "${trimmedDelta}"  ${repeatCount} ，`);
                                    degenerateAborted = true;
                                    //  delta
                                    reader.cancel();
                                    break;
                                }
                            } else {
                                lastDelta = trimmedDelta;
                                repeatCount = 1;
                            }
                        } else {
                            //  → 
                            lastDelta = '';
                            repeatCount = 0;
                        }
                    }

                    onChunk(event);
                } catch {
                    //  JSON 
                }
            }

            if (degenerateAborted) break;
        }

        // ★  sendCursorRequest 
        if (degenerateAborted) {
            throw new Error('DEGENERATE_LOOP_ABORTED');
        }

        //  buffer
        if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim();
            if (data) {
                try {
                    const event: CursorSSEEvent = JSON.parse(data);
                    onChunk(event);
                } catch { /* ignore */ }
            }
        }
    } finally {
        if (idleTimer) clearTimeout(idleTimer);
    }
}

/**
 * 
 */
export async function sendCursorRequestFull(req: CursorChatRequest): Promise<string> {
    let fullText = '';
    await sendCursorRequest(req, (event) => {
        if (event.type === 'text-delta' && event.delta) {
            fullText += event.delta;
        }
    });
    return fullText;
}
