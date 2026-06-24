import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type MetricRecord = Record<string, unknown>;

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[%,$,\s]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function firstNumber(record: MetricRecord, names: string[]) {
  for (const name of names) {
    if (name in record) return asNumber(record[name]);
  }
  return 0;
}

function firstString(record: MetricRecord, names: string[]) {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function findRecords(value: unknown): MetricRecord[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    const objectItems = value.filter(
      (item): item is MetricRecord => Boolean(item && typeof item === "object"),
    );
    if (
      objectItems.length > 0 &&
      objectItems.some((item) =>
        ["cost", "click", "clicks", "impression", "showCnt", "inquiry"].some(
          (key) => key in item,
        ),
      )
    ) {
      return objectItems;
    }
    return value.flatMap(findRecords);
  }
  if (typeof value !== "object") return [];
  const record = value as MetricRecord;
  return Object.values(record).flatMap(findRecords);
}

function pct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function money(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function diagnose(record: MetricRecord) {
  const productId = firstString(record, [
    "productId",
    "product_id",
    "offerId",
    "offer_id",
    "id",
  ]);
  const title = firstString(record, [
    "productName",
    "product_name",
    "title",
    "subject",
    "offerName",
  ]);
  const impressions = firstNumber(record, [
    "impression",
    "impressions",
    "showCnt",
    "show",
    "pv",
  ]);
  const clicks = firstNumber(record, ["click", "clicks", "clickCnt", "uv"]);
  const cost = firstNumber(record, ["cost", "spend", "charge", "consume"]);
  const inquiries = firstNumber(record, [
    "inquiry",
    "inquiries",
    "inquiryCnt",
    "feedback",
    "feedbackCnt",
    "conversion",
    "conversions",
  ]);
  const orders = firstNumber(record, ["order", "orders", "orderCnt", "payOrderCnt"]);

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? cost / clicks : 0;
  const inquiryRate = clicks > 0 ? inquiries / clicks : 0;
  const costPerInquiry = inquiries > 0 ? cost / inquiries : 0;

  const issues: string[] = [];
  const actions: string[] = [];
  let priority = "observe";

  if (impressions >= 300 && ctr < 0.005) {
    issues.push("High impressions but low CTR.");
    actions.push("Rewrite title and first image around the core buyer keyword.");
    priority = "fix_content";
  }
  if (clicks >= 20 && inquiries === 0) {
    issues.push("Clicks are not turning into inquiries.");
    actions.push("Check price, MOQ, lead time, detail page proof, and inquiry CTA.");
    priority = "fix_conversion";
  }
  if (cost > 0 && inquiries === 0 && clicks >= 10) {
    issues.push("Spend has no inquiry result.");
    actions.push("Reduce bid or pause after checking search terms and product match.");
    priority = "reduce_waste";
  }
  if (inquiries > 0 && costPerInquiry > 0) {
    actions.push("Compare cost per inquiry with your acceptable margin target.");
  }
  if (ctr >= 0.01 && inquiryRate >= 0.03 && inquiries > 0) {
    issues.push("This product has healthy traffic and inquiry conversion.");
    actions.push("Keep budget, test small bid increase, and expand similar keywords.");
    priority = "scale";
  }
  if (issues.length === 0) {
    issues.push("No strong problem detected from available metrics.");
    actions.push("Keep observing until impressions, clicks, and inquiry volume are meaningful.");
  }

  return {
    productId,
    title,
    metrics: {
      impressions,
      clicks,
      cost,
      inquiries,
      orders,
      ctr: pct(ctr),
      cpc: money(cpc),
      inquiryRate: pct(inquiryRate),
      costPerInquiry: inquiries > 0 ? money(costPerInquiry) : null,
    },
    priority,
    issues,
    recommendedActions: actions,
  };
}

function summarize(items: ReturnType<typeof diagnose>[]) {
  const totals = items.reduce(
    (acc, item) => {
      acc.impressions += item.metrics.impressions;
      acc.clicks += item.metrics.clicks;
      acc.cost += item.metrics.cost;
      acc.inquiries += item.metrics.inquiries;
      acc.orders += item.metrics.orders;
      return acc;
    },
    { impressions: 0, clicks: 0, cost: 0, inquiries: 0, orders: 0 },
  );
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const inquiryRate = totals.clicks > 0 ? totals.inquiries / totals.clicks : 0;
  return {
    ...totals,
    ctr: pct(ctr),
    inquiryRate: pct(inquiryRate),
    costPerInquiry:
      totals.inquiries > 0 ? money(totals.cost / totals.inquiries) : null,
  };
}

async function fetchReport(request: NextRequest) {
  const url = new URL("/api/alibaba/ad/product-report", request.url);
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
    const report = await fetchReport(request);
    const records = findRecords(report.data);
    const items = records.map(diagnose);
    const sorted = [...items].sort((a, b) => b.metrics.cost - a.metrics.cost);

    return NextResponse.json({
      ok: true,
      reportOk: Boolean(report.ok),
      reportStatus: report.status || null,
      request: report.reportRequest || null,
      summary: summarize(items),
      count: items.length,
      diagnosis: sorted.slice(0, 100),
      model: {
        level: "read-only-diagnosis",
        rules: [
          "High impressions plus low CTR means title/image/keyword mismatch.",
          "Clicks without inquiries means landing page, price, MOQ, or buyer-intent mismatch.",
          "Spend without inquiries should be reduced or paused after search-term review.",
          "Good CTR and inquiry rate can be scaled carefully.",
        ],
        writeSafety: "No ad budget, bid, campaign, or product changes are made.",
      },
      raw: records.length ? undefined : report,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
