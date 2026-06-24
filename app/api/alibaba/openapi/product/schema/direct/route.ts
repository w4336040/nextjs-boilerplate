import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TopParams = Record<string, string>;

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function timestampGmt8() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    ":",
    pad(date.getUTCSeconds()),
  ].join("");
}

function topSign(params: TopParams, secret: string, method: string) {
  const assembled = Object.keys(params)
    .sort()
    .filter((key) => key !== "sign" && params[key] !== "")
    .map((key) => `${key}${params[key]}`)
    .join("");

  if (method.toLowerCase() === "hmac") {
    return crypto
      .createHmac("md5", secret)
      .update(assembled, "utf8")
      .digest("hex")
      .toUpperCase();
  }

  return crypto
    .createHash("md5")
    .update(`${secret}${assembled}${secret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lower = key.toLowerCase();
      if (lower.includes("secret") || lower.includes("session")) {
        return [key, typeof item === "string" ? `${item.slice(0, 6)}...` : "***"];
      }
      return [key, redact(item)];
    }),
  );
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

function buildBusinessPayload(request: NextRequest, body: Record<string, unknown>) {
  const raw =
    body.param_product_top_publish_request ||
    request.nextUrl.searchParams.get("param_product_top_publish_request") ||
    request.nextUrl.searchParams.get("payload") ||
    "null";
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

function buildTopParams(request: NextRequest, body: Record<string, unknown>) {
  const signMethod =
    request.nextUrl.searchParams.get("signMethod") ||
    process.env.ALIBABA_TOP_SIGN_METHOD ||
    "hmac";
  const session =
    request.nextUrl.searchParams.get("session") ||
    String(body.session || "") ||
    process.env.ALIBABA_TOP_SESSION ||
    "";

  const params: TopParams = {
    method:
      request.nextUrl.searchParams.get("method") ||
      "alibaba.icbu.product.schema.render.draft",
    app_key: requireEnv("ALIBABA_APP_KEY"),
    timestamp: timestampGmt8(),
    format: "json",
    v: "2.0",
    sign_method: signMethod,
    partner_id: "viecart",
    param_product_top_publish_request: buildBusinessPayload(request, body),
  };

  if (session) {
    params.session = session;
  }

  params.sign = topSign(params, requireEnv("ALIBABA_APP_SECRET"), signMethod);
  return params;
}

async function callTop(params: TopParams) {
  const gateway =
    process.env.ALIBABA_OPENAPI_GATEWAY_URL ||
    "https://eco.taobao.com/router/rest";
  const response = await fetch(gateway, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
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
    data,
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
    const params = buildTopParams(request, body);

    if (request.nextUrl.searchParams.get("dryRun") === "1") {
      return NextResponse.json({
        ok: true,
        gateway:
          process.env.ALIBABA_OPENAPI_GATEWAY_URL ||
          "https://eco.taobao.com/router/rest",
        payloadKeys: Object.keys(params),
        redactedPayload: redact(params),
        notes: [
          "Official docs mark this method as authorization-required.",
          "If the real call returns missing session/session invalid, SELF_APP still needs a TOP session/access token.",
        ],
      });
    }

    const result = await callTop(params);
    return NextResponse.json(
      {
        ...result,
        sent: {
          method: params.method,
          sign_method: params.sign_method,
          has_session: Boolean(params.session),
          payload_param:
            params.param_product_top_publish_request === "null"
              ? "null"
              : "provided",
        },
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

