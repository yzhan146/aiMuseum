import { notFound } from "next/navigation";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { getOperationalMetrics, isMetricsAdmin } from "@/lib/operational-metrics";
import { currentAccount } from "@/lib/server-account";
import { MetricsDashboard } from "./metrics-dashboard";
import "./metrics.css";

export const metadata = { title: "运营指标", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MetricsPage() {
  const account = await currentAccount();
  if (!isMetricsAdmin(account)) notFound();
  let metrics;
  try {
    metrics = await getOperationalMetrics();
  } catch {
    metrics = { available: false, registeredTotal: 0, newToday: 0, new7d: 0, new30d: 0, onlineNow: 0, activeToday: 0, active7d: 0, active30d: 0, updatedAt: new Date().toISOString() };
  }
  return <><PresenceHeartbeat /><MetricsDashboard initial={metrics} /></>;
}
