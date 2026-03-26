/**
 * test/unit-tool-fixer.mjs
 *
 * ：tool-fixer 
 * ：node test/unit-tool-fixer.mjs
 */

// ─── （ src/tool-fixer.ts ， dist）──────────────

const SMART_DOUBLE_QUOTES = new Set([
    '\u00ab', '\u201c', '\u201d', '\u275e',
    '\u201f', '\u201e', '\u275d', '\u00bb',
]);
const SMART_SINGLE_QUOTES = new Set([
    '\u2018', '\u2019', '\u201a', '\u201b',
]);

function normalizeToolArguments(args) {
    if (!args || typeof args !== 'object') return args;
    // Removed legacy file_path to path conversion
    return args;
}

function replaceSmartQuotes(text) {
    const chars = [...text];
    return chars.map(ch => {
        if (SMART_DOUBLE_QUOTES.has(ch)) return '"';
        if (SMART_SINGLE_QUOTES.has(ch)) return "'";
        return ch;
    }).join('');
}

function fixToolCallArguments(toolName, args) {
    args = normalizeToolArguments(args);
    // repairExactMatchToolArguments is skipped in unit test (needs file system)
    return args;
}

// ───  ──────────────────────────────────────────────────────────
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
// 1. normalizeToolArguments — 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [1] normalizeToolArguments — \n');

test('file_pathpath', () => {
    const args = { file_path: 'src/index.ts', content: 'hello' };
    const result = normalizeToolArguments(args);
    assertEqual(result.file_path, 'src/index.ts', ' file_path');
    assert(!('path' in result), ' path');
    assertEqual(result.content, 'hello');
});

test('', () => {
    const args = { file_path: 'old.ts', path: 'new.ts' };
    const result = normalizeToolArguments(args);
    assertEqual(result.path, 'new.ts');
    assert('file_path' in result);
});

test(' file_path ', () => {
    const args = { path: 'foo.ts', content: 'bar' };
    const result = normalizeToolArguments(args);
    assertEqual(result.path, 'foo.ts');
    assertEqual(result.content, 'bar');
});

test('null/undefined ', () => {
    assertEqual(normalizeToolArguments(null), null);
    assertEqual(normalizeToolArguments(undefined), undefined);
});

test('', () => {
    const result = normalizeToolArguments({});
    assertEqual(result, {});
});

// ════════════════════════════════════════════════════════════════════
// 2. replaceSmartQuotes — 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [2] replaceSmartQuotes — \n');

test(' → ', () => {
    const input = '\u201c\u201d';
    assertEqual(replaceSmartQuotes(input), '""');
});

test(' → ', () => {
    const input = '\u2018hello\u2019';
    assertEqual(replaceSmartQuotes(input), "'hello'");
});

test('', () => {
    const input = '\u201cHello\u201d and \u2018World\u2019';
    assertEqual(replaceSmartQuotes(input), '"Hello" and \'World\'');
});

test('', () => {
    const input = '"normal" and \'single\'';
    assertEqual(replaceSmartQuotes(input), input);
});

test('', () => {
    assertEqual(replaceSmartQuotes(''), '');
});

test(' « »', () => {
    const input = '\u00abBonjour\u00bb';
    assertEqual(replaceSmartQuotes(input), '"Bonjour"');
});

test('', () => {
    const input = 'const name = \u201cClaude\u201d;';
    assertEqual(replaceSmartQuotes(input), 'const name = "Claude";');
});

// ════════════════════════════════════════════════════════════════════
// 3. fixToolCallArguments — 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [3] fixToolCallArguments — \n');

test('Read : file_path  file_path', () => {
    const args = { file_path: 'src/main.ts' };
    const result = fixToolCallArguments('Read', args);
    assertEqual(result.file_path, 'src/main.ts');
    assert(!('path' in result));
});

test('Write : file_path + content ', () => {
    const args = { file_path: 'test.ts', content: 'console.log("hello")' };
    const result = fixToolCallArguments('Write', args);
    assertEqual(result.file_path, 'test.ts');
    assertEqual(result.content, 'console.log("hello")');
});

test('Bash : ', () => {
    const args = { command: 'ls -la' };
    const result = fixToolCallArguments('Bash', args);
    assertEqual(result.command, 'ls -la');
});

test('', () => {
    assertEqual(fixToolCallArguments('Read', null), null);
    assertEqual(fixToolCallArguments('Read', undefined), undefined);
});

// ════════════════════════════════════════════════════════════════════
// 4. parseToolCalls with fixToolCallArguments — 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [4] parseToolCalls + fixToolCallArguments \n');

function tolerantParse(jsonStr) {
    try { return JSON.parse(jsonStr); } catch { /* pass */ }
    let inString = false, escaped = false, fixed = '';
    const bracketStack = [];
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        if (char === '\\' && !escaped) { escaped = true; fixed += char; }
        else if (char === '"' && !escaped) { inString = !inString; fixed += char; escaped = false; }
        else { if (inString) { if (char === '\n') fixed += '\\n'; else if (char === '\r') fixed += '\\r'; else if (char === '\t') fixed += '\\t'; else fixed += char; } else { if (char === '{' || char === '[') bracketStack.push(char === '{' ? '}' : ']'); else if (char === '}' || char === ']') { if (bracketStack.length > 0) bracketStack.pop(); } fixed += char; } escaped = false; }
    }
    if (inString) fixed += '"';
    while (bracketStack.length > 0) fixed += bracketStack.pop();
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch (_e2) {
        const lastBrace = fixed.lastIndexOf('}');
        if (lastBrace > 0) { try { return JSON.parse(fixed.substring(0, lastBrace + 1)); } catch { } }
        throw _e2;
    }
}

function parseToolCallsWithFix(responseText) {
    const toolCalls = [];
    let cleanText = responseText;
    const fullBlockRegex = /```json(?:\s+action)?\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = fullBlockRegex.exec(responseText)) !== null) {
        let isToolCall = false;
        try {
            const parsed = tolerantParse(match[1]);
            if (parsed.tool || parsed.name) {
                const name = parsed.tool || parsed.name;
                let args = parsed.parameters || parsed.arguments || parsed.input || {};
                args = fixToolCallArguments(name, args);
                toolCalls.push({ name, arguments: args });
                isToolCall = true;
            }
        } catch (e) { /* skip */ }
        if (isToolCall) cleanText = cleanText.replace(match[0], '');
    }
    return { toolCalls, cleanText: cleanText.trim() };
}

test(' file_path  →  file_path', () => {
    const text = `I'll read the file now.

\`\`\`json action
{
  "tool": "Read",
  "parameters": {
    "file_path": "src/index.ts"
  }
}
\`\`\``;
    const { toolCalls } = parseToolCallsWithFix(text);
    assertEqual(toolCalls.length, 1);
    assertEqual(toolCalls[0].name, 'Read');
    assertEqual(toolCalls[0].arguments.file_path, 'src/index.ts');
    assert(!('path' in toolCalls[0].arguments), ' path');
});

test('', () => {
    const text = `\`\`\`json action
{"tool":"Read","parameters":{"file_path":"a.ts"}}
\`\`\`

\`\`\`json action
{"tool":"Write","parameters":{"file_path":"b.ts","content":"hello"}}
\`\`\``;
    const { toolCalls } = parseToolCallsWithFix(text);
    assertEqual(toolCalls.length, 2);
    assertEqual(toolCalls[0].arguments.file_path, 'a.ts');
    assertEqual(toolCalls[1].arguments.file_path, 'b.ts');
    assertEqual(toolCalls[1].arguments.content, 'hello');
});

test('', () => {
    const text = `\`\`\`json action
{"tool":"Bash","parameters":{"command":"npm run build"}}
\`\`\``;
    const { toolCalls } = parseToolCallsWithFix(text);
    assertEqual(toolCalls.length, 1);
    assertEqual(toolCalls[0].arguments.command, 'npm run build');
});

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(55));
console.log(`  : ${passed}  / ${failed}  / ${passed + failed} `);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
