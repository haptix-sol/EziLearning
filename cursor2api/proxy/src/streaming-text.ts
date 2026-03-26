/**
 * streaming-text.ts - 
 *
 * 
 * 1. “”
 * 2. 
 * 3.  chunk 
 */

export interface LeadingThinkingSplit {
    startedWithThinking: boolean;
    complete: boolean;
    thinkingContent: string;
    remainder: string;
}

export interface IncrementalTextStreamerOptions {
    warmupChars?: number;
    guardChars?: number;
    transform?: (text: string) => string;
    isBlockedPrefix?: (text: string) => boolean;
}

export interface IncrementalTextStreamer {
    push(chunk: string): string;
    finish(): string;
    hasUnlocked(): boolean;
    hasSentText(): boolean;
    getRawText(): string;
}

const THINKING_OPEN = '<thinking>';
const THINKING_CLOSE = '</thinking>';
const DEFAULT_WARMUP_CHARS = 96;
const DEFAULT_GUARD_CHARS = 256;
const STREAM_START_BOUNDARY_RE = /[\n。！？.!?]/;

/**
 *  thinking 。
 *
 * ★  indexOf + lastIndexOf  thinking 
 *    </thinking> 。
 */
export function stripThinkingTags(text: string): string {
    if (!text || !text.includes(THINKING_OPEN)) return text;
    const startIdx = text.indexOf(THINKING_OPEN);
    const endIdx = text.lastIndexOf(THINKING_CLOSE);
    if (endIdx > startIdx) {
        return (text.slice(0, startIdx) + text.slice(endIdx + THINKING_CLOSE.length)).trim();
    }
    // →  <thinking> 
    return text.slice(0, startIdx).trim();
}

/**
 * Whether the text starts with a leading <thinking> block (leading whitespace allowed).
 * Uses anchored matching instead of includes('<thinking>') so literal tags in user
 * text or body do not false-trigger extractThinking.
 */
export function hasLeadingThinking(text: string): boolean {
    if (!text) return false;
    return /^\s*<thinking>/.test(text);
}

/**
 * “ thinking ”。
 *
 * Cursor  thinking 。
 *  thinking 。
 */
export function splitLeadingThinkingBlocks(text: string): LeadingThinkingSplit {
    if (!text) {
        return {
            startedWithThinking: false,
            complete: false,
            thinkingContent: '',
            remainder: '',
        };
    }

    const trimmed = text.trimStart();
    if (!trimmed.startsWith(THINKING_OPEN)) {
        return {
            startedWithThinking: false,
            complete: false,
            thinkingContent: '',
            remainder: text,
        };
    }

    let cursor = trimmed;
    const thinkingParts: string[] = [];

    while (cursor.startsWith(THINKING_OPEN)) {
        const closeIndex = cursor.indexOf(THINKING_CLOSE, THINKING_OPEN.length);
        if (closeIndex === -1) {
            return {
                startedWithThinking: true,
                complete: false,
                thinkingContent: '',
                remainder: '',
            };
        }

        const content = cursor.slice(THINKING_OPEN.length, closeIndex).trim();
        if (content) thinkingParts.push(content);
        cursor = cursor.slice(closeIndex + THINKING_CLOSE.length).trimStart();
    }

    return {
        startedWithThinking: true,
        complete: true,
        thinkingContent: thinkingParts.join('\n\n'),
        remainder: cursor,
    };
}

/**
 * 。
 *
 * 
 * - 
 * -  guardChars“”
 * -  finish() 
 */
export function createIncrementalTextStreamer(
    options: IncrementalTextStreamerOptions = {},
): IncrementalTextStreamer {
    const warmupChars = options.warmupChars ?? DEFAULT_WARMUP_CHARS;
    const guardChars = options.guardChars ?? DEFAULT_GUARD_CHARS;
    const transform = options.transform ?? ((text: string) => text);
    const isBlockedPrefix = options.isBlockedPrefix ?? (() => false);

    let rawText = '';
    let sentText = '';
    let unlocked = false;
    let sentAny = false;

    const tryUnlock = (): boolean => {
        if (unlocked) return true;

        const preview = transform(rawText);
        if (!preview.trim()) return false;

        const hasBoundary = STREAM_START_BOUNDARY_RE.test(preview);
        const enoughChars = preview.length >= warmupChars;
        if (!hasBoundary && !enoughChars) {
            return false;
        }

        if (isBlockedPrefix(preview.trim())) {
            return false;
        }

        unlocked = true;
        return true;
    };

    const emitFromRawLength = (rawLength: number): string => {
        const transformed = transform(rawText.slice(0, rawLength));
        if (transformed.length <= sentText.length) return '';

        const delta = transformed.slice(sentText.length);
        sentText = transformed;
        if (delta) sentAny = true;
        return delta;
    };

    return {
        push(chunk: string): string {
            if (!chunk) return '';

            rawText += chunk;
            if (!tryUnlock()) return '';

            const safeRawLength = Math.max(0, rawText.length - guardChars);
            if (safeRawLength <= 0) return '';

            return emitFromRawLength(safeRawLength);
        },

        finish(): string {
            if (!rawText) return '';
            return emitFromRawLength(rawText.length);
        },

        hasUnlocked(): boolean {
            return unlocked;
        },

        hasSentText(): boolean {
            return sentAny;
        },

        getRawText(): string {
            return rawText;
        },
    };
}
