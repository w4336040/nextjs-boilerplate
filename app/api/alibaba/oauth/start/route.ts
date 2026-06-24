import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

function buildAuthUrl() {
  const authUrl = new URL(requireEnv("ALIBABA_AUTH_URL"));
  if (authUrl.hostname === "oauth.alibaba.com") {
    return new URL("https://open-api.alibaba.com/oauth/authorize?force_auth=true");
  }
  return authUrl;
}

export async function GET(request: NextRequest) {
  try {
    const authUrl = buildAuthUrl();
    const state = randomUUID();
    const stateParam = process.env.ALIBABA_AUTH_STATE_PARAM || "State";
    const callback = request.nextUrl.searchParams.get("callback");

    authUrl.searchParams.set(
      process.env.ALIBABA_AUTH_RESPONSE_TYPE_PARAM || "response_type",
      "code",
    );
    authUrl.searchParams.set(
      process.env.ALIBABA_AUTH_CLIENT_ID_PARAM || "client_id",
      requireEnv("ALIBABA_APP_KEY"),
    );
    for (const alias of (process.env.ALIBABA_AUTH_APP_KEY_ALIASES || "").split(
      ",",
    )) {
      const key = alias.trim();
      if (key) {
        authUrl.searchParams.set(key, requireEnv("ALIBABA_APP_KEY"));
      }
    }
    authUrl.searchParams.set(
      process.env.ALIBABA_AUTH_REDIRECT_URI_PARAM || "redirect_uri",
      requireEnv("ALIBABA_REDIRECT_URI"),
    );
    authUrl.searchParams.set(stateParam, state);

    const scope = process.env.ALIBABA_SCOPE;
    if (scope) {
      authUrl.searchParams.set(
        process.env.ALIBABA_AUTH_SCOPE_PARAM || "scope",
        scope,
      );
    }

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("alibaba_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60,
      path: "/",
    });
    if (callback) {
      response.cookies.set("alibaba_oauth_callback", callback, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        maxAge: 10 * 60,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
