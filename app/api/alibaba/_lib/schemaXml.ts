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
