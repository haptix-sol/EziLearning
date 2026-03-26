/**
 * EziLearning — Cursor API proxy (Express entrypoint).
 * Proxies Cursor chat to Anthropic- and OpenAI-compatible endpoints.
 */

import 'dotenv/config';
import { createRequire } from 'module';
import express from 'express';
import { getConfig, initConfigWatcher, stopConfigWatcher } from './config.js';
import { handleMessages, listModels, countTokens } from './handler.js';
import { handleOpenAIChatCompletions, handleOpenAIResponses } from './openai-handler.js';
import { serveLogViewer, apiGetLogs, apiGetRequests, apiGetStats, apiGetPayload, apiLogsStream, serveLogViewerLogin, apiClearLogs, serveVueApp } from './log-viewer.js';
import { loadLogsFromFiles } from './logger.js';

// Version from package.json
const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json') as { version: string };


const app = express();
const config = getConfig();

// JSON body (large limit for base64 images)
app.use(express.json({ limit: '50mb' }));

// CORS
app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    if (_req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

// Static assets (public/)
app.use('/public', express.static('public'));

// Log viewer auth when auth_tokens is set
const logViewerAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const tokens = getConfig().authTokens;
    if (!tokens || tokens.length === 0) return next();

    // ?token=, Authorization, or x-api-key
    const tokenFromQuery = req.query.token as string | undefined;
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
    const tokenFromHeader = authHeader ? String(authHeader).replace(/^Bearer\s+/i, '').trim() : undefined;
    const token = tokenFromQuery || tokenFromHeader;

    if (!token || !tokens.includes(token)) {
        // HTML → login page; API → JSON error
        if (req.path === '/logs') {
            return serveLogViewerLogin(req, res);
        }
        res.status(401).json({ error: { message: 'Unauthorized. Provide token via ?token=xxx or Authorization header.', type: 'auth_error' } });
        return;
    }
    next();
};

app.get('/logs', logViewerAuth, serveLogViewer);
// Alternate Vue log UI
app.get('/vuelogs', serveVueApp);
app.get('/api/logs', logViewerAuth, apiGetLogs);
app.get('/api/requests', logViewerAuth, apiGetRequests);
app.get('/api/stats', logViewerAuth, apiGetStats);
app.get('/api/payload/:requestId', logViewerAuth, apiGetPayload);
app.get('/api/logs/stream', logViewerAuth, apiLogsStream);
app.post('/api/logs/clear', logViewerAuth, apiClearLogs);

// API auth for mutating requests when auth_tokens is set
app.use((req, res, next) => {
    // Allow GET and /health without token
    if (req.method === 'GET' || req.path === '/health') {
        return next();
    }
    const tokens = getConfig().authTokens;
    if (!tokens || tokens.length === 0) {
        return next();
    }
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'];
    if (!authHeader) {
        res.status(401).json({ error: { message: 'Missing authentication token. Use Authorization: Bearer <token>', type: 'auth_error' } });
        return;
    }
    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    if (!tokens.includes(token)) {
        console.log(`[Auth] Invalid token: ${token.substring(0, 8)}...`);
        res.status(403).json({ error: { message: 'Invalid authentication token', type: 'auth_error' } });
        return;
    }
    next();
});

// --- Routes ---

// Anthropic Messages API
app.post('/v1/messages', handleMessages);
app.post('/messages', handleMessages);

// OpenAI Chat Completions (compatible)
app.post('/v1/chat/completions', handleOpenAIChatCompletions);
app.post('/chat/completions', handleOpenAIChatCompletions);

// OpenAI Responses (Cursor IDE agent-style)
app.post('/v1/responses', handleOpenAIResponses);
app.post('/responses', handleOpenAIResponses);

// Token count
app.post('/v1/messages/count_tokens', countTokens);
app.post('/messages/count_tokens', countTokens);

// OpenAI-compatible model list
app.get('/v1/models', listModels);

// Health
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: VERSION });
});

app.get('/', (_req, res) => {
    res.json({
        name: 'ezilearning-cursor-proxy',
        version: VERSION,
        description: 'Local proxy: Cursor chat → Anthropic / OpenAI-compatible APIs',
        endpoints: {
            anthropic_messages: 'POST /v1/messages',
            openai_chat: 'POST /v1/chat/completions',
            openai_responses: 'POST /v1/responses',
            models: 'GET /v1/models',
            health: 'GET /health',
            log_viewer: 'GET /logs',
        },
        usage: {
            claude_code: 'export ANTHROPIC_BASE_URL=http://localhost:' + config.port,
            openai_compatible: 'OPENAI_BASE_URL=http://localhost:' + config.port + '/v1',
            cursor_ide: 'OPENAI_BASE_URL=http://localhost:' + config.port + '/v1 (use a Claude model name)',
        },
    });
});

// --- Start ---

// Load persisted logs before listen
loadLogsFromFiles();

app.listen(config.port, () => {
    const auth = config.authTokens?.length ? `${config.authTokens.length} token(s)` : 'open';
    const logPersist = config.logging?.file_enabled ? `file → ${config.logging.dir}` : 'memory only';
    
    // Tools config summary
    const toolsCfg = config.tools;
    let toolsInfo = 'default (full, desc=full)';
    if (toolsCfg) {
        const parts: string[] = [];
        parts.push(`schema=${toolsCfg.schemaMode}`);
        parts.push(toolsCfg.descriptionMaxLength === 0 ? 'desc=full' : `desc≤${toolsCfg.descriptionMaxLength}`);
        if (toolsCfg.includeOnly?.length) parts.push(`whitelist=${toolsCfg.includeOnly.length}`);
        if (toolsCfg.exclude?.length) parts.push(`blacklist=${toolsCfg.exclude.length}`);
        toolsInfo = parts.join(', ');
    }
    
    console.log('');
    console.log(`  \x1b[36m⚡ EziLearning cursor proxy v${VERSION}\x1b[0m`);
    console.log(`  ├─ Server:  \x1b[32mhttp://localhost:${config.port}\x1b[0m`);
    console.log(`  ├─ Model:   ${config.cursorModel}`);
    console.log(`  ├─ Auth:    ${auth}`);
    console.log(`  ├─ Tools:   ${toolsInfo}`);
    console.log(`  ├─ Logging: ${logPersist}`);
    console.log(`  └─ Logs:    \x1b[35mhttp://localhost:${config.port}/logs\x1b[0m`);
    console.log(`  └─ Logs (Vue): \x1b[35mhttp://localhost:${config.port}/vuelogs\x1b[0m`);
    console.log('');

    initConfigWatcher();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    stopConfigWatcher();
    process.exit(0);
});
process.on('SIGINT', () => {
    stopConfigWatcher();
    process.exit(0);
});
