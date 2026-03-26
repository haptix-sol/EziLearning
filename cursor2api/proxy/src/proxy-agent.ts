/**
 * proxy-agent.ts - 
 *
 * 
 *  config.proxy  PROXY  undici ProxyAgent
 *  Node.js  fetch()  HTTP/HTTPS 。
 *
 * Node.js  fetch ( undici)  HTTP_PROXY / HTTPS_PROXY
 *  dispatcher (ProxyAgent) 。
 */

import { ProxyAgent } from 'undici';
import { getConfig } from './config.js';

let cachedAgent: ProxyAgent | undefined;
let cachedVisionAgent: ProxyAgent | undefined;

/**
 *  dispatcher proxy
 *  undefined 
 */
export function getProxyDispatcher(): ProxyAgent | undefined {
    const config = getConfig();
    const proxyUrl = config.proxy;

    if (!proxyUrl) return undefined;

    if (!cachedAgent) {
        console.log(`[Proxy] : ${proxyUrl}`);
        cachedAgent = new ProxyAgent(proxyUrl);
    }

    return cachedAgent;
}

/**
 *  fetch  dispatcher
 * : fetch(url, { ...options, ...getProxyFetchOptions() })
 */
export function getProxyFetchOptions(): Record<string, unknown> {
    const dispatcher = getProxyDispatcher();
    return dispatcher ? { dispatcher } : {};
}

/**
 * ★ Vision  vision.proxy proxy
 * Cursor API  API 
 */
export function getVisionProxyFetchOptions(): Record<string, unknown> {
    const config = getConfig();
    const visionProxy = config.vision?.proxy;

    if (visionProxy) {
        if (!cachedVisionAgent) {
            console.log(`[Proxy] Vision : ${visionProxy}`);
            cachedVisionAgent = new ProxyAgent(visionProxy);
        }
        return { dispatcher: cachedVisionAgent };
    }

    // 
    return getProxyFetchOptions();
}
