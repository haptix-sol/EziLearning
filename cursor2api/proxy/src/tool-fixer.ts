/**
 * tool-fixer.ts - 
 *
 *  claude-api-2-cursor  tool_use_fixer.py
 *  AI 
 * 1.  (file_path → path)
 * 2. 
 * 3. StrReplace/search_replace 
 */

import { readFileSync, existsSync } from 'fs';

const SMART_DOUBLE_QUOTES = new Set([
    '\u00ab', '\u201c', '\u201d', '\u275e',
    '\u201f', '\u201e', '\u275d', '\u00bb',
]);

const SMART_SINGLE_QUOTES = new Set([
    '\u2018', '\u2019', '\u201a', '\u201b',
]);

/**
 * 
 */
export function normalizeToolArguments(args: Record<string, unknown>): Record<string, unknown> {
    if (!args || typeof args !== 'object') return args;

    // Removed legacy mapping that forcefully converted 'file_path' to 'path'.
    // Claude Code 2.1.71 tools like 'Read' legitimately require 'file_path' as per their schema,
    // and this legacy mapping causes infinite loop failures.

    return args;
}

/**
 *  ASCII 
 */
export function replaceSmartQuotes(text: string): string {
    const chars = [...text];
    return chars.map(ch => {
        if (SMART_DOUBLE_QUOTES.has(ch)) return '"';
        if (SMART_SINGLE_QUOTES.has(ch)) return "'";
        return ch;
    }).join('');
}

function buildFuzzyPattern(text: string): string {
    const parts: string[] = [];
    for (const ch of text) {
        if (SMART_DOUBLE_QUOTES.has(ch) || ch === '"') {
            parts.push('["\u00ab\u201c\u201d\u275e\u201f\u201e\u275d\u00bb]');
        } else if (SMART_SINGLE_QUOTES.has(ch) || ch === "'") {
            parts.push("['\u2018\u2019\u201a\u201b]");
        } else if (ch === ' ' || ch === '\t') {
            parts.push('\\s+');
        } else if (ch === '\\') {
            parts.push('\\\\{1,2}');
        } else {
            parts.push(escapeRegExp(ch));
        }
    }
    return parts.join('');
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 *  StrReplace / search_replace  old_string 
 *
 *  AI  old_string 
 * 
 */
export function repairExactMatchToolArguments(
    toolName: string,
    args: Record<string, unknown>,
): Record<string, unknown> {
    if (!args || typeof args !== 'object') return args;

    const lowerName = (toolName || '').toLowerCase();
    if (!lowerName.includes('str_replace') && !lowerName.includes('search_replace') && !lowerName.includes('strreplace')) {
        return args;
    }

    const oldString = (args.old_string ?? args.old_str) as string | undefined;
    if (!oldString) return args;

    const filePath = (args.path ?? args.file_path) as string | undefined;
    if (!filePath) return args;

    try {
        if (!existsSync(filePath)) return args;
        const content = readFileSync(filePath, 'utf-8');

        if (content.includes(oldString)) return args;

        const pattern = buildFuzzyPattern(oldString);
        const regex = new RegExp(pattern, 'g');
        const matches = [...content.matchAll(regex)];

        if (matches.length !== 1) return args;

        const matchedText = matches[0][0];

        if ('old_string' in args) args.old_string = matchedText;
        else if ('old_str' in args) args.old_str = matchedText;

        const newString = (args.new_string ?? args.new_str) as string | undefined;
        if (newString) {
            const fixed = replaceSmartQuotes(newString);
            if ('new_string' in args) args.new_string = fixed;
            else if ('new_str' in args) args.new_str = fixed;
        }
    } catch {
        // best-effort: 
    }

    return args;
}

/**
 * 
 */
export function fixToolCallArguments(
    toolName: string,
    args: Record<string, unknown>,
): Record<string, unknown> {
    args = normalizeToolArguments(args);
    args = repairExactMatchToolArguments(toolName, args);
    return args;
}
