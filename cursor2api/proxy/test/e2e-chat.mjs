/**
 * test/e2e-chat.mjs
 *
 * ： (localhost:3010) 
 * 、、
 *
 * ：
 *   1. : npm run dev  ( npm start)
 *   2. node test/e2e-chat.mjs
 *
 * ：PORT=3010 node test/e2e-chat.mjs
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3010}`;
const MODEL = 'claude-3-5-sonnet-20241022';

// ───  ───────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m',
};
const ok  = (s) => `${C.green}✅ ${s}${C.reset}`;
const err = (s) => `${C.red}❌ ${s}${C.reset}`;
const hdr = (s) => `\n${C.bold}${C.cyan}━━━ ${s} ━━━${C.reset}`;
const dim = (s) => `${C.dim}${s}${C.reset}`;

// ───  ───────────────────────────────────────────────────────────────
async function chat(messages, { tools, stream = false, label } = {}) {
    const body = { model: MODEL, max_tokens: 4096, messages, stream };
    if (tools) body.tools = tools;

    const t0 = Date.now();
    const resp = await fetch(`${BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'dummy' },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    if (stream) {
        return await collectStream(resp, t0, label);
    } else {
        const data = await resp.json();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        return { data, elapsed };
    }
}

async function collectStream(resp, t0, label = '') {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let toolCalls = [];
    let stopReason = null;
    let chunkCount = 0;

    process.stdout.write(`    ${C.dim}[stream${label ? ' · ' + label : ''}]${C.reset} `);

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
                const evt = JSON.parse(data);
                if (evt.type === 'content_block_delta') {
                    if (evt.delta?.type === 'text_delta') {
                        fullText += evt.delta.text;
                        chunkCount++;
                        if (chunkCount % 20 === 0) process.stdout.write('.');
                    } else if (evt.delta?.type === 'input_json_delta') {
                        chunkCount++;
                    }
                } else if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
                    toolCalls.push({ name: evt.content_block.name, id: evt.content_block.id, arguments: {} });
                } else if (evt.type === 'message_delta') {
                    stopReason = evt.delta?.stop_reason;
                }
            } catch { /* ignore */ }
        }
    }
    process.stdout.write('\n');

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    return { fullText, toolCalls, stopReason, elapsed, chunkCount };
}

// ───  ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const results = [];

async function test(name, fn) {
    process.stdout.write(`  ${C.blue}▷${C.reset} ${name} ... `);
    const t0 = Date.now();
    try {
        const info = await fn();
        const ms = Date.now() - t0;
        console.log(ok(``) + dim(` (${(ms/1000).toFixed(1)}s)`));
        if (info) console.log(dim(`    → ${info}`));
        passed++;
        results.push({ name, ok: true });
    } catch (e) {
        const ms = Date.now() - t0;
        console.log(err(``) + dim(` (${(ms/1000).toFixed(1)}s)`));
        console.log(`    ${C.red}${e.message}${C.reset}`);
        failed++;
        results.push({ name, ok: false, error: e.message });
    }
}

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
async function checkServer() {
    try {
        const r = await fetch(`${BASE_URL}/v1/models`, { headers: { 'x-api-key': 'dummy' } });
        return r.ok;
    } catch {
        return false;
    }
}

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
console.log(`\n${C.bold}${C.magenta}  EziLearning Cursor proxy — E2E${C.reset}`);
console.log(dim(`  Server: ${BASE_URL}  |  Model: ${MODEL}`));

const online = await checkServer();
if (!online) {
    console.log(`\n${C.red}  Server not running — start with npm run dev or npm start${C.reset}\n`);
    process.exit(1);
}
console.log(ok(``));

// ─────────────────────────────────────────────────────────────────
// A. （）
// ─────────────────────────────────────────────────────────────────
console.log(hdr('A. （）'));

await test('', async () => {
    const { data, elapsed } = await chat([
        { role: 'user', content: '。' }
    ]);
    if (!data.content?.[0]?.text) throw new Error('');
    if (data.stop_reason !== 'end_turn') throw new Error(`stop_reason  end_turn，: ${data.stop_reason}`);
    return `"${data.content[0].text.substring(0, 60)}..." (${elapsed}s)`;
});

await test('', async () => {
    const { data } = await chat([
        { role: 'user', content: 'What is the difference between async/await and Promises in JavaScript? Be concise.' }
    ]);
    if (!data.content?.[0]?.text) throw new Error('');
    return data.content[0].text.substring(0, 60) + '...';
});

await test('', async () => {
    const { data } = await chat([
        { role: 'user', content: 'My name is TestBot. Remember it.' },
        { role: 'assistant', content: 'Got it! I will remember your name is TestBot.' },
        { role: 'user', content: 'What is my name?' },
    ]);
    const text = data.content?.[0]?.text || '';
    if (!text.toLowerCase().includes('testbot')) throw new Error(` TestBot: "${text.substring(0, 100)}"`);
    return text.substring(0, 60) + '...';
});

await test('', async () => {
    const { data } = await chat([
        { role: 'user', content: 'Write a JavaScript function that reverses a string. Return only the code, no explanation.' }
    ]);
    const text = data.content?.[0]?.text || '';
    if (!text.includes('function') && !text.includes('=>')) throw new Error('');
    return ': ' + (text.includes('```') ? '' : '（inline）');
});

// ─────────────────────────────────────────────────────────────────
// B. （）
// ─────────────────────────────────────────────────────────────────
console.log(hdr('B. （）'));

await test('', async () => {
    const { fullText, stopReason, elapsed, chunkCount } = await chat(
        [{ role: 'user', content: '5。' }],
        { stream: true }
    );
    if (!fullText) throw new Error('');
    if (stopReason !== 'end_turn') throw new Error(`stop_reason=${stopReason}`);
    return `${fullText.length}  / ${chunkCount} chunks (${elapsed}s)`;
});

await test('（）', async () => {
    const { fullText, elapsed, chunkCount } = await chat(
        [{ role: 'user', content: '：、、、/、 TypeScript 。，500。' }],
        { stream: true, label: '' }
    );
    if (!fullText || fullText.length < 200) throw new Error(`: ${fullText.length} `);
    return `${fullText.length}  / ${chunkCount} chunks (${elapsed}s)`;
});

// ─────────────────────────────────────────────────────────────────
// C. （）
// ─────────────────────────────────────────────────────────────────
console.log(hdr('C. （）'));

const READ_TOOL = {
    name: 'Read',
    description: 'Read the contents of a file at the given path.',
    input_schema: {
        type: 'object',
        properties: { file_path: { type: 'string', description: 'Absolute path of the file to read.' } },
        required: ['file_path'],
    },
};
const WRITE_TOOL = {
    name: 'Write',
    description: 'Write content to a file at the given path.',
    input_schema: {
        type: 'object',
        properties: {
            file_path: { type: 'string', description: 'Absolute path to write to.' },
            content: { type: 'string', description: 'Text content to write.' },
        },
        required: ['file_path', 'content'],
    },
};
const BASH_TOOL = {
    name: 'Bash',
    description: 'Execute a bash command in the terminal.',
    input_schema: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The command to execute.' } },
        required: ['command'],
    },
};

await test(' — Read file', async () => {
    const { data, elapsed } = await chat(
        [{ role: 'user', content: 'Please read the file at /project/src/index.ts' }],
        { tools: [READ_TOOL] }
    );
    const toolBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
    if (toolBlocks.length === 0) throw new Error(`。: ${JSON.stringify(data.content).substring(0, 200)}`);
    const tc = toolBlocks[0];
    if (tc.name !== 'Read') throw new Error(` Read，: ${tc.name}`);
    return `=${tc.name} file_path=${tc.input?.file_path} (${elapsed}s)`;
});

await test(' — Bash command', async () => {
    const { data, elapsed } = await chat(
        [{ role: 'user', content: 'Run "ls -la" to list the current directory.' }],
        { tools: [BASH_TOOL] }
    );
    const toolBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
    if (toolBlocks.length === 0) throw new Error(`。: ${JSON.stringify(data.content).substring(0, 200)}`);
    const tc = toolBlocks[0];
    return `=${tc.name} command="${tc.input?.command}" (${elapsed}s)`;
});

await test(' — stop_reason = tool_use', async () => {
    const { data } = await chat(
        [{ role: 'user', content: 'Read the file /src/main.ts' }],
        { tools: [READ_TOOL] }
    );
    if (data.stop_reason !== 'tool_use') {
        throw new Error(`stop_reason  tool_use， ${data.stop_reason}`);
    }
    return `stop_reason=${data.stop_reason}`;
});

await test(' tool_result ', async () => {
    // 
    const { data: d1 } = await chat(
        [{ role: 'user', content: 'Read the config file at /app/config.json' }],
        { tools: [READ_TOOL] }
    );
    const toolBlock = d1.content?.find(b => b.type === 'tool_use');
    if (!toolBlock) throw new Error('');

    //  tool_result 
    const { data: d2, elapsed } = await chat([
        { role: 'user', content: 'Read the config file at /app/config.json' },
        { role: 'assistant', content: d1.content },
        {
            role: 'user',
            content: [{
                type: 'tool_result',
                tool_use_id: toolBlock.id,
                content: '{"port":3010,"model":"claude-sonnet-4.6","timeout":120}',
            }]
        }
    ], { tools: [READ_TOOL] });

    const text = d2.content?.find(b => b.type === 'text')?.text || '';
    if (!text) throw new Error('tool_result ');
    return `tool_result : "${text.substring(0, 60)}..." (${elapsed}s)`;
});

// ─────────────────────────────────────────────────────────────────
// D. （）
// ─────────────────────────────────────────────────────────────────
console.log(hdr('D. （）'));

await test(' — Read', async () => {
    const { toolCalls, stopReason, elapsed } = await chat(
        [{ role: 'user', content: 'Please read /project/README.md' }],
        { tools: [READ_TOOL], stream: true, label: '' }
    );
    if (toolCalls.length === 0) throw new Error('');
    if (stopReason !== 'tool_use') throw new Error(`stop_reason  tool_use，: ${stopReason}`);
    return `=${toolCalls[0].name} (${elapsed}s)`;
});

await test(' — Write file（ content ）', async () => {
    const { toolCalls, elapsed } = await chat(
        [{ role: 'user', content: 'Write a new file at /tmp/hello.ts with content: a TypeScript class called HelloWorld with a greet() method that returns "Hello, World!". Include full class definition with constructor and method.' }],
        { tools: [WRITE_TOOL], stream: true, label: 'Write' }
    );
    if (toolCalls.length === 0) throw new Error('');
    const tc = toolCalls[0];
    return `=${tc.name} file_path=${tc.arguments?.file_path} (${elapsed}s)`;
});

await test('（Read + Bash）', async () => {
    const { data } = await chat(
        [{ role: 'user', content: 'I need to check the directory listing and read the package.json file. Please do both.' }],
        { tools: [READ_TOOL, BASH_TOOL] }
    );
    const toolBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
    console.log(dim(`    → ${toolBlocks.length} : ${toolBlocks.map(t => t.name).join(', ')}`));
    // 2（），1
    if (toolBlocks.length === 0) throw new Error('');
    return `${toolBlocks.length} : ${toolBlocks.map(t => `${t.name}(${JSON.stringify(t.input).substring(0,30)})`).join(' | ')}`;
});

// ─────────────────────────────────────────────────────────────────
// E.  / 
// ─────────────────────────────────────────────────────────────────
console.log(hdr('E.  / '));

await test('（ Cursor）', async () => {
    const { data } = await chat([
        { role: 'user', content: 'Who are you?' }
    ]);
    const text = data.content?.[0]?.text || '';
    if (text.toLowerCase().includes('cursor') && !text.toLowerCase().includes('cursor ide')) {
        throw new Error(` Cursor : "${text.substring(0, 150)}"`);
    }
    return `: "${text.substring(0, 80)}..."`;
});

await test('/v1/models ', async () => {
    const r = await fetch(`${BASE_URL}/v1/models`, { headers: { 'x-api-key': 'dummy' } });
    const data = await r.json();
    if (!data.data || data.data.length === 0) throw new Error('models ');
    return `: ${data.data.map(m => m.id).join(', ')}`;
});

await test('/v1/messages/count_tokens ', async () => {
    const r = await fetch(`${BASE_URL}/v1/messages/count_tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'dummy' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'Hello world' }] }),
    });
    const data = await r.json();
    if (typeof data.input_tokens !== 'number') throw new Error(`input_tokens : ${JSON.stringify(data)}`);
    return `input_tokens=${data.input_tokens}`;
});

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${'═'.repeat(60)}`);
console.log(`${C.bold}  : ${C.green}${passed} ${C.reset}${C.bold} / ${failed > 0 ? C.red : ''}${failed} ${C.reset}${C.bold} / ${total} ${C.reset}`);
console.log('═'.repeat(60) + '\n');

if (failed > 0) {
    console.log(`${C.red}:${C.reset}`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    console.log();
    process.exit(1);
}
