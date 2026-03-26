/**
 * test/unit-vision.mjs
 *
 * ：Vision  user 
 * ：node test/unit-vision.mjs
 */

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
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

async function applyVisionInterceptor(messages) {
    for (const msg of messages) {
        if (msg.role !== 'user') continue;
        if (!Array.isArray(msg.content)) continue;

        const newContent = [];
        const imagesToAnalyze = [];

        for (const block of msg.content) {
            if (block.type === 'image') {
                imagesToAnalyze.push(block);
            } else {
                newContent.push(block);
            }
        }

        if (imagesToAnalyze.length > 0) {
            newContent.push({
                type: 'text',
                text: `[System: The user attached ${imagesToAnalyze.length} image(s). Visual analysis/OCR extracted the following context:\nmock vision result]`,
            });
            msg.content = newContent;
        }
    }
}

console.log('\n📦 [1] Vision \n');

await test(' user ', async () => {
    const messages = [
        {
            role: 'assistant',
            content: [
                { type: 'text', text: 'assistant says hi' },
                { type: 'image', source: { type: 'url', data: 'https://example.com/a.jpg' } },
            ],
        },
        {
            role: 'user',
            content: [
                { type: 'text', text: 'please inspect this image' },
                { type: 'image', source: { type: 'url', data: 'https://example.com/b.jpg' } },
            ],
        },
    ];

    await applyVisionInterceptor(messages);

    assert(messages[0].content.some(block => block.type === 'image'), 'assistant image should remain untouched');
    assert(messages[1].content.every(block => block.type !== 'image'), 'user images should be converted away');
    assert(messages[1].content.some(block => block.type === 'text' && block.text.includes('mock vision result')), 'user message should receive vision text');
});

await test(' user ', async () => {
    const messages = [{ role: 'user', content: 'plain text only' }];
    await applyVisionInterceptor(messages);
    assert(messages[0].content === 'plain text only', 'plain text content should stay unchanged');
});

console.log('\n' + '═'.repeat(55));
console.log(`  : ${passed}  / ${failed}  / ${passed + failed} `);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
