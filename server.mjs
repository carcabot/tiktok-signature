#!/usr/bin/env node
/**
 * TikTok Signature Server
 *
 * Generates valid X-Bogus and X-Gnarly signatures for TikTok API requests.
 * Runs a POOL of independent browser identities (one incognito context each,
 * with its own ttwid / msToken / tt_chain_token cookie jar) and rotates
 * through them per request, so no single identity carries the whole signing
 * volume. Identities are retired after a signature budget or age and replaced
 * in the background, so the queue never stalls on a browser re-init. Callers
 * can report an identity that TikTok started answering with empty bodies
 * (POST /report) and it is retired immediately.
 *
 * Endpoints:
 * - POST /signature - Generate signed URL (body: { "url": "..." }) - RECOMMENDED for scalability
 * - POST /fetch     - Fetch through browser (slower, but 100% reliable fallback)
 * - POST /report    - Report a burnt identity (body: { "cookies": "<Cookie header>" } or { "ttwid": "..." } or { "msToken": "..." })
 * - GET  /health    - Health check (pool stats)
 * - GET  /restart   - Retire every identity and warm a fresh pool
 *
 * Environment Variables:
 * - PORT                           - Server port (default: 8080)
 * - PROXY_ENABLED                  - Enable proxy (default: false)
 * - PROXY_HOST                     - Proxy host:port (e.g., "proxy.example.com:8080")
 * - PROXY_USER                     - Proxy username
 * - PROXY_PASS                     - Proxy password
 * - IDENTITY_POOL_SIZE             - Number of concurrent browser identities (default: 3)
 * - MAX_GENERATIONS_BEFORE_REFRESH - Signatures per identity before it is retired (default: 500)
 * - MAX_SESSION_AGE_MS             - Identity age before it is retired (default: 30 min)
 * - REPORT_MIN_AGE_MS              - Ignore /report for identities younger than this (default: 15 s)
 * - REPORT_RETIRE_COOLDOWN_MS      - Minimum gap between report-driven retirements (default: 20 s)
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { encode as encodeXGnarly } from "./xgnarly.mjs";

// Use stealth plugin with default evasions
puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// Custom user data directory to avoid filling /tmp
const USER_DATA_DIR = path.join(__dirname, ".chrome-profile");

// User agent - Safari on macOS
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";

// Current active user agent (can be overridden per-request)
let currentUserAgent = DEFAULT_UA;

// Proxy configuration from environment
const PROXY_ENABLED =
  process.env.PROXY_ENABLED === "true" && process.env.PROXY_HOST;
const PROXY_HOST = process.env.PROXY_HOST || "";
const PROXY_USER = process.env.PROXY_USER || "";
const PROXY_PASS = process.env.PROXY_PASS || "";

// Local SDK path - the SDK is used to generate valid signatures
const SDK_PATH = path.join(__dirname, "javascript", "webmssdk_5.1.3.js");
let localSdkContent = null;

// Versioned SDK files served in place of the CDN copies.
const SDK_368_PATH = path.join(
  __dirname,
  "javascript",
  "webmssdk_1.0.0.368.js",
);
const SDK_485_PATH = path.join(
  __dirname,
  "javascript",
  "webmssdk_2.0.0.485.js",
);
let sdk368 = null;
let sdk485 = null;
try {
  if (fs.existsSync(SDK_368_PATH)) {
    sdk368 = fs.readFileSync(SDK_368_PATH, "utf-8");
    console.log("[Server] Loaded:", SDK_368_PATH);
  }
  if (fs.existsSync(SDK_485_PATH)) {
    sdk485 = fs.readFileSync(SDK_485_PATH, "utf-8");
    console.log("[Server] Loaded:", SDK_485_PATH);
  }
} catch (e) {
  console.log("[Server] SDK load error:", e.message);
}

// Try to load local SDK
try {
  if (fs.existsSync(SDK_PATH)) {
    localSdkContent = fs.readFileSync(SDK_PATH, "utf-8");
    console.log("[Server] Local SDK loaded:", SDK_PATH);
  }
} catch (e) {
  console.log("[Server] Local SDK not found:", e.message);
}

// ---------------------------------------------------------------------------
// Pool configuration
// ---------------------------------------------------------------------------

const IDENTITY_POOL_SIZE = Math.max(
  1,
  Number(process.env.IDENTITY_POOL_SIZE) || 3,
);
// Signatures one identity may emit before it is retired. The identity's
// ttwid/msToken is what TikTok keys on; at high volume (and from many egress
// IPs) a single identity is flagged within minutes, after which item_list
// answers HTTP 200 with an empty body for every request carrying it.
const MAX_GENERATIONS_BEFORE_REFRESH =
  Number(process.env.MAX_GENERATIONS_BEFORE_REFRESH) || 500;
const MAX_SESSION_AGE_MS =
  Number(process.env.MAX_SESSION_AGE_MS) || 30 * 60 * 1000;
// A /report against an identity younger than this is ignored: the empty body
// most likely came from the caller's egress IP, not from the identity.
const REPORT_MIN_AGE_MS = Number(process.env.REPORT_MIN_AGE_MS) || 15_000;
// At most one report-driven retirement per this interval, pool-wide. TikTok
// also judges the caller's egress IP, so a burst of reports during an IP-side
// block must not churn every identity (each mint costs a page load + ~10 s).
const REPORT_RETIRE_COOLDOWN_MS =
  Number(process.env.REPORT_RETIRE_COOLDOWN_MS) || 20_000;
let lastReportRetireAt = 0;

const SIGNED_CACHE_MAX_AGE_MS = 60_000;

// ---------------------------------------------------------------------------
// Browser + identity pool state
// ---------------------------------------------------------------------------

let browser = null;
let browserLaunch = null; // in-flight launch promise

let identitySeq = 0;
/** @type {Identity[]} */
const identities = [];
let rrCursor = 0;
let poolWarming = null; // in-flight warm-up promise (startup / restart)
let replacementsInFlight = 0;

class Identity {
  constructor() {
    this.id = ++identitySeq;
    this.context = null;
    this.page = null;
    this.cookies = null;
    this.cookieIndex = new Set(); // ttwid / msToken values, for /report lookup
    this.generationCount = 0;
    this.createdAt = null;
    this.ready = false;
    this.retired = false;
    this.retiring = false;
    this.initMethod = null;
    this.signedUrlCache = new Map();
    this.busy = false; // page.evaluate in flight
  }

  get ageMs() {
    return this.createdAt ? Date.now() - this.createdAt : 0;
  }

  get ttwid() {
    const c = (this.cookies || []).find((x) => x.name === "ttwid");
    return c ? c.value : null;
  }

  shouldRetire() {
    if (!this.ready) return false;
    if (this.generationCount >= MAX_GENERATIONS_BEFORE_REFRESH) return true;
    if (this.ageMs >= MAX_SESSION_AGE_MS) return true;
    return false;
  }

  refreshCookieIndex() {
    this.cookieIndex = new Set();
    for (const c of this.cookies || []) {
      if (c.name === "ttwid" || c.name === "msToken") {
        this.cookieIndex.add(c.value);
        try {
          this.cookieIndex.add(decodeURIComponent(c.value));
        } catch (e) {}
      }
    }
  }

  async updateCookies() {
    try {
      this.cookies = await this.page.cookies();
      this.refreshCookieIndex();
    } catch (e) {
      // Page may be gone; keep the last known cookies.
    }
  }

  summary() {
    return {
      id: this.id,
      ready: this.ready,
      retiring: this.retiring,
      ageMinutes: Math.round(this.ageMs / 60000),
      generationCount: this.generationCount,
      ttwid: this.ttwid ? this.ttwid.slice(0, 12) + "…" : null,
    };
  }
}

// Request queue for sequential processing (prevents concurrent access to a page)
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
      console.log(
        `[Queue] Processing request, ${remaining} remaining in queue`,
      );
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

// ---------------------------------------------------------------------------
// Browser lifecycle (one shared Chromium, one incognito context per identity)
// ---------------------------------------------------------------------------

function getChromePath() {
  // Check for Docker/env override first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // macOS
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  // Linux - try common paths
  if (process.platform === "linux") {
    const paths = [
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
    ];
    for (const p of paths) {
      try {
        fs.accessSync(p);
        return p;
      } catch {}
    }
  }
  return undefined; // Let Puppeteer find it
}

async function ensureBrowser() {
  if (browser && browser.connected) return browser;
  if (browserLaunch) return browserLaunch;

  browserLaunch = (async () => {
    console.log("[Server] Launching browser...");

    const browserArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-gpu",
      "--window-size=1920,1080",
    ];

    if (PROXY_ENABLED) {
      browserArgs.push(`--proxy-server=http://${PROXY_HOST}`);
      console.log(`[Server] Proxy enabled: ${PROXY_HOST}`);
    } else {
      console.log("[Server] Proxy disabled - direct connection");
    }

    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    const b = await puppeteer.launch({
      headless: "new",
      executablePath: getChromePath(),
      args: browserArgs,
      userDataDir: USER_DATA_DIR,
      ignoreDefaultArgs: ["--enable-automation"],
    });

    b.on("disconnected", () => {
      console.error("[Server] Browser disconnected — pool will be rebuilt");
      browser = null;
      for (const idn of identities) {
        idn.ready = false;
        idn.retired = true;
      }
      identities.length = 0;
    });

    browser = b;
    return b;
  })();

  try {
    return await browserLaunch;
  } finally {
    browserLaunch = null;
  }
}

async function closeBrowser() {
  for (const idn of identities) {
    idn.ready = false;
    idn.retired = true;
  }
  identities.length = 0;

  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      console.error("[Server] Error closing browser:", e.message);
    }
    browser = null;
  }

  // Clean up user data directory to prevent disk space accumulation
  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      console.log("[Server] Cleaned up browser profile directory");
    }
  } catch (e) {
    console.error("[Server] Error cleaning up profile:", e.message);
  }

  console.log("[Server] Browser closed, all state reset");
}

// ---------------------------------------------------------------------------
// Identity lifecycle
// ---------------------------------------------------------------------------

/**
 * Detect TikTok's "Something went wrong" interstitial and click its Refresh
 * button. Returns true if the error was detected and handled, false otherwise.
 * Tries up to 2 retries since the second load occasionally errors too.
 */
async function dismissTikTokErrorIfPresent(page, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const state = await page.evaluate(() => {
      const text = document.body ? document.body.innerText || "" : "";
      const hasError = /Something went wrong/i.test(text);
      const refreshBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => /^\s*Refresh\s*$/i.test(b.textContent || ""),
      );
      return { hasError, hasRefreshBtn: !!refreshBtn };
    });
    if (!state.hasError) {
      return attempt === 1 ? false : true;
    }
    console.log(
      `[Server] Detected "Something went wrong" interstitial (attempt ${attempt}/${maxAttempts}), clicking Refresh...`,
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /^\s*Refresh\s*$/i.test(b.textContent || ""),
      );
      if (btn) btn.click();
    });
    // Wait for the bundle to re-initialise after the click
    try {
      await page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (e) {
      // Some refreshes don't trigger a full navigation; just wait
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return true;
}

/**
 * Prime one identity's page with TikTok's page context and the LOCAL SDK.
 * Injects the local SDK BEFORE page loads using evaluateOnNewDocument.
 */
async function initPageWithLocalSdk(idn) {
  const page = idn.page;
  if (!localSdkContent) {
    throw new Error(
      "Local SDK not available - ensure webmssdk_5.1.3.js exists in javascript/ folder",
    );
  }

  console.log(`[Identity ${idn.id}] Injecting local SDK before navigation...`);

  // Inject SDK before any page scripts run
  await page.evaluateOnNewDocument((sdkCode) => {
    try {
      eval(sdkCode);
      console.log("[SDK] Injected via evaluateOnNewDocument");
    } catch (e) {
      console.error("[SDK] Injection error:", e.message);
    }
  }, localSdkContent);

  // Set up request interception to block TikTok's SDK (prevent conflicts)
  await page.setRequestInterception(true);

  const requestHandler = async (request) => {
    const url = request.url();
    const resourceType = request.resourceType();

    if (url.includes("/webmssdk/")) {
      let body = null;
      if (url.includes("2.0.0.485") && sdk485) body = sdk485;
      else if (url.includes("1.0.0.368") && sdk368) body = sdk368;
      else if (sdk485) body = sdk485;
      if (body) {
        try {
          await request.respond({
            status: 200,
            contentType: "application/javascript; charset=utf-8",
            body,
          });
        } catch (e) {
          try {
            await request.abort();
          } catch (e2) {}
        }
        return;
      }
    }

    // Block other security/telemetry SDK files (we don't want them interfering)
    if (
      url.includes("/webmssdk/") ||
      url.includes("slardar") ||
      url.includes("acrawler")
    ) {
      try {
        await request.abort();
      } catch (e) {}
      return;
    }

    // Block heavy resources to speed up loading
    if (["image", "media", "font"].includes(resourceType)) {
      try {
        await request.abort();
      } catch (e) {}
      return;
    }

    try {
      await request.continue();
    } catch (e) {}
  };

  page.on("request", requestHandler);

  console.log(`[Identity ${idn.id}] Navigating to TikTok...`);
  await page.goto("https://www.tiktok.com/@zara", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for page to settle and SDK to initialize
  await new Promise((r) => setTimeout(r, 3000));

  // Check SDK status
  const sdkStatus = await page.evaluate(() => {
    const hasAcrawler = !!window.byted_acrawler;
    const hasFrontierSign =
      hasAcrawler && typeof window.byted_acrawler.frontierSign === "function";
    const keys = window.byted_acrawler
      ? Object.keys(window.byted_acrawler).slice(0, 10)
      : [];
    return { hasAcrawler, hasFrontierSign, keys };
  });

  console.log(`[Identity ${idn.id}] SDK status:`, JSON.stringify(sdkStatus));

  if (!sdkStatus.hasFrontierSign) {
    throw new Error(
      `Local SDK failed to initialize: ${JSON.stringify(sdkStatus)}`,
    );
  }

  idn.initMethod = "local-sdk";

  // Warm up the SDK
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise((r) => setTimeout(r, 2000));

  // Always reload after the initial load. First load is unreliable — sometimes
  // a blank/white page, sometimes the "Something went wrong" interstitial. The
  // reload primes the second pass with the cookies/msToken accumulated on the
  // first pass, after which the page bundle reliably emits signed requests.
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.log(`[Identity ${idn.id}] Reload warning:`, e.message);
  }
  await new Promise((r) => setTimeout(r, 3000));

  // If the second pass still shows the "Something went wrong" interstitial,
  // click its in-page Refresh button to retry once more.
  await dismissTikTokErrorIfPresent(page);

  // Extract cookies for use in requests
  await idn.updateCookies();
  console.log(
    `[Identity ${idn.id}] Captured ${(idn.cookies || []).length} cookies (ttwid ${idn.ttwid ? idn.ttwid.slice(0, 12) + "…" : "none"})`,
  );
}

/**
 * Create and prime a brand-new identity: its own incognito context (separate
 * cookie jar → separate ttwid / msToken / tt_chain_token), own page, own SDK.
 */
async function createIdentity() {
  const b = await ensureBrowser();
  const idn = new Identity();
  console.log(`[Identity ${idn.id}] Creating...`);

  try {
    idn.context = await b.createBrowserContext();
    idn.page = await idn.context.newPage();
    const page = idn.page;

    // Permanent passive listener: every signed request the page emits gets
    // cached by its pathname. The page-intercept sign path reads this cache.
    page.on("request", (request) => {
      try {
        const u = request.url();
        if (!u.includes("X-Gnarly=")) return;
        const parsed = new URL(u);
        idn.signedUrlCache.set(parsed.pathname, {
          url: u,
          capturedAt: Date.now(),
          referer: request.headers().referer || "",
        });
      } catch (e) {}
    });

    // Authenticate with proxy if enabled
    if (PROXY_ENABLED && PROXY_USER && PROXY_PASS) {
      await page.authenticate({
        username: PROXY_USER,
        password: PROXY_PASS,
      });
    }

    await page.setUserAgent(DEFAULT_UA);
    await page.setViewport({ width: 1920, height: 1080 });

    // Apply platform override to match Safari on macOS
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "platform", {
        get: () => "MacIntel",
        configurable: true,
      });
    });

    await page.evaluateOnNewDocument(() => {
      if (typeof window.process === "undefined") {
        window.process = {
          env: { NODE_ENV: "production" },
          browser: true,
          version: "",
          versions: {},
        };
      }
    });

    await initPageWithLocalSdk(idn);

    idn.createdAt = Date.now();
    idn.ready = true;
    console.log(`[Identity ${idn.id}] Ready`);
    return idn;
  } catch (e) {
    console.error(`[Identity ${idn.id}] Init error:`, e.message);
    await destroyIdentity(idn);
    throw e;
  }
}

async function destroyIdentity(idn) {
  idn.ready = false;
  idn.retired = true;
  const i = identities.indexOf(idn);
  if (i >= 0) identities.splice(i, 1);
  try {
    if (idn.context) await idn.context.close();
  } catch (e) {
    // context may already be gone
  }
  idn.context = null;
  idn.page = null;
}

/**
 * Retire an identity: spin up its replacement first (so capacity never drops
 * to zero), then close it. Idempotent.
 */
async function retireIdentity(idn, reason) {
  if (idn.retired || idn.retiring) return;
  idn.retiring = true;
  console.log(
    `[Identity ${idn.id}] Retiring (${reason}; ${idn.generationCount} signatures, ${Math.round(idn.ageMs / 1000)}s old)`,
  );

  // Keep serving from this identity until a replacement is ready, unless we
  // still have other ready identities to carry the load.
  const othersReady = identities.filter(
    (x) => x !== idn && x.ready && !x.retiring,
  );
  if (othersReady.length > 0) {
    await destroyIdentity(idn);
    replaceIdentityInBackground();
  } else {
    try {
      await addIdentity();
    } catch (e) {
      console.error(
        `[Identity ${idn.id}] Replacement failed, keeping old identity for now:`,
        e.message,
      );
      idn.retiring = false;
      return;
    }
    await destroyIdentity(idn);
  }
}

async function addIdentity() {
  replacementsInFlight++;
  try {
    const idn = await createIdentity();
    identities.push(idn);
    return idn;
  } finally {
    replacementsInFlight--;
  }
}

function replaceIdentityInBackground() {
  if (identities.length + replacementsInFlight >= IDENTITY_POOL_SIZE) return;
  addIdentity().catch((e) =>
    console.error(
      "[Server] Background identity replacement failed:",
      e.message,
    ),
  );
}

/**
 * Warm the pool up to IDENTITY_POOL_SIZE. The first identity is awaited so the
 * server can answer as soon as one exists; the rest come up in the background.
 */
async function warmPool() {
  if (poolWarming) return poolWarming;
  poolWarming = (async () => {
    const readyCount = () => identities.filter((x) => x.ready).length;
    if (readyCount() === 0) {
      await addIdentity();
    }
    const missing =
      IDENTITY_POOL_SIZE - identities.length - replacementsInFlight;
    for (let i = 0; i < missing; i++) {
      addIdentity().catch((e) =>
        console.error("[Server] Pool warm-up identity failed:", e.message),
      );
    }
  })();
  try {
    await poolWarming;
  } finally {
    poolWarming = null;
  }
}

/**
 * Pick the identity for the next request: round-robin over ready identities,
 * retiring any that exhausted their budget on the way.
 */
async function pickIdentity() {
  // Retire exhausted identities (replacement is handled inside retireIdentity)
  for (const idn of [...identities]) {
    if (idn.shouldRetire() && !idn.retiring) {
      await retireIdentity(
        idn,
        idn.generationCount >= MAX_GENERATIONS_BEFORE_REFRESH
          ? "signature budget"
          : "age",
      );
    }
  }

  let ready = identities.filter((x) => x.ready && !x.retired);
  if (ready.length === 0) {
    await warmPool();
    ready = identities.filter((x) => x.ready && !x.retired);
  }
  if (ready.length === 0) {
    throw new Error("No ready identity in pool");
  }

  // Top the pool back up if something failed earlier
  if (identities.length + replacementsInFlight < IDENTITY_POOL_SIZE) {
    replaceIdentityInBackground();
  }

  rrCursor = (rrCursor + 1) % ready.length;
  return ready[rrCursor];
}

/**
 * /report: a caller saw TikTok answer an empty body for a request carrying
 * this identity's cookies. Retire it now instead of waiting for the budget.
 */
function findIdentityByCookieValue(value) {
  if (!value) return null;
  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value));
  } catch (e) {}
  try {
    candidates.push(encodeURIComponent(value));
  } catch (e) {}
  for (const idn of identities) {
    for (const v of candidates) {
      if (idn.cookieIndex.has(v)) return idn;
    }
  }
  return null;
}

function extractCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, "g");
  let last = null;
  let m;
  while ((m = re.exec(cookieHeader)) !== null) last = m[1];
  return last;
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Generate signed URL for any TikTok URL
 * Triggers fetch, SDK signs it, we capture and abort
 * @param {string} targetUrl - The URL to sign
 * @param {string|null} userAgent - Optional custom user agent to return in response
 */
async function generateSignedUrl(
  targetUrl,
  userAgent = null,
  navigateTo = null,
) {
  return queueSignatureRequest(() =>
    _generateSignedUrlInternal(targetUrl, userAgent, navigateTo),
  );
}

/**
 * Internal implementation - must be called through queue
 */
async function _generateSignedUrlInternal(
  targetUrl,
  userAgent = null,
  navigateTo = null,
) {
  // Parse target URL - remove existing signatures and normalize fingerprint params
  const urlObj = new URL(targetUrl);
  urlObj.searchParams.delete("X-Bogus");
  urlObj.searchParams.delete("X-Gnarly");
  urlObj.searchParams.delete("msToken");
  normalizeUrlFingerprint(urlObj);
  const fetchUrl = urlObj.toString();

  const attempt = async (idn) => {
    if (navigateTo) {
      console.log(`[Server] Sign via page intercept: navigateTo=${navigateTo}`);
      return _signViaPageIntercept(idn, fetchUrl, navigateTo, userAgent);
    }
    console.log(
      `[Server] Signing URL (identity ${idn.id}): ${fetchUrl.substring(0, 100)}...`,
    );
    return _signDirectly(idn, fetchUrl, userAgent);
  };

  const idn = await pickIdentity();
  try {
    return await attempt(idn);
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    // SDK got detached from the page (navigation, crash, lost context).
    // Retire this identity and retry once on a fresh one.
    if (
      /SDK not initialized|SDK not ready|detached|Target closed|Session closed/i.test(
        msg,
      )
    ) {
      console.log(
        `[Server] "${msg}" — retiring identity ${idn.id} and retrying on another...`,
      );
      await destroyIdentity(idn);
      const next = await pickIdentity();
      return attempt(next);
    }
    throw e;
  }
}

async function _signViaPageIntercept(
  idn,
  targetUrl,
  navigateTo,
  userAgent = null,
) {
  const page = idn.page;
  const targetPath = new URL(targetUrl).pathname;
  const callStart = Date.now();

  // Always navigate per call — that's the only reliable way to get a fresh
  // signed URL that TikTok will accept on external fetch. Cache-reuse and
  // scroll-trigger were both tried and produced unfetchable URLs.
  await page.goto(navigateTo, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await dismissTikTokErrorIfPresent(page);

  // Wait for the permanent listener to capture a matching signed URL emitted
  // after this call started (rules out a stale entry left from a prior nav).
  // Residential proxies can be slow — give it 15s.
  const WAIT_MS = 15000;
  while (Date.now() - callStart < WAIT_MS) {
    const c = idn.signedUrlCache.get(targetPath);
    if (c && c.capturedAt >= callStart) {
      await idn.updateCookies();
      idn.generationCount++;
      return parseResult(idn, c.url, userAgent);
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  throw new Error(
    `No fresh ${targetPath} request emitted by ${navigateTo} within ${WAIT_MS / 1000}s`,
  );
}

async function _signDirectly(idn, fetchUrl, userAgent = null) {
  const page = idn.page;
  const out = await page.evaluate((url) => {
    if (typeof window.__sdkN === "undefined") {
      return { error: "SDK not initialized" };
    }
    const sdkN = window.__sdkN;
    let table = null;
    if (sdkN.u && sdkN.u[995] && sdkN.u[995].v) table = sdkN.u;
    else if (sdkN.B && sdkN.B.o && sdkN.B.o[995] && sdkN.B.o[995].v)
      table = sdkN.B.o;
    else if (sdkN.o && sdkN.o[995] && sdkN.o[995].v) table = sdkN.o;
    if (!table) return { error: "SDK not ready" };
    const u995 = table[995] && table[995].v;
    if (typeof u995 !== "function") {
      return { error: "SDK not ready" };
    }

    const u = new URL(url);
    const msTokenMatches = [...document.cookie.matchAll(/msToken=([^;]+)/g)];
    const msToken = msTokenMatches.length
      ? msTokenMatches[msTokenMatches.length - 1][1]
      : "";
    u.searchParams.delete("X-Bogus");
    u.searchParams.delete("X-Gnarly");
    u.searchParams.set("msToken", msToken);
    const queryString = u.search.slice(1);

    if (typeof window.__sigCallCount !== "number") window.__sigCallCount = 100;
    window.__sigCallCount += 1;
    const baseN = window.__sigCallCount;
    let counterObj = {
      totalXHRRequests: Math.floor(baseN * 0.6),
      totalFetchRequests: Math.floor(baseN * 0.4) + 3,
      interceptedXHRRequests: Math.floor(baseN * 0.1),
      interceptedFetchRequests: Math.floor(baseN * 0.05) + 1,
    };
    try {
      const cap3 = window.__cap3 || [];
      const lastNat = [...cap3]
        .reverse()
        .find((c) => c.fn === "gnarly_x" && c.args && c.args[3] && c.args[3].v);
      if (lastNat && lastNat.args[3].v) {
        const v = lastNat.args[3].v;
        const fromCap = {
          totalXHRRequests: (v.totalXHRRequests && v.totalXHRRequests.v) || 0,
          totalFetchRequests:
            (v.totalFetchRequests && v.totalFetchRequests.v) || 0,
          interceptedXHRRequests:
            (v.interceptedXHRRequests && v.interceptedXHRRequests.v) || 0,
          interceptedFetchRequests:
            (v.interceptedFetchRequests && v.interceptedFetchRequests.v) || 0,
        };
        if (fromCap.totalXHRRequests + fromCap.totalFetchRequests > 0) {
          counterObj = fromCap;
        }
      }
    } catch (e) {}

    const acrawlerInst =
      window.byted_acrawler && typeof window.byted_acrawler === "object"
        ? window.byted_acrawler
        : null;
    try {
      const xb = u995.call(acrawlerInst, queryString, "");
      return {
        urlBase: u.toString(),
        queryString,
        xBogus: xb,
        msTokenUsed: msToken,
        userAgent: navigator.userAgent,
        cookies: document.cookie,
        counters: counterObj,
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  }, fetchUrl);

  if (out.error) {
    throw new Error("Sign failed: " + out.error);
  }

  const xg = encodeXGnarly(out.queryString, "", out.userAgent, out.counters, {
    ubcode: 4,
    sdkVersion: "1.0.0.368",
  });

  const u = new URL(out.urlBase);
  u.searchParams.set("X-Bogus", out.xBogus);
  u.searchParams.set("X-Gnarly", xg);

  await idn.updateCookies();
  idn.generationCount++;
  return parseResult(idn, u.toString(), userAgent);
}

/**
 * Normalize browser fingerprint query parameters to match the browser environment.
 * TikTok's X-Bogus signature encodes the browser's actual fingerprint, so the URL
 * params must be consistent with the browser environment or TikTok returns
 * "url doesn't match".
 * Only overwrites params that are already present in the URL.
 * @param {URL} urlObj - The URL object to normalize in place
 */
function normalizeUrlFingerprint(urlObj) {
  const params = urlObj.searchParams;

  // Map of fingerprint param -> correct value for our browser environment
  const fingerprint = {
    browser_platform: "MacIntel", // matches navigator.platform override
    os: "mac", // matches Safari macOS UA
    screen_width: "1920", // matches viewport
    screen_height: "1080", // matches viewport
  };

  let normalized = false;
  for (const [key, correctValue] of Object.entries(fingerprint)) {
    if (params.has(key) && params.get(key) !== correctValue) {
      console.log(
        `[Server] Normalizing ${key}: "${params.get(key)}" -> "${correctValue}"`,
      );
      params.set(key, correctValue);
      normalized = true;
    }
  }

  if (normalized) {
    console.log(
      "[Server] URL fingerprint params normalized to match browser environment",
    );
  }
}

function parseResult(idn, url, userAgent = null) {
  const urlObj = new URL(url);
  const cookieString = idn.cookies
    ? idn.cookies.map((c) => `${c.name}=${c.value}`).join("; ")
    : "";
  return {
    signedUrl: url,
    xBogus: urlObj.searchParams.get("X-Bogus"),
    xGnarly: urlObj.searchParams.get("X-Gnarly"),
    secUid: urlObj.searchParams.get("secUid"),
    cursor: urlObj.searchParams.get("cursor"),
    deviceId: urlObj.searchParams.get("device_id"),
    userAgent: userAgent || currentUserAgent,
    cookies: cookieString,
    identity: idn.id,
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

function poolStats() {
  const ready = identities.filter((x) => x.ready && !x.retired);
  const oldest = ready.reduce((a, x) => Math.max(a, x.ageMs), 0);
  return {
    poolSize: IDENTITY_POOL_SIZE,
    identities: identities.map((x) => x.summary()),
    readyIdentities: ready.length,
    replacementsInFlight,
    generationCount: identities.reduce((a, x) => a + x.generationCount, 0),
    sessionAgeMinutes: Math.round(oldest / 60000),
  };
}

/**
 * HTTP Request Handler
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Health check
    if (url.pathname === "/health") {
      const stats = poolStats();
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          ready: stats.readyIdentities > 0,
          initializing: !!poolWarming || replacementsInFlight > 0,
          initMethod: identities.find((x) => x.ready)?.initMethod || null,
          ...stats,
          maxGenerationsBeforeRefresh: MAX_GENERATIONS_BEFORE_REFRESH,
          maxSessionAgeMinutes: MAX_SESSION_AGE_MS / 60000,
          queueLength: requestQueue.length,
          isProcessing: isProcessingQueue,
          localSdkAvailable: !!localSdkContent,
          proxyEnabled: PROXY_ENABLED,
          userAgent: currentUserAgent,
        }),
      );
      return;
    }

    // Report a burnt identity: the caller saw an empty 200 body for a request
    // carrying these cookies. Retire that identity now.
    if (url.pathname === "/report" && req.method === "POST") {
      const body = await readBody(req);
      let json = {};
      try {
        json = JSON.parse(body);
      } catch (e) {}
      const ttwid = json.ttwid || extractCookieValue(json.cookies, "ttwid");
      const msToken =
        json.msToken || extractCookieValue(json.cookies, "msToken");
      const idn =
        findIdentityByCookieValue(ttwid) || findIdentityByCookieValue(msToken);

      if (!idn) {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", action: "unknown_identity" }));
        return;
      }
      if (idn.ageMs < REPORT_MIN_AGE_MS) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: "ok",
            action: "ignored_too_young",
            identity: idn.id,
          }),
        );
        return;
      }
      if (idn.retiring || idn.retired) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: "ok",
            action: "already_retiring",
            identity: idn.id,
          }),
        );
        return;
      }
      if (Date.now() - lastReportRetireAt < REPORT_RETIRE_COOLDOWN_MS) {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            status: "ok",
            action: "ignored_cooldown",
            identity: idn.id,
          }),
        );
        return;
      }
      lastReportRetireAt = Date.now();
      console.log(
        `[Identity ${idn.id}] Reported burnt by caller (${json.reason || "empty response"})`,
      );
      // Don't block the caller on the replacement warm-up.
      retireIdentity(idn, "reported burnt").catch((e) =>
        console.error(
          `[Identity ${idn.id}] Retire after report failed:`,
          e.message,
        ),
      );
      res.writeHead(200);
      res.end(
        JSON.stringify({ status: "ok", action: "retired", identity: idn.id }),
      );
      return;
    }

    // Fetch endpoint - makes request through browser (slower, but 100% reliable fallback)
    // Use /signature + external requests for better scalability
    if (url.pathname === "/fetch" && req.method === "POST") {
      const body = await readBody(req);

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
        res.end(
          JSON.stringify({ status: "error", message: "URL is required" }),
        );
        return;
      }

      // A signed URL carries the msToken of the identity that signed it; fetch
      // from that same identity so cookies and signature agree. Unsigned URLs
      // (page HTML etc.) can go through any identity.
      let idn = null;
      try {
        const msToken = new URL(targetUrl).searchParams.get("msToken");
        const owner = findIdentityByCookieValue(msToken);
        if (owner && owner.ready && !owner.retired) idn = owner;
      } catch (e) {}
      if (!idn) idn = await pickIdentity();

      console.log(
        `[Server] Fetching through browser (identity ${idn.id}):`,
        targetUrl.substring(0, 80) + "...",
      );

      const fetchResult = await idn.page.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            credentials: "include",
            headers: { Accept: "application/json, text/html;q=0.9, */*;q=0.8" },
          });
          const text = await response.text();
          const contentType = response.headers.get("content-type") || "";
          // API endpoints answer JSON; page URLs (e.g. /@user/video/123) answer
          // HTML. Parse JSON when possible, otherwise hand back the raw text so
          // callers can extract embedded page data themselves.
          let data = null;
          let raw = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              raw = text;
            }
          }
          return {
            status: response.status,
            bodyLength: text.length,
            contentType,
            data,
            text: raw,
          };
        } catch (e) {
          return { error: e.message };
        }
      }, targetUrl);

      console.log(
        "[Server] Fetch result:",
        fetchResult.error || `${fetchResult.bodyLength} bytes`,
      );

      if (fetchResult.error) {
        res.writeHead(500);
        res.end(
          JSON.stringify({ status: "error", message: fetchResult.error }),
        );
        return;
      }

      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          httpStatus: fetchResult.status,
          contentType: fetchResult.contentType,
          data: fetchResult.data,
          ...(fetchResult.text != null && { text: fetchResult.text }),
        }),
      );
      return;
    }

    if (url.pathname === "/signature" && req.method === "POST") {
      const body = await readBody(req);

      let targetUrl = null;
      let userAgent = null;
      let navigateTo = null;

      // Try to parse as JSON first
      try {
        const json = JSON.parse(body);
        if (json.url) targetUrl = json.url;
        if (json.userAgent) userAgent = json.userAgent;
        if (json.navigateTo) navigateTo = json.navigateTo;
      } catch (e) {
        // Body might be a direct URL string
        try {
          new URL(body);
          targetUrl = body;
        } catch (e2) {}
      }

      if (!targetUrl) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            status: "error",
            message:
              'URL is required in body as JSON { "url": "...", "navigateTo": "...", "userAgent": "..." } or plain text URL',
          }),
        );
        return;
      }

      const result = await generateSignedUrl(targetUrl, userAgent, navigateTo);

      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          data: {
            signed_url: result.signedUrl,
            "x-bogus": result.xBogus,
            "x-gnarly": result.xGnarly,
            "device-id": result.deviceId,
            cookies: result.cookies,
            identity: result.identity,
            navigator: {
              user_agent: result.userAgent,
            },
          },
        }),
      );
      return;
    }

    if (url.pathname === "/restart") {
      console.log("[Server] Restarting pool...");
      // Retire every identity in place (replacements are minted first when
      // possible) rather than tearing the browser down, so in-flight signing
      // keeps working.
      const current = [...identities];
      for (const idn of current) {
        await destroyIdentity(idn);
      }
      await warmPool();
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          message: "Pool restarted",
          ...poolStats(),
        }),
      );
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (e) {
    console.error("[Server] Error:", e.message);
    res.writeHead(500);
    res.end(JSON.stringify({ status: "error", message: e.message }));
  }
}

// Create server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[Server] TikTok Signature Server running on port ${PORT}`);
  console.log(`[Server] Identity pool size: ${IDENTITY_POOL_SIZE}`);
  console.log(`[Server] Endpoints:`);
  console.log(
    `  POST /signature - Generate signed URL (RECOMMENDED for scalability)`,
  );
  console.log(
    `  POST /fetch     - Fetch through browser (fallback, 100% reliable)`,
  );
  console.log(`  POST /report    - Report a burnt identity (retired at once)`);
  console.log(`  GET  /health    - Health check`);
  console.log(
    `  GET  /restart   - Retire all identities and warm a fresh pool`,
  );

  // Warm the pool on startup
  warmPool().catch((e) => console.error("[Server] Init failed:", e.message));
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Server] Shutting down...");
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Server] Received SIGTERM, shutting down...");
  await closeBrowser();
  process.exit(0);
});
