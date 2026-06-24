import crypto from "crypto";
import { NextRequest } from "next/server";

export type IopParams = Record<string, string>;

export function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export function iopGatewayBase() {
  return (
    process.env.ALIBABA_IOP_GATEWAY_URL ||
    "https://open-api.alibaba.com/rest"
  ).replace(/\/$/, "");
}

export function getCookieSecret() {
  return (
    process.env.ALIBABA_TOKEN_COOKIE_SECRET ||
    process.env.ALIBABA_APP_SECRET ||
    "local-debug-only"
  );
}

export function decryptTokenCookie(value: string) {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = crypto.createHash("sha256").update(getCookieSecret()).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext);
}

export function getAccessTokenFromRequest(request: NextRequest) {
  const cookie = request.cookies.get("alibaba_token")?.value;
  if (!cookie) return "";
  const token = decryptTokenCookie(cookie);
  return findTokenValue(token, ["access_token", "accessToken"]);
}

export function findTokenValue(value: unknown, keys: string[]): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  for (const child of Object.values(record)) {
    const found = findTokenValue(child, keys);
    if (found) return found;
  }
  return "";
}

export function signIopRequest(apiName: string, params: IopParams) {
  const assembled =
    apiName +
    Object.keys(params)
      .sort()
      .filter((key) => key !== "sign" && params[key] !== "")
      .map((key) => `${key}${params[key]}`)
      .join("");

  return crypto
    .createHmac("sha256", requireEnv("ALIBABA_APP_SECRET"))
    .update(assembled, "utf8")
    .digest("hex")
    .toUpperCase();
}

export function buildIopParams(apiName: string, apiParams: IopParams) {
  const params: IopParams = {
    app_key: requireEnv("ALIBABA_APP_KEY"),
    timestamp: String(Date.now()),
    sign_method: process.env.ALIBABA_IOP_SIGN_METHOD || "sha256",
    ...apiParams,
  };
  params.sign = signIopRequest(apiName, params);
  return params;
}

export function resolveIopApiUrl(apiName: string, mode = "dot-path") {
  const base = iopGatewayBase();
  const cleanName = apiName.replace(/^\//, "");
  if (mode === "slash-path") {
    return `${base}/${cleanName.replace(/\./g, "/")}`;
  }
  if (mode === "query-method") {
    return `${base}?method=${encodeURIComponent(cleanName)}`;
  }
  if (mode === "base-only" || mode === "body-method") {
    return base;
  }
  return `${base}/${cleanName}`;
}

export async function callIopApi(options: {
  apiName: string;
  apiParams: IopParams;
  transport?: "json" | "form";
  endpointMode?: string;
}) {
  const endpointMode = options.endpointMode || "dot-path";
  const apiParams =
    endpointMode === "body-method"
      ? { method: options.apiName, ...options.apiParams }
      : options.apiParams;
  const params = buildIopParams(options.apiName, apiParams);
  const url = resolveIopApiUrl(options.apiName, endpointMode);
  const transport = options.transport || "json";
  const response = await fetch(url, {
    method: "POST",
    headers:
      transport === "form"
        ? {
            "accept-encoding": "gzip",
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          }
        : {
            "accept-encoding": "gzip",
            "content-type": "application/json;charset=utf-8",
          },
    body:
      transport === "form"
        ? new URLSearchParams(params).toString()
        : JSON.stringify(params),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    data,
    sent: {
      apiName: options.apiName,
      endpointMode,
      transport,
      payloadKeys: Object.keys(params),
      hasAccessToken: Boolean(params.access_token),
    },
  };
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("token") ||
        lower.includes("sign")
      ) {
        return [
          key,
          typeof item === "string" && item.length > 12
            ? `${item.slice(0, 8)}...${item.slice(-6)}`
            : "***",
        ];
      }
      return [key, redact(item)];
    }),
  );
}
