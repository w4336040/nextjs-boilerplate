import { createDecipheriv, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readStoredToken } from "../../_lib/tokenStore";

export const runtime = "nodejs";

function getCookieSecret() {
  return (
    process.env.ALIBABA_TOKEN_COOKIE_SECRET ||
    process.env.ALIBABA_APP_SECRET ||
    "local-debug-only"
  );
}

function decryptCookie(value: string) {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const key = createHash("sha256").update(getCookieSecret()).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext);
}

function tokenValue(data: unknown, key: string) {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  return record[key] || record[key.replace("_", "")] || null;
}

function mask(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.length <= 10) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const stored = await readStoredToken();
    const cookie = request.cookies.get("alibaba_token")?.value;
    const data = stored || (cookie ? decryptCookie(cookie) : null);
    if (!data) {
      return NextResponse.json({
        ok: false,
        hasToken: false,
        startUrl: "/api/alibaba/oauth/start",
      });
    }
    return NextResponse.json({
      ok: true,
      hasToken: true,
      accessToken: mask(tokenValue(data, "access_token")),
      refreshToken: mask(tokenValue(data, "refresh_token")),
      keys: data && typeof data === "object" ? Object.keys(data) : [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        hasToken: true,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
