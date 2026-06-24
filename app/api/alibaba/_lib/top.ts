import crypto from "crypto";

import { requireEnv } from "./iop";

export type TopParams = Record<string, string>;

export function topGatewayUrl() {
  return (
    process.env.ALIBABA_TOP_GATEWAY_URL ||
    process.env.ALIBABA_OPENAPI_GATEWAY_URL ||
    "https://eco.taobao.com/router/rest"
  );
}

export function timestampGmt8() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    "-",
    pad(date.getUTCMonth() + 1),
    "-",
    pad(date.getUTCDate()),
    " ",
    pad(date.getUTCHours()),
    ":",
    pad(date.getUTCMinutes()),
    ":",
    pad(date.getUTCSeconds()),
  ].join("");
}

export function signTopRequest(params: TopParams) {
  const secret = requireEnv("ALIBABA_APP_SECRET");
  const signMethod = (params.sign_method || "hmac").toLowerCase();
  const assembled = Object.keys(params)
    .sort()
    .filter((key) => key !== "sign" && params[key] !== "")
    .map((key) => `${key}${params[key]}`)
    .join("");

  if (signMethod === "hmac") {
    return crypto
      .createHmac("md5", secret)
      .update(assembled, "utf8")
      .digest("hex")
      .toUpperCase();
  }

  return crypto
    .createHash("md5")
    .update(`${secret}${assembled}${secret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

export function buildTopParams(method: string, apiParams: TopParams) {
  const params: TopParams = {
    method,
    app_key: requireEnv("ALIBABA_APP_KEY"),
    timestamp: timestampGmt8(),
    format: "json",
    v: "2.0",
    sign_method: process.env.ALIBABA_TOP_SIGN_METHOD || "hmac",
    partner_id: process.env.ALIBABA_TOP_PARTNER_ID || "viecart",
    ...apiParams,
  };
  params.sign = signTopRequest(params);
  return params;
}

export async function callTopApi(options: {
  method: string;
  apiParams: TopParams;
}) {
  const params = buildTopParams(options.method, options.apiParams);
  const url = topGatewayUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    data,
    sent: {
      method: options.method,
      protocol: "top",
      payloadKeys: Object.keys(params),
      hasSession: Boolean(params.session),
    },
  };
}
