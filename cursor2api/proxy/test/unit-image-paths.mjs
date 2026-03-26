/**
 * test/unit-image-paths.mjs
 *
 * ：
 * ：node test/unit-image-paths.mjs
 */

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

function normalizeFileUrlToLocalPath(url) {
    if (!url.startsWith('file:///')) return url;

    const rawPath = url.slice('file:///'.length);
    let decodedPath = rawPath;
    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch {
        // ，
    }

    return /^[A-Za-z]:[\\/]/.test(decodedPath)
        ? decodedPath
        : '/' + decodedPath;
}

function extractImageUrlsFromText(text) {
    const urls = [];

    const fileRe = /file:\/\/\/([^\s"')\]]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg))/gi;
    for (const m of text.matchAll(fileRe)) {
        const normalizedPath = normalizeFileUrlToLocalPath(`file:///${m[1]}`);
        urls.push(normalizedPath);
    }

    const httpRe = /(https?:\/\/[^\s"')\]]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\s"')\]]*)?)/gi;
    for (const m of text.matchAll(httpRe)) {
        if (!urls.includes(m[1])) urls.push(m[1]);
    }

    const localRe = /(?:^|[\s"'(\[,:])((?:\/(?!\/)|[A-Za-z]:[\\/])[^\s"')\]]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg))/gi;
    for (const m of text.matchAll(localRe)) {
        const localPath = m[1].trim();
        const fullMatch = m[0];
        const matchStart = m.index ?? 0;
        const pathOffsetInMatch = fullMatch.lastIndexOf(localPath);
        const pathStart = matchStart + Math.max(pathOffsetInMatch, 0);
        const beforePath = text.slice(Math.max(0, pathStart - 12), pathStart);

        if (/file:\/\/\/[A-Za-z]:$/i.test(beforePath)) continue;
        if (localPath.startsWith('//')) continue;
        if (!urls.includes(localPath)) urls.push(localPath);
    }

    return [...new Set(urls)];
}

function isLocalPath(imageUrl) {
    return /^(\/|~\/|[A-Za-z]:[\\/])/.test(imageUrl);
}

console.log('\n📦 [1]  URL \n');

test(' //example.com/image.jpg', () => {
    const text = 'look //example.com/image.jpg and https://example.com/real.jpg';
    const urls = extractImageUrlsFromText(text);
    assertEqual(urls, ['https://example.com/real.jpg']);
});

console.log('\n📦 [2] file:// Windows \n');

test('file:///C:/Users/name/a.jpg → C:/Users/name/a.jpg', () => {
    const text = 'please inspect file:///C:/Users/name/a.jpg';
    const urls = extractImageUrlsFromText(text);
    assertEqual(urls, ['C:/Users/name/a.jpg']);
});

test('file:///Users/name/a.jpg → /Users/name/a.jpg', () => {
    const text = 'please inspect file:///Users/name/a.jpg';
    const urls = extractImageUrlsFromText(text);
    assertEqual(urls, ['/Users/name/a.jpg']);
});

test(' image block  file:// URL ', () => {
    assertEqual(
        normalizeFileUrlToLocalPath('file:///C:/Users/name/a.jpg'),
        'C:/Users/name/a.jpg'
    );
    assertEqual(
        normalizeFileUrlToLocalPath('file:///Users/name/a.jpg'),
        '/Users/name/a.jpg'
    );
});

console.log('\n📦 [3] Windows \n');

test(' C:\\Users\\name\\a.jpg', () => {
    const text = ' C:\\Users\\name\\a.jpg';
    const urls = extractImageUrlsFromText(text);
    assertEqual(urls, ['C:\\Users\\name\\a.jpg']);
});

test(' C:/Users/name/a.jpg', () => {
    const text = ' C:/Users/name/a.jpg';
    const urls = extractImageUrlsFromText(text);
    assertEqual(urls, ['C:/Users/name/a.jpg']);
});

test('Windows ', () => {
    assert(isLocalPath('C:\\Users\\name\\a.jpg'), 'backslash path should be local');
    assert(isLocalPath('C:/Users/name/a.jpg'), 'slash path should be local');
    assert(isLocalPath(normalizeFileUrlToLocalPath('file:///C:/Users/name/a.jpg')), 'normalized file URL should be local');
    assert(isLocalPath(normalizeFileUrlToLocalPath('file:///Users/name/a.jpg')), 'normalized unix file URL should be local');
});

console.log('\n' + '═'.repeat(55));
console.log(`  : ${passed}  / ${failed}  / ${passed + failed} `);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
