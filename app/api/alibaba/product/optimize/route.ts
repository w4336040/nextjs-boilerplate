import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ActionableSuggestion = {
  key: string;
  title: string;
  priority: "high" | "medium" | "low";
  source: string;
  reason: string;
  action: string;
  evidence?: string;
  fieldPath?: string[];
};

type RecordObject = Record<string, unknown>;

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
  const data = score as RecordObject;
  const result = data.result as RecordObject | undefined;
  const raw = result?.problem_map;
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw) as RecordObject;
  } catch {
    return null;
  }
}

function hasActualQualityProblem(problemMap: RecordObject | null) {
  const extendProblemMap = problemMap?.extendProblemMap;
  if (!extendProblemMap || typeof extendProblemMap !== "object") return false;
  return Object.values(extendProblemMap).some(Boolean);
}

function normalizePath(path: unknown) {
  return Array.isArray(path) ? path.map((item) => String(item)).filter(Boolean) : [];
}

function pathText(path: string[]) {
  return path.length ? path.join(" / ") : "未提供路径";
}

function titleFromName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMissingRequiredAction(item: RecordObject) {
  const group = String(item.group || "").toLowerCase();
  const name = String(item.name || item.id || "未命名字段");

  if (group.includes("image")) {
    return `补齐 ${name} 对应的主图、场景图或细节图；首图保持主体清晰、无水印、无裁切。`;
  }
  if (group.includes("pricing")) {
    return `补齐 ${name} 对应的单价、阶梯价、样品价、MOQ、币种和价格区间。`;
  }
  if (group.includes("logistics")) {
    return `补齐 ${name} 对应的物流方式、交期、发货地、运费模板。`;
  }
  if (group.includes("sku")) {
    return `补齐 ${name} 对应的规格、颜色、尺码、SKU 图片和库存。`;
  }
  if (group.includes("content")) {
    return `在 ${name} 中加入核心词、品类词、材质、型号或用途，避免空泛描述。`;
  }
  return `按 Schema 必填要求补齐 ${name}，避免发布或编辑时校验失败。`;
}

function buildWeakContentAction(item: RecordObject) {
  const name = String(item.name || item.id || "未命名字段");
  const path = normalizePath(item.path);
  const pathLabel = pathText(path);
  const suggestion = String(item.suggestion || "");

  if (suggestion) return suggestion;

  const lower = `${name} ${pathLabel}`.toLowerCase();
  if (lower.includes("title") || lower.includes("keyword") || lower.includes("summary")) {
    return `把 ${pathLabel} 扩写到 80-120 字符，前置核心词、品类词、材质和型号，并保留买家可搜索的词。`;
  }
  return `把 ${pathLabel} 补成更完整的英文说明，加入规格、材质、场景、认证或卖点。`;
}

function buildProblemAction(key: string) {
  const actions: Record<string, { title: string; action: string }> = {
    title_word_miss_core_error: {
      title: "标题缺少核心词",
      action: "把核心词放到标题前半段，按“品类词 + 核心特征 + 型号/材质”顺序重写。",
    },
    title_word_error: {
      title: "标题用词异常",
      action: "检查标题是否有重复堆词、语序不顺或不自然表达，保留能被买家搜索的词。",
    },
    imageQualityBad: {
      title: "主图质量偏弱",
      action: "替换为清晰无水印主图，保证主体突出、背景干净、分辨率足够。",
    },
    image_num: {
      title: "图片数量不足",
      action: "补足主图、场景图、细节图、尺寸图，至少让买家看清用途和规格。",
    },
    image_scale: {
      title: "图片比例不合适",
      action: "统一图片比例，避免裁切变形，常用 1:1 或 4:5。",
    },
    imageText: {
      title: "图文一致性不足",
      action: "让主图、标题和卖点一致，避免买家点进来发现信息不匹配。",
    },
    sku_image: {
      title: "SKU 图片偏弱",
      action: "为每个 SKU 补清晰规格图或颜色图，降低选错风险。",
    },
    sku_text: {
      title: "SKU 文案偏弱",
      action: "把 SKU 文案写成规格 + 材质 + 颜色/尺寸的统一格式。",
    },
    category: {
      title: "类目匹配不足",
      action: "检查类目和属性是否匹配，必要时重新选类目。",
    },
    selling_point_attribute_conflict: {
      title: "卖点与属性冲突",
      action: "让卖点和属性一致，删除与实际不符的营销表述。",
    },
    inventory: {
      title: "库存异常",
      action: "核对库存和可售数量，避免无货或超卖。",
    },
    freightRate: {
      title: "运费竞争力不足",
      action: "检查运费模板和到门成本，确保价格具备竞争力。",
    },
    price: {
      title: "价格策略待优化",
      action: "补齐价格区间、样品价和阶梯价，让买家能快速判断采购成本。",
    },
    imageSubTitle: {
      title: "图片副标题不足",
      action: "在图片中加入短副标题或说明，帮助买家快速理解差异点。",
    },
  };

  return actions[key] || {
    title: titleFromName(key),
    action: "根据质量规则命中的字段项进行修复，优先保证商品信息与买家搜索意图一致。",
  };
}

function buildCoverageSuggestion(
  kind: "imageCoverage" | "pricingCoverage",
  coverage: unknown,
): ActionableSuggestion | null {
  if (!coverage || typeof coverage !== "object") return null;
  const record = coverage as RecordObject;
  const fieldCount = Number(record.fieldCount || 0);
  const filledCount = Number(record.filledCount || 0);
  if (!fieldCount || filledCount >= fieldCount) return null;

  if (kind === "imageCoverage") {
    return {
      key: kind,
      title: "补齐图片覆盖",
      priority: "high",
      source: "schema.optimization.imageCoverage",
      reason: `图片字段 ${filledCount}/${fieldCount} 已填写。`,
      action: "优先补主图、场景图、细节图、对比图；首图保证主体清晰、无水印、主体占画面 70% 以上。",
      evidence: typeof record.suggestion === "string" ? record.suggestion : undefined,
    };
  }

  return {
    key: kind,
    title: "补齐价格和 MOQ",
    priority: "high",
    source: "schema.optimization.pricingCoverage",
    reason: `价格字段 ${filledCount}/${fieldCount} 已填写。`,
    action: "补单价、阶梯价、样品价、MOQ、币种和交付条件，让买家能直接判断采购成本。",
    evidence: typeof record.suggestion === "string" ? record.suggestion : undefined,
  };
}

function buildActionableSuggestions(
  optimization: unknown,
  problemMap: RecordObject | null,
  report: RecordObject | null,
) {
  const suggestions: ActionableSuggestion[] = [];
  const seen = new Set<string>();
  const optimizationRecord = optimization && typeof optimization === "object" ? (optimization as RecordObject) : {};

  function addSuggestion(item: ActionableSuggestion) {
    if (seen.has(item.key)) return;
    seen.add(item.key);
    suggestions.push(item);
  }

  const missingRequired = Array.isArray(optimizationRecord.missingRequired) ? optimizationRecord.missingRequired : [];
  for (const item of missingRequired.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const record = item as RecordObject;
    const path = normalizePath(record.path);
    const name = String(record.name || record.id || "未命名字段");
    const group = String(record.group || "General");
    const optionsPreview = Array.isArray(record.optionsPreview) ? record.optionsPreview : [];
    const optionNames = optionsPreview
      .map((option) => {
        if (!option || typeof option !== "object") return "";
        const opt = option as RecordObject;
        return String(opt.displayName || opt.cnName || opt.value || "");
      })
      .filter(Boolean)
      .slice(0, 4);

    addSuggestion({
      key: `missing-${String(record.id || name)}`,
      title: `补必填项：${name}`,
      priority: "high",
      source: "schema.optimization.missingRequired",
      reason: `Schema 要求中该字段属于 ${group}，当前还未完整填写。`,
      action: buildMissingRequiredAction(record),
      evidence: [
        path.length ? `路径：${pathText(path)}` : "",
        optionNames.length ? `可选值：${optionNames.join(" / ")}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      fieldPath: path.length ? path : undefined,
    });
  }

  const weakContent = Array.isArray(optimizationRecord.weakContent) ? optimizationRecord.weakContent : [];
  for (const item of weakContent.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const record = item as RecordObject;
    const path = normalizePath(record.path);
    const name = String(record.name || record.id || "未命名字段");
    const valueLength = Number(record.valueLength || 0);

    addSuggestion({
      key: `weak-${String(record.id || name)}`,
      title: `扩写弱内容：${name}`,
      priority: "medium",
      source: "schema.optimization.weakContent",
      reason: `当前文本长度仅 ${valueLength}，容易影响抓词和转化。`,
      action: buildWeakContentAction(record),
      evidence: path.length ? `路径：${pathText(path)}` : undefined,
      fieldPath: path.length ? path : undefined,
    });
  }

  const imageCoverage = buildCoverageSuggestion("imageCoverage", optimizationRecord.imageCoverage);
  if (imageCoverage) addSuggestion(imageCoverage);
  const pricingCoverage = buildCoverageSuggestion("pricingCoverage", optimizationRecord.pricingCoverage);
  if (pricingCoverage) addSuggestion(pricingCoverage);

  const extendProblemMap = problemMap?.extendProblemMap;
  const ruleScoreMap = problemMap?.ruleScoreMap;
  const extendProblemMapRecord =
    extendProblemMap && typeof extendProblemMap === "object"
      ? (extendProblemMap as Record<string, unknown>)
      : null;
  const ruleScoreMapRecord =
    ruleScoreMap && typeof ruleScoreMap === "object" ? (ruleScoreMap as Record<string, unknown>) : null;
  const candidateKeys = new Set<string>();

  if (extendProblemMap && typeof extendProblemMap === "object") {
    for (const [key, value] of Object.entries(extendProblemMap)) {
      if (value === false) candidateKeys.add(key);
    }
  }

  if (ruleScoreMap && typeof ruleScoreMap === "object") {
    for (const [key, value] of Object.entries(ruleScoreMap)) {
      if (typeof value === "number" && value > 0) candidateKeys.add(key);
    }
  }

  for (const key of candidateKeys) {
    const scoreValue =
      ruleScoreMapRecord && typeof ruleScoreMapRecord[key] === "number"
        ? (ruleScoreMapRecord[key] as number)
        : null;
    const info = buildProblemAction(key);

    addSuggestion({
      key: `problem-${key}`,
      title: info.title,
      priority:
        scoreValue !== null && scoreValue >= 0.7
          ? "high"
          : extendProblemMapRecord && extendProblemMapRecord[key] === false
            ? "high"
            : "medium",
      source: "score.problem_map",
      reason: scoreValue !== null ? `质量评分规则命中，得分 ${scoreValue.toFixed(2)}。` : "质量评分规则命中。",
      action: info.action,
      evidence: `key: ${key}`,
    });
  }

  if (!suggestions.length) {
    const safeNextActions = Array.isArray(report?.safeNextActions) ? report.safeNextActions : [];
    for (const [index, item] of safeNextActions.slice(0, 3).entries()) {
      addSuggestion({
        key: `fallback-${index}`,
        title: "继续诊断并补齐数据",
        priority: "low",
        source: "report.safeNextActions",
        reason: "当前没有拿到足够的字段级建议。",
        action: String(item),
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  return suggestions
    .slice()
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 12);
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
    const report = {
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
    };
    const actionableSuggestions = buildActionableSuggestions(optimization, problemMap, report);

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
      report,
      productSchema: render?.schema || null,
      optimization: optimization || null,
      score: scoreData,
      optimizationSummary: {
        missingRequiredCount: optimization?.missingRequiredCount ?? 0,
        weakContentCount: optimization?.weakContent?.length ?? 0,
        imageCoverage: optimization?.imageCoverage ?? null,
        pricingCoverage: optimization?.pricingCoverage ?? null,
        priorities: Array.isArray(optimization?.priorities) ? optimization.priorities.slice(0, 5) : [],
      },
      actionableSuggestions,
      recommendations: [
        "\u4f18\u5148\u5904\u7406 actionableSuggestions \u4e2d priority=high \u7684\u9879\uff0c\u5b83\u4eec\u662f\u771f\u5b9e\u53ef\u6267\u884c\u7684\u7f3a\u5931\u3002",
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
