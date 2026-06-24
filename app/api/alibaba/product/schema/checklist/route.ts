import { NextRequest, NextResponse } from "next/server";

import {
  buildSchemaChecklist,
  parseSchemaXml,
  summarizeParsedSchema,
} from "../../../_lib/schemaXml";

export const runtime = "nodejs";

async function fetchSchema(request: NextRequest) {
  const url = new URL("/api/alibaba/product/schema/get", request.url);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
    cache: "no-store",
  });
  return response.json();
}

function findXml(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.data === "string" && record.data.includes("<itemSchema")) {
    return record.data;
  }
  for (const child of Object.values(record)) {
    const found = findXml(child);
    if (found) return found;
  }
  return "";
}

export async function GET(request: NextRequest) {
  try {
    const schemaResult = await fetchSchema(request);
    const xml = findXml(schemaResult);
    if (!xml) {
      return NextResponse.json(
        {
          ok: false,
          error: "Schema XML was not returned.",
          schemaResult,
        },
        { status: 502 },
      );
    }

    const fields = parseSchemaXml(xml);
    const checklist = buildSchemaChecklist(fields);
    return NextResponse.json({
      ok: true,
      category: {
        cat_id: request.nextUrl.searchParams.get("cat_id") || "333",
        language: request.nextUrl.searchParams.get("language") || "en_US",
        publish_type: request.nextUrl.searchParams.get("publish_type") || "default",
      },
      summary: summarizeParsedSchema(fields),
      checklist,
      nextOperations: [
        "Use checklist to validate product drafts before calling schema render/add APIs.",
        "Map existing Alibaba products against required attributes and image/price/logistics rules.",
        "Generate AI suggestions for missing required fields, weak titles, sparse attributes, and incomplete images.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
