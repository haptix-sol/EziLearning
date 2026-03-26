/**
 * test/unit-proxy-agent.mjs
 *
 * ：proxy-agent 
 * ：node test/unit-proxy-agent.mjs
 *
 * ， dist 。
 * ：
 *  1.  getProxyFetchOptions 
 *  2.  dispatcher 
 *  3. ProxyAgent （）
 *  4.  URL 
 */

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

// ───  mock （ proxy-agent.ts ， dist）──────

//  config
let mockConfig = {};

function getConfig() {
    return mockConfig;
}

//  ProxyAgent（）
class MockProxyAgent {
    constructor(url) {
        this.url = url;
        this.type = 'ProxyAgent';
    }
}

//  src/proxy-agent.ts 
let cachedAgent = undefined;

function resetCache() {
    cachedAgent = undefined;
}

function getProxyDispatcher() {
    const config = getConfig();
    const proxyUrl = config.proxy;

    if (!proxyUrl) return undefined;

    if (!cachedAgent) {
        cachedAgent = new MockProxyAgent(proxyUrl);
    }

    return cachedAgent;
}

function getProxyFetchOptions() {
    const dispatcher = getProxyDispatcher();
    return dispatcher ? { dispatcher } : {};
}

// ════════════════════════════════════════════════════════════════════
// 1.  → 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [1] \n');

test('proxy ', () => {
    resetCache();
    mockConfig = {};
    const opts = getProxyFetchOptions();
    assertEqual(Object.keys(opts).length, 0, '');
});

test('proxy  undefined ', () => {
    resetCache();
    mockConfig = { proxy: undefined };
    const opts = getProxyFetchOptions();
    assertEqual(Object.keys(opts).length, 0);
});

test('proxy ', () => {
    resetCache();
    mockConfig = { proxy: '' };
    const opts = getProxyFetchOptions();
    assertEqual(Object.keys(opts).length, 0, '');
});

test('getProxyDispatcher  undefined', () => {
    resetCache();
    mockConfig = {};
    const d = getProxyDispatcher();
    assertEqual(d, undefined);
});

// ════════════════════════════════════════════════════════════════════
// 2.  →  dispatcher 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [2] \n');

test(' proxy  dispatcher ', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const opts = getProxyFetchOptions();
    assert(opts.dispatcher !== undefined, ' dispatcher');
    assert(opts.dispatcher instanceof MockProxyAgent, ' ProxyAgent ');
});

test('dispatcher  URL', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const d = getProxyDispatcher();
    assertEqual(d.url, 'http://127.0.0.1:7890');
});

test(' URL', () => {
    resetCache();
    mockConfig = { proxy: 'http://user:pass@proxy.corp.com:8080' };
    const d = getProxyDispatcher();
    assertEqual(d.url, 'http://user:pass@proxy.corp.com:8080');
});

test('HTTPS  URL', () => {
    resetCache();
    mockConfig = { proxy: 'https://secure-proxy.corp.com:443' };
    const d = getProxyDispatcher();
    assertEqual(d.url, 'https://secure-proxy.corp.com:443');
});

test(' URL', () => {
    resetCache();
    const url = 'http://admin:p%40ssw0rd@proxy:8080';
    mockConfig = { proxy: url };
    const d = getProxyDispatcher();
    assertEqual(d.url, url, ' URL ');
});

// ════════════════════════════════════════════════════════════════════
// 3. （）
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [3] \n');

test(' ProxyAgent ', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const d1 = getProxyDispatcher();
    const d2 = getProxyDispatcher();
    assert(d1 === d2, '');
});

test('getProxyFetchOptions  dispatcher', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const opts1 = getProxyFetchOptions();
    const opts2 = getProxyFetchOptions();
    assert(opts1.dispatcher === opts2.dispatcher, 'dispatcher ');
});

test('', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const d1 = getProxyDispatcher();
    resetCache();
    mockConfig = { proxy: 'http://10.0.0.1:3128' };
    const d2 = getProxyDispatcher();
    assert(d1 !== d2, '');
    assertEqual(d2.url, 'http://10.0.0.1:3128');
});

// ════════════════════════════════════════════════════════════════════
// 4. fetch options 
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [4] fetch options \n');

test(' options', () => {
    resetCache();
    mockConfig = {};
    const original = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    const merged = { ...original, ...getProxyFetchOptions() };
    assertEqual(merged.method, 'POST');
    assertEqual(merged.headers['Content-Type'], 'application/json');
    assert(merged.dispatcher === undefined, ' dispatcher');
});

test(' dispatcher ', () => {
    resetCache();
    mockConfig = { proxy: 'http://127.0.0.1:7890' };
    const original = { method: 'POST', body: '{}', signal: 'test-signal' };
    const merged = { ...original, ...getProxyFetchOptions() };
    assertEqual(merged.method, 'POST');
    assertEqual(merged.body, '{}');
    assertEqual(merged.signal, 'test-signal');
    assert(merged.dispatcher instanceof MockProxyAgent, ' dispatcher');
});

// ════════════════════════════════════════════════════════════════════
// 5. config.ts （）
// ════════════════════════════════════════════════════════════════════
console.log('\n📦 [5] config \n');

test('PROXY  config.yaml（）', () => {
    //  config.ts ：env > yaml
    let config = { proxy: 'http://yaml-proxy:1234' };
    const envProxy = 'http://env-proxy:5678';
    //  config.ts  49 
    if (envProxy) config.proxy = envProxy;
    assertEqual(config.proxy, 'http://env-proxy:5678', 'PROXY  yaml ');
});

test('PROXY  yaml （）', () => {
    let config = { proxy: 'http://yaml-proxy:1234' };
    const envProxy = undefined;
    if (envProxy) config.proxy = envProxy;
    assertEqual(config.proxy, 'http://yaml-proxy:1234', ' yaml ');
});

// ════════════════════════════════════════════════════════════════════
// 
// ════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(55));
console.log(`  : ${passed}  / ${failed}  / ${passed + failed} `);
console.log('═'.repeat(55) + '\n');

if (failed > 0) process.exit(1);
