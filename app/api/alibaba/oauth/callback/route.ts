import { createCipheriv, createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function getCookieSecret() {
  return (
    process.env.ALIBABA_TOKEN_COOKIE_SECRET ||
    process.env.ALIBABA_APP_SECRET ||
    "local-debug-only"
  );
}

function encryptForCookie(payload: unknown) {
  const key = createHash("sha256").update(getCookieSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

async function exchangeCode(code: string) {
  const tokenUrl = requireEnv("ALIBABA_TOKEN_URL");
  const format = process.env.ALIBABA_TOKEN_REQUEST_FORMAT || "json";
  const payload: Record<string, string> = {
    [process.env.ALIBABA_TOKEN_GRANT_TYPE_PARAM || "grant_type"]:
      "authorization_code",
    [process.env.ALIBABA_TOKEN_CLIENT_ID_PARAM || "client_id"]:
      requireEnv("ALIBABA_APP_KEY"),
    [process.env.ALIBABA_TOKEN_CLIENT_SECRET_PARAM || "client_secret"]:
      requireEnv("ALIBABA_APP_SECRET"),
    [process.env.ALIBABA_TOKEN_REDIRECT_URI_PARAM || "redirect_uri"]:
      requireEnv("ALIBABA_REDIRECT_URI"),
    [process.env.ALIBABA_TOKEN_CODE_PARAM || "code"]: code,
  };

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers:
      format === "form"
        ? { "content-type": "application/x-www-form-urlencoded" }
        : { "content-type": "application/json" },
    body:
      format === "form"
        ? new URLSearchParams(payload).toString()
        : JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  return { ok: true, status: response.status, data };
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const returnedState =
      request.nextUrl.searchParams.get("State") ||
      request.nextUrl.searchParams.get("state");
    const expectedState = request.cookies.get("alibaba_oauth_state")?.value;
    const callback = request.cookies.get("alibaba_oauth_callback")?.value;

    if (!code) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing code from Alibaba OAuth callback.",
          query: Object.fromEntries(request.nextUrl.searchParams),
        },
        { status: 400 },
      );
    }

    if (expectedState && returnedState && expectedState !== returnedState) {
      return NextResponse.json(
        { ok: false, error: "OAuth state mismatch." },
        { status: 400 },
      );
    }

    const tokenResult = await exchangeCode(code);
    if (!tokenResult.ok) {
      return NextResponse.json(tokenResult, { status: 502 });
    }

    const response = callback
      ? NextResponse.redirect(new URL(callback, request.nextUrl.origin))
      : NextResponse.json({
          ok: true,
          message: "Alibaba token received and stored in an encrypted HttpOnly cookie.",
        });

    response.cookies.set("alibaba_token", encryptForCookie(tokenResult.data), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    response.cookies.delete("alibaba_oauth_state");
    response.cookies.delete("alibaba_oauth_callback");
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

