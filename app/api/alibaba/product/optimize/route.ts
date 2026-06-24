import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function callInternal(request: NextRequest, path: string) {
  const url = new URL(path, request.url);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { cookie: request.headers.get("cookie") || "" },
    cache: "no-store",
  });
  return response.json();
}

function parseProblemMap(score: unknown) {
  if (!score || typeof score !== "object") return null;
  const data = score as Record<string, unknown>;
  const result = data.result as Record<string, unknown> | undefined;
  const raw = result?.problem_map;
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const productId =
      request.nextUrl.searchParams.get("product_id") ||
      request.nextUrl.searchParams.get("productId") ||
      request.nextUrl.searchParams.get("id") ||
      "";
    if (!productId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing product_id. Example: ?product_id=1601815992580",
        },
        { status: 400 },
      );
    }

    const [render, score] = await Promise.all([
      callInternal(request, "/api/alibaba/product/schema/render"),
      callInternal(request, "/api/alibaba/product/score"),
    ]);

    const scoreData = score?.data || score;
    const problemMap = parseProblemMap(scoreData);
    const finalScore = scoreData?.result?.final_score || null;
    const boutiqueTag = scoreData?.result?.boutique_tag || 0;

    return NextResponse.json({
      ok: true,
      product_id: productId,
      renderOk: Boolean(render?.schema?.hasXml),
      scoreOk: Boolean(score?.ok && !score?.data?.error_response),
      diagnosis: {
        finalScore,
        boutiqueTag,
        qualityStatus:
          Number(finalScore) >= 4.8 && boutiqueTag
            ? "当前商品质量分较高，已达到精品商品状态。"
            : "当前商品仍有优化空间，请优先查看 missingRequired 和 problemMap。",
        problemMap,
      },
      productSchema: render?.schema || null,
      score: scoreData,
      recommendations: [
        "优先处理 productSchema.optimization.missingRequired 中的真实必填缺失。",
        "结合 score.result.problem_map 定位质量分扣分原因。",
        "标题、主图、详情图、MOQ、价格、物流模板是第一批优化对象。",
        "本接口只读诊断，不会修改商品；写入前必须展示 diff 并由你确认。",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
