import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REQUIRED_KEYS = [
  "ALIBABA_APP_KEY",
  "ALIBABA_APP_SECRET",
  "ALIBABA_REDIRECT_URI",
  "ALIBABA_AUTH_URL",
  "ALIBABA_TOKEN_URL",
] as const;

function mask(value: string | undefined) {
  if (!value) return null;
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET() {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    configured: Object.fromEntries(
      REQUIRED_KEYS.map((key) => [key, Boolean(process.env[key])]),
    ),
    appKey: mask(process.env.ALIBABA_APP_KEY),
    redirectUri: process.env.ALIBABA_REDIRECT_URI || null,
    authUrl: process.env.ALIBABA_AUTH_URL || null,
    tokenUrl: process.env.ALIBABA_TOKEN_URL || null,
    scopeConfigured: Boolean(process.env.ALIBABA_SCOPE),
    stateParam: process.env.ALIBABA_AUTH_STATE_PARAM || "State",
    tokenRequestFormat: process.env.ALIBABA_TOKEN_REQUEST_FORMAT || "json",
  });
}

