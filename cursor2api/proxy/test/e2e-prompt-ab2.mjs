/**
 * test/e2e-prompt-ab2.mjs
 *
 *  A/B ：
 *   ⑤  (extractToolResultNatural )
 *   ② thinkingSuffix ()  
 *   ③ fewShotResponse (few-shot )
 *
 * ：
 *   - ⑤  → 
 *   - ②  → 
 *   - ③ few-shot → 
 *
 * ：
 *   VARIANT=baseline node test/e2e-prompt-ab2.mjs
 *   VARIANT=candidate_x node test/e2e-prompt-ab2.mjs
 *   node test/e2e-prompt-ab2.mjs --compare
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3010}`;
const MODEL = 'claude-sonnet-4-5-20251120';
const MAX_TURNS = 10;
const VARIANT = process.env.VARIANT || 'current';
const COMPARE_MODE = process.argv.includes('--compare');

// ───  ───────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m', gray: '\x1b[90m',
};
const ok   = s => `${C.green}✅ ${s}${C.reset}`;
const fail = s => `${C.red}❌ ${s}${C.reset}`;
const warn = s => `${C.yellow}⚠  ${s}${C.reset}`;
const hdr  = s => `\n${C.bold}${C.cyan}━━━ ${s} ━━━${C.reset}`;
const info = s => `  ${C.gray}${s}${C.reset}`;

// ───  ──────────────────────────────────────────────────────
const TOOLS = [
    {
        name: 'Read', description: 'Reads a file.', input_schema: {
            type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'],
        },
    },
    {
        name: 'Write', description: 'Writes a file.', input_schema: {
            type: 'object', properties: {
                file_path: { type: 'string' }, content: { type: 'string' },
            }, required: ['file_path', 'content'],
        },
    },
    {
        name: 'Bash', description: 'Executes a bash command.', input_schema: {
            type: 'object', properties: { command: { type: 'string' } }, required: ['command'],
        },
    },
    {
        name: 'Grep', description: 'Search for patterns in files.', input_schema: {
            type: 'object', properties: {
                pattern: { type: 'string' }, path: { type: 'string' },
            }, required: ['pattern'],
        },
    },
    {
        name: 'LS', description: 'Lists directory contents.', input_schema: {
            type: 'object', properties: { path: { type: 'string' } }, required: ['path'],
        },
    },
    {
        name: 'attempt_completion', description: 'Present the final result.', input_schema: {
            type: 'object', properties: { result: { type: 'string' } }, required: ['result'],
        },
    },
];

// ───  ────────────────────────────────────────────────────
const MOCK_FS = {
    '/project/package.json': '{"name":"my-app","version":"2.0.0","dependencies":{"express":"^4.18.0","lodash":"^4.17.21"}}',
    '/project/src/index.ts': 'import express from "express";\nimport { router } from "./router";\nconst app = express();\napp.use("/api", router);\napp.listen(3000);\n',
    '/project/src/router.ts': 'import { Router } from "express";\nexport const router = Router();\nrouter.get("/health", (_, res) => res.json({ ok: true }));\nrouter.get("/users", (_, res) => res.json([]));\n// TODO: add POST /users\n',
    '/project/src/utils.ts': 'export function clamp(v: number, min: number, max: number) {\n  return Math.min(Math.max(v, min), max);\n}\n// TODO: add debounce function\n',
    '/project/tsconfig.json': '{"compilerOptions":{"target":"es2020","module":"commonjs","strict":true}}',
    '/project/README.md': '# My App\nExpress API server.\n## API\n- GET /api/health\n- GET /api/users\n',
};

function mockExec(name, input) {
    switch (name) {
        case 'Read': return MOCK_FS[input.file_path] || `Error: File not found: ${input.file_path}`;
        case 'Write': { MOCK_FS[input.file_path] = input.content; return `Wrote ${input.content.length} chars`; }
        case 'Bash': {
            if (input.command?.includes('npm test')) return 'Tests passed: 3/3';
            if (input.command?.includes('tsc')) return 'Compilation successful';
            return `$ ${input.command}\n(ok)`;
        }
        case 'Grep': {
            const results = [];
            for (const [fp, c] of Object.entries(MOCK_FS)) {
                c.split('\n').forEach((line, i) => {
                    if (line.toLowerCase().includes((input.pattern || '').toLowerCase()))
                        results.push(`${fp}:${i + 1}:${line.trim()}`);
                });
            }
            return results.join('\n') || 'No matches.';
        }
        case 'LS': return Object.keys(MOCK_FS).filter(p => p.startsWith(input.path || '/project')).join('\n');
        case 'attempt_completion': return `__DONE__:${input.result}`;
        default: return `Executed ${name}`;
    }
}

// ───  ─────────────────────────────────────────────────────
async function runMultiTurn(userMessage, opts = {}) {
    const { tools = TOOLS, systemPrompt = '', toolChoice, maxTurns = MAX_TURNS } = opts;
    const messages = [{ role: 'user', content: userMessage }];
    const system = systemPrompt || 'You are an AI coding assistant. Working directory: /project.';

    let totalToolCalls = 0, totalTextChars = 0, turns = 0;
    let firstTurnToolCount = 0, firstTurnTextLen = 0;
    const toolLog = [];
    let completed = false;
    let stopped = false; // （end_turn but not completed）

    while (turns < maxTurns) {
        turns++;
        const resp = await fetch(`${BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'dummy' },
            body: JSON.stringify({
                model: MODEL, max_tokens: 4096, system, tools,
                ...(toolChoice ? { tool_choice: toolChoice } : {}),
                messages,
            }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        const textBlocks = data.content?.filter(b => b.type === 'text') || [];
        const toolUseBlocks = data.content?.filter(b => b.type === 'tool_use') || [];
        const turnText = textBlocks.reduce((s, b) => s + (b.text?.length || 0), 0);
        
        totalTextChars += turnText;
        totalToolCalls += toolUseBlocks.length;

        if (turns === 1) {
            firstTurnToolCount = toolUseBlocks.length;
            firstTurnTextLen = turnText;
        }

        for (const tb of toolUseBlocks) {
            toolLog.push({ turn: turns, tool: tb.name });
        }

        if (data.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
            if (!completed) stopped = true;
            break;
        }

        messages.push({ role: 'assistant', content: data.content });
        const results = toolUseBlocks.map(tb => ({
            type: 'tool_result', tool_use_id: tb.id,
            content: mockExec(tb.name, tb.input),
        }));
        messages.push({ role: 'user', content: results });

        if (results.some(r => r.content.startsWith('__DONE__'))) { completed = true; break; }
    }

    return {
        totalToolCalls, totalTextChars, turns,
        firstTurnToolCount, firstTurnTextLen,
        toolLog, completed, stopped,
        narrationRatio: totalTextChars / Math.max(totalTextChars + totalToolCalls * 100, 1),
        toolPath: toolLog.map(t => `${t.turn}:${t.tool}`).join(' → '),
    };
}

// ───  ─────────────────────────────────────────────────────
const SCENARIOS = [
    // ========= ⑤  =========
    {
        id: 'continuation_3step',
        group: '⑤ ',
        name: '3 （）',
        description: ' 3 ，。。',
        prompt: 'Step 1: Read /project/src/router.ts. Step 2: Read /project/src/utils.ts. Step 3: After reading both, use attempt_completion to summarize all TODO items found.',
        expect: { minTools: 3, completed: true },
        toolChoice: { type: 'any' },
    },
    {
        id: 'continuation_after_error',
        group: '⑤ ',
        name: '',
        description: '→→。',
        prompt: 'Read /project/src/nonexistent.ts. If it fails, read /project/src/index.ts instead.',
        expect: { minTools: 2 },
    },
    {
        id: 'continuation_long_chain',
        group: '⑤ ',
        name: '（≥4 ）',
        description: ' 4+ 。',
        prompt: 'Please do these steps in order: 1) LS /project/src 2) Read /project/src/index.ts 3) Read /project/src/router.ts 4) Grep for "TODO" in /project/src 5) attempt_completion with a summary of all findings.',
        expect: { minTools: 4, completed: true },
        toolChoice: { type: 'any' },
    },

    // ========= ②  =========
    {
        id: 'suffix_immediate_action',
        group: '② ',
        name: '（）',
        description: '，。',
        prompt: 'Show me the project structure.',
        expect: { firstTurnAction: true, maxFirstTurnText: 100 },
    },
    {
        id: 'suffix_ambiguous_task',
        group: '② ',
        name: '',
        description: '，（）。',
        prompt: 'Help me understand this project.',
        expect: { firstTurnAction: true },
    },
    {
        id: 'suffix_multi_file',
        group: '② ',
        name: '',
        description: '。',
        prompt: 'Read /project/src/index.ts and /project/src/router.ts and /project/tsconfig.json.',
        expect: { firstTurnMinTools: 2 },
    },

    // ========= ③ few-shot  =========
    {
        id: 'fewshot_format',
        group: '③ few-shot',
        name: '',
        description: ' ```json action （）。',
        prompt: 'Read /project/package.json and tell me the project name.',
        expect: { formatCorrect: true, minTools: 1 },
    },
    {
        id: 'fewshot_style_match',
        group: '③ few-shot',
        name: ' —— ',
        description: 'few-shot ，。',
        prompt: 'List all TypeScript files in the project.',
        expect: { maxFirstTurnText: 80 },
    },
    {
        id: 'fewshot_no_meta',
        group: '③ few-shot',
        name: '',
        description: ' "I will use the structured format" 。',
        prompt: 'Check if there are any TODO comments in /project/src/utils.ts.',
        expect: { noMetaText: true, minTools: 1 },
    },
];

// ───  ────────────────────────────────────────────────────────
if (COMPARE_MODE) {
    const fs = await import('fs');
    const files = fs.readdirSync('test')
        .filter(f => f.startsWith('prompt-ab2-results-') && f.endsWith('.json'))
        .sort();

    if (files.length < 2) {
        console.log(`\n${fail(' 2 。')}`);
        process.exit(1);
    }

    const results = files.map(f => ({ file: f, ...JSON.parse(fs.readFileSync(`test/${f}`, 'utf-8')) }));

    console.log(`\n${C.bold}${C.magenta}══  A/B  ══${C.reset}\n`);
    results.forEach(r => console.log(`  ${C.cyan}${r.variant}${C.reset} — ${r.timestamp}`));

    //  group 
    const groups = [...new Set(SCENARIOS.map(s => s.group))];
    for (const group of groups) {
        console.log(hdr(group));
        const groupScenarios = SCENARIOS.filter(s => s.group === group);

        console.log(`${'─'.repeat(120)}`);
        const headerParts = [`${''.padEnd(28)}`];
        for (const r of results) headerParts.push(r.variant.padEnd(25));
        console.log(`${C.bold}${headerParts.join('')}${C.reset}`);
        console.log(`${'─'.repeat(120)}`);

        for (const sc of groupScenarios) {
            const row = [sc.id.padEnd(28)];
            for (const r of results) {
                const s = r.scenarios.find(x => x.id === sc.id);
                if (!s) { row.push('N/A'.padEnd(25)); continue; }
                const m = s.metrics;
                const emoji = s.passed ? '✅' : '❌';
                const brief = m
                    ? `${emoji} T:${m.totalToolCalls} N:${Math.round((m.narrationRatio || 0) * 100)}% ${m.turns}`
                    : '❌ ERR';
                row.push(brief.padEnd(25));
            }
            console.log(row.join(''));
        }
    }

    // 
    console.log(`\n${C.bold}:${C.reset}`);
    for (const r of results) {
        const pass = r.scenarios.filter(s => s.passed).length;
        const avgNarr = r.scenarios.reduce((s, x) => s + (x.metrics?.narrationRatio || 0), 0) / r.scenarios.length;
        const totalTools = r.scenarios.reduce((s, x) => s + (x.metrics?.totalToolCalls || 0), 0);
        const completions = r.scenarios.filter(s => s.metrics?.completed).length;
        console.log(`  ${C.cyan}${r.variant}${C.reset}: ${pass}/${r.scenarios.length}  :${totalTools}  :${Math.round(avgNarr * 100)}%  :${completions}`);
    }
    process.exit(0);
}

// ───  ────────────────────────────────────────────────────
console.log(`\n${C.bold}${C.magenta}   A/B ${C.reset}`);
console.log(info(`VARIANT=${VARIANT}  MODEL=${MODEL}`));

try {
    const r = await fetch(`${BASE_URL}/v1/models`, { headers: { 'x-api-key': 'dummy' } });
    if (!r.ok) throw new Error();
    console.log(`\n${ok('')}`);
} catch { console.log(`\n${fail('')}`); process.exit(1); }

const scenarioResults = [];
let passed = 0, failedCount = 0;
let currentGroup = '';

for (const sc of SCENARIOS) {
    if (sc.group !== currentGroup) {
        currentGroup = sc.group;
        console.log(hdr(currentGroup));
    }
    process.stdout.write(`  ${C.blue}▶${C.reset} ${C.bold}${sc.name}${C.reset}\n`);
    console.log(info(sc.description));

    const t0 = Date.now();
    try {
        const r = await runMultiTurn(sc.prompt, { toolChoice: sc.toolChoice });

        let testPassed = true;
        const failReasons = [];

        // 
        if (sc.expect.minTools && r.totalToolCalls < sc.expect.minTools) {
            testPassed = false; failReasons.push(` ${r.totalToolCalls} < ${sc.expect.minTools}`);
        }
        if (sc.expect.completed && !r.completed) {
            testPassed = false; failReasons.push('（ attempt_completion）');
        }
        if (sc.expect.firstTurnAction && r.firstTurnToolCount === 0) {
            testPassed = false; failReasons.push('');
        }
        if (sc.expect.maxFirstTurnText && r.firstTurnTextLen > sc.expect.maxFirstTurnText) {
            failReasons.push(` ${r.firstTurnTextLen} > ${sc.expect.maxFirstTurnText} ()`);
        }
        if (sc.expect.firstTurnMinTools && r.firstTurnToolCount < sc.expect.firstTurnMinTools) {
            testPassed = false; failReasons.push(` ${r.firstTurnToolCount} < ${sc.expect.firstTurnMinTools}`);
        }
        if (sc.expect.formatCorrect !== undefined && sc.expect.formatCorrect && r.totalToolCalls === 0) {
            testPassed = false; failReasons.push('（）');
        }

        console.log(info(`  : ${r.totalToolCalls}  : ${r.turns}  : ${r.totalTextChars}chars  : ${Math.round(r.narrationRatio * 100)}%  : ${r.completed ? '✅' : '❌'}`));
        console.log(info(`  : ${r.toolPath}`));

        const ms = ((Date.now() - t0) / 1000).toFixed(1);
        if (testPassed && failReasons.length === 0) {
            console.log(`  ${ok('')} (${ms}s)`);
            passed++;
        } else if (testPassed) {
            console.log(`  ${ok('')} (${ms}s) — ${failReasons.join(', ')}`);
            passed++;
        } else {
            console.log(`  ${fail('')} (${ms}s)`);
            failReasons.forEach(r2 => console.log(`    ${C.yellow}→ ${r2}${C.reset}`));
            failedCount++;
        }

        scenarioResults.push({ id: sc.id, name: sc.name, group: sc.group, passed: testPassed, failReasons, metrics: r });
    } catch (err) {
        console.log(`  ${fail('')}: ${err.message}`);
        failedCount++;
        scenarioResults.push({ id: sc.id, name: sc.name, group: sc.group, passed: false, failReasons: [err.message], metrics: null });
    }
}

const total = passed + failedCount;
console.log(`\n${'═'.repeat(62)}`);
console.log(`${C.bold}  [${VARIANT}] : ${C.green}${passed} ${C.reset}${C.bold} / ${failedCount > 0 ? C.red : ''}${failedCount} ${C.reset}${C.bold} / ${total} ${C.reset}`);
console.log('═'.repeat(62));

const fs = await import('fs');
const out = { variant: VARIANT, timestamp: new Date().toISOString(), model: MODEL, scenarios: scenarioResults, summary: { passed, failed: failedCount, total } };
const outFile = `test/prompt-ab2-results-${VARIANT}.json`;
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
console.log(`\n${info(`: ${outFile}`)}`);
console.log(info(': node test/e2e-prompt-ab2.mjs --compare'));
console.log();
