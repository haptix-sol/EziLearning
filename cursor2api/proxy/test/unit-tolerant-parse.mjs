/**
 * test/unit-tolerant-parse.mjs
 *
 * ：tolerantParse  parseToolCalls 
 * ：node test/unit-tolerant-parse.mjs
 *
 * ，。
 */

// ───  dist/  converter（ npm run build）──────────
//  dist， tolerantParse 

// ───  tolerantParse（ src/converter.ts ）──────────────────────
function tolerantParse(jsonStr) {
    try {
        return JSON.parse(jsonStr);
    } catch (_e1) { /* pass */ }

    let inString = false;
    let escaped = false;
    let fixed = '';
    const bracketStack = [];

    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        if (char === '\\' && !escaped) {
            escaped = true;
            fixed += char;
        } else if (char === '"' && !escaped) {
            inString = !inString;
            fixed += char;
            escaped = false;
        } else {
            if (inString) {
                if (char === '\n') fixed += '\\n';
                else if (char === '\r') fixed += '\\r';
                else if (char === '\t') fixed += '\\t';
                else fixed += char;
            } else {
                if (char === '{' || char === '[') bracketStack.push(char === '{' ? '}' : ']');
                else if (char === '}' || char === ']') { if (bracketStack.length > 0) bracketStack.pop(); }
                fixed += char;
            }
            escaped = false;
        }
    }

    if (inString) fixed += '"';
    while (bracketStack.length > 0) fixed += bracketStack.pop();
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');

    try {
        return JSON.parse(fixed);
    } catch (_e2) {
        const lastBrace = fixed.lastIndexOf('}');
        if (lastBrace > 0) {
            try { return JSON.parse(fixed.substring(0, lastBrace + 1)); } catch { /* ignore */ }
        }
        throw _e2;
    }
}

// ───  parseToolCalls（ src/converter.ts ）────────────────────
function parseToolCalls(responseText) {
    const toolCalls = [];
    let cleanText = responseText;

    const fullBlockRegex = /```json(?:\s+action)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = fullBlockRegex.exec(responseText)) !== null) {
        let isToolCall = false;
        try {
            const parsed = tolerantParse(match[1]);
            if (parsed.tool || parsed.name) {
                toolCalls.push({
                    name: parsed.tool || parsed.name,
                    arguments: parsed.parameters || parsed.arguments || parsed.input || {}
                });
                isToolCall = true;
            }
        } catch (e) {
            console.error(`  ⚠  tolerantParse :`, e.message);
        }
        if (isToolCall) cleanText = cleanText.replace(match[0], '');
    }
    return { toolCalls, cleanText: cleanText.trim() };
}

// ─── （）────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅  ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌  ${name}`);
        console.error(`      ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
    const as = JSON.stringify(a), bs = JSON.stringify(b);
    if (as !== bs) throw new Error(msg || `Expected ${bs}, got ${as}`);
}

// ════════════════════════════════════════════════════════════════════
// 1. tolerantParse —  JSON
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [1] tolerantParse —  JSON\n');

test(' JSON ', () => {
    const r = tolerantParse('{"tool":"Read","parameters":{"path":"/foo"}}');
    assertEqual(r.tool, 'Read');
    assertEqual(r.parameters.path, '/foo');
});

test(' JSON', () => {
    const r = tolerantParse(`{
  "tool": "Write",
  "parameters": {
    "file_path": "src/index.ts",
    "content": "hello world"
  }
}`);
    assertEqual(r.tool, 'Write');
});

test('', () => {
    const r = tolerantParse('{}');
    assertEqual(r, {});
});

// ════════════════════════════════════════════════════════════════════
// 2. tolerantParse — （）
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [2] tolerantParse — \n');

test('value  \\n', () => {
    // ：content ， JSON 
    const raw = '{"tool":"Write","parameters":{"content":"line1\nline2\nline3"}}';
    const r = tolerantParse(raw);
    assert(r.parameters.content.includes('\n') || r.parameters.content.includes('\\n'),
        'content ');
});

test('value  \\t', () => {
    const raw = '{"tool":"Bash","parameters":{"command":"echo\there"}}';
    const r = tolerantParse(raw);
    assert(r.parameters.command !== undefined);
});

// ════════════════════════════════════════════════════════════════════
// 3. tolerantParse —  JSON（）
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [3] tolerantParse —  JSON（ / ）\n');

test('', () => {
    // ：，"content" 
    const truncated = '{"tool":"Write","parameters":{"content":"# Accrual Backfill Start Date Implementation Plan\\n\\n> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.\\n\\n**Goal:** Add an optional `backfillStartDate` parameter to the company-level accrual recalculate feature, allowing admins to specify a';
    const r = tolerantParse(truncated);
    // ，content  tool 
    assertEqual(r.tool, 'Write');
    assert(r.parameters !== undefined);
});

test(' }}', () => {
    const truncated = '{"tool":"Read","parameters":{"file_path":"/Users/rain/project/src/index.ts"';
    const r = tolerantParse(truncated);
    assertEqual(r.tool, 'Read');
});

test(' }', () => {
    const truncated = '{"name":"Bash","input":{"command":"ls -la"}';
    const r = tolerantParse(truncated);
    assertEqual(r.name, 'Bash');
});

test('', () => {
    const truncated = '{"tool":"Write","parameters":{"path":"a.ts","content":"export function foo() {\n  return 42;\n}';
    const r = tolerantParse(truncated);
    assertEqual(r.tool, 'Write');
});

test('', () => {
    const withComma = '{"tool":"Read","parameters":{"path":"/foo",},}';
    const r = tolerantParse(withComma);
    assertEqual(r.tool, 'Read');
});

test('tolerant parse: truncated JSON at position ~813', () => {
    // 813 content 
    const longContent = 'A'.repeat(700);
    const truncated = `{"tool":"Write","parameters":{"file_path":"/docs/plan.md","content":"${longContent}`;
    const r = tolerantParse(truncated);
    assertEqual(r.tool, 'Write');
    // content ， JSON 
    assert(typeof r.parameters.content === 'string', 'content ');
});

// ════════════════════════════════════════════════════════════════════
// 4. parseToolCalls —  ```json action 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [4] parseToolCalls — \n');

test(' (tool )', () => {
    const text = `I'll read the file now.

\`\`\`json action
{
  "tool": "Read",
  "parameters": {
    "file_path": "src/index.ts"
  }
}
\`\`\``;
    const { toolCalls, cleanText } = parseToolCalls(text);
    assertEqual(toolCalls.length, 1);
    assertEqual(toolCalls[0].name, 'Read');
    assertEqual(toolCalls[0].arguments.file_path, 'src/index.ts');
    assert(!cleanText.includes('```'), '');
});

test(' (name )', () => {
    const text = `\`\`\`json action
{"name":"Bash","input":{"command":"npm run build"}}
\`\`\``;
    const { toolCalls } = parseToolCalls(text);
    assertEqual(toolCalls.length, 1);
    assertEqual(toolCalls[0].name, 'Bash');
    assertEqual(toolCalls[0].arguments.command, 'npm run build');
});

test('', () => {
    const text = `\`\`\`json action
{"tool":"Read","parameters":{"file_path":"a.ts"}}
\`\`\`

\`\`\`json action
{"tool":"Write","parameters":{"file_path":"b.ts","content":"hello"}}
\`\`\``;
    const { toolCalls } = parseToolCalls(text);
    assertEqual(toolCalls.length, 2);
    assertEqual(toolCalls[0].name, 'Read');
    assertEqual(toolCalls[1].name, 'Write');
});

test('', () => {
    const text = `Let me first read the existing file to understand the structure.

\`\`\`json action
{"tool":"Read","parameters":{"file_path":"src/handler.ts"}}
\`\`\``;
    const { toolCalls, cleanText } = parseToolCalls(text);
    assertEqual(toolCalls.length, 1);
    assert(cleanText.includes('Let me first read'), '');
});

test('', () => {
    const text = 'Here is the answer: 42. No tool calls needed.';
    const { toolCalls, cleanText } = parseToolCalls(text);
    assertEqual(toolCalls.length, 0);
    assertEqual(cleanText, text);
});

test('json  tool call（ json）', () => {
    const text = `Here is an example:
\`\`\`json
{"key":"value","count":42}
\`\`\``;
    const { toolCalls } = parseToolCalls(text);
    assertEqual(toolCalls.length, 0, ' tool/name  JSON ');
});

// ════════════════════════════════════════════════════════════════════
// 5.  parseToolCalls
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [5] parseToolCalls — \n');

test('（block  JSON ）', () => {
    //  ``` ， JSON 
    const text = `\`\`\`json action
{"tool":"Write","parameters":{"file_path":"/docs/plan.md","content":"# Plan\n\nThis is a very long document that got cut at position 813 in the strea
\`\`\``;
    const { toolCalls } = parseToolCalls(text);
    // （ content ）
    assertEqual(toolCalls.length, 1);
    assertEqual(toolCalls[0].name, 'Write');
    console.log(`    →  content 30: "${String(toolCalls[0].arguments.content).substring(0, 30)}..."`);
});

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(55));
console.log(`  : ${passed}  / ${failed}  / ${passed + failed} `);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
