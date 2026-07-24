import { timingSafeEqual } from "node:crypto";
import { databaseEnabled } from "@/lib/database";
import { drainRelationshipOutboxBatch } from "@/lib/relationship-service";

function authorized(request: Request) {
  const secret = process.env.RELATIONSHIP_WORKER_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export async function POST(request: Request) {
  if (!process.env.RELATIONSHIP_WORKER_SECRET?.trim())
    return Response.json(
      { error: "RELATIONSHIP_WORKER_NOT_CONFIGURED" },
      { status: 503 },
    );
  if (!authorized(request))
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!databaseEnabled)
    return Response.json(
      { error: "RELATIONSHIP_WORKER_REQUIRES_DATABASE" },
      { status: 503 },
    );
  const body = await request.json().catch(() => ({}));
  const requested = Number(body.batchSize);
  const batchSize = Number.isInteger(requested)
    ? Math.max(1, Math.min(25, requested))
    : 5;
  const result = await drainRelationshipOutboxBatch(batchSize);
  return Response.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
