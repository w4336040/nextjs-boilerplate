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
  path?: string[];
  filled?: boolean;
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
    const value = textContent(ownInner, "value");

    fields.push({
      id,
      name,
      type,
      depth: stack.length,
      path,
      required: rules.some(
        (rule) => rule.name === "requiredRule" && rule.value === "true",
      ),
      value,
      filled: Boolean(value || ownInner.includes("<values>")),
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
  if (joined.includes("shipping") || joined.includes("logistics")) return "Logistics";
  if (joined.includes("sku") || joined.includes("specification")) return "SKU";
  if (joined.includes("product feature") || field.id.startsWith("p-")) {
    return "Product attributes";
  }
  if (joined.includes("product name") || joined.includes("keyword")) {
    return "Content";
  }
  return "General";
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function pathText(field: Pick<SchemaField, "path">) {
  return field.path.map(normalized).join(" / ");
}

function displayName(field: Pick<SchemaField, "id" | "name">) {
  return field.name || field.id;
}

function hasMeaningfulValue(field: SchemaField) {
  return Boolean(field.value.trim()) || field.filled;
}

function isOptionalTemplateRequired(field: SchemaField) {
  const path = pathText(field);
  return (
    /custommoreproperty_\d+/.test(path) ||
    /ladderprice_[1-9]\d*/.test(path) ||
    /ladderperiod_[1-9]\d*/.test(path) ||
    path.includes("company picture") ||
    path.includes("faq") ||
    field.id === "question" ||
    field.id === "answers"
  );
}

function hasMatchingFilledValue(required: SchemaField, fields: SchemaField[]) {
  if (hasMeaningfulValue(required)) return true;
  if (isOptionalTemplateRequired(required)) return true;

  const requiredPath = pathText(required);
  const requiredName = normalized(displayName(required));
  const filledFields = fields.filter(hasMeaningfulValue);
  const filledPaths = filledFields.map(pathText);
  const hasFilledPrice = filledPaths.some(
    (path) =>
      path.includes("ladderprice") ||
      path.includes("price setting") ||
      path.includes("single piece price") ||
      path.includes("sample"),
  );
  const hasFilledDetailMedia = filledPaths.some(
    (path) =>
      path.includes("details of the picture") ||
      path.includes("product images") ||
      path.includes("image") ||
      path.includes("gallery"),
  );

  if (["range_min", "range_max", "unit_type"].includes(required.id)) {
    return hasFilledPrice;
  }

  if (
    required.id === "superText" ||
    requiredPath.includes("details of the picture")
  ) {
    return hasFilledDetailMedia;
  }

  return filledFields.some((field) => {
    const filledPath = pathText(field);
    const filledName = normalized(displayName(field));

    if (field.id !== required.id) return false;
    if (requiredName && filledName === requiredName) return true;
    if (required.id.startsWith("p-")) return true;

    if (requiredPath.includes("ladderprice_0")) {
      return filledPath.includes("ladderprice_0");
    }

    if (requiredPath.includes("logistics supply mode")) {
      return filledPath.includes("logistics supply mode");
    }

    if (
      groupForField(required) === "Images" ||
      requiredPath.includes("product images") ||
      requiredPath.includes("details of the picture")
    ) {
      return (
        filledPath.includes("image") ||
        filledPath.includes("gallery") ||
        filledPath.includes("details of the picture")
      );
    }

    if (required.id === "price" && requiredName.includes("sample")) {
      return filledPath.includes("sample") || filledPath.includes("ladderprice");
    }

    return !["price", "quantity", "range_min", "range_max", "unit_type"].includes(
      required.id,
    );
  });
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
      path: field.path,
      optionsPreview: field.options.slice(0, 8),
    }))
    .filter((item) => {
      const key = `${item.group}:${item.id}:${item.name}:${(item.path || []).join("/")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function buildProductOptimization(fields: SchemaField[]) {
  const requiredFields = fields.filter((field) => field.required && field.id);
  const checklist = buildSchemaChecklist(fields).map((item) => {
    const requiredField = requiredFields.find(
      (field) =>
        field.id === item.id &&
        field.path.join("\u0000") === (item.path || []).join("\u0000"),
    );
    return {
      ...item,
      filled: requiredField ? hasMatchingFilledValue(requiredField, fields) : false,
    };
  });
  const missingRequired = checklist.filter((item) => !item.filled);
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
    filledRequiredCount: checklist.filter((item) => item.filled).length,
    weakContent: weakContent.slice(0, 30).map((field) => ({
      id: field.id,
      name: field.name || field.id,
      path: field.path,
      valueLength: field.value.length,
      suggestion:
        "\u8865\u5145\u66f4\u5b8c\u6574\u7684\u82f1\u6587\u6807\u9898\u3001\u5173\u952e\u8bcd\u6216\u5356\u70b9\u6587\u672c\u3002",
    })),
    imageCoverage: {
      fieldCount: imageFields.length,
      filledCount: imageFields.filter((field) => field.filled).length,
      suggestion:
        "\u68c0\u67e5\u4e3b\u56fe\u3001\u8be6\u60c5\u56fe\u3001\u573a\u666f\u56fe\u3001\u7ec6\u8282\u56fe\u662f\u5426\u9f50\u5168\u4e14\u6e05\u6670\u3002",
    },
    pricingCoverage: {
      fieldCount: priceFields.length,
      filledCount: priceFields.filter((field) => field.filled).length,
      suggestion:
        "\u68c0\u67e5 MOQ\u3001\u9636\u68af\u4ef7\u3001\u6837\u54c1\u4ef7\u3001\u5e01\u79cd\u548c\u4ef7\u683c\u533a\u95f4\u662f\u5426\u5b8c\u6574\u3002",
    },
    priorities: [
      "\u5148\u5904\u7406 missingRequired \u4e2d\u7684\u771f\u5b9e\u5fc5\u586b\u7f3a\u5931\uff0c\u907f\u514d\u5546\u54c1\u7f16\u8f91\u6216\u53d1\u5e03\u5931\u8d25\u3002",
      "\u4f18\u5148\u4f18\u5316 Product name\u3001Product keywords\u3001Product images\u3001MOQ\u3001Single Piece price\u3002",
      "\u518d\u6839\u636e\u5546\u54c1\u8d28\u91cf\u5206\u63a5\u53e3\u8fd4\u56de\u7684 problem_map \u5b9a\u5411\u4fee\u590d\u4f4e\u8d28\u91cf\u9879\u3002",
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
