/**
 * E2E: send requests to the local Cursor proxy
 * 
 * ：
 * 1. 
 * 2. 
 * 3.  stop_reason 
 */

const API_URL = 'http://localhost:3010/v1/messages';

interface TestResult {
    name: string;
    passed: boolean;
    detail: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail = '') {
    results.push({ name, passed: condition, detail });
    console.log(condition ? `  ✅ ${name}` : `  ❌ ${name}: ${detail}`);
}

//  Claude Code （）
function buildLongToolRequest(turnCount: number) {
    const messages: any[] = [];
    
    // 
    for (let i = 0; i < turnCount; i++) {
        if (i === 0) {
            // ：
            messages.push({
                role: 'user',
                content: 'Help me analyze the project structure. Read the main entry file first.'
            });
        } else {
            // 
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: `tool_${i}`,
                        content: `File content of module${i}.ts:\n` + 
                            `import { something } from './utils';\n\n` +
                            `export class Module${i} {\n` +
                            Array.from({length: 30}, (_, j) => `    method${j}() { return ${j}; }`).join('\n') +
                            `\n}\n`
                    }
                ]
            });
        }

        // 
        messages.push({
            role: 'assistant',
            content: [
                { type: 'text', text: `Let me check module${i + 1}.` },
                {
                    type: 'tool_use',
                    id: `tool_${i + 1}`,
                    name: 'Read',
                    input: { file_path: `src/module${i + 1}.ts` }
                }
            ]
        });
    }

    // 
    messages.push({
        role: 'user',
        content: [
            {
                type: 'tool_result',
                tool_use_id: `tool_${turnCount}`,
                content: 'File not found: src/module' + turnCount + '.ts'
            }
        ]
    });

    return {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        stream: false,
        system: 'You are a helpful coding assistant.',
        tools: [
            {
                name: 'Read',
                description: 'Read a file from disk',
                input_schema: {
                    type: 'object',
                    properties: {
                        file_path: { type: 'string', description: 'Path to the file' }
                    },
                    required: ['file_path']
                }
            },
            {
                name: 'Bash',
                description: 'Execute a shell command',
                input_schema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'The command to execute' }
                    },
                    required: ['command']
                }
            }
        ],
        messages
    };
}

async function runTests() {
    console.log('\n===  1： ===');
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                stream: false,
                messages: [{ role: 'user', content: 'Say "hello" in one word.' }]
            })
        });
        assert('', resp.ok, `status=${resp.status}`);
        const data = await resp.json();
        assert(' message ', data.type === 'message', `type=${data.type}`);
        assert('stop_reason  end_turn', data.stop_reason === 'end_turn', `stop_reason=${data.stop_reason}`);
        assert(' content', data.content?.length > 0, `content=${JSON.stringify(data.content)}`);
        console.log(`  📝 : ${data.content?.[0]?.text?.substring(0, 100)}`);
    } catch (e: any) {
        assert('', false, e.message);
    }

    console.log('\n===  2：（）===');
    try {
        const longReq = buildLongToolRequest(18); // 18  → 37 
        console.log(`  📊  ${longReq.messages.length} ...`);
        
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
            body: JSON.stringify(longReq)
        });
        assert('', resp.ok, `status=${resp.status}`);
        const data = await resp.json();
        assert(' message', data.type === 'message', `type=${data.type}`);
        assert(' content', data.content?.length > 0);
        
        //  stop_reason
        const validStops = ['end_turn', 'tool_use', 'max_tokens'];
        assert('stop_reason ', validStops.includes(data.stop_reason), `stop_reason=${data.stop_reason}`);
        
        console.log(`  📝 stop_reason: ${data.stop_reason}`);
        console.log(`  📝 content blocks: ${data.content?.length}`);
        if (data.content?.[0]?.text) {
            console.log(`  📝 : ${data.content[0].text.substring(0, 150)}...`);
        }
    } catch (e: any) {
        assert('', false, e.message);
    }

    console.log('\n===  3： ===');
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'test' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                stream: true,
                messages: [{ role: 'user', content: 'Say "world" in one word.' }]
            })
        });
        assert(' 200', resp.ok, `status=${resp.status}`);
        assert('Content-Type  SSE', resp.headers.get('content-type')?.includes('text/event-stream') ?? false);
        
        const body = await resp.text();
        const events = body.split('\n').filter(l => l.startsWith('event:'));
        assert(' SSE ', events.length > 0, `events=${events.length}`);
        assert(' message_start', body.includes('message_start'));
        assert(' message_stop', body.includes('message_stop'));
        
        //  stop_reason
        const deltaMatch = body.match(/"stop_reason"\s*:\s*"([^"]+)"/);
        if (deltaMatch) {
            assert(' stop_reason ', ['end_turn', 'tool_use', 'max_tokens'].includes(deltaMatch[1]), `stop_reason=${deltaMatch[1]}`);
        }
        console.log(`  📝 SSE : ${events.length}`);
    } catch (e: any) {
        assert('', false, e.message);
    }

    // 
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`\n=== : ${passed} , ${failed}  ===\n`);
}

runTests().catch(console.error);
