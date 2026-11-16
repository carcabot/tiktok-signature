/**
 * Tests for the per-identity proxy pool (no browser needed)
 */

import fs from "fs";
import os from "os";
import path from "path";
import {
  ProxyConfigError,
  ProxyPool,
  loadProxiesFromEnv,
  loadProxyConfig,
  maskProxy,
  maskRawProxy,
  parseProxy,
  parseProxyJson,
  parseProxyText,
  proxyServerArg,
  proxyUrl,
} from "../proxy-pool.mjs";

describe("parseProxy", () => {
  test("host:port", () => {
    expect(parseProxy("1.2.3.4:8080")).toEqual({
      protocol: "http",
      host: "1.2.3.4",
      port: 8080,
      username: "",
      password: "",
    });
  });

  test("host:port:user:pass", () => {
    expect(parseProxy("1.2.3.4:8080:alice:s3cret")).toMatchObject({
      host: "1.2.3.4",
      port: 8080,
      username: "alice",
      password: "s3cret",
    });
  });

  test("host:port:user:pass with ':' in the password", () => {
    expect(parseProxy("1.2.3.4:8080:alice:pa:ss:word")).toMatchObject({
      username: "alice",
      password: "pa:ss:word",
    });
  });

  test("user:pass@host:port, incl. ':' and '@' in the password", () => {
    expect(parseProxy("alice:s3cret@proxy.example.com:3128")).toMatchObject({
      host: "proxy.example.com",
      port: 3128,
      username: "alice",
      password: "s3cret",
    });
    expect(parseProxy("alice:p:a@ss@h:1")).toMatchObject({
      username: "alice",
      password: "p:a@ss",
      host: "h",
    });
  });

  test("scheme://user:pass@host:port with encoded password", () => {
    expect(parseProxy("socks5://bob:p%40ss@10.0.0.1:1080")).toMatchObject({
      protocol: "socks5",
      username: "bob",
      password: "p@ss",
      port: 1080,
    });
  });

  test("object form", () => {
    expect(
      parseProxy({ host: "h", port: "9000", username: "u", password: "p" }),
    ).toMatchObject({ protocol: "http", host: "h", port: 9000, username: "u" });
  });

  test("missing port only with allowMissingPort (legacy PROXY_HOST)", () => {
    expect(parseProxy("proxy.example.com")).toBeNull();
    expect(
      parseProxy("proxy.example.com", { allowMissingPort: true }),
    ).toMatchObject({ host: "proxy.example.com", port: 80 });
    expect(
      parseProxy("https://proxy.example.com", { allowMissingPort: true }),
    ).toMatchObject({ protocol: "https", port: 443 });
  });

  test("rejects garbage", () => {
    expect(parseProxy("")).toBeNull();
    expect(parseProxy("# comment")).toBeNull();
    expect(parseProxy("no-port")).toBeNull();
    expect(parseProxy("1.2.3.4;8080")).toBeNull();
    expect(parseProxy("2.2.2.2:8O80")).toBeNull();
    expect(parseProxy("1.2.3.4:99999")).toBeNull();
    expect(parseProxy("1.2.3.4:80:user")).toBeNull();
    expect(parseProxy("ftp://1.2.3.4:21")).toBeNull();
    expect(parseProxy("[2001:db8::1]:8080")).toBeNull(); // IPv6 unsupported
    expect(parseProxy({ host: "h" })).toBeNull();
  });
});

describe("list parsing", () => {
  test("text: newlines, commas, comments", () => {
    const list = parseProxyText(
      "# pool\n1.1.1.1:80\n2.2.2.2:81:u:p, 3.3.3.3:82 # trailing\n\n",
    );
    expect(list.map((p) => p.host)).toEqual(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
  });

  test("text: any bad entry throws, naming it with the password masked", () => {
    expect(() => parseProxyText("1.2.3.4;8080, proxy.example.com")).toThrow(
      ProxyConfigError,
    );
    let err;
    try {
      parseProxyText("1.1.1.1:80,2.2.2.2:8O80:user:hunter2,3.3.3.3:80");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ProxyConfigError);
    expect(err.message).toContain("2.2.2.2:8O80:user:***");
    expect(err.message).not.toContain("hunter2");
  });

  test("json: array of strings and objects, or { proxies }", () => {
    const arr = ["1.1.1.1:80", { host: "2.2.2.2", port: 81 }];
    expect(parseProxyJson(arr)).toHaveLength(2);
    expect(parseProxyJson({ proxies: arr })).toHaveLength(2);
  });

  test("json: wrong shape or bad entry throws", () => {
    expect(() => parseProxyJson({ nope: true })).toThrow(ProxyConfigError);
    expect(() =>
      parseProxyJson(["1.1.1.1:80", { host: "h", password: "x" }]),
    ).toThrow(/password":"\*\*\*"/);
  });
});

describe("formatting", () => {
  const p = parseProxy("http://u:p@ss@h:1");
  test("proxyServerArg has no credentials", () => {
    expect(proxyServerArg(p)).toBe("http://h:1");
  });
  test("maskProxy hides the password", () => {
    expect(maskProxy(p)).toBe("http://u:***@h:1");
  });
  test("proxyUrl round-trips through parseProxy", () => {
    expect(parseProxy(proxyUrl(p))).toEqual(p);
  });
  test("maskRawProxy masks credentials of unparseable entries", () => {
    expect(maskRawProxy("u:secret@h:8O80")).toBe("u:***@h:8O80");
    expect(maskRawProxy("http://u:secret@h")).toBe("http://u:***@h");
    expect(maskRawProxy("h:8O80:u:secret")).toBe("h:8O80:u:***");
  });
});

describe("loadProxiesFromEnv", () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "proxy-pool-"));
    fs.writeFileSync(path.join(dir, "p.txt"), "1.1.1.1:80\n2.2.2.2:81:u:p\n");
    fs.writeFileSync(
      path.join(dir, "p.json"),
      JSON.stringify(["3.3.3.3:82", { host: "4.4.4.4", port: 83 }]),
    );
    fs.writeFileSync(path.join(dir, "bad.txt"), "1.1.1.1:80\noops\n");
    fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  test("merges list, txt file, json file and legacy proxy, de-duplicated", () => {
    const fromTxt = loadProxiesFromEnv(
      {
        PROXY_LIST: "5.5.5.5:84,1.1.1.1:80",
        PROXY_FILE: "p.txt",
        PROXY_ENABLED: "true",
        PROXY_HOST: "6.6.6.6:85",
        PROXY_USER: "lu",
        PROXY_PASS: "lp",
      },
      dir,
    );
    expect(fromTxt.map((p) => p.host).sort()).toEqual([
      "1.1.1.1",
      "2.2.2.2",
      "5.5.5.5",
      "6.6.6.6",
    ]);
    expect(fromTxt.find((p) => p.host === "6.6.6.6").username).toBe("lu");

    const fromJson = loadProxiesFromEnv({ PROXY_FILE: "p.json" }, dir);
    expect(fromJson.map((p) => p.host)).toEqual(["3.3.3.3", "4.4.4.4"]);
  });

  test("a mistyped entry throws instead of silently going direct", () => {
    expect(() =>
      loadProxiesFromEnv({ PROXY_LIST: "1.2.3.4;8080, proxy.example.com" }),
    ).toThrow(ProxyConfigError);
    expect(() =>
      loadProxiesFromEnv({ PROXY_LIST: "1.1.1.1:80,2.2.2.2:8O80,3.3.3.3:80" }),
    ).toThrow(/2\.2\.2\.2:8O80/);
    expect(() => loadProxiesFromEnv({ PROXY_FILE: "bad.txt" }, dir)).toThrow(
      /oops/,
    );
    expect(() => loadProxiesFromEnv({ PROXY_FILE: "bad.json" }, dir)).toThrow(
      /not valid JSON/,
    );
  });

  test("legacy PROXY_HOST without a port still works (scheme default)", () => {
    const [p] = loadProxiesFromEnv({
      PROXY_ENABLED: "true",
      PROXY_HOST: "proxy.example.com",
    });
    expect(p).toMatchObject({ host: "proxy.example.com", port: 80 });
    expect(() =>
      loadProxiesFromEnv({ PROXY_ENABLED: "true", PROXY_HOST: "a b:80" }),
    ).toThrow(ProxyConfigError);
  });

  test("legacy PROXY_HOST is ignored unless PROXY_ENABLED=true", () => {
    expect(loadProxiesFromEnv({ PROXY_HOST: "6.6.6.6:85" }, dir)).toEqual([]);
  });

  test("missing PROXY_FILE throws instead of silently going direct", () => {
    expect(() => loadProxiesFromEnv({ PROXY_FILE: "nope.txt" }, dir)).toThrow(
      ProxyConfigError,
    );
  });

  test("authenticated SOCKS proxies are rejected (Chromium cannot auth them)", () => {
    expect(() =>
      loadProxiesFromEnv({ PROXY_LIST: "socks5://u:p@1.1.1.1:1080" }, dir),
    ).toThrow(/SOCKS/);
    expect(
      loadProxiesFromEnv({ PROXY_LIST: "socks5://1.1.1.1:1080" }, dir),
    ).toHaveLength(1);
  });
});

describe("loadProxyConfig (pool sizing)", () => {
  test("no proxies: 3 identities, direct", () => {
    expect(loadProxyConfig({})).toMatchObject({
      proxies: [],
      poolSize: 3,
      maxPerProxy: 0,
    });
  });

  test("legacy single PROXY_HOST keeps 3 identities on its one proxy", () => {
    const c = loadProxyConfig({ PROXY_ENABLED: "true", PROXY_HOST: "h:80" });
    expect(c.poolSize).toBe(3);
    expect(c.maxPerProxy).toBe(3);
  });

  test("PROXY_LIST: proxies × IDENTITIES_PER_PROXY", () => {
    const list = "1.1.1.1:80,2.2.2.2:80,3.3.3.3:80";
    expect(loadProxyConfig({ PROXY_LIST: list })).toMatchObject({
      poolSize: 3,
      maxPerProxy: 1,
    });
    expect(
      loadProxyConfig({ PROXY_LIST: list, IDENTITIES_PER_PROXY: "2" }),
    ).toMatchObject({ poolSize: 6, maxPerProxy: 2 });
  });

  test("explicit IDENTITY_POOL_SIZE wins and spreads evenly", () => {
    const c = loadProxyConfig({
      PROXY_LIST: "1.1.1.1:80,2.2.2.2:80,3.3.3.3:80",
      IDENTITY_POOL_SIZE: "7",
    });
    expect(c.poolSize).toBe(7);
    expect(c.maxPerProxy).toBe(3);
  });

  test("empty strings (docker-compose defaults) mean unset", () => {
    expect(
      loadProxyConfig({
        PROXY_LIST: "",
        PROXY_FILE: "",
        IDENTITY_POOL_SIZE: "",
        IDENTITIES_PER_PROXY: "",
        PROXY_PENALTY_MS: "",
      }),
    ).toMatchObject({ poolSize: 3, penaltyMs: 300000 });
  });

  test("PROXY_PENALTY_MS=0 is honoured; garbage numbers throw", () => {
    expect(loadProxyConfig({ PROXY_PENALTY_MS: "0" }).penaltyMs).toBe(0);
    expect(() => loadProxyConfig({ PROXY_PENALTY_MS: "5m" })).toThrow(
      ProxyConfigError,
    );
    expect(() => loadProxyConfig({ IDENTITIES_PER_PROXY: "0" })).toThrow(
      ProxyConfigError,
    );
  });

  test("EXPOSE_PROXY_IN_SIGNATURE is opt-in", () => {
    expect(loadProxyConfig({}).exposeProxyInSignature).toBe(false);
    expect(
      loadProxyConfig({ EXPOSE_PROXY_IN_SIGNATURE: "true" })
        .exposeProxyInSignature,
    ).toBe(true);
  });
});

describe("ProxyPool", () => {
  const proxies = parseProxyText("1.1.1.1:80\n2.2.2.2:80\n3.3.3.3:80");
  const loads = (pool) => pool.stats().map((s) => s.identities);

  test("spreads identities across proxies before doubling up", () => {
    const pool = new ProxyPool(proxies, { maxPerProxy: 2 });
    expect(pool.capacity).toBe(6);
    const picked = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(new Set(picked.map((p) => p.host)).size).toBe(3);
    pool.acquire();
    expect(loads(pool).sort()).toEqual([1, 1, 2]);
  });

  test("release frees the slot", () => {
    const pool = new ProxyPool(proxies.slice(0, 1));
    const p = pool.acquire();
    expect(loads(pool)).toEqual([1]);
    pool.release(p);
    pool.release(p); // idempotent at zero
    expect(loads(pool)).toEqual([0]);
  });

  test("a burn report never makes two identities share an IP", () => {
    // 3 proxies / 3 identities / 1 per proxy — the reviewer's scenario
    const pool = new ProxyPool(proxies, { maxPerProxy: 1, now: () => 0 });
    const a = pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.penalize(a);
    pool.release(a);
    const replacement = pool.acquire();
    expect(replacement.host).toBe(a.host); // benched proxy with a free slot
    expect(loads(pool)).toEqual([1, 1, 1]);
  });

  test("a healthy proxy with a free slot beats a benched one", () => {
    let now = 0;
    const pool = new ProxyPool(proxies.slice(0, 2), {
      maxPerProxy: 1,
      penaltyMs: 500,
      now: () => now,
    });
    pool.penalize(proxies[0]);
    expect(pool.acquire().host).toBe(proxies[1].host);
    expect(pool.acquire().host).toBe(proxies[0].host); // only free slot left
  });

  test("penalized proxies are skipped until the penalty expires", () => {
    let now = 1000;
    const pool = new ProxyPool(proxies.slice(0, 2), {
      maxPerProxy: 2,
      penaltyMs: 500,
      now: () => now,
    });
    const first = pool.acquire();
    pool.release(first);
    pool.penalize(first, "test");
    for (let i = 0; i < 3; i++) {
      const p = pool.acquire();
      expect(p.host).not.toBe(first.host);
      pool.release(p);
    }
    now += 501;
    const hosts = new Set();
    for (let i = 0; i < 2; i++) hosts.add(pool.acquire().host);
    expect(hosts.has(first.host)).toBe(true);
  });

  test("penaltyMs 0 never benches", () => {
    const pool = new ProxyPool(proxies.slice(0, 1), { penaltyMs: 0 });
    pool.penalize(proxies[0]);
    expect(pool.stats()[0]).toMatchObject({ penalized: false, failures: 1 });
  });

  test("over capacity: least loaded, healthy first", () => {
    const pool = new ProxyPool(proxies.slice(0, 2), {
      maxPerProxy: 1,
      now: () => 0,
    });
    pool.acquire();
    pool.acquire();
    pool.penalize(proxies[0]);
    expect(pool.acquire().host).toBe(proxies[1].host);
  });

  test("empty pool returns null (direct connection)", () => {
    const pool = new ProxyPool([]);
    expect(pool.enabled).toBe(false);
    expect(pool.acquire()).toBeNull();
  });
});
