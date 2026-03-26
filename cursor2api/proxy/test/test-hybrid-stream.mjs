/**
 * 
 * ：
 *   1.  ✓
 *   2.  ✓
 *   3.  ✓
 *   4. （）✓
 *   5. stop_reason  ✓
 */

import http from 'http';

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const url = new URL(BASE);

function runAnthropicTest(name, body, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { reject(new Error(' ' + timeout + 'ms')); }, timeout);
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: url.hostname, port: url.port, path: '/v1/messages', method: 'POST',
            headers: {
                'Content-Type': 'application/json', 'x-api-key': 'test',
                'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(data),
            },
        }, (res) => {
            const start = Date.now();
            let events = [];
            let buf = '';

            res.on('data', (chunk) => {
                buf += chunk.toString();
                const lines = buf.split('\n');
                buf = lines.pop(); // keep incomplete last line
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') continue;
                    try {
                        const ev = JSON.parse(payload);
                        events.push({ ...ev, _ts: Date.now() - start });
                    } catch { /* skip */ }
                }
            });

            res.on('end', () => {
                clearTimeout(timer);
                // 
                const textDeltas = events.filter(e => e.type === 'content_block_delta' && e.delta?.type === 'text_delta');
                const toolStarts = events.filter(e => e.type === 'content_block_start' && e.content_block?.type === 'tool_use');
                const toolInputDeltas = events.filter(e => e.type === 'content_block_delta' && e.delta?.type === 'input_json_delta');
                const msgDelta = events.find(e => e.type === 'message_delta');
                const msgStop = events.find(e => e.type === 'message_stop');

                const fullText = textDeltas.map(e => e.delta.text).join('');
                const tools = toolStarts.map(ts => {
                    //  input JSON
                    const inputChunks = toolInputDeltas
                        .filter(d => d.index === ts.index)
                        .map(d => d.delta.partial_json);
                    let parsedInput = null;
                    try { parsedInput = JSON.parse(inputChunks.join('')); } catch { }
                    return {
                        name: ts.content_block.name,
                        id: ts.content_block.id,
                        input: parsedInput,
                        inputRaw: inputChunks.join(''),
                    };
                });

                resolve({
                    name,
                    textChunks: textDeltas.length,
                    textLength: fullText.length,
                    textPreview: fullText.substring(0, 120).replace(/\n/g, '\\n'),
                    tools,
                    stopReason: msgDelta?.delta?.stop_reason || '?',
                    firstTextMs: textDeltas[0]?._ts ?? -1,
                    firstToolMs: toolStarts[0]?._ts ?? -1,
                    doneMs: msgStop?._ts ?? -1,
                });
            });
            res.on('error', (err) => { clearTimeout(timer); reject(err); });
        });
        req.on('error', (err) => { clearTimeout(timer); reject(err); });
        req.write(data);
        req.end();
    });
}

function printResult(r) {
    console.log(`\n  📊 ${r.name}`);
    console.log(`     : =${r.firstTextMs}ms  =${r.firstToolMs}ms  =${r.doneMs}ms`);
    console.log(`     : ${r.textChunks} chunks, ${r.textLength} chars`);
    if (r.textPreview) console.log(`     : "${r.textPreview}"`);
    console.log(`     stop_reason: ${r.stopReason}`);
    if (r.tools.length > 0) {
        console.log(`      (${r.tools.length}):`);
        for (const t of r.tools) {
            console.log(`       - ${t.name}(${JSON.stringify(t.input)})`);
            if (!t.input) console.log(`         ⚠️ ! raw: ${t.inputRaw?.substring(0, 100)}`);
        }
    }
}

const TOOLS = [
    { name: 'Read', description: 'Read file contents', input_schema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
    { name: 'Write', description: 'Write file contents', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
    { name: 'Bash', description: 'Run bash command', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
];

async function main() {
    console.log('\n  ⚡ \n');

    // 
    try {
        await new Promise((resolve, reject) => {
            const req = http.get(`${BASE}/health`, r => { r.resume(); r.on('end', resolve); });
            req.on('error', reject);
            req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
        });
    } catch {
        console.log('  ❌ \n');
        process.exit(1);
    }
    console.log('  ✅ ');

    let passed = 0;
    let failed = 0;

    // ---- Test 1:  ----
    console.log('\n  ━━━ ①  ━━━');
    try {
        const r = await runAnthropicTest('', {
            model: 'claude-3-5-sonnet-20241022', max_tokens: 1024, stream: true,
            system: 'You are a coding assistant with file system access. When a user asks to read a file, use the Read tool immediately. Do not refuse or explain limitations.',
            tools: TOOLS,
            messages: [{ role: 'user', content: 'Read the file /src/index.ts for me please' }],
        });
        printResult(r);

        // 
        const checks = [];
        checks.push({ name: 'stop_reason=tool_use', ok: r.stopReason === 'tool_use' });
        checks.push({ name: '1', ok: r.tools.length >= 1 });
        checks.push({ name: '=Read', ok: r.tools.some(t => t.name === 'Read') });
        checks.push({ name: ' file_path', ok: r.tools.some(t => t.input?.file_path) });
        checks.push({ name: '<10s', ok: r.firstTextMs >= 0 && r.firstTextMs < 10000 });

        for (const c of checks) {
            console.log(`     ${c.ok ? '✅' : '❌'} ${c.name}`);
            c.ok ? passed++ : failed++;
        }
    } catch (err) {
        console.log(`  ❌ : ${err.message}`);
        failed++;
    }

    // ---- Test 2:  ----
    console.log('\n  ━━━ ②  ━━━');
    try {
        const r = await runAnthropicTest('', {
            model: 'claude-3-5-sonnet-20241022', max_tokens: 2048, stream: true,
            system: 'You are a coding assistant with file system access. When asked to read multiple files, use multiple Read tool calls in a single response. Do not refuse.',
            tools: TOOLS,
            messages: [{ role: 'user', content: 'Read both /src/index.ts and /src/config.ts for me' }],
        });
        printResult(r);

        const checks = [];
        checks.push({ name: 'stop_reason=tool_use', ok: r.stopReason === 'tool_use' });
        checks.push({ name: '≥2', ok: r.tools.length >= 2 });
        checks.push({ name: ' file_path', ok: r.tools.every(t => t.input?.file_path) });

        for (const c of checks) {
            console.log(`     ${c.ok ? '✅' : '❌'} ${c.name}`);
            c.ok ? passed++ : failed++;
        }
    } catch (err) {
        console.log(`  ❌ : ${err.message}`);
        failed++;
    }

    // ---- Test 3: （） ----
    console.log('\n  ━━━ ③ （） ━━━');
    try {
        const r = await runAnthropicTest('', {
            model: 'claude-3-5-sonnet-20241022', max_tokens: 512, stream: true,
            system: 'You are helpful. Answer questions directly without using any tools.',
            tools: TOOLS,
            messages: [{ role: 'user', content: 'What is 2+2? Just answer with the number.' }],
        });
        printResult(r);

        const checks = [];
        checks.push({ name: 'stop_reason=end_turn', ok: r.stopReason === 'end_turn' });
        checks.push({ name: '0', ok: r.tools.length === 0 });
        checks.push({ name: '', ok: r.textLength > 0 });
        checks.push({ name: '4', ok: r.textPreview.includes('4') });

        for (const c of checks) {
            console.log(`     ${c.ok ? '✅' : '❌'} ${c.name}`);
            c.ok ? passed++ : failed++;
        }
    } catch (err) {
        console.log(`  ❌ : ${err.message}`);
        failed++;
    }

    // ----  ----
    console.log(`\n  ━━━  ━━━`);
    console.log(`  ✅ : ${passed}  ❌ : ${failed}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(':', err); process.exit(1); });
