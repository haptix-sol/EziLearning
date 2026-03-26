import { shouldAutoContinueTruncatedToolResponse } from '../dist/handler.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ❌ ${name}`);
        console.error(`      ${message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

console.log('\n📦 handler \n');

test('', () => {
    const text = [
        '。',
        '',
        '```json action',
        '{',
        '  "tool": "Read",',
        '  "parameters": {',
        '    "file_path": "/app/config.yaml"',
        '  }',
    ].join('\n');

    assertEqual(
        shouldAutoContinueTruncatedToolResponse(text, true),
        false,
        'Read ',
    );
});

test('', () => {
    const longContent = 'A'.repeat(4000);
    const text = [
        '```json action',
        '{',
        '  "tool": "Write",',
        '  "parameters": {',
        '    "file_path": "/tmp/large.txt",',
        `    "content": "${longContent}`,
    ].join('\n');

    assertEqual(
        shouldAutoContinueTruncatedToolResponse(text, true),
        true,
        'Write ',
    );
});

test('', () => {
    const text = '```ts\nexport const answer = {';

    assertEqual(
        shouldAutoContinueTruncatedToolResponse(text, true),
        true,
        '',
    );
});

console.log(`\n: ${passed}  / ${failed}  / ${passed + failed} \n`);

if (failed > 0) process.exit(1);
