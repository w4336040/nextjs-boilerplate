import { headers } from "next/headers";
import type { ReactNode } from "react";
import AdoptionBoard, { type ContentSuggestion } from "./adoption-board";

type ProfileValue = {
  label: string;
  value: string;
  id?: string;
  path?: string[];
};

type ProductProfile = {
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

type DashboardResponse = {
  ok: boolean;
  generatedAt?: string;
  reportOk?: boolean;
  tokenStatus?: {
    hasToken?: boolean;
    accessToken?: string | null;
    refreshToken?: string | null;
  };
  envStatus?: {
    ok?: boolean;
    missing?: string[];
  };
  productProfile?: ProductProfile | null;
  contentSuggestions?: ContentSuggestion[];
  actionableSuggestions?: Array<{
    key?: string;
    title?: string;
    priority?: "high" | "medium" | "low";
    source?: string;
    reason?: string;
    action?: string;
    evidence?: string;
    fieldPath?: string[];
    currentValue?: string;
  }>;
  productScore?: {
    finalScore?: string | number | null;
    boutiqueTag?: string | number | null;
    problemMap?: unknown;
  };
  optimization?: {
    missingRequiredCount?: number;
    weakContentCount?: number;
    imageCoverage?: {
      fieldCount?: number;
      filledCount?: number;
      missingFieldNames?: string[];
    } | null;
    pricingCoverage?: {
      fieldCount?: number;
      filledCount?: number;
      missingFieldNames?: string[];
    } | null;
  };
  diagnosis?: {
    count?: number;
    topActions?: Array<{
      productId?: string | null;
      title?: string | null;
      priority?: string | null;
      issues?: string[];
      recommendedActions?: string[];
    }>;
  };
  productReport?: {
    error?: {
      code?: string | number | null;
      msg?: string | null;
      subCode?: string | null;
      requestId?: string | null;
    } | null;
  };
  usableApis?: Array<{
    name: string;
    label: string;
    ok: boolean;
    usage: string;
    error?: {
      code?: string | number | null;
      msg?: string | null;
      subCode?: string | null;
      requestId?: string | null;
    } | null;
  }>;
  signals?: string[];
  actions?: string[];
  error?: string;
};

type PageProps = {
  searchParams?: Promise<{
    product_id?: string;
    days?: string;
  }>;
};

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "未获取";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "未获取";
  if (typeof value === "boolean") return value ? "是" : "否";
  return JSON.stringify(value);
}

function formatTime(value?: string) {
  if (!value) return "未获取";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function badgeTone(tone: "good" | "warn" | "bad" | "neutral" | "accent") {
  return {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    bad: "border-rose-200 bg-rose-50 text-rose-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-700",
    accent: "border-sky-200 bg-sky-50 text-sky-700",
  }[tone];
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "good" | "warn" | "bad" | "neutral" | "accent";
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${badgeTone(tone)}`}>
      {children}
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${className}`}>
      {children}
    </section>
  );
}

function DataRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 text-sm font-medium leading-6 ${muted ? "text-slate-500" : "text-slate-950"}`}>{value}</div>
    </div>
  );
}

function priorityTone(priority?: "high" | "medium" | "low") {
  if (priority === "high") return "bad";
  if (priority === "medium") return "warn";
  return "neutral";
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
  );
}

function ValueGrid({ items, emptyText }: { items: ProfileValue[]; emptyText: string }) {
  if (!items.length) {
    return <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <DataRow
          key={`${item.label}-${item.id || item.value}`}
          label={item.label}
          value={
            <>
              <span>{item.value}</span>
              {item.path?.length ? <span className="mt-1 block text-xs font-normal text-slate-500">{item.path.join(" / ")}</span> : null}
            </>
          }
        />
      ))}
    </div>
  );
}

function sortSuggestions(items: NonNullable<DashboardResponse["actionableSuggestions"]>) {
  return [...items].sort((a, b) => priorityOrder[a.priority || "low"] - priorityOrder[b.priority || "low"]);
}

async function fetchDashboard(productId: string, days: string): Promise<DashboardResponse> {
  const params = new URLSearchParams();
  params.set("product_id", productId);
  params.set("days", days);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "127.0.0.1:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;

  try {
    const response = await fetch(`${base}/api/alibaba/ops/dashboard?${params.toString()}`, {
      cache: "no-store",
    });
    return response.json();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const productId = params.product_id || "1601815992580";
  const days = params.days || "7";
  const dashboard = await fetchDashboard(productId, days);

  const profile = dashboard.productProfile || null;
  const scoreValue = Number(dashboard.productScore?.finalScore);
  const scoreTone: "good" | "warn" | "bad" =
    Number.isFinite(scoreValue) && scoreValue >= 4.5
      ? "good"
      : Number.isFinite(scoreValue) && scoreValue >= 3.5
        ? "warn"
        : "bad";
  const contentSuggestions = dashboard.contentSuggestions || [];
  const structureSuggestions = sortSuggestions(dashboard.actionableSuggestions || []);
  const reportError = dashboard.productReport?.error;
  const imageCoverage = dashboard.optimization?.imageCoverage;
  const pricingCoverage = dashboard.optimization?.pricingCoverage;
  const apiStatuses = dashboard.usableApis || [];
  const mainAttributes = profile?.attributes.slice(0, 8) || [];

  return (
    <main className="min-h-screen bg-[#f5f1ea] text-slate-950">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_410px]">
          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap gap-2">
              <Badge tone={dashboard.tokenStatus?.hasToken ? "good" : "bad"}>
                {dashboard.tokenStatus?.hasToken ? "Token 已连接" : "Token 未连接"}
              </Badge>
              <Badge tone={dashboard.envStatus?.ok ? "good" : "warn"}>
                {dashboard.envStatus?.ok ? "环境变量正常" : "环境变量待检查"}
              </Badge>
              <Badge tone={dashboard.reportOk ? "good" : "warn"}>
                {dashboard.reportOk ? "推广数据已联通" : "推广数据未完全联通"}
              </Badge>
              <Badge tone={scoreTone}>质量分 {formatValue(dashboard.productScore?.finalScore)} / 5.00</Badge>
            </div>

            <div className="mt-6 max-w-5xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">商品优化诊断</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {profile?.title || `Alibaba 商品 ${productId}`}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                输入商品 ID 后，系统会读取当前商品字段、质量分和可用接口，生成“当前值 vs 建议值”的可采纳草稿。当前只做诊断和审核草稿，不会写回 Alibaba。
              </p>
            </div>

            {mainAttributes.length ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {mainAttributes.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold leading-5 text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <form className="mt-6 grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_160px_auto]" action="/" method="get">
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">商品 ID</span>
                <input
                  name="product_id"
                  defaultValue={productId}
                  className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="1601815992580"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">推广天数</span>
                <input
                  name="days"
                  defaultValue={days}
                  className="h-12 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-950 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10"
                />
              </label>
              <button
                type="submit"
                className="h-12 self-end rounded-[14px] bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 active:translate-y-px"
              >
                诊断商品
              </button>
            </form>
          </div>

          <Panel className="lg:h-full">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">数据状态</div>
            <div className="mt-4 grid gap-3">
              <DataRow label="商品 ID" value={productId} />
              <DataRow label="类目 ID" value={profile?.categoryId || "未解析"} />
              <DataRow label="可采纳建议" value={`${contentSuggestions.length} 项`} />
              <DataRow label="更新时间" value={formatTime(dashboard.generatedAt)} />
              <DataRow label="精品标记" value={formatValue(dashboard.productScore?.boutiqueTag)} />
            </div>
            {reportError ? (
              <div className="mt-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                推广报表提示：{formatValue(reportError.code)} · {formatValue(reportError.msg)}
              </div>
            ) : null}
          </Panel>
        </section>

        {!dashboard.ok ? (
          <Panel>
            <SectionTitle eyebrow="错误" title="接口请求失败" description={dashboard.error || "没有拿到 dashboard 数据，请先检查 Vercel 环境变量和 Alibaba token。"} />
          </Panel>
        ) : null}

        <section className="space-y-5">
          <SectionTitle
            eyebrow="商品基础信息"
            title={profile?.title || "未解析到商品标题"}
            description={
              profile?.title
                ? `标题长度 ${profile.titleLength}，当前已解析 ${profile.raw.filledFieldCount}/${profile.raw.fieldCount} 个有值字段。`
                : "如果这里没有标题，说明商品详情接口没有返回当前商品值，或解析字段还需要补充。"
            }
          />

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">核心属性</div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">API 已解析到的产品信息</h3>
                </div>
                <Badge tone="accent">{profile?.attributes.length || 0} 项</Badge>
              </div>
              <div className="mt-4">
                <ValueGrid items={profile?.attributes || []} emptyText="还没有解析到属性值。" />
              </div>
            </Panel>

            <div className="grid gap-4">
              <Panel>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">交易信息</div>
                <div className="mt-4">
                  <ValueGrid items={profile?.commerce || []} emptyText="还没有解析到 MOQ、价格或计价单位。" />
                </div>
              </Panel>
              <Panel>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">图片与内容</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DataRow label="图片/图库数量" value={`${profile?.media.imageCount || 0} 项`} />
                  <DataRow label="关键词" value={profile?.content.keywords.length ? profile.content.keywords.join(", ") : "当前为空"} muted={!profile?.content.keywords.length} />
                  <DataRow label="图片类型" value={profile?.media.galleries.length ? profile.media.galleries.join(" / ") : "未解析"} muted={!profile?.media.galleries.length} />
                  <DataRow label="详情预览" value={profile?.content.descriptionPreview || "未解析到详情文本"} muted={!profile?.content.descriptionPreview} />
                </div>
              </Panel>
            </div>
          </div>

          {profile?.gaps.length ? (
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle eyebrow="需要人工确认" title="不能自动猜的字段" description="这些字段会影响搜索过滤、类目匹配或买家决策，建议进入审核队列，由你确认后再更新。" />
                <Badge tone="warn">{profile.gaps.length} 项</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.gaps.map((gap) => (
                  <Badge key={gap} tone="warn">
                    {gap}
                  </Badge>
                ))}
              </div>
            </Panel>
          ) : null}
        </section>

        <section className="space-y-5">
          <SectionTitle
            eyebrow="接口能力"
            title="当前可以用哪些 Alibaba API 做智能运营"
            description="页面会优先使用已经跑通的只读接口。没有权限的接口不会参与建议生成，避免出现空数据或误判。"
          />
          <div className="grid gap-3 lg:grid-cols-4">
            {apiStatuses.map((api) => (
              <Panel key={api.name} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{api.label}</div>
                    <h3 className="mt-2 break-words text-sm font-semibold text-slate-950">{api.name}</h3>
                  </div>
                  <Badge tone={api.ok ? "good" : "warn"}>{api.ok ? "可用" : "受限"}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{api.usage}</p>
                {api.error ? (
                  <p className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    {formatValue(api.error.subCode || api.error.code)} · {formatValue(api.error.msg)}
                  </p>
                ) : null}
              </Panel>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle
            eyebrow="可采纳建议"
            title="当前值和建议值直接对比，先采纳草稿，后续再接一键更新"
            description="这里的建议基于当前 API 解析到的真实商品字段生成，不是泛泛而谈。采纳后先保存在浏览器本地，安全地作为审核草稿。"
          />
          <AdoptionBoard key={productId} productId={productId} suggestions={contentSuggestions} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle eyebrow="结构校验" title="Schema 和质量分建议" description="这部分继续保留，用来发现必填项、弱内容、图片覆盖和价格覆盖问题。" />
              <Badge tone="accent">{structureSuggestions.length} 项</Badge>
            </div>
            <div className="mt-4 grid gap-3">
              {structureSuggestions.length ? (
                structureSuggestions.slice(0, 8).map((item) => (
                  <article key={item.key || item.title} className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
                      <Badge tone={priorityTone(item.priority)}>
                        {item.priority || "low"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-950">{item.action}</p>
                    {item.currentValue || item.evidence ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {[item.currentValue ? `当前值：${item.currentValue}` : "", item.evidence ? `证据：${item.evidence}` : ""].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  当前没有结构级建议。
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionTitle eyebrow="运营判断" title="下一步日常处理顺序" description="这个顺序适合后续扩展成智能运营日报：先修商品页，再看投放，再看询盘成本。" />
            <div className="mt-4 grid gap-3">
              <DataRow label="图片覆盖" value={imageCoverage ? `${imageCoverage.filledCount || 0}/${imageCoverage.fieldCount || 0}` : "未获取"} />
              <DataRow label="价格覆盖" value={pricingCoverage ? `${pricingCoverage.filledCount || 0}/${pricingCoverage.fieldCount || 0}` : "未获取"} />
              <DataRow label="必填缺失" value={`${dashboard.optimization?.missingRequiredCount || 0} 项`} />
              <DataRow label="弱内容" value={`${dashboard.optimization?.weakContentCount || 0} 项`} />
            </div>
            <div className="mt-4 space-y-2">
              {(dashboard.actions || []).slice(0, 4).map((action) => (
                <div key={action} className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {action}
                </div>
              ))}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}
