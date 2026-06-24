import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type IopParams = Record<string, string>;

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

function gatewayBase() {
  return (
    process.env.ALIBABA_IOP_GATEWAY_URL ||
    process.env.ALIBABA_OPENAPI_GATEWAY_URL ||
    "https://openapi-api.alibaba.com/rest"
  ).replace(/\/$/, "");
}

function nowMs() {
  return String(Date.now());
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

function signIopRequest(apiName: string, params: IopParams, secret: string) {
  const assembled =
    apiName +
    Object.keys(params)
      .sort()
      .filter((key) => key !== "sign" && params[key] !== "")
      .map((key) => `${key}${params[key]}`)
      .join("");

  return crypto
    .createHmac("sha256", secret)
    .update(assembled, "utf8")
    .digest("hex")
    .toUpperCase();
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

function buildParams(request: NextRequest, body: Record<string, unknown>) {
  const apiName = "/auth/token/create";
  const code = String(body.code || request.nextUrl.searchParams.get("code") || "")
    .trim();
  const params: IopParams = {
    app_key: requireEnv("ALIBABA_APP_KEY"),
    timestamp: nowMs(),
    sign_method: process.env.ALIBABA_IOP_SIGN_METHOD || "sha256",
    code,
  };

  const uuid = String(body.uuid || request.nextUrl.searchParams.get("uuid") || "")
    .trim();
  if (uuid) params.uuid = uuid;

  params.sign = signIopRequest(apiName, params, requireEnv("ALIBABA_APP_SECRET"));
  return { apiName, params };
}

async function callIop(apiName: string, params: IopParams) {
  const url = `${gatewayBase()}${apiName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json;charset=utf-8" },
    body: JSON.stringify(params),
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
    const { apiName, params } = buildParams(request, body);

    if (request.nextUrl.searchParams.get("dryRun") === "1") {
      return NextResponse.json({
        ok: true,
        gateway: gatewayBase(),
        apiName,
        requestUrl: `${gatewayBase()}${apiName}`,
        payloadKeys: Object.keys(params),
        redactedPayload: redact(params),
        note:
          "Official docs require code for /auth/token/create. Call this endpoint with ?code=YOUR_CODE when you have it.",
      });
    }

    if (!params.code) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing code. Official /auth/token/create requires code.",
          docsInput: ["code required", "uuid optional"],
          dryRun: "/api/alibaba/iop/token/create?dryRun=1",
        },
        { status: 400 },
      );
    }

    const result = await callIop(apiName, params);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

