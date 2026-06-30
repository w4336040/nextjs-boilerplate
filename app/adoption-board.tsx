"use client";

import { useEffect, useMemo, useState } from "react";

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

type Props = {
  productId: string;
  suggestions: ContentSuggestion[];
};

const areaLabel: Record<ContentSuggestion["area"], string> = {
  title: "标题",
  keywords: "关键词",
  sellingPoints: "卖点",
  details: "详情",
  images: "图片",
  pricing: "价格",
  attributes: "属性",
};

const priorityClass = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

function storageKey(productId: string) {
  return `alibaba-product-drafts:${productId}`;
}

function readAcceptedKeys(productId: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(productId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function AdoptionBoard({ productId, suggestions }: Props) {
  const [acceptedKeys, setAcceptedKeys] = useState<string[]>(() => readAcceptedKeys(productId));
  const [copiedKey, setCopiedKey] = useState<string>("");

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(productId), JSON.stringify(acceptedKeys));
    } catch {
      // Local draft persistence is optional. The server-side write step comes later.
    }
  }, [acceptedKeys, productId]);

  const acceptedSuggestions = useMemo(
    () => suggestions.filter((item) => acceptedKeys.includes(item.key)),
    [acceptedKeys, suggestions],
  );

  function toggleSuggestion(key: string) {
    setAcceptedKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function copyValue(item: ContentSuggestion) {
    try {
      await navigator.clipboard.writeText(item.suggestedValue);
      setCopiedKey(item.key);
      window.setTimeout(() => setCopiedKey(""), 1400);
    } catch {
      setCopiedKey("");
    }
  }

  if (!suggestions.length) {
    return (
      <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        当前还没有生成内容草稿。通常是商品详情接口没有返回可解析字段，先检查授权、商品 ID 和类目参数。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {suggestions.map((item) => {
          const accepted = acceptedKeys.includes(item.key);
          return (
            <article
              key={item.key}
              className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition ${
                accepted ? "border-emerald-300 ring-4 ring-emerald-500/10" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityClass[item.priority]}`}>
                      {item.priority === "high" ? "优先处理" : item.priority === "medium" ? "建议优化" : "观察优化"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {areaLabel[item.area]}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    字段：{item.fieldLabel}
                    {item.fieldPath?.length ? ` · ${item.fieldPath.join(" / ")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={accepted}
                  onClick={() => toggleSuggestion(item.key)}
                  className={`h-10 rounded-[14px] px-4 text-sm font-medium transition active:translate-y-px ${
                    accepted
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-slate-950 text-white hover:bg-slate-800"
                  }`}
                >
                  {accepted ? "已采纳" : item.acceptLabel}
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">当前值</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.currentValue || "未解析到当前值"}</div>
                </div>
                <div className="rounded-[16px] border border-sky-200 bg-sky-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700">建议值</div>
                    <button
                      type="button"
                      onClick={() => copyValue(item)}
                      className="rounded-[10px] border border-sky-200 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                      {copiedKey === item.key ? "已复制" : "复制"}
                    </button>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-950">{item.suggestedValue}</div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">{item.rationale}</p>
              {item.evidence.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.evidence.slice(0, 6).map((evidence) => (
                    <span key={evidence} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      {evidence}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <aside className="rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">审核草稿</div>
            <h3 className="mt-2 text-lg font-semibold">已采纳 {acceptedSuggestions.length} 项，后续可接一键更新</h3>
          </div>
          {acceptedSuggestions.length ? (
            <button
              type="button"
              onClick={() => setAcceptedKeys([])}
              className="rounded-[14px] border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
            >
              清空草稿
            </button>
          ) : null}
        </div>

        {acceptedSuggestions.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {acceptedSuggestions.map((item) => (
              <div key={item.key} className="rounded-[16px] border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-sm font-medium">{item.fieldLabel}</div>
                <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{item.suggestedValue}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-300">
            先点击上方“采纳草稿”。现在只保存在浏览器本地，不会写回 Alibaba 商品；等写入接口接好后，这里会变成审核更新队列。
          </p>
        )}
      </aside>
    </div>
  );
}
