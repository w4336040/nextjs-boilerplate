import { NextRequest, NextResponse } from "next/server";
import {
  getAccessTokenFromRequest,
  redact,
} from "../../../_lib/iop";
import {
  buildTopParams,
  callTopApi,
  resolveTopGatewayUrl,
} from "../../../_lib/top";

export const runtime = "nodejs";

const API_NAME = "alibaba.icbu.product.schema.get";

async function parseBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return {};
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stringParam(
  request: NextRequest,
  body: Record<string, unknown>,
  names: string[],
  fallback = "",
) {
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) return value;
    if (typeof body[name] === "string" || typeof body[name] === "number") {
      return String(body[name]);
    }
  }
  return fallback;
}

function buildPublishRequest(request: NextRequest, body: Record<string, unknown>) {
  const catId = stringParam(request, body, ["cat_id", "catId", "categoryId"]);
  const productId = stringParam(request, body, ["productId", "product_id"]);
  const payload: Record<string, string | number> = {
    publish_type: stringParam(
      request,
      body,
      ["publish_type", "publishType"],
      "default",
    ),
    cat_id: catId ? Number(catId) : 333,
    language: stringParam(request, body, ["language"], "en_US"),
    version: stringParam(request, body, ["version"], "trade.1.1"),
  };

  if (productId) payload.productId = Number(productId);
  return payload;
}

function extractSchemaXml(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.data === "string") return record.data;
  for (const value of Object.values(record)) {
    const found = extractSchemaXml(value);
    if (found) return found;
  }
  return "";
}

function summarizeSchema(xml: string) {
  const fields = [...xml.matchAll(/<field\b([^>]*)>/g)].slice(0, 200).map((match) => {
    const attrs = match[1];
    const attr = (name: string) => {
      const found = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return found?.[1] || "";
    };
    return {
      id: attr("id"),
      name: attr("name"),
      type: attr("type"),
    };
  });

  const requiredIds = [
    ...xml.matchAll(
      /<field\b([^>]*)>[\s\S]*?<rule\b[^>]*name="requiredRule"[^>]*value="true"[^>]*>/g,
    ),
  ].map((match) => {
    const found = match[1].match(/id="([^"]*)"/);
    return found?.[1] || "";
  });

  return {
    fieldCount: fields.length,
    requiredCount: requiredIds.filter(Boolean).length,
    requiredIds: requiredIds.filter(Boolean).slice(0, 100),
    fields: fields.slice(0, 80),
  };
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  try {
    const body = await parseBody(request);
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

    const publishRequest = buildPublishRequest(request, body);
    const gateway = resolveTopGatewayUrl(
      request.nextUrl.searchParams.get("gateway") || "",
    );
    const apiParams = {
      session: accessToken || "DRY_RUN_ACCESS_TOKEN",
      param_product_top_publish_request: JSON.stringify(publishRequest),
    };

    if (isDryRun) {
      const signed = buildTopParams(API_NAME, apiParams);
      return NextResponse.json({
        ok: true,
        gateway,
        url: gateway,
        method: API_NAME,
        protocol: "top",
        publishRequest,
        redactedPayload: redact(signed),
      });
    }

    const result = await callTopApi({
      method: API_NAME,
      apiParams,
      gatewayUrl: gateway,
    });
    const xml = extractSchemaXml(result.data);

    return NextResponse.json(
      {
        ...result,
        data: redact(result.data),
        schema: xml
          ? {
              hasXml: true,
              xmlLength: xml.length,
              summary: summarizeSchema(xml),
            }
          : { hasXml: false },
      },
      { status: result.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
