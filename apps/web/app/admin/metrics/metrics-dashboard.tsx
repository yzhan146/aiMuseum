"use client";

import { useEffect, useState } from "react";
import type { OperationalMetrics } from "@/lib/operational-metrics";

const REFRESH_MS = 15_000;

function Metric({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}
export function MetricsDashboard({ initial }: { initial: OperationalMetrics }) {
  const [metrics, setMetrics] = useState(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      void fetch("/api/admin/metrics", { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "无法刷新指标");
          setMetrics(result as OperationalMetrics);
          setError("");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "无法刷新指标"));
    };
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return <main className="metrics-page">
    <header><div><p>运营观测</p><h1>AI Museum 实时指标</h1><span>每 15 秒刷新；在线表示最近 2 分钟内活动过的独立登录账户。</span></div><a href="/museum">返回博物馆</a></header>
    {!metrics.available && <section className="metrics-unavailable"><h2>本地环境没有连接生产数据库</h2><p>指标不会使用测试账号或伪造数据。连接 PostgreSQL 后，这里将显示真实的已验证注册与 Session 活跃数据。</p></section>}
    {error && <p className="metrics-error" role="alert">{error}</p>}
    <section><h2>此刻</h2><div className="metric-grid primary"><Metric label="当前在线" value={metrics.onlineNow} note="最近 2 分钟去重" /><Metric label="已验证注册账户" value={metrics.registeredTotal} note="排除测试与已删除账户" /></div></section>
    <section><h2>新增注册</h2><div className="metric-grid"><Metric label="今天" value={metrics.newToday} /><Metric label="最近 7 天" value={metrics.new7d} /><Metric label="最近 30 天" value={metrics.new30d} /></div></section>
    <section><h2>活跃账户</h2><div className="metric-grid"><Metric label="今天" value={metrics.activeToday} /><Metric label="最近 7 天" value={metrics.active7d} /><Metric label="最近 30 天" value={metrics.active30d} /></div></section>
    <footer>最后刷新：{new Date(metrics.updatedAt).toLocaleString("zh-CN")}</footer>
  </main>;
}
