#!/usr/bin/env node
/**
 * TikTok Signature Server
 *
 * Generates valid X-Bogus and X-Gnarly signatures for TikTok API requests.
 * Uses a persistent browser session with local SDK injection for reliable signature generation.
 *
 * Endpoints:
 * - POST /signature - Generate signed URL (body: { "url": "..." }) - RECOMMENDED for scalability
 * - POST /fetch     - Fetch through browser (slower, but 100% reliable fallback)
 * - GET  /health    - Health check
 * - GET  /restart   - Restart browser session
 *
 * Environment Variables:
 * - PORT          - Server port (default: 8080)
 * - PROXY_ENABLED - Enable proxy (default: false)
 * - PROXY_HOST    - Proxy host:port (e.g., "proxy.example.com:8080")
 * - PROXY_USER    - Proxy username
 * - PROXY_PASS    - Proxy password
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Use stealth plugin with default evasions
puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// User agent - Chrome on Linux produces working DFSz signatures
const DEFAULT_UA = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

// Proxy configuration from environment
const PROXY_ENABLED = process.env.PROXY_ENABLED === 'true' && process.env.PROXY_HOST;
const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';

// Local SDK path - the SDK is used to generate valid signatures
const SDK_PATH = path.join(__dirname, 'javascript', 'webmssdk_5.1.3.js');
let localSdkContent = null;

// Try to load local SDK
try {
    if (fs.existsSync(SDK_PATH)) {
        localSdkContent = fs.readFileSync(SDK_PATH, 'utf-8');
        console.log('[Server] Local SDK loaded:', SDK_PATH);
    }
} catch (e) {
    console.log('[Server] Local SDK not found:', e.message);
}

// Browser state
let browser = null;
let page = null;
let cookies = null;
let isInitializing = false;
let isReady = false;
let generationCount = 0;
let initMethod = null;
let lastInitTime = null;

// Request queue for sequential processing (prevents concurrent access to browser page)
const requestQueue = [];
let isProcessingQueue = false;

/**
 * Add a signature request to the queue and process sequentially
 */
function queueSignatureRequest(signFn) {
    return new Promise((resolve, reject) => {
        const queuePosition = requestQueue.length + 1;
        if (queuePosition > 1) {
            console.log(`[Queue] Request queued at position ${queuePosition}`);
        }
        requestQueue.push({ signFn, resolve, reject });
        processQueue();
    });
}

/**
 * Process the queue sequentially
 */
async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) {
        return;
    }

    isProcessingQueue = true;

    while (requestQueue.length > 0) {
        const { signFn, resolve, reject } = requestQueue.shift();
        const remaining = requestQueue.length;
        if (remaining > 0) {
            console.log(`[Queue] Processing request, ${remaining} remaining in queue`);
        }
        try {
            const result = await signFn();
            resolve(result);
        } catch (e) {
            console.error(`[Queue] Request failed: ${e.message}`);
            reject(e);
        }
    }

    isProcessingQueue = false;
}

/**
 * Initialize browser with local SDK injection
 */
async function initBrowser() {
    if (isInitializing) {
        // Wait for initialization to complete
        while (isInitializing) {
            await new Promise(r => setTimeout(r, 100));
        }
        return;
    }

    if (isReady && browser && page) {
        return;
    }

    isInitializing = true;
    console.log('[Server] Initializing browser...');

    try {
        // Determine Chrome executable path
        const getChromePath = () => {
            // Check for Docker/env override first
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                return process.env.PUPPETEER_EXECUTABLE_PATH;
            }
            // macOS
            if (process.platform === 'darwin') {
                return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            }
            // Linux - try common paths
            if (process.platform === 'linux') {
                const paths = [
                    '/usr/bin/chromium',
                    '/usr/bin/chromium-browser',
                    '/usr/bin/google-chrome',
                    '/usr/bin/google-chrome-stable'
                ];
                for (const p of paths) {
                    try {
                        fs.accessSync(p);
                        return p;
                    } catch {}
                }
            }
            return undefined; // Let Puppeteer find it
        };

        // Build browser args
        const browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--window-size=1920,1080'
        ];

        // Add proxy if enabled
        if (PROXY_ENABLED) {
            browserArgs.push(`--proxy-server=http://${PROXY_HOST}`);
            console.log(`[Server] Proxy enabled: ${PROXY_HOST}`);
        } else {
            console.log('[Server] Proxy disabled - direct connection');
        }

        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: getChromePath(),
            args: browserArgs,
            ignoreDefaultArgs: ['--enable-automation']
        });

        page = await browser.newPage();

        // Authenticate with proxy if enabled
        if (PROXY_ENABLED && PROXY_USER && PROXY_PASS) {
            await page.authenticate({
                username: PROXY_USER,
                password: PROXY_PASS
            });
        }

        await page.setUserAgent(DEFAULT_UA);
        await page.setViewport({ width: 1920, height: 1080 });

        // Apply platform override to match browser_platform param
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'platform', {
                get: () => 'Linux x86_64',
                configurable: true
            });
        });

        // Initialize with local SDK
        await initWithLocalSdk();
        lastInitTime = new Date().toISOString();
        console.log(`[Server] Browser ready (init method: ${initMethod})`);
        isReady = true;

    } catch (e) {
        console.error('[Server] Init error:', e.message);
        await closeBrowser();
        throw e;
    } finally {
        isInitializing = false;
    }
}

/**
 * Initialize with TikTok page context and LOCAL SDK
 * Injects local SDK BEFORE page loads using evaluateOnNewDocument
 */
async function initWithLocalSdk() {
    if (!localSdkContent) {
        throw new Error('Local SDK not available - ensure webmssdk_5.1.3.js exists in javascript/ folder');
    }

    console.log('[Server] Injecting local SDK before navigation...');

    // Inject SDK before any page scripts run
    await page.evaluateOnNewDocument((sdkCode) => {
        try {
            eval(sdkCode);
            console.log('[SDK] Injected via evaluateOnNewDocument');
        } catch (e) {
            console.error('[SDK] Injection error:', e.message);
        }
    }, localSdkContent);

    // Set up request interception to block TikTok's SDK (prevent conflicts)
    console.log('[Server] Setting up request interception...');
    await page.setRequestInterception(true);

    const requestHandler = async (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        // Block TikTok's SDK files to prevent conflicts with our local SDK
        if (url.includes('webmssdk') || url.includes('slardar') || url.includes('acrawler')) {
            await request.abort();
            return;
        }

        // Block heavy resources to speed up loading
        if (['image', 'media', 'font'].includes(resourceType)) {
            await request.abort();
            return;
        }

        await request.continue();
    };

    page.on('request', requestHandler);

    console.log('[Server] Navigating to TikTok...');
    await page.goto('https://www.tiktok.com/@tiktok', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait for page to settle and SDK to initialize
    console.log('[Server] Waiting for SDK...');
    await new Promise(r => setTimeout(r, 3000));

    // Check SDK status
    const sdkStatus = await page.evaluate(() => {
        const hasAcrawler = !!window.byted_acrawler;
        const hasFrontierSign = hasAcrawler && typeof window.byted_acrawler.frontierSign === 'function';
        const keys = window.byted_acrawler ? Object.keys(window.byted_acrawler).slice(0, 10) : [];
        return { hasAcrawler, hasFrontierSign, keys };
    });

    console.log('[Server] SDK status:', JSON.stringify(sdkStatus));

    if (!sdkStatus.hasFrontierSign) {
        throw new Error(`Local SDK failed to initialize: ${JSON.stringify(sdkStatus)}`);
    }

    initMethod = 'local-sdk';
    console.log('[Server] Local SDK initialized successfully');

    // Disable interception now
    page.off('request', requestHandler);
    await page.setRequestInterception(false);

    // Warm up the SDK
    console.log('[Server] Warming up SDK...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    // Extract cookies for use in requests
    cookies = await page.cookies();
    console.log(`[Server] Captured ${cookies.length} cookies`);
}

async function closeBrowser() {
    isReady = false;
    cookies = null;
    generationCount = 0;
    initMethod = null;
    lastInitTime = null;

    if (browser) {
        try {
            await browser.close();
        } catch (e) {
            console.error('[Server] Error closing browser:', e.message);
        }
        browser = null;
        page = null;
    }
    console.log('[Server] Browser closed, all state reset');
}

/**
 * Check if the page is still valid and ready
 */
async function ensurePageReady() {
    try {
        if (!browser || !page) {
            throw new Error('Browser or page not initialized');
        }
        await page.mainFrame();
        return true;
    } catch (e) {
        console.log('[Server] Page invalid, reinitializing...', e.message);
        isReady = false;
        await closeBrowser();
        await initBrowser();
        return true;
    }
}

/**
 * Generate signed URL for any TikTok URL
 * Triggers fetch, SDK signs it, we capture and abort
 */
async function generateSignedUrl(targetUrl) {
    return queueSignatureRequest(() => _generateSignedUrlInternal(targetUrl));
}

/**
 * Internal implementation - must be called through queue
 */
async function _generateSignedUrlInternal(targetUrl) {
    await initBrowser();
    await ensurePageReady();

    // Parse target URL - use it as-is, only remove existing signatures
    const urlObj = new URL(targetUrl);
    urlObj.searchParams.delete('X-Bogus');
    urlObj.searchParams.delete('X-Gnarly');
    urlObj.searchParams.delete('msToken');

    const fetchUrl = urlObj.toString();
    console.log(`[Server] Signing URL: ${fetchUrl.substring(0, 100)}...`);

    // Use fetch interception - SDK signs fetch requests automatically
    return _signWithFetchInterception(fetchUrl);
}

/**
 * Sign URL using fetch interception
 * SDK intercepts fetch and adds signature params (X-Bogus, X-Gnarly)
 */
async function _signWithFetchInterception(fetchUrl) {
    return new Promise(async (resolve, reject) => {
        let signedUrl = null;
        let timeout = null;
        let resolved = false;
        let cleanedUp = false;

        async function cleanup() {
            if (cleanedUp) return;
            cleanedUp = true;
            try {
                page.off('request', requestHandler);
                await page.setRequestInterception(false);
            } catch (e) {
                // Ignore cleanup errors
            }
        }

        const requestHandler = async (request) => {
            if (resolved) {
                try {
                    if (!request.isInterceptResolutionHandled()) {
                        await request.abort('aborted');
                    }
                } catch (e) {}
                return;
            }

            const url = request.url();

            // Capture any signed request (contains X-Bogus)
            if (url.includes('X-Bogus') && !signedUrl) {
                signedUrl = url;

                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    await cleanup();
                    generationCount++;
                    resolve(parseResult(signedUrl));
                }
            }

            // Abort request
            try {
                if (!request.isInterceptResolutionHandled()) {
                    await request.abort('aborted');
                }
            } catch (e) {}
        };

        try {
            await page.setRequestInterception(true);
        } catch (e) {
            reject(new Error('Failed to enable request interception: ' + e.message));
            return;
        }

        page.on('request', requestHandler);

        // Timeout fallback
        timeout = setTimeout(async () => {
            if (!resolved) {
                resolved = true;
                await cleanup();
                if (signedUrl) {
                    generationCount++;
                    resolve(parseResult(signedUrl));
                } else {
                    reject(new Error('Timeout waiting for signed URL'));
                }
            }
        }, 5000);

        // Trigger fetch - SDK will sign it
        try {
            page.evaluate((url) => {
                fetch(url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Accept': '*/*' }
                }).catch(() => {});
            }, fetchUrl).catch(e => {
                if (!resolved) {
                    console.error('[Server] page.evaluate failed:', e.message);
                }
            });
        } catch (e) {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                await cleanup();
                reject(new Error('page.evaluate failed: ' + e.message));
            }
        }
    });
}

function parseResult(url) {
    const urlObj = new URL(url);
    const cookieString = cookies
        ? cookies.map(c => `${c.name}=${c.value}`).join('; ')
        : '';
    return {
        signedUrl: url,
        xBogus: urlObj.searchParams.get('X-Bogus'),
        xGnarly: urlObj.searchParams.get('X-Gnarly'),
        secUid: urlObj.searchParams.get('secUid'),
        cursor: urlObj.searchParams.get('cursor'),
        deviceId: urlObj.searchParams.get('device_id'),
        userAgent: DEFAULT_UA,
        cookies: cookieString
    };
}

/**
 * HTTP Request Handler
 */
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // Health check
        if (url.pathname === '/health') {
            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'ok',
                ready: isReady,
                initializing: isInitializing,
                initMethod: initMethod,
                lastInitTime: lastInitTime,
                generationCount: generationCount,
                queueLength: requestQueue.length,
                isProcessing: isProcessingQueue,
                localSdkAvailable: !!localSdkContent,
                proxyEnabled: PROXY_ENABLED
            }));
            return;
        }

        // Fetch endpoint - makes request through browser (slower, but 100% reliable fallback)
        // Use /signature + external requests for better scalability
        if (url.pathname === '/fetch' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) {
                body += chunk;
            }

            let targetUrl = null;
            try {
                const json = JSON.parse(body);
                targetUrl = json.url;
            } catch (e) {
                try {
                    new URL(body.trim());
                    targetUrl = body.trim();
                } catch (e2) {}
            }

            if (!targetUrl) {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'URL is required' }));
                return;
            }

            await initBrowser();
            await ensurePageReady();

            console.log('[Server] Fetching through browser:', targetUrl.substring(0, 80) + '...');

            const fetchResult = await page.evaluate(async (url) => {
                try {
                    const response = await fetch(url, {
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    const text = await response.text();
                    return {
                        status: response.status,
                        bodyLength: text.length,
                        data: text ? JSON.parse(text) : null
                    };
                } catch (e) {
                    return { error: e.message };
                }
            }, targetUrl);

            console.log('[Server] Fetch result:', fetchResult.error || `${fetchResult.bodyLength} bytes`);

            if (fetchResult.error) {
                res.writeHead(500);
                res.end(JSON.stringify({ status: 'error', message: fetchResult.error }));
                return;
            }

            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'ok',
                httpStatus: fetchResult.status,
                data: fetchResult.data
            }));
            return;
        }

        // Generate signature (RECOMMENDED - scalable)
        if (url.pathname === '/signature' && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) {
                body += chunk;
            }

            let targetUrl = null;

            // Try to parse as JSON first
            try {
                const json = JSON.parse(body);
                if (json.url) {
                    targetUrl = json.url;
                }
            } catch (e) {
                // Body might be a direct URL string
                try {
                    new URL(body);
                    targetUrl = body;
                } catch (e2) {}
            }

            if (!targetUrl) {
                res.writeHead(400);
                res.end(JSON.stringify({ status: 'error', message: 'URL is required in body as JSON { "url": "..." } or plain text' }));
                return;
            }

            const result = await generateSignedUrl(targetUrl);

            res.writeHead(200);
            res.end(JSON.stringify({
                status: 'ok',
                data: {
                    signed_url: result.signedUrl,
                    'x-bogus': result.xBogus,
                    'x-gnarly': result.xGnarly,
                    'device-id': result.deviceId,
                    cookies: result.cookies,
                    navigator: {
                        user_agent: result.userAgent
                    }
                }
            }));
            return;
        }

        // Restart browser
        if (url.pathname === '/restart') {
            console.log('[Server] Restarting browser...');
            await closeBrowser();
            await initBrowser();
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok', message: 'Browser restarted' }));
            return;
        }

        // 404
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (e) {
        console.error('[Server] Error:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ status: 'error', message: e.message }));
    }
}

// Create server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`[Server] TikTok Signature Server running on port ${PORT}`);
    console.log(`[Server] Endpoints:`);
    console.log(`  POST /signature - Generate signed URL (RECOMMENDED for scalability)`);
    console.log(`  POST /fetch     - Fetch through browser (fallback, 100% reliable)`);
    console.log(`  GET  /health    - Health check`);
    console.log(`  GET  /restart   - Restart browser session`);

    // Initialize browser on startup
    initBrowser().catch(e => console.error('[Server] Init failed:', e.message));
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    await closeBrowser();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[Server] Received SIGTERM, shutting down...');
    await closeBrowser();
    process.exit(0);
});
