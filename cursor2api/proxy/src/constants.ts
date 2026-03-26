/**
 * constants.ts — refusal detection, identity probes, canned replies (EziLearning Cursor proxy).
 */

import { getConfig } from './config.js';

// --- Built-in refusal patterns (match → retry) ---
// Add more via config.yaml `refusal_patterns` (appended, not replacing these).

export const REFUSAL_PATTERNS: RegExp[] = [
    // --- English: identity refusal ---
    /Cursor(?:'s)?\s+support\s+assistant/i,
    /support\s+assistant\s+for\s+Cursor/i,
    /I[''']\s*m\s+sorry/i,
    /I\s+am\s+sorry/i,
    /not\s+able\s+to\s+fulfill/i,
    /cannot\s+perform/i,
    /I\s+can\s+only\s+answer/i,
    /I\s+only\s+answer/i,
    /cannot\s+write\s+files/i,
    /pricing[, \s]*or\s*troubleshooting/i,
    /I\s+cannot\s+help\s+with/i,
    /I'm\s+a\s+coding\s+assistant/i,
    /not\s+able\s+to\s+search/i,
    /not\s+in\s+my\s+core/i,
    /outside\s+my\s+capabilities/i,
    /I\s+cannot\s+search/i,
    /focused\s+on\s+software\s+development/i,
    /not\s+able\s+to\s+help\s+with\s+(?:that|this)/i,
    /beyond\s+(?:my|the)\s+scope/i,
    /I'?m\s+not\s+(?:able|designed)\s+to/i,
    /I\s+don't\s+have\s+(?:the\s+)?(?:ability|capability)/i,
    /questions\s+about\s+(?:Cursor|the\s+(?:AI\s+)?code\s+editor)/i,

    // --- English: off-topic refusal ---
    /help\s+with\s+(?:coding|programming)\s+and\s+Cursor/i,
    /Cursor\s+IDE\s+(?:questions|features|related)/i,
    /unrelated\s+to\s+(?:programming|coding)(?:\s+or\s+Cursor)?/i,
    /Cursor[- ]related\s+question/i,
    /(?:ask|please\s+ask)\s+a\s+(?:programming|coding|Cursor)/i,
    /(?:I'?m|I\s+am)\s+here\s+to\s+help\s+with\s+(?:coding|programming)/i,
    /appears\s+to\s+be\s+(?:asking|about)\s+.*?unrelated/i,
    /(?:not|isn't|is\s+not)\s+(?:related|relevant)\s+to\s+(?:programming|coding|software)/i,
    // Narrow: broad "I can help you with things like" matched legitimate JSON/coaching (study plans, etc.)
    /I\s+can\s+help\s+(?:you\s+)?with\s+things\s+like\s+(?:coding|programming|software|Cursor|the\s+editor)/i,

    // --- English: newer phrasing ---
    /isn't\s+something\s+I\s+can\s+help\s+with/i,
    /not\s+something\s+I\s+can\s+help\s+with/i,
    /scoped\s+to\s+answering\s+questions\s+about\s+Cursor/i,
    /falls\s+outside\s+(?:the\s+scope|what\s+I)/i,

    // --- English: injection / social-engineering ---
    /prompt\s+injection\s+attack/i,
    /prompt\s+injection/i,
    /social\s+engineering/i,
    /I\s+need\s+to\s+stop\s+and\s+flag/i,
    /What\s+I\s+will\s+not\s+do/i,
    /What\s+is\s+actually\s+happening/i,
    /replayed\s+against\s+a\s+real\s+system/i,
    /tool-call\s+payloads/i,
    // Narrow: standalone "copy-pasteable JSON" matched legitimate structured outputs
    /copy-pasteable\s+JSON.*(?:inject|attack|payload|replay|another\s+AI)/i,
    /injected\s+into\s+another\s+AI/i,
    /emit\s+tool\s+invocations/i,
    /make\s+me\s+output\s+tool\s+calls/i,

    // --- English: "only two tools" style lock-in ---
    /I\s+(?:only\s+)?have\s+(?:access\s+to\s+)?(?:two|2|read_file|read_dir)\s+tool/i,
    /(?:only|just)\s+(?:two|2)\s+(?:tools?|functions?)\b/i,
    /\bread_file\b.*\bread_dir\b/i,
    /\bread_dir\b.*\bread_file\b/i,

    // --- English: scope / expertise ---
    /(?:outside|beyond)\s+(?:the\s+)?scope\s+of\s+what/i,
    /not\s+(?:within|in)\s+(?:my|the)\s+scope/i,
    /this\s+assistant\s+is\s+(?:focused|scoped)/i,
    /(?:only|just)\s+(?:able|here)\s+to\s+(?:answer|help)/i,
    /I\s+(?:can\s+)?only\s+help\s+with\s+(?:questions|issues)\s+(?:related|about)/i,
    /(?:here|designed)\s+to\s+help\s+(?:with\s+)?(?:questions\s+)?about\s+Cursor/i,
    /not\s+(?:something|a\s+topic)\s+(?:related|specific)\s+to\s+(?:Cursor|coding)/i,
    /outside\s+(?:my|the|your)\s+area\s+of\s+(?:expertise|scope)/i,
    /(?:can[.']?t|cannot|unable\s+to)\s+help\s+with\s+(?:this|that)\s+(?:request|question|topic)/i,
    /scoped\s+to\s+(?:answering|helping)/i,

    // --- CJK: identity refusal ---
    /\u6211\u662f\s*Cursor\s*\u7684?\s*\u652f\u6301\u52a9\u624b/,
    /Cursor\s*\u7684?\s*\u652f\u6301\u7cfb\u7edf/,
    /Cursor\s*(?:\u7f16\u8f91\u5668|IDE)?\s*\u76f8\u5173\u7684?\s*\u95ee\u9898/,
    /\u6211\u7684\u804c\u8d23\u662f\u5e2e\u52a9\u4f60\u89e3\u7b54/,
    /\u6211\u65e0\u6cd5\u900f\u9732/,
    /\u5e2e\u52a9\u4f60\u89e3\u7b54\s*Cursor/,
    /\u8fd0\u884c\u5728\s*Cursor\s*\u7684/,
    /\u4e13\u95e8.*\u56de\u7b54.*(?:Cursor|\u7f16\u8f91\u5668)/,
    /\u6211\u53ea\u80fd\u56de\u7b54/,
    /\u65e0\u6cd5\u63d0\u4f9b.*\u4fe1\u606f/,
    /\u6211\u6ca1\u6709.*\u4e5f\u4e0d\u4f1a\u63d0\u4f9b/,
    /\u529f\u80fd\u4f7f\u7528[、,]\s*\u8d26\u5355/,
    /\u6545\u969c\u6392\u9664/,

    // --- CJK: off-topic ---
    /\u4e0e\s*(?:\u7f16\u7a0b|\u4ee3\u7801|\u5f00\u53d1)\s*\u65e0\u5173/,
    /\u8bf7\u63d0\u95ee.*(?:\u7f16\u7a0b|\u4ee3\u7801|\u5f00\u53d1|\u6280\u672f).*\u95ee\u9898/,
    /\u53ea\u80fd\u5e2e\u52a9.*(?:\u7f16\u7a0b|\u4ee3\u7801|\u5f00\u53d1)/,

    // --- CJK: injection-style ---
    /\u4e0d\u662f.*\u9700\u8981\u6587\u6863\u5316/,
    /\u5de5\u5177\u8c03\u7528\u573a\u666f/,
    /\u8bed\u8a00\u504f\u597d\u8bf7\u6c42/,
    /\u63d0\u4f9b.*\u5177\u4f53\u573a\u666f/,
    /\u5373\u62a5\u9519/,

    // --- CJK: tool availability claims ---
    /\u6709\u4ee5\u4e0b.*?(?:\u4e24|2)\u4e2a.*?\u5de5\u5177/,
    /\u6211\u6709.*?(?:\u4e24|2)\u4e2a\u5de5\u5177/,
    /\u5de5\u5177.*?(?:\u53ea\u6709|\u6709\u4ee5\u4e0b|\u4ec5\u6709).*?(?:\u4e24|2)\u4e2a/,
    /\u53ea\u80fd\u7528.*?read_file/i,
    /\u65e0\u6cd5\u8c03\u7528.*?\u5de5\u5177/,
    /(?:\u4ec5\u9650\u4e8e|\u4ec5\u7528\u4e8e).*?(?:\u67e5\u9605|\u6d4f\u89c8).*?(?:\u6587\u6863|docs)/,
    // --- CJK: tool availability (extra) ---
    /\u53ea\u6709.*?\u8bfb\u53d6.*?Cursor.*?\u5de5\u5177/,
    /\u53ea\u6709.*?\u8bfb\u53d6.*?\u6587\u6863\u7684\u5de5\u5177/,
    /\u65e0\u6cd5\u8bbf\u95ee.*?\u672c\u5730\u6587\u4ef6/,
    /\u65e0\u6cd5.*?\u6267\u884c\u547d\u4ee4/,
    /\u9700\u8981\u5728.*?Claude\s*Code/i,
    /\u9700\u8981.*?CLI.*?\u73af\u5883/i,
    /\u5f53\u524d\u73af\u5883.*?\u53ea\u6709.*?\u5de5\u5177/,
    /\u53ea\u6709.*?read_file.*?read_dir/i,
    /\u53ea\u6709.*?read_dir.*?read_file/i,

    // --- CJK: UI-style refusals ---
    /\u53ea\u80fd\u56de\u7b54.*(?:Cursor|\u7f16\u8f91\u5668).*(?:\u76f8\u5173|\u6709\u5173)/,
    /\u4e13[\u6ce8\u95e8].*(?:\u56de\u7b54|\u5e2e\u52a9|\u89e3\u7b54).*(?:Cursor|\u7f16\u8f91\u5668)/,
    /\u6709\u4ec0\u4e48.*(?:Cursor|\u7f16\u8f91\u5668).*(?:\u95ee\u9898|\u53ef\u4ee5)/,
    /\u65e0\u6cd5\u63d0\u4f9b.*(?:\u63a8\u8350|\u5efa\u8bae|\u5e2e\u52a9)/,
    /(?:\u529f\u80fd\u4f7f\u7528|\u8d26\u6237|\u6545\u969c\u6392\u9664|\u8d26\u53f7|\u8ba2\u9605|\u5957\u9910|\u8ba1\u8d39).*(?:\u7b49|\u95ee\u9898)/,
];

// --- Custom refusal rules (from config.yaml `refusal_patterns`, hot-reloaded) ---

let _customRefusalPatterns: RegExp[] = [];
let _lastRefusalPatternsKey = '';

function getCustomRefusalPatterns(): RegExp[] {
    const config = getConfig();
    const patterns = config.refusalPatterns;
    if (!patterns || patterns.length === 0) return _customRefusalPatterns = [];

    // Cache compiled patterns by key
    const key = patterns.join('\0');
    if (key === _lastRefusalPatternsKey) return _customRefusalPatterns;

    _lastRefusalPatternsKey = key;
    _customRefusalPatterns = [];
    for (const p of patterns) {
        try {
            _customRefusalPatterns.push(new RegExp(p, 'i'));
        } catch {
            _customRefusalPatterns.push(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
            console.warn(`[Config] refusal_patterns: "${p}" is not a valid regex; using literal match`);
        }
    }
    console.log(`[Config] Loaded ${_customRefusalPatterns.length} custom refusal pattern(s)`);
    return _customRefusalPatterns;
}

export function isRefusal(text: string): boolean {
    if (REFUSAL_PATTERNS.some(p => p.test(text))) return true;
    const custom = getCustomRefusalPatterns();
    return custom.length > 0 && custom.some(p => p.test(text));
}

// --- Identity probes (short-circuit to canned reply) ---

export const IDENTITY_PROBE_PATTERNS: RegExp[] = [
    // Short greetings / who-are-you
    /^\s*(who are you\??|\u4f60\u662f\u8c01[\u5440\u554a\u5417]?\??|what is your name\??|\u4f60\u53eb\u4ec0\u4e48\??|\u4f60\u53eb\u4ec0\u4e48\u540d\u5b57\??|what are you\??|\u4f60\u662f\u4ec0\u4e48\??|Introduce yourself\??|\u81ea\u6211\u4ecb\u7ecd\u4e00\u4e0b\??|hi\??|hello\??|hey\??|\u4f60\u597d\??|\u5728\u5417\??|\u54c8\u55bd\??)\s*$/i,
    // Model / identity questions
    /(?:\u4ec0\u4e48|\u54ea\u4e2a|\u5565)\s*\u6a21\u578b/,
    /(?:\u771f\u5b9e|\u5e95\u5c42|\u5b9e\u9645|\u771f\u6b63).{0,10}(?:\u6a21\u578b|\u8eab\u4efd|\u540d\u5b57)/,
    /\u6a21\u578b\s*(?:id|\u540d|\u540d\u79f0|\u540d\u5b57|\u662f\u4ec0\u4e48)/i,
    /(?:what|which)\s+model/i,
    /(?:real|actual|true|underlying)\s+(?:model|identity|name)/i,
    /your\s+(?:model|identity|real\s+name)/i,
    // Platform / runtime
    /\u8fd0\u884c\u5728\s*(?:\u54ea|\u90a3|\u4ec0\u4e48)/,
    /(?:\u54ea\u4e2a|\u4ec0\u4e48)\s*\u5e73\u53f0/,
    /running\s+on\s+(?:what|which)/i,
    /what\s+platform/i,
    // System prompt probes
    /\u7cfb\u7edf\s*\u63d0\u793a\u8bcd/,
    /system\s*prompt/i,
    // CJK / mixed "who are you" variants
    /\u4f60\s*(?:\u5230\u5e95|\u7a76\u7adf|\u771f\u7684|\u771f\u5b9e)\s*\u662f\s*\u8c01/,
    /\u4f60\s*\u662f[^。，,\.]{0,5}(?:AI|\u4eba\u5de5\u667a\u80fd|\u52a9\u624b|\u673a\u5668\u4eba|\u6a21\u578b|Claude|GPT|Gemini)/i,
];

// --- "What tools do you have?" style questions ---

export const TOOL_CAPABILITY_PATTERNS: RegExp[] = [
    /\u4f60\s*(?:\u6709|\u80fd\u7528|\u53ef\u4ee5\u7528)\s*(?:\u54ea\u4e9b|\u4ec0\u4e48|\u51e0\u4e2a)\s*(?:\u5de5\u5177|tools?|functions?)/i,
    /(?:what|which|list).*?tools?/i,
    /\u4f60\s*\u7528\s*(?:\u4ec0\u4e48|\u54ea\u4e2a|\u5565)\s*(?:mcp|\u5de5\u5177)/i,
    /\u4f60\s*(?:\u80fd|\u53ef\u4ee5)\s*(?:\u505a|\u5e72)\s*(?:\u4ec0\u4e48|\u54ea\u4e9b|\u5565)/,
    /(?:what|which).*?(?:capabilities|functions)/i,
    /\u80fd\u529b|\u529f\u80fd/,
];

// --- Canned replies ---

/** Default identity answer (probes / fallback) */
export const CLAUDE_IDENTITY_RESPONSE = `I am Claude, made by Anthropic. I'm an AI assistant designed to be helpful, harmless, and honest. I can help you with a wide range of tasks including writing, analysis, coding, math, and more.

I don't have information about the specific model version or ID being used for this conversation, but I'm happy to help you with whatever you need!`;

/** Answer when the user asks what tools or capabilities are available */
export const CLAUDE_TOOLS_RESPONSE = `As Claude, my core capabilities include:

**General**
- **Code** — read, write, debug across common languages
- **Writing & analysis** — drafts, summaries, translation
- **Data & reasoning** — math, structured reasoning
- **Q&A** — technical and general topics

**Tool use (MCP)**
If your client exposes MCP (Model Context Protocol) tools, I can call them when appropriate — for example search, filesystem actions, or custom servers you configure.

What is available depends on your client setup. Tell me what you want to do and I will use the right approach.`;
