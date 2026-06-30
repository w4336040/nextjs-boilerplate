import type { SchemaField } from "./schemaXml";

type RecordObject = Record<string, unknown>;

export type ProfileValue = {
  label: string;
  value: string;
  id?: string;
  path?: string[];
};

export type ProductProfile = {
  productId: string;
  categoryId: string;
  title: string;
  titleLength: number;
  attributes: ProfileValue[];
  commerce: ProfileValue[];
  logistics: ProfileValue[];
  media: {
    imageCount: number;
    imageUrls: string[];
    galleries: string[];
  };
  content: {
    keywords: string[];
    descriptionPreview: string;
  };
  gaps: string[];
  raw: {
    fieldCount: number;
    filledFieldCount: number;
  };
};

export type ContentSuggestion = {
  key: string;
  area: "title" | "keywords" | "sellingPoints" | "details" | "images" | "pricing" | "attributes";
  priority: "high" | "medium" | "low";
  title: string;
  fieldLabel: string;
  fieldPath?: string[];
  currentValue: string;
  suggestedValue: string;
  rationale: string;
  evidence: string[];
  acceptLabel: string;
};

function decodeText(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeText(value.replace(/<[^>]*>/g, " "));
}

function fieldTarget(field: SchemaField) {
  return `${field.id} ${field.name} ${field.path.join(" ")}`.toLowerCase();
}

function displayValue(field?: SchemaField) {
  if (!field) return "";
  return stripHtml(field.displayValue || field.value || field.rawValue || "");
}

function meaningfulValue(field?: SchemaField) {
  const value = displayValue(field);
  if (!value) return "";
  if (["-", "--", "null", "undefined"].includes(value.toLowerCase())) return "";
  if (/^-\d+$/.test(value)) return "";
  return value;
}

function findField(fields: SchemaField[], matcher: (field: SchemaField) => boolean) {
  const matched = fields.filter(matcher);
  return (
    matched
      .slice()
      .sort((a, b) => fieldValueScore(b) - fieldValueScore(a))
      .find((field) => meaningfulValue(field)) || matched[0]
  );
}

function findValue(fields: SchemaField[], matcher: (field: SchemaField) => boolean) {
  const field = findField(fields, matcher);
  return {
    value: meaningfulValue(field),
    field,
  };
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term.toLowerCase()));
}

function byFieldName(names: string[]) {
  return (field: SchemaField) => includesAny(fieldTarget(field), names);
}

function normalizeLabel(value: string) {
  return decodeText(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function profileValue(label: string, field?: SchemaField): ProfileValue | null {
  const value = meaningfulValue(field);
  if (!value) return null;
  return {
    label,
    value,
    id: field?.id,
    path: field?.path,
  };
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items
    .map((item) => normalizeLabel(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function fieldValueScore(field: SchemaField) {
  const value = displayValue(field);
  if (!value) return 0;
  let score = 1;
  if (field.valueItems.some((item) => item.attributes.inputValue)) score += 8;
  if (field.displayValue && field.rawValue && field.displayValue !== field.rawValue) {
    score += 5;
  }
  if (!field.required) score += 1;
  if (!/^[-\d.]+$/.test(value)) score += 2;
  if (field.path.some((item) => /_\d+$/.test(item))) score -= 1;
  return score;
}

function attr(profile: ProductProfile, label: string) {
  return profile.attributes.find((item) => item.label === label)?.value || "";
}

function commerce(profile: ProductProfile, label: string) {
  return profile.commerce.find((item) => item.label === label)?.value || "";
}

function smartUpper(value: string) {
  return normalizeLabel(value)
    .replace(/\bpemf\b/gi, "PEMF")
    .replace(/\busb\b/gi, "USB")
    .replace(/\bmoq\b/gi, "MOQ")
    .replace(/\b(v)\b/gi, "V")
    .trim();
}

function usefulTitleTerms(title: string) {
  const priorityTerms = [
    "therapy",
    "therapeutic",
    "heat",
    "heating",
    "jade",
    "tourmaline",
    "mattress",
    "mat",
    "health",
    "bio",
    "infrared",
    "far infrared",
    "full body",
  ];
  const lowerTitle = title.toLowerCase();
  return priorityTerms.filter((term) => lowerTitle.includes(term)).map(smartUpper);
}

function compactTitle(parts: string[], maxLength = 125) {
  const cleaned = unique(parts).map(smartUpper).filter(Boolean);
  const selected: string[] = [];
  for (const part of cleaned) {
    const next = [...selected, part].join(" ");
    if (next.length <= maxLength) selected.push(part);
  }
  return selected.join(" ");
}

function buildTitleDraft(profile: ProductProfile) {
  const brand = attr(profile, "Brand Name");
  const model = attr(profile, "Model Number");
  const type = attr(profile, "Type") || "Product";
  const feature = attr(profile, "Function");
  const power = attr(profile, "Power");
  const materialTerms = usefulTitleTerms(profile.title).filter((term) =>
    ["Jade", "Tourmaline", "Heating", "Heat", "Infrared", "Far Infrared"].includes(term),
  );
  const pieces = [
    brand,
    model,
    feature ? `${feature} Therapy` : "",
    power ? `${power} Heating` : "Heating",
    type,
    materialTerms.length ? `with ${materialTerms.join(" ")}` : "",
    "Full Body Mattress",
  ];
  const draft = compactTitle(pieces, 118);
  return draft || compactTitle([brand, model, type, profile.title], 118);
}

function buildKeywordDraft(profile: ProductProfile) {
  const type = attr(profile, "Type") || profile.title || "product";
  const application = attr(profile, "Application");
  const feature = attr(profile, "Function");
  const model = attr(profile, "Model Number");
  const power = attr(profile, "Power");

  return unique([
    feature && type ? `${feature} ${type}` : "",
    "PEMF therapy mattress",
    "heating massage mattress",
    "jade tourmaline mat",
    "full body therapy mat",
    application && type ? `${application} therapy ${type}` : "",
    model && type ? `${model} ${type}` : "",
    power && type ? `${power} ${type}` : "",
    `${type} supplier`,
  ])
    .map((item) => item.toLowerCase().replace(/\bpemf\b/g, "PEMF"))
    .slice(0, 7)
    .join(", ");
}

function buildSellingPoints(profile: ProductProfile) {
  const type = attr(profile, "Type") || "product";
  const model = attr(profile, "Model Number");
  const application = attr(profile, "Application");
  const feature = attr(profile, "Function");
  const power = attr(profile, "Power");
  const voltage = attr(profile, "Voltage");
  const size = attr(profile, "Size");
  const weight = attr(profile, "Weight");
  const service = attr(profile, "After-sale Service");
  const place = attr(profile, "Place of Origin");
  const province = attr(profile, "Province");
  const brand = attr(profile, "Brand Name");

  return unique([
    model ? `Model ${model} ${type}${application ? ` for ${application.toLowerCase()} use` : ""}.` : "",
    feature || power || voltage
      ? `${feature ? `${smartUpper(feature)} function` : "Configured function"}${power ? `, ${power} power` : ""}${voltage ? `, ${voltage} voltage options` : ""}.`
      : "",
    size || weight ? `${size ? `Product size ${size}` : ""}${size && weight ? ", " : ""}${weight ? `weight ${weight}` : ""}.` : "",
    brand || place ? `${brand ? `${brand} brand` : "Brand-ready product"}${place ? `, made in ${place}${province ? `, ${province}` : ""}` : ""}.` : "",
    service ? `${service} after-sale service for B2B buyers.` : "",
    "Use the detail page to explain heating zones, controller operation, material layers and recommended usage time.",
  ]).join("\n");
}

function buildDetailDraft(profile: ProductProfile) {
  const title = buildTitleDraft(profile).replace(/\s+Wholesale Supplier$/i, "");
  const type = attr(profile, "Type") || "product";
  const application = attr(profile, "Application");
  const model = attr(profile, "Model Number");
  const feature = attr(profile, "Function");
  const power = attr(profile, "Power");
  const voltage = attr(profile, "Voltage");
  const size = attr(profile, "Size");
  const weight = attr(profile, "Weight");
  const moq = commerce(profile, "MOQ");
  const price = commerce(profile, "Single Piece price");

  return [
    `${title} is prepared for buyers sourcing ${type.toLowerCase()} products${application ? ` for ${application.toLowerCase()} applications` : ""}.`,
    `Key specification: ${[
      model ? `model ${model}` : "",
      feature ? `${smartUpper(feature)} function` : "",
      power ? `${power} power` : "",
      voltage ? `${voltage} voltage options` : "",
      size ? `size ${size}` : "",
      weight ? `weight ${weight}` : "",
    ]
      .filter(Boolean)
      .join(", ")}.`,
    moq || price ? `Current commercial setting: ${moq ? `MOQ ${moq}` : ""}${moq && price ? ", " : ""}${price ? `unit price USD ${price}` : ""}.` : "",
    "Recommended detail-page order: buyer use case, core specifications, product close-up, size and packaging, service support, then inquiry call-to-action.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildImageDraft(profile: ProductProfile) {
  const type = attr(profile, "Type") || "product";
  const model = attr(profile, "Model Number");
  return [
    `1. Main image: clean front view of ${model ? `${model} ` : ""}${type}; keep the full mat visible and remove extra text overlays.`,
    `2. Use-scene image: show the ${type} on a bed or treatment table, with the full body scale visible.`,
    "3. Close-ups: controller, cable/plug, jade/tourmaline surface, heating area and stitching edge.",
    "4. Specification image: size, power, voltage, weight, package size and accessories in one comparison graphic.",
    "5. Trust image: QC test, packaging, factory or service support proof.",
  ].join("\n");
}

function buildPricingDraft(profile: ProductProfile) {
  const moq = commerce(profile, "MOQ");
  const price = commerce(profile, "Single Piece price");
  const unit = commerce(profile, "Unit");
  const sample = commerce(profile, "Sample price");
  const base = price || sample;

  if (!base && !moq) {
    return "Fill MOQ, unit price, sample price and tiered pricing. Keep one clear entry price, then add 10 / 50 / 100 pcs tiers after checking margin.";
  }

  return [
    `Keep the first tier clear: ${moq ? `MOQ ${moq}` : "MOQ to confirm"}${unit ? ` ${unit}` : ""}${base ? `, USD ${base} per piece` : ""}.`,
    sample && sample !== base ? `Show sample price separately: USD ${sample}.` : "",
    "Add 10 / 50 / 100 pcs tier rows after margin check, so buyers can understand bulk purchasing cost before inquiry.",
  ]
    .filter(Boolean)
    .join(" ");
}

function evidenceFromProfile(profile: ProductProfile, labels: string[]) {
  return labels
    .map((label) => {
      const item = profile.attributes.find((field) => field.label === label) || profile.commerce.find((field) => field.label === label);
      return item ? `${label}: ${item.value}` : "";
    })
    .filter(Boolean);
}

function looksLikeImageUrl(value: string) {
  return (
    /(^|\/\/|https?:\/\/).+\.(png|jpe?g|webp|gif)(_|$|\?)/i.test(value) ||
    value.includes("alicdn.com/kf/")
  );
}

function normalizeImageUrl(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  return cleaned;
}

export function buildProductProfile(fields: SchemaField[], productId: string): ProductProfile {
  const { value: categoryId } = findValue(fields, (field) => field.id === "catId");
  const titleResult = findValue(fields, (field) => {
    const target = fieldTarget(field);
    return field.id === "productTitle" || target.includes("product name") || target.includes("product title");
  });

  const attributeSpecs = [
    ["Brand Name", ["brand name"]],
    ["Model Number", ["model number"]],
    ["Type", ["product feature type"]],
    ["Application", ["application"]],
    ["Function", ["function"]],
    ["Power", ["power"]],
    ["Voltage", ["voltage"]],
    ["Size", ["size"]],
    ["Weight", ["weight"]],
    ["Power Source", ["power source"]],
    ["After-sale Service", ["after-sale service"]],
    ["Place of Origin", ["place of origin"]],
    ["Province", ["province"]],
    ["Color", ["sales property color", " color"]],
  ] as const;

  const attributes = attributeSpecs
    .map(([label, terms]) => profileValue(label, findField(fields, byFieldName([...terms]))))
    .filter(Boolean) as ProfileValue[];

  const commerceSpecs: Array<[string, (field: SchemaField) => boolean]> = [
    [
      "MOQ",
      (field) =>
        field.id === "minOrderQuantity" ||
        (field.id === "quantity" &&
          fieldTarget(field).includes("quantity price") &&
          !fieldTarget(field).includes("moq")),
    ],
    [
      "Single Piece price",
      (field) =>
        field.id === "price" &&
        fieldTarget(field).includes("quantity price") &&
        !fieldTarget(field).includes("single piece price"),
    ],
    ["Sample price", (field) => fieldTarget(field).includes("sample price")],
    ["Unit", (field) => field.id === "priceUnit" || fieldTarget(field).includes(" unit")],
    ["Price setting", (field) => field.id === "scPrice" || fieldTarget(field).includes("price setting")],
    ["Sell product by", (field) => field.id === "saleType" || fieldTarget(field).includes("sell product by")],
  ];

  const commerceValues = commerceSpecs
    .map(([label, matcher]) => profileValue(label, findField(fields, matcher)))
    .filter(Boolean) as ProfileValue[];

  const logisticsSpecs: Array<[string, (field: SchemaField) => boolean]> = [
    ["Package weight", (field) => field.id === "pkgWeight" || fieldTarget(field).includes("volume and weight")],
    ["Shipping template", (field) => field.id === "shippingTemplate" || field.id === "shippingTemplateId"],
    ["Lead time quantity", (field) => field.id === "quantity" && fieldTarget(field).includes("shipping")],
    ["Estimated lead time", (field) => field.id === "day" && fieldTarget(field).includes("shipping")],
  ];

  const logistics = logisticsSpecs
    .map(([label, matcher]) => profileValue(label, findField(fields, matcher)))
    .filter(Boolean) as ProfileValue[];

  const keywordFields = fields.filter((field) => fieldTarget(field).includes("product keywords"));
  const keywords = unique(keywordFields.map((field) => meaningfulValue(field)).filter(Boolean));
  const description = findField(fields, (field) => {
    const target = fieldTarget(field);
    return field.id === "superText" || target.includes("regular editor") || target.includes("product description");
  });
  const imageUrlFields = fields.filter((field) => {
    const target = fieldTarget(field);
    const value = meaningfulValue(field);
    return (
      Boolean(value) &&
      (field.id.toLowerCase().includes("imageurl") ||
        field.id.toLowerCase().startsWith("scimages_") ||
        target.includes("image url") ||
        looksLikeImageUrl(value))
    );
  });
  const galleries = unique(
    fields
      .filter((field) => field.id === "gallery" && meaningfulValue(field))
      .map((field) => meaningfulValue(field)),
  );

  const powerSource = attributes.find((item) => item.label === "Power Source");
  const gaps = [
    !titleResult.value ? "商品标题未解析到当前值" : "",
    !keywords.length ? "Product keywords 为空，影响搜索词覆盖" : "",
    !powerSource ? "Power Source 未填写，建议确认供电方式" : "",
    imageUrlFields.length < 6 ? "图片素材数量偏少，建议补齐场景图、细节图和规格图" : "",
  ].filter(Boolean);

  return {
    productId,
    categoryId,
    title: titleResult.value,
    titleLength: titleResult.value.length,
    attributes,
    commerce: commerceValues,
    logistics,
    media: {
      imageCount: Math.max(imageUrlFields.length, galleries.length),
      imageUrls: imageUrlFields
        .map((field) => normalizeImageUrl(meaningfulValue(field)))
        .filter(Boolean)
        .slice(0, 8),
      galleries,
    },
    content: {
      keywords,
      descriptionPreview: meaningfulValue(description).slice(0, 260),
    },
    gaps,
    raw: {
      fieldCount: fields.length,
      filledFieldCount: fields.filter((field) => meaningfulValue(field)).length,
    },
  };
}

export function buildContentSuggestions(
  profile: ProductProfile,
  optimization?: RecordObject | null,
): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const titleDraft = buildTitleDraft(profile);
  const keywordDraft = buildKeywordDraft(profile);
  const sellingPoints = buildSellingPoints(profile);
  const detailDraft = buildDetailDraft(profile);
  const imageDraft = buildImageDraft(profile);
  const pricingDraft = buildPricingDraft(profile);
  const weakContent = Array.isArray(optimization?.weakContent) ? optimization?.weakContent : [];
  const imageCoverage = optimization?.imageCoverage as RecordObject | undefined;
  const pricingCoverage = optimization?.pricingCoverage as RecordObject | undefined;

  suggestions.push({
    key: "draft-title",
    area: "title",
    priority: profile.title ? "medium" : "high",
    title: "标题重写草稿",
    fieldLabel: "Product name",
    fieldPath: ["Product name"],
    currentValue: profile.title || "未解析到标题",
    suggestedValue: titleDraft,
    rationale: "标题草稿只使用当前商品已解析到的品牌、型号、类型、功能、功率和电压，避免空泛堆词。",
    evidence: evidenceFromProfile(profile, ["Brand Name", "Model Number", "Type", "Application", "Function", "Power", "Voltage"]),
    acceptLabel: "采纳标题草稿",
  });

  suggestions.push({
    key: "draft-keywords",
    area: "keywords",
    priority: profile.content.keywords.length ? "medium" : "high",
    title: "关键词补全草稿",
    fieldLabel: "Product keywords",
    fieldPath: ["Product keywords"],
    currentValue: profile.content.keywords.join(", ") || "当前为空",
    suggestedValue: keywordDraft,
    rationale: weakContent.length ? "接口已识别 Product keywords 偏弱；先用商品真实属性生成词根，再进入广告词报告扩展。" : "用商品属性生成第一版搜索词，后续可接关键词报告继续筛选。",
    evidence: evidenceFromProfile(profile, ["Type", "Application", "Function", "Model Number", "Power"]),
    acceptLabel: "采纳关键词",
  });

  suggestions.push({
    key: "draft-selling-points",
    area: "sellingPoints",
    priority: "medium",
    title: "卖点区块草稿",
    fieldLabel: "Selling points",
    fieldPath: ["Regular Editor"],
    currentValue: profile.content.descriptionPreview || "详情文本未解析到可展示内容",
    suggestedValue: sellingPoints,
    rationale: "卖点从规格、功能、产地和售后服务拆开写，适合放在详情页首屏或产品说明开头。",
    evidence: evidenceFromProfile(profile, ["Model Number", "Type", "Function", "Power", "Voltage", "After-sale Service"]),
    acceptLabel: "采纳卖点",
  });

  suggestions.push({
    key: "draft-details",
    area: "details",
    priority: "medium",
    title: "详情页首屏文案",
    fieldLabel: "Regular Editor",
    fieldPath: ["Regular Editor"],
    currentValue: profile.content.descriptionPreview || "详情文本未解析到可展示内容",
    suggestedValue: detailDraft,
    rationale: "详情首屏先回答买家最关心的用途、规格、价格门槛和询盘理由，减少只堆图片导致的信息断层。",
    evidence: evidenceFromProfile(profile, ["Type", "Application", "Model Number", "Function", "Power", "Voltage"]),
    acceptLabel: "采纳详情文案",
  });

  suggestions.push({
    key: "draft-images",
    area: "images",
    priority: Number(imageCoverage?.filledCount || profile.media.imageCount) >= 6 ? "low" : "high",
    title: "图片素材补拍清单",
    fieldLabel: "Product images",
    fieldPath: ["Product images", "Details of the picture"],
    currentValue: `已解析图片/图库：${profile.media.imageCount || 0} 项${profile.media.galleries.length ? `；图库类型：${profile.media.galleries.join(" / ")}` : ""}`,
    suggestedValue: imageDraft,
    rationale: "图片建议按买家决策顺序排列：先看产品，再看场景，再看细节和规格，最后看可信证明。",
    evidence: [
      imageCoverage ? `图片字段填写：${imageCoverage.filledCount || 0}/${imageCoverage.fieldCount || 0}` : "",
      ...profile.media.galleries.map((item) => `Gallery: ${item}`),
    ].filter(Boolean),
    acceptLabel: "采纳图片清单",
  });

  suggestions.push({
    key: "draft-pricing",
    area: "pricing",
    priority: Number(pricingCoverage?.filledCount || 0) >= 8 ? "low" : "medium",
    title: "价格和 MOQ 表达",
    fieldLabel: "Quantity price",
    fieldPath: ["Quantity price"],
    currentValue: profile.commerce.map((item) => `${item.label}: ${item.value}`).join(" / ") || "未解析到价格信息",
    suggestedValue: pricingDraft,
    rationale: "不直接替你改价，只把当前首档价格表达清楚，并预留阶梯价结构，方便买家判断采购成本。",
    evidence: evidenceFromProfile(profile, ["MOQ", "Single Piece price", "Unit", "Sample price"]),
    acceptLabel: "采纳价格表达",
  });

  if (profile.gaps.length) {
    suggestions.push({
      key: "draft-attributes",
      area: "attributes",
      priority: "medium",
      title: "属性补齐任务",
      fieldLabel: "Product feature",
      fieldPath: ["Product feature"],
      currentValue: profile.gaps.join(" / "),
      suggestedValue: [
        attr(profile, "Power") || attr(profile, "Voltage") ? "确认并填写 Power Source：Plug-In / USB / Built-In Battery 选择真实供电方式。" : "",
        "把缺失属性作为人工审核任务，不自动猜测属性值。",
        "审核后再进入商品更新接口，保留字段 diff 和操作日志。",
      ]
        .filter(Boolean)
        .join("\n"),
      rationale: "属性值会影响类目匹配、搜索过滤和买家信任，不能由系统随意编造。",
      evidence: profile.gaps,
      acceptLabel: "采纳属性任务",
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
