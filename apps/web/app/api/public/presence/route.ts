import { getOperationalMetrics, onlineCountBucket, publicPresenceEnabled } from "../../../../lib/operational-metrics";

export async function GET() {
  if (!publicPresenceEnabled()) return Response.json({ onlineLabel: null }, { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" } });
  try {
    const metrics = await getOperationalMetrics();
    return Response.json(
      { onlineLabel: metrics.available ? onlineCountBucket(metrics.onlineNow) : null, updatedAt: metrics.updatedAt },
      { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" } },
    );
  } catch {
    return Response.json({ onlineLabel: null }, { headers: { "cache-control": "public, max-age=30" } });
  }
}
