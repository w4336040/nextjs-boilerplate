import { NextRequest, NextResponse } from "next/server";

import {
  buildIopSyncParams,
  callIopSyncApi,
  getAccessTokenFromRequest,
  redact,
  syncGatewayUrl,
} from "../../_lib/iop";

export const runtime = "nodejs";

const API_NAME = "alibaba.icbu.product.score.get";

export async function GET(request: NextRequest) {
  try {
    const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const accessToken = getAccessTokenFromRequest(request);
    if (!accessToken && !isDryRun) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Alibaba access_token found. Visit /api/alibaba/oauth/start first.",
        },
        { status: 401 },
      );
    }

    const productId =
      request.nextUrl.searchParams.get("product_id") ||
      request.nextUrl.searchParams.get("productId") ||
      request.nextUrl.searchParams.get("id") ||
      "";
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: "Missing product_id." },
        { status: 400 },
      );
    }

    const apiParams = {
      access_token: accessToken || "DRY_RUN_ACCESS_TOKEN",
      product_id: productId,
    };

    if (isDryRun) {
      const signed = buildIopSyncParams(API_NAME, apiParams);
      return NextResponse.json({
        ok: true,
        gateway: syncGatewayUrl(),
        url: `${syncGatewayUrl()}?${new URLSearchParams(signed).toString()}`,
        method: API_NAME,
        redactedPayload: redact(signed),
      });
    }

    const result = await callIopSyncApi({
      apiName: API_NAME,
      apiParams,
    });
    return NextResponse.json({
      ...result,
      data: redact(result.data),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
