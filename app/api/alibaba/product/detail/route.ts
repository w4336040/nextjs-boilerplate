import { NextRequest, NextResponse } from "next/server";

import {
  buildIopSyncParams,
  callIopSyncApi,
  getAccessTokenFromStorageOrRequest,
  redact,
  syncGatewayUrl,
} from "../../_lib/iop";

export const runtime = "nodejs";

const API_NAME = "alibaba.icbu.product.get";

function stringParam(request: NextRequest, names: string[], fallback = "") {
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) return value;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const accessToken = await getAccessTokenFromStorageOrRequest(request);
    if (!accessToken && !isDryRun) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Alibaba access_token found. Visit /api/alibaba/oauth/start first.",
        },
        { status: 401 },
      );
    }

    const productId = stringParam(request, ["product_id", "productId", "id"]);
    if (!productId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing product_id. Example: ?product_id=1601815992580",
        },
        { status: 400 },
      );
    }

    const apiParams = {
      access_token: accessToken || "DRY_RUN_ACCESS_TOKEN",
      product_id: productId,
      language: stringParam(request, ["language"], "en_US"),
    };

    if (isDryRun) {
      const signed = buildIopSyncParams(API_NAME, apiParams);
      return NextResponse.json({
        ok: true,
        gateway: syncGatewayUrl(),
        method: API_NAME,
        protocol: "iop-sync",
        note:
          "This endpoint checks whether alibaba.icbu.product.get is available for the current app. Some accounts require encrypted product_id.",
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
