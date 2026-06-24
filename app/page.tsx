import { headers } from "next/headers";
import { ReactNode } from "react";

type DashboardResponse = {
  ok: boolean;
  generatedAt?: string;
  reportOk?: boolean;
  signals?: string[];
  actions?: string[];
  tokenStatus?: {
    hasToken?: boolean;
    accessToken?: string | null;
    refreshToken?: string | null;
    keys?: string[];
    startUrl?: string;
    error?: string;
  };
  envStatus?: {
    ok?: boolean;
    missing?: string[];
    configured?: Record<string, boolean>;
    appKey?: string | null;
    redirectUri?: string | null;
    authUrl?: string | null;
    tokenUrl?: string | null;
    scopeConfigured?: boolean;
    stateParam?: string;
    tokenRequestFormat?: string;
  };
  schemaChecklist?: {
    ok?: boolean;
    summary?: {
      fieldCount?: number;
      requiredCount?: number;
      groups?: Array<{ name: string; count: number }>;
    };
    checklist?: Array<Record<string, unknown>>;
    nextOperations?: string[];
  };
  productReport?: {
    error?: {
      code?: string | number | null;
      msg?: string | null;
      subCode?: string | null;
      requestId?: string | null;
    } | null;
    raw?: unknown;
  };
  diagnosis?: {
    count?: number;
    summary?: Record<string, unknown> | null;
    topActions?: Array<{
      productId?: string | null;
      title?: string | null;
      priority?: string | null;
      issues?: string[];
      recommendedActions?: string[];
      metrics?: Record<string, unknown> | null;
    }>;
  };
  productScore?: {
    productId?: string;
    finalScore?: string | number | null;
    boutiqueTag?: string | number | null;
    problemMap?: unknown;
  };
  nextSuggestions?: string[];
  error?: string;
};

type PageProps = {
  searchParams?: Promise<{
    product_id?: string;
    days?: string;
  }>;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  children: ReactNode;
}) {
  const colors: Record<typeof tone, string> = {
    neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    bad: "bg-rose-50 text-rose-700 border-rose-200",
    accent: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors[tone]}`}>
      {children}
    </span>
  );
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  const border = {
    neutral: "border-zinc-200",
    good: "border-emerald-200",
    warn: "border-amber-200",
    bad: "border-rose-200",
    accent: "border-sky-200",
  }[tone];
  return (
    <div className={`rounded-2xl border ${border} bg-zinc-50 p-4`}> 
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function ListBlock({ items }: { items: string[] }) {
  if (!items.length) return <div className="text-sm text-zinc-500">暂无</div>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {item}
        </div>
      ))}
    </div>
  );
}

async function fetchDashboard(productId: string, days: string): Promise<DashboardResponse> {
  const params = new URLSearchParams();
  if (productId) params.set("product_id", productId);
  if (days) params.set("days", days);
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "127.0.0.1:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const url = `${base}/api/alibaba/ops/dashboard?${params.toString()}`;
  const response = await fetch(url, { cache: "no-store" });
  return response.json();
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const productId = params.product_id || "1601815992580";
  const days = params.days || "7";
  const dashboard = await fetchDashboard(productId, days);
  const productError = dashboard.productReport?.error;
  const diagnosisItems = dashboard.diagnosis?.topActions || [];
  const schemaRequiredCount = dashboard.schemaChecklist?.summary?.requiredCount ?? dashboard.schemaChecklist?.checklist?.length;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge tone={Boolean(dashboard.reportOk) ? "good" : "warn"}>{dashboard.reportOk ? "报表就绪" : "等待数据"}</Badge>
                <Badge tone={Boolean(dashboard.tokenStatus?.hasToken) ? "good" : "bad"}>
                  {dashboard.tokenStatus?.hasToken ? "Token 已连接" : "Token 未就绪"}
                </Badge>
                <Badge tone={Boolean(dashboard.envStatus?.ok) ? "good" : "warn"}>
                  {dashboard.envStatus?.ok ? "环境已配" : "环境需检查"}
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Alibaba 国际站智能运营面板
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600">
                这里先做成“能看见反馈”的版本：拉取 OAuth 状态、推广报表、诊断建议和商品评分。
                后面再接账户报告、关键词报告、推荐出价和推词。
              </p>
            </div>
            <form className="flex flex-wrap gap-3" action="/" method="get">
              <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                <span className="text-zinc-500">商品</span>
                <input
                  name="product_id"
                  defaultValue={productId}
                  className="w-44 bg-transparent text-zinc-950 outline-none"
                  placeholder="1601815992580"
                />
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                <span className="text-zinc-500">天数</span>
                <input
                  name="days"
                  defaultValue={days}
                  className="w-16 bg-transparent text-zinc-950 outline-none"
                />
              </label>
              <button
                type="submit"
                className="rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                刷新数据
              </button>
            </form>
          </div>
          <div className="mt-4 text-xs text-zinc-500">
            服务端时间：{dashboard.generatedAt ? new Date(dashboard.generatedAt).toLocaleString("zh-CN") : "未知"}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Metric
            label="询盘建议"
            value={formatValue(dashboard.diagnosis?.summary?.inquiries)}
            hint="诊断汇总中的询盘数"
            tone="accent"
          />
          <Metric
            label="商品评分"
            value={formatValue(dashboard.productScore?.finalScore)}
            hint={`精品标记：${formatValue(dashboard.productScore?.boutiqueTag)}`}
            tone="good"
          />
          <Metric
            label="诊断条数"
            value={formatValue(dashboard.diagnosis?.count)}
            hint="当前输出的规则建议数量"
          />
          <Metric
            label="报表状态"
            value={dashboard.reportOk ? "成功" : "待排查"}
            hint={productError ? `${formatValue(productError.code)} ${formatValue(productError.msg)}` : "正常时会显示成功"}
            tone={dashboard.reportOk ? "good" : "warn"}
          />
          <Metric
            label="Schema 清单"
            value={formatValue(schemaRequiredCount)}
            hint="商品必填项/规则清单"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <Panel title="当前反馈" right={<Badge tone="neutral">只读诊断</Badge>}>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">信号</div>
                <ListBlock items={dashboard.signals || []} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">下一步</div>
                <ListBlock items={dashboard.actions || []} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">建议路线</div>
                <ListBlock items={dashboard.nextSuggestions || []} />
              </div>
            </div>
          </Panel>

          <Panel
            title="授权和报错"
            right={<Badge tone={dashboard.tokenStatus?.hasToken ? "good" : "bad"}>{dashboard.tokenStatus?.hasToken ? "已授权" : "未授权"}</Badge>}
          >
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Token</div>
                <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700">
                  {formatValue(dashboard.tokenStatus)}
                </pre>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">环境</div>
                <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-zinc-700">
                  {formatValue(dashboard.envStatus)}
                </pre>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">报错</div>
                {productError ? (
                  <div className="space-y-1 text-sm text-zinc-700">
                    <div>code: {formatValue(productError.code)}</div>
                    <div>msg: {formatValue(productError.msg)}</div>
                    <div>subCode: {formatValue(productError.subCode)}</div>
                    <div>requestId: {formatValue(productError.requestId)}</div>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">暂无明显错误</div>
                )}
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="推广明细">
            {dashboard.diagnosis?.summary ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(dashboard.diagnosis.summary).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-xs font-medium text-zinc-500">{key}</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-950">{formatValue(value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">暂无诊断汇总。</div>
            )}
          </Panel>

          <Panel title="优先处理商品">
            {diagnosisItems.length ? (
              <div className="space-y-3">
                {diagnosisItems.map((item, index) => (
                  <div key={`${item.productId || item.title || index}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-zinc-900">{item.title || item.productId || "未命名商品"}</div>
                      <Badge tone={item.priority === "scale" ? "good" : item.priority === "reduce_waste" ? "bad" : "warn"}>
                        {item.priority || "observe"}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                      <div>商品ID: {formatValue(item.productId)}</div>
                      <div>指标: {formatValue(item.metrics)}</div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-zinc-700">
                      <div>
                        <span className="font-medium">问题：</span>
                        {item.issues?.join(" / ") || "无"}
                      </div>
                      <div>
                        <span className="font-medium">建议：</span>
                        {item.recommendedActions?.join(" / ") || "无"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-zinc-500">暂无商品级建议。</div>
            )}
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel title="账户/关键词扩展路线">
            <div className="space-y-3 text-sm text-zinc-700">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                1. 账户报告：做整店日报，输出消耗、点击、询盘和趋势。
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                2. 关键词报告：看词级 CTR / CPC / 询盘率，找出浪费词和高转化词。
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                3. 推荐出价：对高潜力词给出保守 bid 建议。
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                4. 推词：把高意图词沉淀到重点计划，形成每日报告。
              </div>
            </div>
          </Panel>

          <Panel title="原始反馈">
            <pre className="max-h-[420px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
{JSON.stringify(dashboard || { ok: false, error: "无数据" }, null, 2)}
            </pre>
          </Panel>
        </section>
      </div>
    </main>
  );
}
