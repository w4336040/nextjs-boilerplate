import { NextRequest, NextResponse } from "next/server";

import {
  buildSchemaChecklist,
  parseSchemaXml,
  summarizeParsedSchema,
} from "../../../_lib/schemaXml";

export const runtime = "nodejs";

async function readXml(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    return typeof body.xml === "string" ? body.xml : "";
  }
  return request.text();
}

export async function POST(request: NextRequest) {
  try {
    const xml = await readXml(request);
    if (!xml.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing XML. POST { \"xml\": \"<itemSchema>...</itemSchema>\" }.",
        },
        { status: 400 },
      );
    }

    const fields = parseSchemaXml(xml);
    const checklist = buildSchemaChecklist(fields);
    return NextResponse.json({
      ok: true,
      summary: summarizeParsedSchema(fields),
      checklist,
      fields,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
