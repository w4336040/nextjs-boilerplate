import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CONFIG_KEYS = [
  "ALIBABA_APP_KEY",
  "ALIBABA_APP_SECRET",
  "ALIBABA_TOKEN_URL",
  "ALIBABA_OPENAPI_GATEWAY_URL",
  "ALIBABA_TOKEN_REQUEST_FORMAT",
] as const;

function mask(value: string | undefined) {
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET() {
  const missing = CONFIG_KEYS.filter((key) => {
    if (key === "ALIBABA_TOKEN_REQUEST_FORMAT") return false;
    if (key === "ALIBABA_OPENAPI_GATEWAY_URL") return false;
    return !process.env[key];
  });

  return NextResponse.json({
    ok: missing.length === 0,
    mode: "SELF_APP_OPENAPI_DEBUG",
    warning:
      "This endpoint never returns App Secret. Use it to confirm server-side config before calling Alibaba OpenAPI.",
    missing,
    appKey: mask(process.env.ALIBABA_APP_KEY),
    tokenUrl: process.env.ALIBABA_TOKEN_URL || null,
    gatewayUrl:
      process.env.ALIBABA_OPENAPI_GATEWAY_URL || "https://openapi.alibaba.com",
    tokenRequestFormat: process.env.ALIBABA_TOKEN_REQUEST_FORMAT || "json",
    nextTests: [
      "/api/alibaba/openapi/token/create?dryRun=1",
      "/api/alibaba/openapi/token/create",
    ],
  });
}

