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
 *   host:port:user:pass          (the password may itself contain ':')
 *   user:pass@host:port
 *   scheme://[user:pass@]host:port   (scheme: http, https, socks4, socks5)
 * The legacy PROXY_HOST may omit the port (Chromium's default for the scheme).
 * IPv6 hosts are not supported.
 *
 * Configuration errors throw at startup: a mistyped proxy must never fall back
 * to a direct connection, where the server would run on the host's real IP
 * while the operator believes it is proxied.
 */

import fs from "fs";
import path from "path";

const SCHEMES = new Set(["http", "https", "socks4", "socks5"]);
const DEFAULT_PORTS = { http: 80, https: 443, socks4: 1080, socks5: 1080 };

const DEFAULT_POOL_SIZE = 3;
const DEFAULT_PENALTY_MS = 5 * 60 * 1000;

/** A proxy configuration problem; the message never contains a password. */
export class ProxyConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProxyConfigError";
  }
}

function validPort(n) {
  return Number.isInteger(n) && n > 0 && n <= 65535;
}

/**
 * Parse one proxy in any accepted notation.
 * @param {string|object} input
 * @param {{ allowMissingPort?: boolean }} [opts]
 * @returns {{protocol:string, host:string, port:number, username:string, password:string}|null}
 */
export function parseProxy(input, opts = {}) {
  if (input && typeof input === "object") {
    const host = String(input.host || "").trim();
    const port = Number(input.port);
    const protocol = String(input.protocol || "http").toLowerCase();
    if (!host || /[\s:/@]/.test(host) || !validPort(port)) return null;
    if (!SCHEMES.has(protocol)) return null;
    return {
      protocol,
      host,
      port,
      username: input.username ? String(input.username) : "",
      password: input.password ? String(input.password) : "",
    };
  }

  let s = String(input ?? "").trim();
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
  let host;
  let portStr;

  const at = s.lastIndexOf("@");
  if (at >= 0) {
    // user:pass@host:port — split credentials on the FIRST ':'
    const cred = s.slice(0, at);
    const colon = cred.indexOf(":");
    username = colon >= 0 ? cred.slice(0, colon) : cred;
    password = colon >= 0 ? cred.slice(colon + 1) : "";
    [host, portStr] = s.slice(at + 1).split(":");
    if (s.slice(at + 1).split(":").length > 2) return null;
  } else {
    const parts = s.split(":");
    if (parts.length === 2) {
      [host, portStr] = parts;
    } else if (parts.length >= 4) {
      // host:port:user:pass — split on the first three ':' so the password
      // may contain ':'
      [host, portStr, username] = parts;
      password = parts.slice(3).join(":");
    } else if (parts.length === 1 && opts.allowMissingPort) {
      host = parts[0];
    } else {
      return null;
    }
  }

  if (!host || /[\s/@]/.test(host)) return null;
  let port;
  if (portStr === undefined || portStr === "") {
    if (!opts.allowMissingPort) return null;
    port = DEFAULT_PORTS[protocol];
  } else {
    if (!/^\d{1,5}$/.test(portStr)) return null;
    port = Number(portStr);
    if (!validPort(port)) return null;
  }

  try {
    username = decodeURIComponent(username);
    password = decodeURIComponent(password);
  } catch (e) {}

  return { protocol, host, port, username, password };
}

/**
 * Mask the credential part of a RAW (possibly unparseable) entry so it can be
 * named in an error message: `user:pass@host` → `user:***@host`,
 * `host:port:user:pass` → `host:port:user:***`.
 */
export function maskRawProxy(raw) {
  let s = typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "");
  if (typeof raw === "object" && raw && raw.password) {
    return JSON.stringify({ ...raw, password: "***" });
  }
  const scheme = (s.match(/^[a-z0-9]+:\/\//i) || [""])[0];
  let rest = s.slice(scheme.length);
  const at = rest.lastIndexOf("@");
  if (at >= 0) {
    const cred = rest.slice(0, at);
    const colon = cred.indexOf(":");
    if (colon >= 0) rest = `${cred.slice(0, colon)}:***${rest.slice(at)}`;
  } else {
    const parts = rest.split(":");
    if (parts.length >= 4) rest = `${parts.slice(0, 3).join(":")}:***`;
  }
  return scheme + rest;
}

function parseAll(entries, source) {
  const proxies = [];
  const bad = [];
  for (const e of entries) {
    const p = parseProxy(e);
    if (p) proxies.push(p);
    else bad.push(maskRawProxy(e));
  }
  if (bad.length) {
    throw new ProxyConfigError(
      `Invalid proxy entr${bad.length > 1 ? "ies" : "y"} in ${source}: ${bad.map((b) => `"${b}"`).join(", ")}. ` +
        "Expected host:port, host:port:user:pass, user:pass@host:port or scheme://user:pass@host:port.",
    );
  }
  return proxies;
}

/**
 * Parse a proxy list from text (commas, whitespace, newlines, `#` comments).
 * @throws {ProxyConfigError} on any entry that does not parse
 */
export function parseProxyText(text, source = "proxy list") {
  const entries = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => line.split(/[\s,]+/))
    .filter(Boolean);
  return parseAll(entries, source);
}

/**
 * Parse a proxy list from a JSON value (array, or { proxies: [...] }).
 * @throws {ProxyConfigError} on a wrong shape or any entry that does not parse
 */
export function parseProxyJson(value, source = "proxy JSON") {
  const list = Array.isArray(value) ? value : value?.proxies;
  if (!Array.isArray(list)) {
    throw new ProxyConfigError(
      `${source} must be an array of proxies or { "proxies": [...] }`,
    );
  }
  return parseAll(list, source);
}

/** Stable key used to de-duplicate and identify a proxy. */
export function proxyKey(p) {
  return `${p.protocol}://${p.username ? `${p.username}@` : ""}${p.host}:${p.port}`;
}

/** host:port with the scheme, no credentials — what Chromium's proxyServer takes. */
export function proxyServerArg(p) {
  return `${p.protocol}://${p.host}:${p.port}`;
}

/** Full proxy URL including credentials (only exposed when explicitly enabled). */
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
 * Load proxies from the environment.
 * @throws {ProxyConfigError} on an unreadable / malformed PROXY_FILE, any
 *   unparseable entry, or an authenticated SOCKS proxy
 */
export function loadProxiesFromEnv(env = process.env, cwd = process.cwd()) {
  const found = [];

  if (env.PROXY_LIST)
    found.push(...parseProxyText(env.PROXY_LIST, "PROXY_LIST"));

  if (env.PROXY_FILE) {
    const file = path.resolve(cwd, env.PROXY_FILE);
    let raw;
    try {
      raw = fs.readFileSync(file, "utf-8");
    } catch (e) {
      throw new ProxyConfigError(
        `Cannot read PROXY_FILE ${file}: ${e.code || e.message}`,
      );
    }
    if (file.toLowerCase().endsWith(".json")) {
      let json;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        throw new ProxyConfigError(
          `PROXY_FILE ${file} is not valid JSON: ${e.message}`,
        );
      }
      found.push(...parseProxyJson(json, `PROXY_FILE ${file}`));
    } else {
      found.push(...parseProxyText(raw, `PROXY_FILE ${file}`));
    }
  }

  // Legacy single proxy. PROXY_ENABLED keeps its old meaning for PROXY_HOST,
  // and like before the port may be omitted (Chromium uses the scheme default).
  if (env.PROXY_ENABLED === "true" && env.PROXY_HOST) {
    const p = parseProxy(env.PROXY_HOST, { allowMissingPort: true });
    if (!p) {
      throw new ProxyConfigError(
        `Invalid PROXY_HOST "${maskRawProxy(env.PROXY_HOST)}" (expected host or host:port)`,
      );
    }
    if (env.PROXY_USER) p.username = env.PROXY_USER;
    if (env.PROXY_PASS) p.password = env.PROXY_PASS;
    found.push(p);
  }

  const unique = new Map();
  for (const p of found) {
    if (p.protocol.startsWith("socks") && (p.username || p.password)) {
      throw new ProxyConfigError(
        `Chromium cannot authenticate SOCKS proxies: ${maskProxy(p)}. Use an HTTP proxy or an IP-whitelisted SOCKS proxy.`,
      );
    }
    unique.set(proxyKey(p), p);
  }
  return [...unique.values()];
}

/** Non-negative integer env var; unset/empty → default. 0 is a valid value. */
function envInt(env, name, def, min = 0) {
  const v = env[name];
  if (v === undefined || String(v).trim() === "") return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) {
    throw new ProxyConfigError(
      `${name} must be an integer >= ${min} (got "${v}")`,
    );
  }
  return n;
}

/**
 * Resolve the whole proxy/pool configuration from the environment.
 *
 * Pool size: IDENTITY_POOL_SIZE when set; otherwise proxies × IDENTITIES_PER_PROXY
 * when a multi-proxy source (PROXY_LIST / PROXY_FILE) is in use; otherwise 3
 * (unchanged default, including the legacy single PROXY_HOST setup).
 *
 * Identities per proxy is raised to ceil(poolSize / proxies) when needed, so a
 * pool larger than proxies × IDENTITIES_PER_PROXY (e.g. 3 identities on the one
 * legacy proxy) still spreads evenly instead of being refused.
 *
 * @throws {ProxyConfigError}
 */
export function loadProxyConfig(env = process.env, cwd = process.cwd()) {
  const proxies = loadProxiesFromEnv(env, cwd);
  const multiProxy = !!(env.PROXY_LIST || env.PROXY_FILE);
  const identitiesPerProxy = envInt(env, "IDENTITIES_PER_PROXY", 1, 1);
  const explicitPool = envInt(env, "IDENTITY_POOL_SIZE", null, 1);

  const poolSize =
    explicitPool ??
    (multiProxy && proxies.length
      ? proxies.length * identitiesPerProxy
      : DEFAULT_POOL_SIZE);
  const maxPerProxy = proxies.length
    ? Math.max(identitiesPerProxy, Math.ceil(poolSize / proxies.length))
    : 0;

  return {
    proxies,
    poolSize,
    maxPerProxy,
    penaltyMs: envInt(env, "PROXY_PENALTY_MS", DEFAULT_PENALTY_MS, 0),
    exposeProxyInSignature: env.EXPOSE_PROXY_IN_SIGNATURE === "true",
  };
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
    this.penaltyMs = opts.penaltyMs ?? DEFAULT_PENALTY_MS;
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
   * Reserve a proxy for a new identity, never putting more than maxPerProxy
   * live identities on one IP while a slot exists anywhere:
   *   1. a healthy proxy with a free slot (least loaded, least recently picked);
   *   2. else a benched proxy with a free slot (penalty ending first) — reusing
   *      a benched IP beats doubling up two live identities on a healthy one;
   *   3. else (every slot taken, i.e. more identities than capacity) the least
   *      loaded proxy, healthy first.
   * @returns {object|null} the proxy, or null when the pool is empty
   */
  acquire() {
    if (!this.entries.length) return null;
    const now = this.now();
    const healthy = (e) => e.penalizedUntil <= now;
    const free = (e) => e.inUse < this.maxPerProxy;
    const byLoad = (a, b) =>
      b.inUse < a.inUse ||
      (b.inUse === a.inUse && b.lastPickedAt < a.lastPickedAt)
        ? b
        : a;

    const healthyFree = this.entries.filter((e) => healthy(e) && free(e));
    const benchedFree = this.entries.filter((e) => !healthy(e) && free(e));
    let pick;
    if (healthyFree.length) {
      pick = healthyFree.reduce(byLoad);
    } else if (benchedFree.length) {
      pick = benchedFree.reduce((a, b) =>
        b.penalizedUntil < a.penalizedUntil ? b : a,
      );
    } else {
      const healthyAll = this.entries.filter(healthy);
      pick = (healthyAll.length ? healthyAll : this.entries).reduce(byLoad);
    }
    pick.inUse++;
    pick.lastPickedAt = now;
    return pick.proxy;
  }

  /** Give back a proxy reserved with acquire(). */
  release(proxy) {
    const e = this.#find(proxy);
    if (e && e.inUse > 0) e.inUse--;
  }

  /** Bench a proxy (dead, timing out, or burning identities). No-op when penaltyMs is 0. */
  penalize(proxy, reason = "") {
    const e = this.#find(proxy);
    if (!e) return;
    e.failures++;
    if (this.penaltyMs > 0) e.penalizedUntil = this.now() + this.penaltyMs;
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
