/**
 * Proxy pool — one proxy per browser identity.
 *
 * Each identity runs in its own incognito BrowserContext, and Puppeteer lets a
 * context carry its own `proxyServer`, so instead of routing the whole browser
 * through one PROXY_HOST every identity is pinned to a proxy for its lifetime.
 * TikTok keys on the identity's ttwid/msToken AND on the egress IP, so an
 * identity never changes IP mid-life; a retired identity's replacement may
 * reuse the same proxy (fresh cookies, same IP is normal browser behaviour).
 *
 * Sources (all optional, merged and de-duplicated):
 *   PROXY_LIST  - proxies separated by commas, whitespace or newlines
 *   PROXY_FILE  - path to a .txt (one proxy per line, `#` comments) or a
 *                 .json file (array of strings or of
 *                 { host, port, username?, password?, protocol? } objects)
 *   PROXY_HOST / PROXY_USER / PROXY_PASS - legacy single proxy
 *
 * Accepted proxy notations:
 *   host:port
 *   host:port:user:pass
 *   user:pass@host:port
 *   scheme://[user:pass@]host:port   (scheme: http, https, socks4, socks5)
 *
 * Note: Chromium cannot authenticate SOCKS proxies, so a SOCKS proxy with
 * credentials is rejected at load time rather than failing silently later.
 */

import fs from "fs";
import path from "path";

const SCHEMES = new Set(["http", "https", "socks4", "socks5"]);

/**
 * Parse one proxy in any accepted notation.
 * @returns {{protocol:string, host:string, port:number, username:string, password:string}|null}
 */
export function parseProxy(input) {
  if (input && typeof input === "object") {
    const host = String(input.host || "").trim();
    const port = Number(input.port);
    if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
      return null;
    }
    const protocol = String(input.protocol || "http").toLowerCase();
    if (!SCHEMES.has(protocol)) return null;
    return {
      protocol,
      host,
      port,
      username: input.username ? String(input.username) : "",
      password: input.password ? String(input.password) : "",
    };
  }

  let s = String(input || "").trim();
  if (!s || s.startsWith("#")) return null;

  let protocol = "http";
  const schemeMatch = s.match(/^([a-z0-9]+):\/\//i);
  if (schemeMatch) {
    protocol = schemeMatch[1].toLowerCase();
    if (!SCHEMES.has(protocol)) return null;
    s = s.slice(schemeMatch[0].length);
  }
  s = s.replace(/\/+$/, "");

  let username = "";
  let password = "";
  let hostPort = s;

  const at = s.lastIndexOf("@");
  if (at >= 0) {
    // user:pass@host:port
    const cred = s.slice(0, at);
    hostPort = s.slice(at + 1);
    const colon = cred.indexOf(":");
    username = colon >= 0 ? cred.slice(0, colon) : cred;
    password = colon >= 0 ? cred.slice(colon + 1) : "";
  } else {
    const parts = s.split(":");
    if (parts.length === 4) {
      // host:port:user:pass (common provider export format)
      hostPort = `${parts[0]}:${parts[1]}`;
      username = parts[2];
      password = parts[3];
    } else if (parts.length !== 2) {
      return null;
    }
  }

  const m = hostPort.match(/^([^:\s]+):(\d{1,5})$/);
  if (!m) return null;
  const port = Number(m[2]);
  if (port <= 0 || port > 65535) return null;

  try {
    username = decodeURIComponent(username);
    password = decodeURIComponent(password);
  } catch (e) {}

  return { protocol, host: m[1], port, username, password };
}

/** Parse a proxy list from text (commas, whitespace, newlines, `#` comments). */
export function parseProxyText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => line.split(/[\s,]+/))
    .map(parseProxy)
    .filter(Boolean);
}

/** Parse a proxy list from a JSON value (array, or { proxies: [...] }). */
export function parseProxyJson(value) {
  const list = Array.isArray(value) ? value : value?.proxies;
  if (!Array.isArray(list)) return [];
  return list.map(parseProxy).filter(Boolean);
}

/** Stable key used to de-duplicate and identify a proxy. */
export function proxyKey(p) {
  return `${p.protocol}://${p.username ? `${p.username}@` : ""}${p.host}:${p.port}`;
}

/** host:port with the scheme, no credentials — what Chromium's proxyServer takes. */
export function proxyServerArg(p) {
  return `${p.protocol}://${p.host}:${p.port}`;
}

/**
 * Full proxy URL including credentials. Returned by /signature so a caller
 * that fetches the signed URL itself can leave through the same egress IP as
 * the identity that signed it.
 */
export function proxyUrl(p) {
  const cred = p.username
    ? `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@`
    : "";
  return `${p.protocol}://${cred}${p.host}:${p.port}`;
}

/** Display form with the password masked, safe for logs and /health. */
export function maskProxy(p) {
  const cred = p.username ? `${p.username}:***@` : "";
  return `${p.protocol}://${cred}${p.host}:${p.port}`;
}

/**
 * Load proxies from the environment. Throws on an unreadable / malformed
 * PROXY_FILE so a typo doesn't silently fall back to a direct connection.
 */
export function loadProxiesFromEnv(env = process.env, cwd = process.cwd()) {
  const found = [];

  if (env.PROXY_LIST) found.push(...parseProxyText(env.PROXY_LIST));

  if (env.PROXY_FILE) {
    const file = path.resolve(cwd, env.PROXY_FILE);
    const raw = fs.readFileSync(file, "utf-8");
    if (file.toLowerCase().endsWith(".json")) {
      found.push(...parseProxyJson(JSON.parse(raw)));
    } else {
      found.push(...parseProxyText(raw));
    }
  }

  // Legacy single proxy. PROXY_ENABLED keeps its old meaning for PROXY_HOST.
  if (env.PROXY_ENABLED === "true" && env.PROXY_HOST) {
    const p = parseProxy(env.PROXY_HOST);
    if (p) {
      if (env.PROXY_USER) p.username = env.PROXY_USER;
      if (env.PROXY_PASS) p.password = env.PROXY_PASS;
      found.push(p);
    }
  }

  const unique = new Map();
  for (const p of found) {
    if (p.protocol.startsWith("socks") && (p.username || p.password)) {
      throw new Error(
        `Chromium cannot authenticate SOCKS proxies: ${maskProxy(p)}. Use an HTTP proxy or an IP-whitelisted SOCKS proxy.`,
      );
    }
    unique.set(proxyKey(p), p);
  }
  return [...unique.values()];
}

/**
 * Tracks which identities use which proxy and benches failing proxies.
 */
export class ProxyPool {
  /**
   * @param {ReturnType<typeof parseProxy>[]} proxies
   * @param {{ penaltyMs?: number, maxPerProxy?: number, now?: () => number }} [opts]
   */
  constructor(proxies, opts = {}) {
    this.penaltyMs = opts.penaltyMs ?? 5 * 60 * 1000;
    this.maxPerProxy = Math.max(1, opts.maxPerProxy ?? 1);
    this.now = opts.now || Date.now;
    this.entries = proxies.map((proxy) => ({
      proxy,
      key: proxyKey(proxy),
      inUse: 0,
      failures: 0,
      penalizedUntil: 0,
      lastPickedAt: 0,
    }));
  }

  get size() {
    return this.entries.length;
  }

  get enabled() {
    return this.entries.length > 0;
  }

  /** Identity slots the pool can fill: proxies × identities-per-proxy. */
  get capacity() {
    return this.entries.length * this.maxPerProxy;
  }

  /**
   * Reserve a proxy for a new identity: the least-loaded non-penalized one,
   * least-recently-picked on ties. If every proxy is benched, the one whose
   * penalty ends first is used, so the server keeps working (degraded)
   * instead of refusing to start identities.
   * @returns {object|null} the proxy, or null when the pool is empty
   */
  acquire() {
    if (!this.entries.length) return null;
    const now = this.now();
    const healthy = this.entries.filter((e) => e.penalizedUntil <= now);
    const pick = healthy.length
      ? healthy.reduce((a, b) =>
          b.inUse < a.inUse ||
          (b.inUse === a.inUse && b.lastPickedAt < a.lastPickedAt)
            ? b
            : a,
        )
      : this.entries.reduce((a, b) =>
          b.penalizedUntil < a.penalizedUntil ? b : a,
        );
    pick.inUse++;
    pick.lastPickedAt = now;
    return pick.proxy;
  }

  /** Give back a proxy reserved with acquire(). */
  release(proxy) {
    const e = this.#find(proxy);
    if (e && e.inUse > 0) e.inUse--;
  }

  /** Bench a proxy (dead, timing out, or burning identities). */
  penalize(proxy, reason = "") {
    const e = this.#find(proxy);
    if (!e) return;
    e.failures++;
    e.penalizedUntil = this.now() + this.penaltyMs;
    return { proxy: maskProxy(e.proxy), reason, until: e.penalizedUntil };
  }

  /** A successful identity start clears the failure streak. */
  markHealthy(proxy) {
    const e = this.#find(proxy);
    if (e) e.failures = 0;
  }

  stats() {
    const now = this.now();
    return this.entries.map((e) => ({
      proxy: maskProxy(e.proxy),
      identities: e.inUse,
      failures: e.failures,
      penalized: e.penalizedUntil > now,
      penaltyRemainingSec:
        e.penalizedUntil > now ? Math.ceil((e.penalizedUntil - now) / 1000) : 0,
    }));
  }

  #find(proxy) {
    if (!proxy) return null;
    const key = proxyKey(proxy);
    return this.entries.find((e) => e.key === key) || null;
  }
}
