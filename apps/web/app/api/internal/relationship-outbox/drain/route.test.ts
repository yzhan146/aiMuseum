import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drainRelationshipOutboxBatch: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  databaseEnabled: true,
}));

vi.mock("@/lib/relationship-service", () => ({
  drainRelationshipOutboxBatch: mocks.drainRelationshipOutboxBatch,
}));

import { POST } from "./route";

describe("relationship outbox drain route", () => {
  beforeEach(() => {
    process.env.RELATIONSHIP_WORKER_SECRET = "test-worker-secret";
    mocks.drainRelationshipOutboxBatch.mockReset();
  });

  afterEach(() => {
    delete process.env.RELATIONSHIP_WORKER_SECRET;
  });

  it("rejects requests without the shared bearer secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/relationship-outbox/drain", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(mocks.drainRelationshipOutboxBatch).not.toHaveBeenCalled();
  });

  it("clamps the requested batch size before draining", async () => {
    mocks.drainRelationshipOutboxBatch.mockResolvedValue({
      claimed: 25,
      processed: 24,
      failed: 1,
    });

    const response = await POST(
      new Request("http://localhost/api/internal/relationship-outbox/drain", {
        method: "POST",
        headers: {
          authorization: "Bearer test-worker-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ batchSize: 999 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      claimed: 25,
      processed: 24,
      failed: 1,
    });
    expect(mocks.drainRelationshipOutboxBatch).toHaveBeenCalledWith(25);
  });
});
