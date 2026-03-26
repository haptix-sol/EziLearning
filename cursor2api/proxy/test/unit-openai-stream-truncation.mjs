import { autoContinueCursorToolResponseStream } from '../dist/handler.js';
import { parseToolCalls } from '../dist/converter.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    Promise.resolve()
        .then(fn)
        .then(() => {
            console.log(`  ✅ ${name}`);
            passed++;
        })
        .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ ${name}`);
            console.error(`      ${message}`);
            failed++;
        });
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        throw new Error(message || `Expected ${b}, got ${a}`);
    }
}

function buildCursorReq() {
    return {
        model: 'claude-sonnet-4-5',
        id: 'req_test',
        trigger: 'user',
        messages: [
            {
                id: 'msg_user',
                role: 'user',
                parts: [{ type: 'text', text: 'Write a long file.' }],
            },
        ],
    };
}

function createSseResponse(deltas) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const delta of deltas) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text-delta', delta })}\n\n`));
            }
            controller.close();
        },
    });

    return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
    });
}

const pending = [];

console.log('\n📦 OpenAI \n');

pending.push((async () => {
    const originalFetch = global.fetch;
    const fetchCalls = [];

    try {
        global.fetch = async (url, init) => {
            fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });

            return createSseResponse([
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
                '"\n  }\n}\n```',
            ]);
        };

        const initialResponse = [
            '。',
            '',
            '```json action',
            '{',
            '  "tool": "Write",',
            '  "parameters": {',
            '    "file_path": "/tmp/long.txt",',
            '    "content": "AAAA' + 'A'.repeat(1800),
        ].join('\n');

        const fullResponse = await autoContinueCursorToolResponseStream(buildCursorReq(), initialResponse, true);
        const parsed = parseToolCalls(fullResponse);

        assertEqual(fetchCalls.length, 1, ' Write ');
        assertEqual(parsed.toolCalls.length, 1, '');
        assertEqual(parsed.toolCalls[0].name, 'Write');
        assert(typeof fetchCalls[0].body?.messages?.at(-1)?.parts?.[0]?.text === 'string', ' user ');
        assert(fetchCalls[0].body.messages.at(-1).parts[0].text.includes('Continue EXACTLY from where you stopped'), '');

        const content = String(parsed.toolCalls[0].arguments.content || '');
        assert(content.startsWith('AAAA'), '');
        assert(content.includes('BBBB'), '');

        const argsStr = JSON.stringify(parsed.toolCalls[0].arguments);
        const CHUNK_SIZE = 128;
        const chunks = [];
        for (let j = 0; j < argsStr.length; j += CHUNK_SIZE) {
            chunks.push(argsStr.slice(j, j + CHUNK_SIZE));
        }
        assert(chunks.length > 1, ' Write  OpenAI  tool_calls');
        assertEqual(chunks.join(''), argsStr, ' arguments');

        console.log('  ✅  Write  tool_calls');
        passed++;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('  ❌  Write  tool_calls');
        console.error(`      ${message}`);
        failed++;
    } finally {
        global.fetch = originalFetch;
    }
})());

pending.push((async () => {
    const originalFetch = global.fetch;
    let fetchCount = 0;

    try {
        global.fetch = async () => {
            fetchCount++;
            throw new Error('');
        };

        const initialResponse = [
            '```json action',
            '{',
            '  "tool": "Read",',
            '  "parameters": {',
            '    "file_path": "/tmp/config.yaml"',
            '  }',
        ].join('\n');

        const fullResponse = await autoContinueCursorToolResponseStream(buildCursorReq(), initialResponse, true);
        const parsed = parseToolCalls(fullResponse);

        assertEqual(fetchCount, 0, ' Read ');
        assertEqual(parsed.toolCalls.length, 1, '');
        assertEqual(parsed.toolCalls[0].name, 'Read');

        console.log('  ✅  Read  OpenAI ');
        passed++;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('  ❌  Read  OpenAI ');
        console.error(`      ${message}`);
        failed++;
    } finally {
        global.fetch = originalFetch;
    }
})());

await Promise.all(pending);

console.log(`\n: ${passed}  / ${failed}  / ${passed + failed} \n`);

if (failed > 0) process.exit(1);
