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

function hasActualQualityProblem(problemMap: Record<string, unknown> | null) {
  const extendProblemMap = problemMap?.extendProblemMap;
  if (!extendProblemMap || typeof extendProblemMap !== "object") return false;
  return Object.values(extendProblemMap).some(Boolean);
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
    const optimization = render?.schema?.optimization || null;
    const actualQualityProblem = hasActualQualityProblem(problemMap);
    const isBoutique = Number(finalScore) >= 4.8 && Boolean(boutiqueTag);

    return NextResponse.json({
      ok: true,
      product_id: productId,
      renderOk: Boolean(render?.schema?.hasXml),
      scoreOk: Boolean(score?.ok && !score?.data?.error_response),
      diagnosis: {
        finalScore,
        boutiqueTag,
        qualityStatus: isBoutique
          ? "\u5f53\u524d\u5546\u54c1\u8d28\u91cf\u5206\u8f83\u9ad8\uff0c\u5df2\u8fbe\u5230\u7cbe\u54c1\u5546\u54c1\u72b6\u6001\u3002"
          : "\u5f53\u524d\u5546\u54c1\u4ecd\u6709\u4f18\u5316\u7a7a\u95f4\uff0c\u8bf7\u4f18\u5148\u67e5\u770b missingRequired \u548c problemMap\u3002",
        actualQualityProblem,
        problemMap,
      },
      report: {
        status: isBoutique
          ? "\u5df2\u662f\u4f18\u8d28\u5546\u54c1\uff0c\u5efa\u8bae\u505a\u589e\u5f3a\u578b\u4f18\u5316\uff0c\u4e0d\u5efa\u8bae\u76f2\u76ee\u5927\u6539\u3002"
          : "\u9700\u8981\u4f18\u5148\u4fee\u590d\u5fc5\u586b\u9879\u6216\u8d28\u91cf\u5206\u95ee\u9898\u3002",
        score: finalScore,
        boutique: Boolean(boutiqueTag),
        trueMissingRequiredCount: optimization?.missingRequiredCount ?? null,
        weakContentCount: optimization?.weakContent?.length ?? null,
        safeNextActions: [
          "\u5148\u751f\u6210\u6807\u9898\u3001\u5173\u952e\u8bcd\u3001\u56fe\u7247\u548c\u4ef7\u683c\u7684\u4f18\u5316\u5efa\u8bae\u3002",
          "\u53ea\u505a\u8bca\u65ad\u548c diff \u5bf9\u6bd4\uff0c\u4e0d\u81ea\u52a8\u5199\u56de\u5546\u54c1\u3002",
          "\u7b49\u4f60\u786e\u8ba4\u540e\uff0c\u518d\u8c03\u7528\u5199\u5165\u63a5\u53e3\u66f4\u65b0\u8349\u7a3f\u6216\u5546\u54c1\u3002",
        ],
      },
      productSchema: render?.schema || null,
      score: scoreData,
      recommendations: [
        "\u4f18\u5148\u5904\u7406 productSchema.optimization.missingRequired \u4e2d\u7684\u771f\u5b9e\u5fc5\u586b\u7f3a\u5931\u3002",
        "\u7ed3\u5408 score.result.problem_map \u5b9a\u4f4d\u8d28\u91cf\u5206\u6263\u5206\u539f\u56e0\u3002",
        "\u6807\u9898\u3001\u4e3b\u56fe\u3001\u8be6\u60c5\u56fe\u3001MOQ\u3001\u4ef7\u683c\u3001\u7269\u6d41\u6a21\u677f\u662f\u7b2c\u4e00\u6279\u4f18\u5316\u5bf9\u8c61\u3002",
        "\u672c\u63a5\u53e3\u53ea\u8bfb\u8bca\u65ad\uff0c\u4e0d\u4f1a\u4fee\u6539\u5546\u54c1\uff1b\u5199\u5165\u524d\u5fc5\u987b\u5c55\u793a diff \u5e76\u7531\u4f60\u786e\u8ba4\u3002",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
