import { NextRequest, NextResponse } from "next/server";
import {
  buildIopParams,
  callIopApi,
  buildIopSyncParams,
  callIopSyncApi,
  getAccessTokenFromRequest,
  iopGatewayBase,
  resolveIopApiUrl,
  redact,
  syncGatewayUrl,
} from "../../../_lib/iop";
import {
  buildTopParams,
  callTopApi,
  describeFetchError,
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

function buildSyncApiParams(
  request: NextRequest,
  publishRequest: Record<string, string | number>,
  accessToken: string,
) {
  const tokenParam = request.nextUrl.searchParams.get("tokenParam") || "access_token";
  const tokenValue = accessToken || "DRY_RUN_ACCESS_TOKEN";
  const params: Record<string, string> = {
    cat_id: String(publishRequest.cat_id),
    language: String(publishRequest.language),
    publish_type: String(publishRequest.publish_type),
    version: String(publishRequest.version),
    ...(publishRequest.productId
      ? { productId: String(publishRequest.productId) }
      : {}),
  };

  if (tokenParam === "session" || tokenParam === "both") {
    params.session = tokenValue;
  }
  if (tokenParam === "access_token" || tokenParam === "both") {
    params.access_token = tokenValue;
  }

  return params;
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
    const protocol = request.nextUrl.searchParams.get("protocol") || "sync";
    const gateway = resolveTopGatewayUrl(
      request.nextUrl.searchParams.get("gateway") || "",
    );
    const topApiParams = {
      session: accessToken || "DRY_RUN_ACCESS_TOKEN",
      param_product_top_publish_request: JSON.stringify(publishRequest),
    };
    const iopApiParams = {
      access_token: accessToken || "DRY_RUN_ACCESS_TOKEN",
      param_product_top_publish_request: JSON.stringify(publishRequest),
    };
    const syncApiParams = buildSyncApiParams(request, publishRequest, accessToken);

    if (isDryRun) {
      if (protocol === "sync") {
        const signed = buildIopSyncParams(API_NAME, syncApiParams);
        return NextResponse.json({
          ok: true,
          gateway: syncGatewayUrl(),
          url: `${syncGatewayUrl()}?${new URLSearchParams(signed).toString()}`,
          method: API_NAME,
          protocol: "iop-sync",
          httpMethod: request.nextUrl.searchParams.get("httpMethod") || "GET",
          publishRequest,
          redactedPayload: redact(signed),
          note:
            "Official docId=134 marks alibaba.icbu.product.schema.get as an original-platform migration API. It uses /sync and signs method as a normal sorted parameter.",
        });
      }

      if (protocol === "iop") {
        const iopMode = request.nextUrl.searchParams.get("iopMode") || "dot-path";
        const transport =
          request.nextUrl.searchParams.get("transport") === "form"
            ? "form"
            : "json";
        const params =
          iopMode === "body-method"
            ? { method: API_NAME, ...iopApiParams }
            : iopApiParams;
        const signed = buildIopParams(API_NAME, params);
        return NextResponse.json({
          ok: true,
          gateway: iopGatewayBase(),
          url: resolveIopApiUrl(API_NAME, iopMode),
          method: API_NAME,
          protocol: "iop",
          iopMode,
          transport,
          publishRequest,
          redactedPayload: redact(signed),
        });
      }

      const signed = buildTopParams(API_NAME, topApiParams);
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

    if (protocol === "sync") {
      const httpMethod =
        request.nextUrl.searchParams.get("httpMethod") === "POST"
          ? "POST"
          : "GET";
      const result = await callIopSyncApi({
        apiName: API_NAME,
        apiParams: syncApiParams,
        httpMethod,
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
    }

    if (protocol === "iop") {
      const iopMode = request.nextUrl.searchParams.get("iopMode") || "dot-path";
      const transport =
        request.nextUrl.searchParams.get("transport") === "form"
          ? "form"
          : "json";
      const result = await callIopApi({
        apiName: API_NAME,
        apiParams: iopApiParams,
        endpointMode: iopMode,
        transport,
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
    }

    let result: Awaited<ReturnType<typeof callTopApi>>;
    try {
      result = await callTopApi({
        method: API_NAME,
        apiParams: topApiParams,
        gatewayUrl: gateway,
      });
    } catch (fetchError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Alibaba TOP gateway fetch failed.",
          gateway,
          hint:
            "Try gateway=api or gateway=eco. If only gw fails on Vercel, keep ALIBABA_TOP_GATEWAY_URL on the working gateway.",
          details: describeFetchError(fetchError),
        },
        { status: 502 },
      );
    }
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
