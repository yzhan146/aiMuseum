import { currentAccount } from "../../../../lib/server-account";
import { getOperationalMetrics, isMetricsAdmin } from "../../../../lib/operational-metrics";

export async function GET() {
  const account = await currentAccount();
  if (!isMetricsAdmin(account)) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    return Response.json(await getOperationalMetrics(), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Operational metrics query failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "指标服务暂时不可用" }, { status: 503 });
  }
}
