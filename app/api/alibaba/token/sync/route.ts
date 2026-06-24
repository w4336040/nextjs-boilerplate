import { NextRequest, NextResponse } from "next/server";

import { readStoredToken, writeStoredToken } from "../../_lib/tokenStore";
import { decryptTokenCookie } from "../../../_lib/iop";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get("alibaba_token")?.value;
    if (!cookie) {
      return NextResponse.json(
        { ok: false, error: "No Alibaba token cookie found." },
        { status: 400 },
      );
    }

    const token = decryptTokenCookie(cookie);
    await writeStoredToken(token as Record<string, unknown>);
    const stored = await readStoredToken();

    return NextResponse.json({
      ok: true,
      synced: Boolean(stored),
      storedKeys: stored && typeof stored === "object" ? Object.keys(stored) : [],
      writeMode: "service-side-encrypted",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
