import { NextRequest, NextResponse } from "next/server";

import {
  buildIopSyncParams,
  callIopSyncApi,
  getAccessTokenFromStorageOrRequest,
  redact,
  syncGatewayUrl,
} from "../../_lib/iop";
import {
  buildTopParams,
  callTopApi,
  describeFetchError,
  resolveTopGatewayUrl,
} from "../../_lib/top";

export const runtime = "nodejs";

const API_NAME = "alibaba.scbp.ad.report.get.product.report";

function stringParam(request: NextRequest, names: string[], fallback = "") {
  for (const name of names) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) return value;
  }
  return fallback;
}

function numberParam(request: NextRequest, names: string[], fallback: number) {
  const value = stringParam(request, names);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ymd(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
  ].join("");
}

function defaultDateRange(days = 7) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));
  return {
    startDate: ymd(start),
    endDate: ymd(end),
  };
}

function buildReportOperation(request: NextRequest) {
  const days = numberParam(request, ["days"], 7);
  const defaults = defaultDateRange(days);
  const pageNo = numberParam(request, ["page_no", "pageNo", "page"], 1);
  const pageSize = numberParam(request, ["page_size", "pageSize"], 20);
  const productId = stringParam(request, ["product_id", "productId"]);
  const campaignId = stringParam(request, ["campaign_id", "campaignId"]);
  const startDate = stringParam(request, ["start_date", "startDate"], defaults.startDate);
  const endDate = stringParam(request, ["end_date", "endDate"], defaults.endDate);
  const sortField = stringParam(request, ["sort_field", "sortField"], "cost");
  const sortType = stringParam(request, ["sort_type", "sortType"], "desc");

  return {
    startDate,
    endDate,
    pageNo,
    pageSize,
    sortField,
    sortType,
    ...(productId ? { productId } : {}),
    ...(campaignId ? { campaignId } : {}),
  };
}

function buildTopContext(request: NextRequest) {
  return {
    locale: stringParam(request, ["locale"], "zh_CN"),
    timezone: stringParam(request, ["timezone"], "Asia/Shanghai"),
  };
}

export async function GET(request: NextRequest) {
  try {
    const isDryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const protocol = request.nextUrl.searchParams.get("protocol") || "sync";
    const gateway = resolveTopGatewayUrl(
      request.nextUrl.searchParams.get("gateway") || "",
    );
    const session = await getAccessTokenFromStorageOrRequest(request);
    if (!session && !isDryRun) {
      return NextResponse.json(
        {
          ok: false,
          error: "No Alibaba token found. Visit /api/alibaba/oauth/start first.",
        },
        { status: 401 },
      );
    }

    const topContext = buildTopContext(request);
    const productReportOperation = buildReportOperation(request);
    const syncApiParams = {
      access_token: session || "DRY_RUN_ACCESS_TOKEN",
      top_context: JSON.stringify(topContext),
      product_report_operation: JSON.stringify(productReportOperation),
    };
    const topApiParams = {
      session: session || "DRY_RUN_SESSION",
      top_context: JSON.stringify(topContext),
      product_report_operation: JSON.stringify(productReportOperation),
    };

    if (isDryRun) {
      const signed =
        protocol === "top"
          ? buildTopParams(API_NAME, topApiParams)
          : buildIopSyncParams(API_NAME, syncApiParams);
      return NextResponse.json({
        ok: true,
        gateway: protocol === "top" ? gateway : syncGatewayUrl(),
        method: API_NAME,
        protocol: protocol === "top" ? "top" : "iop-sync",
        topContext,
        productReportOperation,
        redactedPayload: redact(signed),
        note:
          protocol === "top"
            ? "TOP mode is kept for comparison. Your current ICBU app key may not exist on Taobao TOP gateways."
            : "Default sync mode matches the current ICBU open platform token flow.",
      });
    }

    if (protocol !== "top") {
      const httpMethod =
        request.nextUrl.searchParams.get("httpMethod") === "POST"
          ? "POST"
          : "GET";
      const result = await callIopSyncApi({
        apiName: API_NAME,
        apiParams: syncApiParams,
        httpMethod,
      });

      return NextResponse.json({
        ...result,
        data: redact(result.data),
        reportRequest: {
          protocol: "iop-sync",
          topContext,
          productReportOperation,
        },
        hint:
          result.ok && !(result.data as Record<string, unknown>)?.error_response
            ? "If data is empty, confirm SCBP permission and date range."
            : "If this reports an invalid method or permission error, confirm that SCBP product report is opened for this ICBU app.",
      });
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
          details: describeFetchError(fetchError),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...result,
      data: redact(result.data),
      reportRequest: {
        protocol: "top",
        topContext,
        productReportOperation,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
