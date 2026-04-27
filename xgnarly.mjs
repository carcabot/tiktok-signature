import { createHash, randomBytes } from "node:crypto";

const ALPHABET =
  "u09tbS3UvgDEe6r-ZVMXzLpsAohTn7mdINQlW412GqBjfYiyk8JORCF5/xKHwacP=";

function encodeBase64(bytes) {
  let out = "";
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[(n >>> 18) & 63] +
      ALPHABET[(n >>> 12) & 63] +
      ALPHABET[(n >>> 6) & 63] +
      ALPHABET[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[(n >>> 18) & 63] + ALPHABET[(n >>> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(n >>> 18) & 63] +
      ALPHABET[(n >>> 12) & 63] +
      ALPHABET[(n >>> 6) & 63] +
      "=";
  }
  return out;
}

const SIGMA = [1196819126, 600974999, 3863347763, 1451689750];

const u32 = (x) => x >>> 0;
const rotl = (v, c) => u32((v << c) | (v >>> (32 - c)));

function quarter(s, a, b, c, d) {
  s[a] = u32(s[a] + s[b]);
  s[d] = rotl(s[d] ^ s[a], 16);
  s[c] = u32(s[c] + s[d]);
  s[b] = rotl(s[b] ^ s[c], 12);
  s[a] = u32(s[a] + s[b]);
  s[d] = rotl(s[d] ^ s[a], 8);
  s[c] = u32(s[c] + s[d]);
  s[b] = rotl(s[b] ^ s[c], 7);
}

function chachaBlock(initial, rounds) {
  const s = initial.slice();
  let r = 0;
  while (r < rounds) {
    quarter(s, 0, 4, 8, 12);
    quarter(s, 1, 5, 9, 13);
    quarter(s, 2, 6, 10, 14);
    quarter(s, 3, 7, 11, 15);
    if (++r >= rounds) break;
    quarter(s, 0, 5, 10, 15);
    quarter(s, 1, 6, 11, 12);
    quarter(s, 2, 7, 12, 13);
    quarter(s, 3, 4, 13, 14);
    r++;
  }
  for (let i = 0; i < 16; i++) s[i] = u32(s[i] + initial[i]);
  return s;
}

function chachaXor(bytes, keyWords, rounds) {
  const state = [...SIGMA, ...keyWords];
  for (let off = 0; off < bytes.length; off += 64) {
    const stream = chachaBlock(state, rounds);
    state[12] = u32(state[12] + 1);
    const lim = Math.min(64, bytes.length - off);
    for (let i = 0; i < lim; i++) {
      const word = stream[i >>> 2];
      const byte = (word >>> (8 * (i & 3))) & 0xff;
      bytes[off + i] ^= byte;
    }
  }
  return bytes;
}

function deriveRounds(keyWords) {
  let r = 0;
  for (const w of keyWords) r = (r + (w & 15)) & 15;
  return r + 5;
}

const FIELD_ORDER = [1, 8, 12, 11, 6, 9, 4, 7, 0, 14, 15, 2, 3, 10, 5, 13];

const INT_WIDTHS = {
  0: 4,
  1: 2,
  2: 2,
  6: 4,
  7: 4,
  8: 4,
  11: 2,
  12: 2,
  13: 2,
  14: 4,
  15: 4,
};

function intToFixedBytes(n, width) {
  const out = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) {
    out[i] = n & 0xff;
    n = Math.floor(n / 256);
  }
  return out;
}

function encodePayload(fields) {
  let xorHeader = 0;
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if (typeof v === "number") xorHeader = (xorHeader ^ v) >>> 0;
  }
  const fieldsWith0 = { ...fields, 0: xorHeader };

  const present = FIELD_ORDER.filter((k) => fieldsWith0[k] !== undefined);

  const out = [present.length];
  for (const k of present) {
    const v = fieldsWith0[k];
    let valueBytes;
    if (typeof v === "number") {
      const width = INT_WIDTHS[k];
      if (!width) throw new Error(`no canonical width for int field ${k}`);
      valueBytes = intToFixedBytes(v, width);
    } else if (typeof v === "string") {
      valueBytes = new TextEncoder().encode(v);
    } else {
      throw new Error(`unsupported field ${k} type: ${typeof v}`);
    }
    out.push(k & 0xff);
    const len = valueBytes.length;
    out.push((len >>> 8) & 0xff, len & 0xff);
    for (const b of valueBytes) out.push(b);
  }
  return Uint8Array.from(out);
}

const MAGIC_BYTE = 75;
const md5 = (s) => createHash("md5").update(s, "utf8").digest("hex");

export function encode(
  queryString,
  body,
  userAgent,
  counters = {},
  options = {},
) {
  const ts = options.timestampMs ?? Date.now();
  const ubcode = options.ubcode ?? 4;
  const sdkVersion = options.sdkVersion ?? "1.0.0.368";

  const r14LowBytes = options.randomLow16 ?? randomBytes(2);
  const field14 = (65 << 16) | (r14LowBytes[0] << 8) | r14LowBytes[1];

  const r15Bytes = options.random32 ?? randomBytes(4);
  const field15 =
    ((r15Bytes[0] << 24) |
      (r15Bytes[1] << 16) |
      (r15Bytes[2] << 8) |
      r15Bytes[3]) >>>
    0;

  const fields = {
    1: 65,
    2: ubcode,
    3: md5(queryString),
    4: md5(body),
    5: md5(userAgent),
    6: Math.floor(ts / 1000),
    7: 3181061566,
    8: ts % 0x80000000,
    9: "5.1.3-ZTCA",
    10: sdkVersion,
    11: 1,
    12: (counters.totalXHRRequests ?? 0) + (counters.totalFetchRequests ?? 0),
    13:
      (counters.interceptedXHRRequests ?? 0) +
      (counters.interceptedFetchRequests ?? 0),
    14: field14,
    15: field15,
  };

  const plaintext = encodePayload(fields);
  const keyBytes = options.randomKey ?? randomBytes(48);
  const keyWords = new Array(12);
  for (let i = 0; i < 12; i++) {
    const o = i * 4;
    keyWords[i] =
      (keyBytes[o] |
        (keyBytes[o + 1] << 8) |
        (keyBytes[o + 2] << 16) |
        (keyBytes[o + 3] << 24)) >>>
      0;
  }
  const rounds = deriveRounds(keyWords);

  const cipher = new Uint8Array(plaintext);
  chachaXor(cipher, keyWords, rounds);

  const xLen = cipher.length;
  const mod = xLen + 1;
  let sum = 0;
  for (const b of keyBytes) sum = (sum + b) % mod;
  for (const b of cipher) sum = (sum + b) % mod;
  const insertPos = sum;

  const out = new Uint8Array(1 + xLen + 48);
  out[0] = MAGIC_BYTE;
  out.set(cipher.subarray(0, insertPos), 1);
  out.set(keyBytes, 1 + insertPos);
  out.set(cipher.subarray(insertPos), 1 + insertPos + 48);

  return encodeBase64(out);
}
