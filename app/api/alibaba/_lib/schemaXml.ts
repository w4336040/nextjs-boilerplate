export type SchemaRule = {
  name: string;
  value: string;
  target?: string;
  desc?: string;
  unit?: string;
};

export type SchemaOption = {
  displayName: string;
  value: string;
};

export type SchemaField = {
  id: string;
  name: string;
  type: string;
  depth: number;
  path: string[];
  required: boolean;
  value: string;
  filled: boolean;
  rules: SchemaRule[];
  options: SchemaOption[];
};

export type SchemaChecklistItem = {
  id: string;
  name: string;
  type: string;
  group: string;
  reason: string;
  optionsPreview?: SchemaOption[];
};

function attrValue(attrs: string, name: string) {
  const found = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return found?.[1] || "";
}

function attrsToRecord(attrs: string) {
  const record: Record<string, string> = {};
  for (const match of attrs.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    record[match[1]] = match[2];
  }
  return record;
}

function stripNestedFields(inner: string) {
  return inner.replace(/<fields>[\s\S]*?<\/fields>/g, "");
}

function textContent(xml: string, tag: string) {
  const found = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return found?.[1]?.replace(/<[^>]*>/g, "").trim() || "";
}

function getDirectFieldInner(xml: string, openEnd: number) {
  let depth = 1;
  let cursor = openEnd;
  const tagPattern = /<\/?field\b[^>]*>|<\/field>/g;
  tagPattern.lastIndex = cursor;

  for (const match of xml.matchAll(tagPattern)) {
    const tag = match[0];
    if (tag.startsWith("</field")) {
      depth -= 1;
      if (depth === 0) {
        return xml.slice(openEnd, match.index);
      }
    } else if (!tag.endsWith("/>")) {
      depth += 1;
    }
    cursor = (match.index || 0) + tag.length;
    tagPattern.lastIndex = cursor;
  }

  return "";
}

export function parseSchemaXml(xml: string) {
  const fields: SchemaField[] = [];
  const stack: Array<{ id: string; name: string }> = [];
  const tagPattern = /<field\b([^>]*?)(\/?)>|<\/field>/g;

  for (const match of xml.matchAll(tagPattern)) {
    const full = match[0];
    if (full.startsWith("</field")) {
      stack.pop();
      continue;
    }

    const attrs = match[1] || "";
    const id = attrValue(attrs, "id");
    const name = attrValue(attrs, "name");
    const type = attrValue(attrs, "type");
    const openEnd = (match.index || 0) + full.length;
    const inner = full.endsWith("/>") ? "" : getDirectFieldInner(xml, openEnd);
    const ownInner = stripNestedFields(inner);
    const rules = [...ownInner.matchAll(/<rule\b([^>]*)\/?>/g)].map((rule) => {
      const record = attrsToRecord(rule[1] || "");
      return {
        name: record.name || "",
        value: record.value || "",
        target: record.target,
        desc: record.desc,
        unit: record.unit,
      };
    });
    const options = [...ownInner.matchAll(/<option\b([^>]*)\/?>/g)]
      .slice(0, 200)
      .map((option) => {
        const record = attrsToRecord(option[1] || "");
        return {
          displayName: record.displayName || record.cnName || "",
          value: record.value || "",
        };
      });
    const path = [...stack.map((item) => item.name || item.id), name || id].filter(
      Boolean,
    );

    fields.push({
      id,
      name,
      type,
      depth: stack.length,
      path,
      required: rules.some(
        (rule) => rule.name === "requiredRule" && rule.value === "true",
      ),
      value: textContent(ownInner, "value"),
      filled: Boolean(textContent(ownInner, "value") || ownInner.includes("<values>")),
      rules,
      options,
    });

    if (!full.endsWith("/>")) {
      stack.push({ id, name });
    }
  }

  return fields;
}

function groupForField(field: SchemaField) {
  const joined = field.path.join(" / ").toLowerCase();
  if (joined.includes("image") || joined.includes("gallery")) return "Images";
  if (joined.includes("price") || joined.includes("moq")) return "Pricing";
  if (joined.includes("shipping") || joined.includes("logistics")) {
    return "Logistics";
  }
  if (joined.includes("sku") || joined.includes("specification")) return "SKU";
  if (joined.includes("product feature") || field.id.startsWith("p-")) {
    return "Product attributes";
  }
  if (joined.includes("product name") || joined.includes("keyword")) {
    return "Content";
  }
  return "General";
}

export function buildSchemaChecklist(fields: SchemaField[]) {
  const seen = new Set<string>();
  return fields
    .filter((field) => field.required && field.id)
    .map<SchemaChecklistItem>((field) => ({
      id: field.id,
      name: field.name || field.id,
      type: field.type,
      group: groupForField(field),
      reason: "requiredRule=true",
      optionsPreview: field.options.slice(0, 8),
    }))
    .filter((item) => {
      const key = `${item.group}:${item.id}:${item.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildProductOptimization(fields: SchemaField[]) {
  const checklist = buildSchemaChecklist(fields);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const missingRequired = checklist.filter((item) => {
    const field = fieldById.get(item.id);
    return field ? !field.filled : true;
  });
  const weakContent = fields.filter((field) => {
    const name = `${field.id} ${field.name}`.toLowerCase();
    return (
      (name.includes("title") || name.includes("keyword") || name.includes("summary")) &&
      (!field.value || field.value.length < 20)
    );
  });
  const imageFields = fields.filter((field) => {
    const name = `${field.id} ${field.name}`.toLowerCase();
    return name.includes("image") || name.includes("gallery");
  });
  const priceFields = fields.filter((field) => {
    const name = `${field.id} ${field.name}`.toLowerCase();
    return name.includes("price") || name.includes("moq") || name.includes("quantity");
  });

  return {
    missingRequiredCount: missingRequired.length,
    missingRequired: missingRequired.slice(0, 80),
    weakContent: weakContent.slice(0, 30).map((field) => ({
      id: field.id,
      name: field.name || field.id,
      path: field.path,
      valueLength: field.value.length,
      suggestion: "补充更完整的英文标题、关键词或卖点文本。",
    })),
    imageCoverage: {
      fieldCount: imageFields.length,
      filledCount: imageFields.filter((field) => field.filled).length,
      suggestion: "检查主图、详情图、场景图、细节图是否齐全且清晰。",
    },
    pricingCoverage: {
      fieldCount: priceFields.length,
      filledCount: priceFields.filter((field) => field.filled).length,
      suggestion: "检查 MOQ、阶梯价、样品价、币种和价格区间是否完整。",
    },
    priorities: [
      "先补齐 missingRequired 中的必填项，避免商品编辑或发布失败。",
      "优先优化 Product name、Product keywords、Product images、MOQ、Single Piece price。",
      "再根据商品质量分接口返回的 problem_map 定向修复低质量项。",
    ],
  };
}

export function summarizeParsedSchema(fields: SchemaField[]) {
  const checklist = buildSchemaChecklist(fields);
  return {
    fieldCount: fields.length,
    requiredCount: checklist.length,
    groups: Object.entries(
      checklist.reduce<Record<string, number>>((acc, item) => {
        acc[item.group] = (acc[item.group] || 0) + 1;
        return acc;
      }, {}),
    ).map(([name, count]) => ({ name, count })),
    requiredPreview: checklist.slice(0, 80),
    fieldsPreview: fields.slice(0, 120),
  };
}
