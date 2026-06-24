import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TokenPayload = Record<string, string>;

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function maskTokenLike(value: unknown) {
  if (typeof value !== "string") return value;
  if (value.length < 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("secret") ||
        lower.includes("token") ||
        lower.includes("session")
      ) {
        return [key, maskTokenLike(item)];
      }
      return [key, redact(item)];
    }),
  );
}

function buildPayload(request: NextRequest, body: Record<string, unknown>) {
  const grantType =
    String(body.grantType || request.nextUrl.searchParams.get("grantType") || "")
      .trim() || "client_credentials";
  const code = String(body.code || request.nextUrl.searchParams.get("code") || "")
    .trim();

  const payload: TokenPayload = {
    app_key: requireEnv("ALIBABA_APP_KEY"),
    appKey: requireEnv("ALIBABA_APP_KEY"),
    client_id: requireEnv("ALIBABA_APP_KEY"),
    app_secret: requireEnv("ALIBABA_APP_SECRET"),
    appSecret: requireEnv("ALIBABA_APP_SECRET"),
    client_secret: requireEnv("ALIBABA_APP_SECRET"),
    grant_type: grantType,
  };

  if (code) {
    payload.code = code;
    payload.redirect_uri =
      process.env.ALIBABA_REDIRECT_URI ||
      "https://api.viecart.com/api/alibaba/oauth/callback";
  }

  return payload;
}

async function parseBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function callTokenEndpoint(payload: TokenPayload, format: string) {
  const tokenUrl = requireEnv("ALIBABA_TOKEN_URL");
  const headers =
    format === "form"
      ? { "content-type": "application/x-www-form-urlencoded" }
      : { "content-type": "application/json" };
  const body =
    format === "form"
      ? new URLSearchParams(payload).toString()
      : JSON.stringify(payload);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body,
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
    data: redact(data),
  };
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const payload = buildPayload(request, body);
    const format =
      request.nextUrl.searchParams.get("format") ||
      process.env.ALIBABA_TOKEN_REQUEST_FORMAT ||
      "json";

    if (request.nextUrl.searchParams.get("dryRun") === "1") {
      return NextResponse.json({
        ok: true,
        tokenUrl: process.env.ALIBABA_TOKEN_URL,
        format,
        payloadKeys: Object.keys(payload),
        redactedPayload: redact(payload),
        note:
          "If this dry run looks right, call the same URL without dryRun=1 to send a server-side token request.",
      });
    }

    const result = await callTokenEndpoint(payload, format);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

