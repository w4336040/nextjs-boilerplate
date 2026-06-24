import crypto from "crypto";

export type StoredTokenRecord = Record<string, unknown>;

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export function tokenStoreKey() {
  return process.env.ALIBABA_TOKEN_STORE_KEY || "alibaba:default";
}

export function tokenStoreUrl() {
  return (
    process.env.ALIBABA_TOKEN_STORE_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    ""
  ).replace(/\/$/, "");
}

export function tokenStoreToken() {
  return (
    process.env.ALIBABA_TOKEN_STORE_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    ""
  );
}

function tokenStoreSecret() {
  return (
    process.env.ALIBABA_TOKEN_STORE_SECRET ||
    process.env.ALIBABA_TOKEN_COOKIE_SECRET ||
    process.env.ALIBABA_APP_SECRET ||
    "local-debug-only"
  );
}

function encrypt(value: string) {
  const key = crypto.createHash("sha256").update(tokenStoreSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(value, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decrypt(value: string) {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = crypto.createHash("sha256").update(tokenStoreSecret()).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

function configured() {
  return Boolean(tokenStoreUrl() && tokenStoreToken());
}

async function requestJson(path: string, init?: RequestInit) {
  if (!configured()) return null;
  const response = await fetch(`${tokenStoreUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${tokenStoreToken()}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function readStoredToken(): Promise<StoredTokenRecord | null> {
  const result = await requestJson(`/get/${encodeURIComponent(tokenStoreKey())}`);
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  if (typeof record.result !== "string") return null;
  try {
    return JSON.parse(decrypt(record.result)) as StoredTokenRecord;
  } catch {
    return null;
  }
}

export async function writeStoredToken(value: StoredTokenRecord) {
  if (!configured()) return { ok: false, skipped: true };
  const payload = encrypt(JSON.stringify(value));
  const result = await requestJson(
    `/set/${encodeURIComponent(tokenStoreKey())}/${encodeURIComponent(payload)}`,
    { method: "POST" },
  );
  return { ok: true, result };
}

export async function deleteStoredToken() {
  if (!configured()) return { ok: false, skipped: true };
  const result = await requestJson(`/del/${encodeURIComponent(tokenStoreKey())}`, {
    method: "POST",
  });
  return { ok: true, result };
}
