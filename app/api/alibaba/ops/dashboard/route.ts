import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function buildUrl(request: NextRequest, path: string) {
  const url = new URL(path, request.url);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return url;
}

async function fetchJson(request: NextRequest, path: string) {
  const response = await fetch(buildUrl(request, path), {
    headers: { cookie: request.headers.get("cookie") || "" },
    cache: "no-store",
  });
  return response.json();
}

function pickReportError(report: unknown) {
  if (!report || typeof report !== "object") return null;
  const record = report as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const error =
    (data?.error_response as Record<string, unknown> | undefined) ||
    (record.error_response as Record<string, unknown> | undefined);
  if (!error) return null;
  return {
    code: error.code ?? error.error_code ?? null,
    msg: error.msg ?? error.message ?? null,
    subCode: error.sub_code ?? error.subCode ?? null,
    requestId: error.request_id ?? null,
  };
}

function summarizeDiagnosis(diagnosis: unknown) {
  const data = diagnosis && typeof diagnosis === "object" ? (diagnosis as Record<string, unknown>) : {};
  const list = Array.isArray(data.diagnosis) ? data.diagnosis : [];
  return {
    count: list.length,
    summary: data.summary || null,
    topActions: list.slice(0, 5).map((item) => {
      if (!item || typeof item !== "object") return item;
      const record = item as Record<string, unknown>;
      return {
        productId: record.productId ?? null,
        title: record.title ?? null,
        priority: record.priority ?? null,
        issues: Array.isArray(record.issues) ? record.issues.slice(0, 3) : [],
        recommendedActions: Array.isArray(record.recommendedActions)
          ? record.recommendedActions.slice(0, 3)
          : [],
        metrics: record.metrics ?? null,
      };
    }),
  };
}

function summarizeProductSchema(schema: unknown) {
  if (!schema || typeof schema !== "object") return null;
  const data = schema as Record<string, unknown>;
  const summary = data.summary as Record<string, unknown> | undefined;
  const optimization = data.optimization as Record<string, unknown> | undefined;
  return {
    summary: summary || null,
    optimization: optimization || null,
    requiredPreview: Array.isArray(summary?.requiredPreview) ? summary.requiredPreview.slice(0, 12) : [],
    fieldsPreview: Array.isArray(summary?.fieldsPreview) ? summary.fieldsPreview.slice(0, 20) : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get("product_id") || "1601815992580";
    const [tokenStatus, envStatus, schemaChecklist, productReport, diagnosis, productScore, productDetail] = await Promise.all([
      fetchJson(request, "/api/alibaba/token/status"),
      fetchJson(request, "/api/alibaba/env"),
      fetchJson(request, "/api/alibaba/product/schema/checklist"),
      fetchJson(request, "/api/alibaba/ad/product-report"),
      fetchJson(request, "/api/alibaba/ad/product-diagnosis"),
      fetchJson(request, `/api/alibaba/product/score?product_id=${encodeURIComponent(productId)}`),
      fetchJson(request, `/api/alibaba/product/detail?product_id=${encodeURIComponent(productId)}`),
    ]);
    const optimization = await fetchJson(
      request,
      `/api/alibaba/product/optimize?product_id=${encodeURIComponent(productId)}`,
    );
    const productSchema = optimization?.productSchema || null;

    const reportError = pickReportError(productReport);
    const detailError = pickReportError(productDetail);
    const diagnosisSummary = summarizeDiagnosis(diagnosis);
    const hasToken = Boolean(tokenStatus?.hasToken);
    const envOk = Boolean(envStatus?.ok);
    const scoreData = productScore?.data?.result || productScore?.result || null;
    const reportOk = Boolean(productReport?.ok && !reportError);

    const signals = [
      hasToken ? "OAuth token 已就绪" : "先完成 OAuth",
      envOk ? "环境变量已配置" : "检查 Vercel / .env",
      reportOk ? "推广报表可以正常访问" : "推广报表请求返回错误",
      diagnosisSummary.count > 0 ? "有推广数据可分析" : "当前未拿到推广明细",
      diagnosisSummary.count > 0 ? "已有规则建议输出" : "诊断规则还没有样本",
    ];

    const actions = [
      hasToken ? "继续接入账户报告和关键词报告" : "先完成授权，再看店铺数据",
      reportError
        ? "先解决推广报表权限或参数错误"
        : "把报表、诊断和商品评分放到同一屏",
      diagnosisSummary.count > 0
        ? "按高消耗、高点击、无询盘排序做日报"
        : "先用 dryRun 检查请求签名和权限",
    ];

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      reportOk,
      signals,
      actions,
      tokenStatus,
      envStatus,
      schemaChecklist,
      usableApis: [
        {
          name: "alibaba.icbu.product.schema.render",
          label: "商品编辑字段与当前值",
          ok: Boolean(optimization?.renderOk || productSchema?.hasXml),
          usage: "当前商品基础信息、字段完整度、标题/属性/价格/图片草稿。",
        },
        {
          name: "alibaba.icbu.product.score.get",
          label: "商品质量分",
          ok: Boolean(productScore?.ok && !pickReportError(productScore)),
          usage: "质量分、精品标、规则命中状态。",
        },
        {
          name: "alibaba.icbu.product.get",
          label: "单个商品详情",
          ok: Boolean(productDetail?.ok && !detailError),
          usage: "如果权限/ID 类型可用，可补充商品状态、主图、详情、商品链接。",
          error: detailError,
        },
        {
          name: "alibaba.scbp.ad.report.get.product.report",
          label: "外贸直通车商品报表",
          ok: reportOk,
          usage: "CTR、CPC、询盘率、询盘成本；当前不足权限时仅展示待开通状态。",
          error: reportError,
        },
      ],
      productReport: {
        error: reportError,
        raw: productReport,
      },
      diagnosis: diagnosisSummary,
      optimization: {
        missingRequiredCount: optimization?.optimizationSummary?.missingRequiredCount ?? 0,
        weakContentCount: optimization?.optimizationSummary?.weakContentCount ?? 0,
        imageCoverage: optimization?.optimizationSummary?.imageCoverage ?? null,
        pricingCoverage: optimization?.optimizationSummary?.pricingCoverage ?? null,
        priorities: Array.isArray(optimization?.optimizationSummary?.priorities)
          ? optimization.optimizationSummary.priorities
          : [],
      },
      productSchema: summarizeProductSchema(productSchema),
      productProfile: optimization?.productProfile || null,
      contentSuggestions: Array.isArray(optimization?.contentSuggestions)
        ? optimization.contentSuggestions
        : [],
      actionableSuggestions: Array.isArray(optimization?.actionableSuggestions)
        ? optimization.actionableSuggestions
        : [],
      productScore: {
        productId,
        finalScore: scoreData?.final_score ?? null,
        boutiqueTag: scoreData?.boutique_tag ?? null,
        problemMap: scoreData?.problem_map ?? null,
      },
      nextSuggestions: [
        "账户报告：看整体消耗、点击、询盘和趋势。",
        "关键词报告：看词级 CTR、CPC 和询盘率。",
        "推荐出价：为高转化词和高潜力词给出 bid 建议。",
        "推词：把高意图搜索词纳入重点计划。",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
