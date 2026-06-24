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

    return NextResponse.json({
      ok: true,
      product_id: productId,
      renderOk: Boolean(render?.schema?.hasXml),
      scoreOk: Boolean(score?.ok && !score?.data?.error_response),
      productSchema: render?.schema || null,
      score: score?.data || score,
      recommendations: [
        "优先处理 productSchema.optimization.missingRequired 中的缺项。",
        "结合 score.result.problem_map 定位质量分扣分原因。",
        "标题、主图、详情图、MOQ、价格、物流模板是第一批优化对象。",
        "本接口只读诊断，不会修改商品；写入前需要展示 diff 并由你确认。",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
