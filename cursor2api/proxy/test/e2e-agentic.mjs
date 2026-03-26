/**
 * test/e2e-agentic.mjs
 *
 * ： Claude Code  Agentic 
 *
 * ：
 * -  Claude Code （Read/Write/Bash/Glob/Grep/LS ）
 * -  tool_use → tool_result ， end_turn
 * - （ →  → ）
 *
 * ：
 *   node test/e2e-agentic.mjs
 *   PORT=3010 node test/e2e-agentic.mjs
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3010}`;
const MODEL = 'claude-sonnet-4-5-20251120';  // Claude Code 
const MAX_TURNS = 12;  //  12 ，

// ───  ─────────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m', gray: '\x1b[90m',
};
const ok    = s => `${C.green}✅ ${s}${C.reset}`;
const fail  = s => `${C.red}❌ ${s}${C.reset}`;
const warn  = s => `${C.yellow}⚠  ${s}${C.reset}`;
const hdr   = s => `\n${C.bold}${C.cyan}━━━ ${s} ━━━${C.reset}`;
const tool  = s => `  ${C.magenta}🔧 ${s}${C.reset}`;
const info  = s => `  ${C.gray}${s}${C.reset}`;

// ─── Claude Code  ───────────────────────────────────────────
const CLAUDE_CODE_TOOLS = [
    {
        name: 'Read',
        description: 'Reads a file from the local filesystem. You can read a specific line range or the entire file. Always prefer reading specific sections rather than entire large files.',
        input_schema: {
            type: 'object',
            properties: {
                file_path:   { type: 'string', description: 'The absolute path to the file to read' },
                start_line:  { type: 'integer', description: 'The line number to start reading from (1-indexed, optional)' },
                end_line:    { type: 'integer', description: 'The line number to stop reading at (1-indexed, inclusive, optional)' },
            },
            required: ['file_path'],
        },
    },
    {
        name: 'Write',
        description: 'Write a file to the local filesystem. Overwrites the existing file if there is one.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The absolute path to the file to write' },
                content:   { type: 'string', description: 'The content to write to the file' },
            },
            required: ['file_path', 'content'],
        },
    },
    {
        name: 'Edit',
        description: 'This is a tool for editing files. For moving or renaming files, you should generally use the Bash tool with the `mv` command instead.',
        input_schema: {
            type: 'object',
            properties: {
                file_path:     { type: 'string', description: 'The absolute path to the file to modify' },
                old_string:    { type: 'string', description: 'The text to replace.' },
                new_string:    { type: 'string', description: 'The edited text to replace the old_string.' },
                replace_all:   { type: 'boolean', description: 'Replace all occurrences (default: false)' },
            },
            required: ['file_path', 'old_string', 'new_string'],
        },
    },
    {
        name: 'Bash',
        description: 'Executes a given bash command in a persistent shell session.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The command to execute' },
                timeout: { type: 'integer', description: 'Optional timeout in milliseconds (max 600000)' },
            },
            required: ['command'],
        },
    },
    {
        name: 'Glob',
        description: 'Fast file pattern matching tool that works with any codebase size.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'The glob pattern to match files against (e.g. "**/*.ts")' },
                path:    { type: 'string', description: 'The directory to search in (optional, defaults to working directory)' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'Grep',
        description: 'Fast content search tool that works with any codebase size.',
        input_schema: {
            type: 'object',
            properties: {
                pattern:        { type: 'string', description: 'The regex pattern to search for' },
                path:           { type: 'string', description: 'The path to search in (file or directory)' },
                include:        { type: 'string', description: 'Glob pattern for files to include (e.g. "*.ts")' },
                case_sensitive: { type: 'boolean', description: 'Whether the search is case-sensitive (default: false)' },
            },
            required: ['pattern'],
        },
    },
    {
        name: 'LS',
        description: 'Lists files and directories in a given path.',
        input_schema: {
            type: 'object',
            properties: {
                path:    { type: 'string', description: 'The directory path to list' },
                ignore:  { type: 'array', items: { type: 'string' }, description: 'List of glob patterns to ignore' },
            },
            required: ['path'],
        },
    },
    {
        name: 'TodoRead',
        description: 'Read the current todo list for the session.',
        input_schema: { type: 'object', properties: {} },
    },
    {
        name: 'TodoWrite',
        description: 'Create and manage a todo list for tracking tasks.',
        input_schema: {
            type: 'object',
            properties: {
                todos: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id:       { type: 'string' },
                            content:  { type: 'string' },
                            status:   { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        },
                        required: ['id', 'content', 'status', 'priority'],
                    },
                },
            },
            required: ['todos'],
        },
    },
    {
        name: 'WebFetch',
        description: 'Fetch content from a URL and return the text content.',
        input_schema: {
            type: 'object',
            properties: {
                url:    { type: 'string', description: 'The URL to fetch' },
                prompt: { type: 'string', description: 'What specific information to extract from the page' },
            },
            required: ['url', 'prompt'],
        },
    },
    {
        name: 'attempt_completion',
        description: 'Once you have completed the task, use this tool to present the result to the user. Provide a final summary of what you did.',
        input_schema: {
            type: 'object',
            properties: {
                result:  { type: 'string', description: 'The result of the task' },
                command: { type: 'string', description: 'Optional command to demonstrate the result' },
            },
            required: ['result'],
        },
    },
    {
        name: 'ask_followup_question',
        description: 'Ask the user a follow-up question to clarify requirements.',
        input_schema: {
            type: 'object',
            properties: {
                question: { type: 'string', description: 'The question to ask' },
                options:  { type: 'array', items: { type: 'string' }, description: 'Optional list of choices' },
            },
            required: ['question'],
        },
    },
];

// ─── （）─────────────────────────────────────────
const VIRTUAL_FS = {
    '/project/package.json': JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        scripts: { test: 'jest', build: 'tsc', dev: 'ts-node src/index.ts' },
        dependencies: { express: '^4.18.0', uuid: '^9.0.0' },
        devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
    }, null, 2),

    '/project/src/index.ts': `import express from 'express';
import { router } from './routes/api';

const app = express();
app.use(express.json());
app.use('/api', router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));

export default app;
`,

    '/project/src/routes/api.ts': `import { Router } from 'express';
import { UserController } from '../controllers/user';

export const router = Router();
const ctrl = new UserController();

router.get('/users', ctrl.list);
router.get('/users/:id', ctrl.get);
router.post('/users', ctrl.create);
// BUG: missing delete route
`,

    '/project/src/controllers/user.ts': `import { Request, Response } from 'express';

export class UserController {
    private users: Array<{id: string, name: string, email: string}> = [];

    list = (req: Request, res: Response) => {
        res.json(this.users);
    }

    get = (req: Request, res: Response) => {
        const user = this.users.find(u => u.id === req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }

    create = (req: Request, res: Response) => {
        // BUG: no validation on input fields
        const user = { id: Date.now().toString(), ...req.body };
        this.users.push(user);
        res.status(201).json(user);
    }
    // Missing: delete method
}
`,

    '/project/src/models/user.ts': `export interface User {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
}

export interface CreateUserDto {
    name: string;
    email: string;
}
`,

    '/project/tests/user.test.ts': `import { UserController } from '../src/controllers/user';

describe('UserController', () => {
    it('should create a user', () => {
        // TODO: implement
    });
    it('should list users', () => {
        // TODO: implement
    });
});
`,
};

// ───  todo  ───────────────────────────────────────────────────────
let virtualTodos = [];

// ─── （ Claude Code ）──────────────────────
function executeTool(name, input) {
    switch (name) {
        case 'LS': {
            const path = input.path || '/project';
            const allPaths = Object.keys(VIRTUAL_FS);
            const files = allPaths
                .filter(p => p.startsWith(path))
                .map(p => p.replace(path, '').replace(/^\//, ''))
                .filter(p => p.length > 0);
            return files.length > 0
                ? files.join('\n')
                : `Directory listing of ${path}:\n(empty)`;
        }

        case 'Glob': {
            const pattern = input.pattern.replace(/\*\*/g, '').replace(/\*/g, '');
            const ext = pattern.replace(/^\./, '');
            const matches = Object.keys(VIRTUAL_FS).filter(p =>
                p.endsWith(ext) || p.includes(pattern.replace('*.', '.'))
            );
            return matches.length > 0
                ? matches.join('\n')
                : `No files matching ${input.pattern}`;
        }

        case 'Grep': {
            const results = [];
            for (const [fp, content] of Object.entries(VIRTUAL_FS)) {
                const lines = content.split('\n');
                lines.forEach((line, i) => {
                    if (line.toLowerCase().includes(input.pattern.toLowerCase())) {
                        results.push(`${fp}:${i + 1}:${line.trim()}`);
                    }
                });
            }
            return results.length > 0
                ? results.join('\n')
                : `No matches for "${input.pattern}"`;
        }

        case 'Read': {
            const content = VIRTUAL_FS[input.file_path];
            if (!content) return `Error: File not found: ${input.file_path}`;
            if (input.start_line || input.end_line) {
                const lines = content.split('\n');
                const start = (input.start_line || 1) - 1;
                const end = input.end_line || lines.length;
                return lines.slice(start, end).join('\n');
            }
            return content;
        }

        case 'Write': {
            VIRTUAL_FS[input.file_path] = input.content;
            return `Successfully wrote ${input.content.length} characters to ${input.file_path}`;
        }

        case 'Edit': {
            const content = VIRTUAL_FS[input.file_path];
            if (!content) return `Error: File not found: ${input.file_path}`;
            if (!content.includes(input.old_string)) {
                return `Error: old_string not found in ${input.file_path}`;
            }
            const newContent = input.replace_all
                ? content.replaceAll(input.old_string, input.new_string)
                : content.replace(input.old_string, input.new_string);
            VIRTUAL_FS[input.file_path] = newContent;
            return `Successfully edited ${input.file_path}`;
        }

        case 'Bash': {
            const cmd = input.command;
            // 
            if (cmd.includes('ls') || cmd.includes('find')) {
                return Object.keys(VIRTUAL_FS).join('\n');
            }
            if (cmd.includes('cat ')) {
                const path = cmd.split('cat ')[1]?.trim();
                return VIRTUAL_FS[path] || `cat: ${path}: No such file or directory`;
            }
            if (cmd.includes('grep')) {
                return executeTool('Grep', { pattern: cmd.split('"')[1] || cmd.split("'")[1] || 'todo', path: '/project' });
            }
            if (cmd.includes('npm test') || cmd.includes('jest')) {
                return `PASS tests/user.test.ts\n  UserController\n    ✓ should create a user (pending)\n    ✓ should list users (pending)\n\nTest Suites: 1 passed, 1 total`;
            }
            if (cmd.includes('tsc') || cmd.includes('build')) {
                return `src/routes/api.ts compiled successfully\nNo errors found`;
            }
            return `$ ${cmd}\n(command executed successfully)`;
        }

        case 'TodoRead': {
            if (virtualTodos.length === 0) return 'No todos yet.';
            return JSON.stringify(virtualTodos, null, 2);
        }

        case 'TodoWrite': {
            virtualTodos = input.todos;
            return `Todo list updated with ${input.todos.length} items`;
        }

        case 'WebFetch':
            return `[Fetched ${input.url}]\n\nThis is simulated web content. The page contains documentation about the requested topic: ${input.prompt}`;

        case 'attempt_completion':
            return `__TASK_COMPLETE__:${input.result}`;

        case 'ask_followup_question':
            return `__ASK__:${input.question}`;

        default:
            return `Tool ${name} executed with input: ${JSON.stringify(input)}`;
    }
}

// ─── Agentic  ─────────────────────────────────────────────────
async function runAgentLoop(userMessage, { label = '', verbose = false, extraTools, toolChoice } = {}) {
    const messages = [{ role: 'user', content: userMessage }];
    //  system prompt： tool-first，
    const systemPrompt = [
        'You are an AI coding assistant with full file system access.',
        'CRITICAL RULES:',
        '1. You MUST use tools to read files before discussing their content. Never guess file contents.',
        '2. You MUST use Write or Edit tools to actually modify files. Never just show code in text.',
        '3. You MUST use Bash to run commands. Never pretend to run them.',
        '4. Always use LS or Glob first to discover files if you are not sure about paths.',
        '5. Use attempt_completion when the task is fully done.',
        '6. Working directory is /project. All files are accessible via the Read tool.',
    ].join('\n');

    let turnCount = 0;
    const toolCallLog = [];
    let finalResult = null;

    while (turnCount < MAX_TURNS) {
        turnCount++;

        // 
        const resp = await fetch(`${BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': 'dummy' },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 8096,
                system: systemPrompt,
                tools: extraTools ? CLAUDE_CODE_TOOLS.filter(t => extraTools.includes(t.name)) : CLAUDE_CODE_TOOLS,
                ...(toolChoice ? { tool_choice: toolChoice } : {}),
                messages,
            }),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
        }

        const data = await resp.json();

        if (verbose) {
            const textBlock = data.content?.find(b => b.type === 'text');
            if (textBlock?.text) {
                console.log(info(`  [Turn ${turnCount}] : "${textBlock.text.substring(0, 100)}..."`));
            }
        }

        // 
        const toolUseBlocks = data.content?.filter(b => b.type === 'tool_use') || [];

        if (data.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
            // 
            const textBlock = data.content?.find(b => b.type === 'text');
            finalResult = textBlock?.text || '(no text response)';
            break;
        }

        // 
        for (const tb of toolUseBlocks) {
            toolCallLog.push({ turn: turnCount, tool: tb.name, input: tb.input });
            if (verbose) {
                console.log(tool(`[Turn ${turnCount}] ${tb.name}(${JSON.stringify(tb.input).substring(0, 80)})`));
            } else {
                process.stdout.write(`${C.magenta}→${tb.name}${C.reset} `);
            }
        }

        //  assistant 
        messages.push({ role: 'assistant', content: data.content });

        // 
        const toolResults = [];
        for (const tb of toolUseBlocks) {
            const result = executeTool(tb.name, tb.input);

            // 
            if (typeof result === 'string' && result.startsWith('__TASK_COMPLETE__:')) {
                finalResult = result.replace('__TASK_COMPLETE__:', '');
                toolCallLog.push({ turn: turnCount, tool: '__DONE__', result: finalResult });
            }

            toolResults.push({
                type: 'tool_result',
                tool_use_id: tb.id,
                content: typeof result === 'string' ? result : JSON.stringify(result),
            });
        }

        // 
        messages.push({ role: 'user', content: toolResults });

        // 
        if (finalResult !== null && toolCallLog.some(t => t.tool === '__DONE__')) break;
    }

    if (!verbose) process.stdout.write('\n');

    return { toolCallLog, finalResult, turns: turnCount };
}

// ───  ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const allResults = [];

async function test(name, fn) {
    const t0 = Date.now();
    process.stdout.write(`\n  ${C.blue}▶${C.reset} ${C.bold}${name}${C.reset}\n`);
    try {
        const result = await fn();
        const ms = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${ok('')} (${ms}s, ${result?.turns || '?'} )`);
        if (result?.toolCallLog) {
            const summary = result.toolCallLog
                .filter(t => t.tool !== '__DONE__')
                .map(t => `${t.turn}:${t.tool}`)
                .join(' → ');
            console.log(info(`  : ${summary}`));
        }
        if (result?.finalResult) {
            console.log(info(`  : "${String(result.finalResult).substring(0, 120)}..."`));
        }
        passed++;
        allResults.push({ name, ok: true });
    } catch (e) {
        const ms = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  ${fail('')} (${ms}s)`);
        console.log(`  ${C.red}${e.message}${C.reset}`);
        failed++;
        allResults.push({ name, ok: false, error: e.message });
    }
}

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
console.log(`\n${C.bold}${C.magenta}  EziLearning Cursor proxy — agentic load test${C.reset}`);
console.log(info(`  BASE_URL=${BASE_URL}  MODEL=${MODEL}  MAX_TURNS=${MAX_TURNS}`));

try {
    const r = await fetch(`${BASE_URL}/v1/models`, { headers: { 'x-api-key': 'dummy' } });
    if (!r.ok) throw new Error();
    console.log(`\n${ok('')}`);
} catch {
    console.log(`\n${fail('， npm run dev')}\n`);
    process.exit(1);
}

// ════════════════════════════════════════════════════════════════════
//  1：（LS → Glob → Read）
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 1：'));

await test('', async () => {
    const result = await runAgentLoop(
        `Use the LS tool on /project to list all files. Then use Glob with pattern "**/*.ts" to find TypeScript files. Read at least one of the source files. Finally summarize what the project does.`,
        { label: '' }
    );
    const { toolCallLog } = result;

    const usedExplore = toolCallLog.some(t => ['LS', 'Glob', 'Read'].includes(t.tool));
    if (!usedExplore) throw new Error(`。: ${toolCallLog.map(t => t.tool).join(', ')}`);

    return result;
});

// ════════════════════════════════════════════════════════════════════
//  2：（Read → Grep → ）
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 2： Bug '));

await test(' UserController  Bug', async () => {
    const result = await runAgentLoop(
        `Use the Read tool to read these two files:
1. /project/src/controllers/user.ts
2. /project/src/routes/api.ts
After reading both files, list all bugs, missing features, and security issues you find.`,
        { label: '' }
    );
    const { toolCallLog, finalResult } = result;

    const readPaths = toolCallLog.filter(t => t.tool === 'Read').map(t => t.input.file_path || '');
    if (readPaths.length === 0) throw new Error('');

    const mentionsBug = finalResult && (
        finalResult.toLowerCase().includes('bug') ||
        finalResult.toLowerCase().includes('missing') ||
        finalResult.toLowerCase().includes('delete') ||
        finalResult.toLowerCase().includes('valid')
    );
    if (!mentionsBug) throw new Error(` Bug: "${finalResult?.substring(0, 200)}"`);

    return result;
});

// ════════════════════════════════════════════════════════════════════
//  3：TodoWrite  → 
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 3： + '));

await test(' Todo  delete ', async () => {
    virtualTodos = [];

    const result = await runAgentLoop(
        `Task: add DELETE /users/:id route to the Express app.

Steps you MUST follow using tools:
1. Call TodoWrite with 3 todos: "Read controller", "Add delete method", "Add delete route"
2. Call Read on /project/src/controllers/user.ts
3. Call Read on /project/src/routes/api.ts  
4. Call Write on /project/src/controllers/user.ts with the full updated content (add delete method)
5. Call Write on /project/src/routes/api.ts with the full updated content (add DELETE route)
6. Call TodoWrite again marking all todos completed`,
        { label: '', toolChoice: { type: 'any' } }  // ← tool_choice=any 
    );
    const { toolCallLog } = result;

    const usedTodo = toolCallLog.some(t => t.tool === 'TodoWrite');
    if (!usedTodo) console.log(warn('     TodoWrite'));

    const usedRead = toolCallLog.some(t => t.tool === 'Read');
    if (!usedRead) throw new Error('');

    const usedWrite = toolCallLog.some(t => ['Write', 'Edit'].includes(t.tool));
    if (!usedWrite) throw new Error('（）');

    const controllerContent = VIRTUAL_FS['/project/src/controllers/user.ts'] || '';
    const routeContent = VIRTUAL_FS['/project/src/routes/api.ts'] || '';
    const controllerFixed = controllerContent.includes('delete') || controllerContent.includes('Delete');
    const routeFixed = routeContent.includes('delete') || routeContent.includes('DELETE');

    console.log(info(`    Controller : ${controllerFixed ? '✅' : '❌'}`));
    console.log(info(`    Routes : ${routeFixed ? '✅' : '❌'}`));

    if (!controllerFixed && !routeFixed) throw new Error('');

    return result;
});

// ════════════════════════════════════════════════════════════════════
//  4：Grep  + （）
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 4：Grep  + '));

await test(' TODO ', async () => {
    const result = await runAgentLoop(
        `You MUST use tools in this exact order:
1. Call Grep with pattern "TODO" and path "/project/tests" — this shows you line numbers only, NOT the full file
2. Call Read on /project/tests/user.test.ts — you NEED this to see the full file content before editing
3. Call Write on /project/tests/user.test.ts — write the complete updated file with the two TODO test cases implemented using real assertions`,
        { label: 'grep+edit', toolChoice: { type: 'any' } }
    );
    const { toolCallLog } = result;

    const usedGrep  = toolCallLog.some(t => t.tool === 'Grep');
    const usedRead  = toolCallLog.some(t => t.tool === 'Read');
    const usedWrite = toolCallLog.some(t => ['Write', 'Edit'].includes(t.tool));

    console.log(info(`    Grep: ${usedGrep ? '✅' : '❌'}  Read: ${usedRead ? '✅' : '⚠()'}  Write: ${usedWrite ? '✅' : '❌'}`));

    if (!usedWrite) throw new Error('');
    if (!usedGrep && !usedRead) throw new Error('');

    const testContent = VIRTUAL_FS['/project/tests/user.test.ts'] || '';
    const hasImpl = testContent.includes('expect') || testContent.includes('assert') ||
                    testContent.includes('toEqual') || testContent.includes('toBe');
    console.log(info(`    : ${hasImpl ? '✅' : '❌'}`));
    if (!hasImpl) throw new Error('');

    return result;
});


// ════════════════════════════════════════════════════════════════════
//  5：Bash （/）
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 5：Bash  + '));

await test('', async () => {
    const result = await runAgentLoop(
        `Use the Bash tool to run these commands one at a time:
1. Bash: {"command": "cd /project && npm run build"}
2. Bash: {"command": "cd /project && npm test"}
Report what each command outputs.`,
        { label: 'bash' }
    );
    const { toolCallLog } = result;

    const usedBash = toolCallLog.some(t => t.tool === 'Bash');
    if (!usedBash) throw new Error(' Bash ');

    return result;
});

// ════════════════════════════════════════════════════════════════════
//  6：attempt_completion 
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 6：attempt_completion '));

await test(' attempt_completion', async () => {
    const result = await runAgentLoop(
        `Use the Read tool to read /project/package.json. Then call attempt_completion with a summary of: project name, version, and all dependencies listed.`,
        { label: 'completion', toolChoice: { type: 'any' } }  // ← tool_choice=any 
    );
    const { toolCallLog } = result;

    const usedRead = toolCallLog.some(t => t.tool === 'Read');
    if (!usedRead) throw new Error(' package.json');

    const usedCompletion = toolCallLog.some(t => t.tool === 'attempt_completion');
    if (!usedCompletion) {
        if (!result.finalResult) throw new Error(' attempt_completion，');
        console.log(warn('     attempt_completion，（）'));
    }

    return result;
});

// ════════════════════════════════════════════════════════════════════
//  7： Agentic（Read → Grep → Edit → Bash → ）
// ════════════════════════════════════════════════════════════════════
console.log(hdr(' 7： Agentic （≥4）'));

await test('：', async () => {
    //  FS  controller 
    VIRTUAL_FS['/project/src/controllers/user.ts'] = `import { Request, Response } from 'express';

export class UserController {
    private users: Array<{id: string, name: string, email: string}> = [];

    list = (req: Request, res: Response) => {
        res.json(this.users);
    }

    get = (req: Request, res: Response) => {
        const user = this.users.find(u => u.id === req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }

    create = (req: Request, res: Response) => {
        // BUG: no validation on input fields
        const user = { id: Date.now().toString(), ...req.body };
        this.users.push(user);
        res.status(201).json(user);
    }
}
`;

    const result = await runAgentLoop(
        `The create method in /project/src/controllers/user.ts has a security bug: it has no input validation.
Please:
1. Read the user model at /project/src/models/user.ts to understand the schema
2. Read the controller file  
3. Add proper validation (check name and email are present and valid)
4. Use Grep to verify no other files need the same fix
5. Run a quick test with Bash to confirm nothing is broken
6. Call attempt_completion when done`,
        { label: '', verbose: false }
    );
    const { toolCallLog, turns } = result;

    if (turns < 3) throw new Error(` 3 ， ${turns} `);

    const usedTools = [...new Set(toolCallLog.map(t => t.tool))];
    console.log(info(`    : ${usedTools.join(', ')}`));

    //  Read  Controller
    const readFiles = toolCallLog.filter(t => t.tool === 'Read').map(t => t.input.file_path);
    console.log(info(`    : ${readFiles.join(', ')}`));

    // 
    const modified = toolCallLog.some(t => ['Write', 'Edit'].includes(t.tool));
    if (!modified) throw new Error('');

    //  controller 
    const ctrl = VIRTUAL_FS['/project/src/controllers/user.ts'];
    const hasValidation = ctrl.includes('valid') || ctrl.includes('400') || ctrl.includes('required') || ctrl.includes('!req.body');
    console.log(info(`    : ${hasValidation ? '✅' : '❌（）'}`));

    return result;
});

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${'═'.repeat(62)}`);
console.log(`${C.bold}  Agentic : ${C.green}${passed} ${C.reset}${C.bold} / ${failed > 0 ? C.red : ''}${failed} ${C.reset}${C.bold} / ${total} ${C.reset}`);
console.log('═'.repeat(62) + '\n');

if (failed > 0) {
    console.log(`${C.red}:${C.reset}`);
    allResults.filter(r => !r.ok).forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.error}`);
    });
    console.log();
    process.exit(1);
}
