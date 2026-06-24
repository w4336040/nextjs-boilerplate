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

function getAccessToken(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  return String(record.access_token || record.accessToken || "");
}

export async function GET(request: NextRequest) {
  try {
    const stored = await readStoredToken();
    const tokenCookie = request.cookies.get("alibaba_token")?.value;
    const tokenData = stored || (tokenCookie ? decryptCookie(tokenCookie) : null);
    if (!tokenData) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Alibaba token found. Visit /api/alibaba/oauth/start first.",
        },
        { status: 401 },
      );
    }

    const accessToken = getAccessToken(tokenData);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Token response does not contain access_token." },
        { status: 400 },
      );
    }

    const categoryId = request.nextUrl.searchParams.get("categoryId");
    const method =
      request.nextUrl.searchParams.get("method") ||
      "alibaba.icbu.product.schema.render.draft";

    if (!categoryId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing categoryId. Example: /api/alibaba/product/schema?categoryId=123",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: false,
      readyForNextStep: true,
      method,
      categoryId,
      message:
        "OAuth is ready. The next step is adding Alibaba API request signing once the exact official gateway/signature docs are confirmed.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
