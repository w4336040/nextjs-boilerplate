import { headers } from "next/headers";
import type { ReactNode } from "react";

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
  optimization?: {
    missingRequiredCount?: number;
    weakContentCount?: number;
    imageCoverage?: {
      fieldCount?: number;
      filledCount?: number;
      suggestion?: string;
    } | null;
    pricingCoverage?: {
      fieldCount?: number;
      filledCount?: number;
      suggestion?: string;
    } | null;
    priorities?: string[];
  };
  actionableSuggestions?: Array<{
    key?: string;
    title?: string;
    priority?: "high" | "medium" | "low";
    source?: string;
    reason?: string;
    action?: string;
    evidence?: string;
    fieldPath?: string[];
  }>;
  nextSuggestions?: string[];
  error?: string;
};

type PageProps = {
  searchParams?: Promise<{
    product_id?: string;
    days?: string;
  }>;
};

type ProblemMap = {
  ruleScoreMap?: Record<string, number>;
  errorReasonList?: unknown[];
  errorReasonMap?: Record<string, unknown>;
  extendCheckMap?: Record<string, boolean>;
  extendProblemMap?: Record<string, boolean>;
};

const friendlyIssueNames: Record<string, string> = {
  title_word_miss_core_error: "标题缺少核心词",
  title_word_error: "标题用词异常",
  imageQualityBad: "主图质量偏弱",
  image_num: "图片数量不足",
  image_scale: "图片比例不合适",
  imageText: "图文一致性不足",
  sku_image: "SKU 图片弱",
  sku_text: "SKU 文案弱",
  category: "类目匹配不足",
  selling_point_attribute_conflict: "卖点与属性冲突",
  inventory: "库存异常",
  freightRate: "运费竞争力不足",
  price: "价格策略待优化",
  imageSubTitle: "图片副标题不足",
};

const diagnosisProjects = [
  {
    title: "商品表达",
    subtitle: "标题 / 主图 / 卖点",
    caseName: "标准询盘放量",
    summary: "先让买家一眼看懂，再决定要不要点进来。",
    checks: ["标题里放核心词和品类词", "主图明确卖点和场景", "详情页首屏先给证据"],
    readout: "重点看点击率、停留和首屏跳出。",
  },
  {
    title: "流量匹配",
    subtitle: "关键词 / 搜索意图",
    caseName: "新品冷启动",
    summary: "搜索词对了，曝光才有机会变成有效点击。",
    checks: ["高意图词单独观察", "词根和类目保持一致", "低质词及时清理"],
    readout: "重点看 CTR、CPC 和曝光质量。",
  },
  {
    title: "转化链路",
    subtitle: "价格 / MOQ / 交期",
    caseName: "高客单防守",
    summary: "买家有兴趣之后，别让价格逻辑或条件把单子拦住。",
    checks: ["价格逻辑能被解释", "MOQ 和交期不制造阻塞", "资质与案例齐全"],
    readout: "重点看询盘率和询盘成本。",
  },
  {
    title: "投放效率",
    subtitle: "预算 / 出价 / 结构",
    caseName: "预算集中优化",
    summary: "把预算集中给更值得投的商品和词，而不是平均撒开。",
    checks: ["预算向高意图词倾斜", "低效词及时暂停", "周度复盘搜索词"],
    readout: "重点看消耗、浪费和 ROI。",
  },
] as const;

const casePlans = [
  {
    title: "标准询盘放量",
    scenario: "适合已经有点击，但询盘还不稳的商品。",
    focus: ["重写标题", "强化主图", "补买家证据", "抬高高质量词出价"],
    outcome: "目标是把点击稳定转成询盘。",
    signal: "适配商品表达与转化链路。",
  },
  {
    title: "新品冷启动",
    scenario: "适合刚上架、需要先跑出有效搜索词的商品。",
    focus: ["筛词", "小额测试", "保留高意图词", "每天复盘搜索词"],
    outcome: "目标是先拿到可解释的有效点击。",
    signal: "适配流量匹配与投放效率。",
  },
  {
    title: "高客单防守",
    scenario: "适合单价高、决策长、容易犹豫的商品。",
    focus: ["补案例", "补认证", "补交期说明", "缩短询盘路径"],
    outcome: "目标是降低买家犹豫，提升询盘质量。",
    signal: "适配转化链路与商品表达。",
  },
] as const;

const priorityRank: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const sourceLabels: Record<string, string> = {
  "schema.optimization.missingRequired": "Schema 必填项",
  "schema.optimization.weakContent": "弱内容",
  "schema.optimization.imageCoverage": "图片覆盖",
  "schema.optimization.pricingCoverage": "价格覆盖",
  "score.problem_map": "质量评分",
  "report.safeNextActions": "保底建议",
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}

function parseProblemMap(raw: unknown): ProblemMap | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? (parsed as ProblemMap) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as ProblemMap;
  return null;
}

function sortSuggestions(
  items: NonNullable<DashboardResponse["actionableSuggestions"]>,
) {
  return [...items].sort((a, b) => {
    const rankA = priorityRank[a.priority || "low"];
    const rankB = priorityRank[b.priority || "low"];
    return rankA - rankB;
  });
}

function problemLabel(key: string) {
  return friendlyIssueNames[key] || key.replace(/_/g, " ");
}

function deriveIssueFlags(problemMap: ProblemMap | null) {
  const flags: Array<{ key: string; label: string; severity: "warn" | "bad" | "neutral"; value: string }> = [];
  const seen = new Set<string>();

  for (const [key, value] of Object.entries(problemMap?.extendProblemMap || {})) {
    if (value === false && !seen.has(key)) {
      flags.push({
        key,
        label: problemLabel(key),
        severity: "warn",
        value: "待优化",
      });
      seen.add(key);
    }
  }

  for (const [key, value] of Object.entries(problemMap?.ruleScoreMap || {})) {
    if (typeof value === "number" && value > 0 && !seen.has(key)) {
      flags.push({
        key,
        label: problemLabel(key),
        severity: value >= 0.7 ? "bad" : "warn",
        value: value.toFixed(2),
      });
      seen.add(key);
    }
  }

  return flags.slice(0, 6);
}

function toneClass(tone: "neutral" | "good" | "warn" | "bad" | "accent") {
  return {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    bad: "bg-rose-50 text-rose-700 ring-rose-200",
    accent: "bg-sky-50 text-sky-700 ring-sky-200",
  }[tone];
}

function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium ring-1 ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-4xl">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">{title}</h2>
      {description ? <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
    </div>
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
    <article className={`rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </article>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}

function ListBlock({
  items,
  emptyText = "暂无内容",
  tone = "neutral",
}: {
  items: string[];
  emptyText?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  if (!items.length) {
    return <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className={`rounded-[18px] border px-4 py-3 text-sm leading-6 ${toneClass(tone)} bg-white`}>
          {item}
        </div>
      ))}
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "未知";
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

async function fetchDashboard(productId: string, days: string): Promise<DashboardResponse> {
  const params = new URLSearchParams();
  if (productId) params.set("product_id", productId);
  if (days) params.set("days", days);
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "127.0.0.1:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
  const response = await fetch(`${base}/api/alibaba/ops/dashboard?${params.toString()}`, {
    cache: "no-store",
  });
  return response.json();
}

export default async function Home({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const productId = params.product_id || "1601815992580";
  const days = params.days || "7";
  const dashboard = await fetchDashboard(productId, days);

  const productScoreRaw = dashboard.productScore?.finalScore;
  const productScoreValue = Number(productScoreRaw);
  const score = formatValue(productScoreRaw);
  const boutiqueTag = formatValue(dashboard.productScore?.boutiqueTag);
  const reportStatus = dashboard.reportOk ? "可读取" : "需处理";
  const reportTone: "good" | "warn" = dashboard.reportOk ? "good" : "warn";
  const tokenTone: "good" | "bad" = dashboard.tokenStatus?.hasToken ? "good" : "bad";
  const envTone: "good" | "warn" = dashboard.envStatus?.ok ? "good" : "warn";
  const schemaRequiredCount =
    dashboard.schemaChecklist?.summary?.requiredCount ?? dashboard.schemaChecklist?.checklist?.length ?? 0;
  const schemaFieldCount = dashboard.schemaChecklist?.summary?.fieldCount ?? 0;
  const schemaGroups = dashboard.schemaChecklist?.summary?.groups || [];
  const diagnosisItems = dashboard.diagnosis?.topActions || [];
  const diagnosisSummary = dashboard.diagnosis?.summary || null;
  const productReportError = dashboard.productReport?.error || null;
  const problemMap = parseProblemMap(dashboard.productScore?.problemMap);
  const issueFlags = deriveIssueFlags(problemMap);
  const actionableSuggestions = sortSuggestions(dashboard.actionableSuggestions || []);
  const nextSuggestions = dashboard.nextSuggestions || [];
  const signals = (dashboard.signals || []).slice(0, 3);
  const actions = (dashboard.actions || []).slice(0, 3);
  const reportErrorText = productReportError
    ? `${formatValue(productReportError.code)} · ${formatValue(productReportError.msg)}`
    : "暂无报错";
  const scoreTone: "good" | "warn" | "bad" =
    Number.isFinite(productScoreValue) && productScoreValue >= 4.5
      ? "good"
      : Number.isFinite(productScoreValue) && productScoreValue >= 3.5
        ? "warn"
        : "bad";
  const optimizationSummary = dashboard.optimization || null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f3f7fb_42%,#eef3f8_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:items-start">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={dashboard.reportOk ? "good" : "warn"}>{dashboard.reportOk ? "数据已接通" : "数据待处理"}</Badge>
              <Badge tone={dashboard.tokenStatus?.hasToken ? "good" : "bad"}>
                {dashboard.tokenStatus?.hasToken ? "Token 已连接" : "Token 未连接"}
              </Badge>
              <Badge tone={dashboard.envStatus?.ok ? "good" : "warn"}>
                {dashboard.envStatus?.ok ? "环境已配置" : "环境待检查"}
              </Badge>
              <Badge tone={scoreTone}>{score === "—" ? "评分待回填" : `评分 ${score}`}</Badge>
            </div>

            <div className="max-w-4xl space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500">商品诊断中心</p>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                把商品、诊断项目、优秀案例方案放在同一页里看清楚
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                这是一个面向日常运营的商品诊断面板。先看商品概览，再看诊断项目，最后对照成熟案例方案，直接指导下一步优化。
              </p>
            </div>

            <form
              className="grid gap-3 rounded-[24px] border border-slate-200 bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] sm:grid-cols-[1.2fr_0.7fr_auto]"
              action="/"
              method="get"
            >
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">商品 ID</span>
                <input
                  name="product_id"
                  defaultValue={productId}
                  className="h-12 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="1601815992580"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">天数</span>
                <input
                  name="days"
                  defaultValue={days}
                  className="h-12 w-full rounded-[16px] border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-sky-500/10"
                />
              </label>
              <button
                type="submit"
                className="h-12 rounded-[16px] bg-slate-950 px-5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-px"
              >
                刷新数据
              </button>
            </form>

            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>服务端时间 {formatDateTime(dashboard.generatedAt)}</span>
              <span>·</span>
              <span>报表状态 {reportStatus}</span>
              <span>·</span>
              <span>只读分析，不改商品和广告</span>
            </div>
          </div>

          <div className="grid gap-4">
            <Panel>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前商品</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Alibaba 商品 {productId}</div>
                  <div className="mt-1 text-sm text-slate-600">围绕评分、诊断和案例方案的一页式优化视图。</div>
                </div>
                <Badge tone="accent">在线</Badge>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <DataRow label="商品评分" value={`${score}${score === "—" ? "" : " / 5.00"}`} />
                <DataRow label="精品标记" value={boutiqueTag} />
                <DataRow label="必填字段" value={`${schemaRequiredCount} 项`} />
                <DataRow label="字段总数" value={`${schemaFieldCount} 项`} />
              </div>
            </Panel>

            <Panel>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">连接状态</div>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-950">Token</div>
                    <div className="mt-1 text-xs text-slate-500">授权是否可用</div>
                  </div>
                  <Badge tone={tokenTone}>{dashboard.tokenStatus?.hasToken ? "已连接" : "未连接"}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-950">环境变量</div>
                    <div className="mt-1 text-xs text-slate-500">Vercel / 本地配置</div>
                  </div>
                  <Badge tone={envTone}>{dashboard.envStatus?.ok ? "已配置" : "待检查"}</Badge>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div className="text-sm font-medium text-slate-950">报表反馈</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">{reportErrorText}</div>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="商品"
            title="先看商品，再看问题，再看能怎么改"
            description="这一块把商品状态、数据反馈和优化建议放在一起，适合运营直接扫一眼就知道优先级。"
          />

          <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">商品优化概览</div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">商品结构、字段完整度、优化方向</h3>
                </div>
                <Badge tone={reportTone}>{reportStatus}</Badge>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DataRow label="商品 ID" value={productId} />
                <DataRow label="当前评分" value={score} />
                <DataRow label="精品标记" value={boutiqueTag} />
                <DataRow label="诊断项目" value={`${dashboard.diagnosis?.count ?? 0} 项`} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <DataRow label="必填缺失" value={`${optimizationSummary?.missingRequiredCount ?? 0} 项`} />
                <DataRow label="弱内容" value={`${optimizationSummary?.weakContentCount ?? 0} 项`} />
                <DataRow
                  label="图片覆盖"
                  value={
                    optimizationSummary?.imageCoverage
                      ? `${optimizationSummary.imageCoverage.filledCount ?? 0}/${optimizationSummary.imageCoverage.fieldCount ?? 0}`
                      : "—"
                  }
                />
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Schema 分组</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {schemaGroups.length ? (
                    schemaGroups.map((group) => (
                      <Badge key={group.name} tone="neutral">
                        {group.name} · {group.count}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="neutral">暂无分组</Badge>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">当前问题项</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {issueFlags.length ? (
                      issueFlags.map((item) => (
                        <Badge key={item.key} tone={item.severity}>
                          {item.label} · {item.value}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="good">当前未命中明显问题</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">字段建议</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(dashboard.schemaChecklist?.nextOperations || []).slice(0, 4).length ? (
                      (dashboard.schemaChecklist?.nextOperations || []).slice(0, 4).map((item) => (
                        <Badge key={item} tone="accent">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="accent">等待下一轮字段优化</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">具体修改建议</div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">按字段拆开的可执行优化项</h3>
                  </div>
                  <Badge tone="accent">{actionableSuggestions.length} 项</Badge>
                </div>
                <div className="mt-4 grid gap-3">
                  {actionableSuggestions.length ? (
                    actionableSuggestions.slice(0, 8).map((item) => (
                      <div key={item.key || item.title} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-950">{item.title}</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={item.priority === "high" ? "bad" : item.priority === "medium" ? "warn" : "neutral"}>
                              {item.priority || "low"}
                            </Badge>
                            <Badge tone="neutral">{sourceLabels[item.source || ""] || item.source || "来源未明"}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-950">{item.action}</div>
                        {item.evidence ? <div className="mt-2 text-xs text-slate-500">{item.evidence}</div> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
                      当前还没有字段级建议，通常是因为授权数据不完整或接口返回为空。
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <div className="grid gap-4">
              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">优先修复</div>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">当前最值得先处理的项目</h3>
                  </div>
                  <Badge tone="accent">{diagnosisItems.length} 项</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {diagnosisItems.length ? (
                    diagnosisItems.slice(0, 3).map((item, index) => (
                      <div key={`${item.productId || item.title || index}`} className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-slate-950">{item.title || item.productId || "未命名商品"}</div>
                            <div className="mt-1 text-xs text-slate-500">商品 ID {formatValue(item.productId)}</div>
                          </div>
                          <Badge tone={item.priority === "scale" ? "good" : item.priority === "reduce_waste" ? "bad" : "warn"}>
                            {item.priority || "observe"}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-slate-600">
                          问题：{item.issues?.length ? item.issues.join(" / ") : "暂无"}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          建议：{item.recommendedActions?.length ? item.recommendedActions.join(" / ") : "暂无"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
                      暂时还没有优先修复项。
                    </div>
                  )}
                </div>
              </Panel>

              <Panel>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">数据反馈</div>
                <div className="mt-4 space-y-3">
                  <ListBlock items={signals} emptyText="暂无信号" tone="neutral" />
                  <ListBlock items={actions} emptyText="暂无动作" tone="accent" />
                </div>
              </Panel>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="诊断项目"
            title="四个诊断项目，直接对应运营动作"
            description="把规则拆成更好读的项目，方便商品页和方案页同时使用，也方便以后继续扩展成日报。"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {diagnosisProjects.map((item) => (
              <Panel key={item.title} className="h-full">
                <div className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.subtitle}</div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
                    </div>
                    <Badge tone="neutral">{item.caseName}</Badge>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.summary}</p>

                  <div className="mt-4 space-y-2">
                    {item.checks.map((check) => (
                      <div key={check} className="flex gap-3 rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                        <span className="mt-1 h-2 w-2 rounded-full bg-sky-500" />
                        <span>{check}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 text-sm font-medium text-slate-950">{item.readout}</div>
                </div>
              </Panel>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="优秀案例方案"
            title="把成熟做法单独拎出来，直接照着执行"
            description="这些方案不是空话，而是按不同商品场景拆好的动作模板，后面可以继续接真实数据和图片。"
          />

          <div className="grid gap-4 xl:grid-cols-3">
            {casePlans.map((item) => (
              <Panel key={item.title} className="h-full">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">方案</div>
                      <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
                    </div>
                    <Badge tone="accent">案例</Badge>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-600">{item.scenario}</p>

                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">核心动作</div>
                    <div className="flex flex-wrap gap-2">
                      {item.focus.map((step) => (
                        <Badge key={step} tone="neutral">
                          {step}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600">
                    {item.outcome}
                  </div>

                  <div className="mt-4 text-sm font-medium text-slate-950">{item.signal}</div>
                </div>
              </Panel>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/80 px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">下一步</div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">这版已经能作为商品优化诊断首页继续往下做</div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                后面最值得补的就是账户报告、关键词报告、推荐出价和推词，这样就能把“商品诊断”继续扩成真正的智能运营面板。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextSuggestions.length ? (
                nextSuggestions.map((item) => (
                  <Badge key={item} tone="accent">
                    {item}
                  </Badge>
                ))
              ) : (
                <>
                  <Badge tone="accent">账户报告</Badge>
                  <Badge tone="accent">关键词报告</Badge>
                  <Badge tone="accent">推荐出价</Badge>
                  <Badge tone="accent">推词</Badge>
                </>
              )}
            </div>
          </div>
          {diagnosisSummary ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(diagnosisSummary)
                .slice(0, 4)
                .map(([key, value]) => (
                  <DataRow key={key} label={key} value={formatValue(value)} />
                ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
