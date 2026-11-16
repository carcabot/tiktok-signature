/**
 * Tests for the per-identity proxy pool (no browser needed)
 */

import fs from "fs";
import os from "os";
import path from "path";
import {
  ProxyPool,
  loadProxiesFromEnv,
  maskProxy,
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

  test("user:pass@host:port", () => {
    expect(parseProxy("alice:s3cret@proxy.example.com:3128")).toMatchObject({
      host: "proxy.example.com",
      port: 3128,
      username: "alice",
      password: "s3cret",
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

  test("rejects garbage", () => {
    expect(parseProxy("")).toBeNull();
    expect(parseProxy("# comment")).toBeNull();
    expect(parseProxy("no-port")).toBeNull();
    expect(parseProxy("1.2.3.4:99999")).toBeNull();
    expect(parseProxy("ftp://1.2.3.4:21")).toBeNull();
    expect(parseProxy({ host: "h" })).toBeNull();
  });
});

describe("list parsing", () => {
  test("text: newlines, commas, comments", () => {
    const list = parseProxyText(
      "# pool\n1.1.1.1:80\n2.2.2.2:81:u:p, 3.3.3.3:82 # trailing\n\nbad",
    );
    expect(list.map((p) => p.host)).toEqual(["1.1.1.1", "2.2.2.2", "3.3.3.3"]);
  });

  test("json: array of strings and objects, or { proxies }", () => {
    const arr = ["1.1.1.1:80", { host: "2.2.2.2", port: 81 }];
    expect(parseProxyJson(arr)).toHaveLength(2);
    expect(parseProxyJson({ proxies: arr })).toHaveLength(2);
    expect(parseProxyJson({ nope: true })).toEqual([]);
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

  test("legacy PROXY_HOST is ignored unless PROXY_ENABLED=true", () => {
    expect(loadProxiesFromEnv({ PROXY_HOST: "6.6.6.6:85" }, dir)).toEqual([]);
  });

  test("missing PROXY_FILE throws instead of silently going direct", () => {
    expect(() => loadProxiesFromEnv({ PROXY_FILE: "nope.txt" }, dir)).toThrow();
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

describe("ProxyPool", () => {
  const proxies = parseProxyText("1.1.1.1:80\n2.2.2.2:80\n3.3.3.3:80");

  test("spreads identities across proxies before doubling up", () => {
    const pool = new ProxyPool(proxies, { maxPerProxy: 2 });
    expect(pool.capacity).toBe(6);
    const picked = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(new Set(picked.map((p) => p.host)).size).toBe(3);
    pool.acquire();
    expect(
      pool
        .stats()
        .map((s) => s.identities)
        .sort(),
    ).toEqual([1, 1, 2]);
  });

  test("release frees the slot", () => {
    const pool = new ProxyPool(proxies.slice(0, 1));
    const p = pool.acquire();
    expect(pool.stats()[0].identities).toBe(1);
    pool.release(p);
    pool.release(p); // idempotent at zero
    expect(pool.stats()[0].identities).toBe(0);
  });

  test("penalized proxies are skipped until the penalty expires", () => {
    let now = 1000;
    const pool = new ProxyPool(proxies.slice(0, 2), {
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

  test("all penalized: still returns the proxy whose penalty ends first", () => {
    let now = 0;
    const pool = new ProxyPool(proxies.slice(0, 2), {
      penaltyMs: 100,
      now: () => now,
    });
    pool.penalize(proxies[0]);
    now = 50;
    pool.penalize(proxies[1]);
    expect(pool.acquire().host).toBe(proxies[0].host);
  });

  test("empty pool returns null (direct connection)", () => {
    const pool = new ProxyPool([]);
    expect(pool.enabled).toBe(false);
    expect(pool.acquire()).toBeNull();
  });
});
