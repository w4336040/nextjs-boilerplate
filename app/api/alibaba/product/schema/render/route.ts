import { NextRequest, NextResponse } from "next/server";

import {
  buildIopSyncParams,
  callIopSyncApi,
  getAccessTokenFromStorageOrRequest,
  redact,
  syncGatewayUrl,
} from "../../../_lib/iop";
import {
  buildProductOptimization,
  parseSchemaXml,
  summarizeParsedSchema,
} from "../../../_lib/schemaXml";

export const runtime = "nodejs";

const API_NAME = "alibaba.icbu.product.schema.render";

function stringParam(request: NextRequest, names: string[], fallback = "") {
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) return value;
  }
  return fallback;
}

function extractXml(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.data === "string" && record.data.includes("<itemSchema")) {
    return record.data;
  }
  for (const child of Object.values(record)) {
    const found = extractXml(child);
    if (found) return found;
  }
  return "";
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

    const payload = {
      version: stringParam(request, ["version"], "trade.1.1"),
      publish_type: stringParam(request, ["publish_type", "publishType"], "default"),
      cat_id: stringParam(request, ["cat_id", "catId", "categoryId"], "333"),
      language: stringParam(request, ["language"], "en_US"),
      product_id: productId,
    };
    const apiParams = {
      access_token: accessToken || "DRY_RUN_ACCESS_TOKEN",
      param_product_top_publish_request: JSON.stringify(payload),
    };

    if (isDryRun) {
      const signed = buildIopSyncParams(API_NAME, apiParams);
      return NextResponse.json({
        ok: true,
        gateway: syncGatewayUrl(),
        url: `${syncGatewayUrl()}?${new URLSearchParams(signed).toString()}`,
        method: API_NAME,
        protocol: "iop-sync",
        payload,
        redactedPayload: redact(signed),
      });
    }

    const result = await callIopSyncApi({
      apiName: API_NAME,
      apiParams,
    });
    const xml = extractXml(result.data);
    const fields = xml ? parseSchemaXml(xml) : [];

    return NextResponse.json({
      ...result,
      data: redact(result.data),
      schema: xml
        ? {
            hasXml: true,
            xmlLength: xml.length,
            summary: summarizeParsedSchema(fields),
            optimization: buildProductOptimization(fields),
          }
        : { hasXml: false },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
