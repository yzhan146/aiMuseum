import { describe, expect, it, vi } from "vitest";
import {
  pollRelationshipOutboxOnce,
  relationshipOutboxBackoff,
  relationshipOutboxConsumerConfig,
  runRelationshipOutboxConsumer,
  type RelationshipOutboxConsumerConfig,
  type RelationshipOutboxConsumerLogger,
} from "./relationship-outbox-consumer.js";

const config: RelationshipOutboxConsumerConfig = {
  endpoint: "https://museum.example/api/internal/relationship-outbox/drain",
  secret: "test-secret",
  batchSize: 7,
  pollIntervalMs: 1_000,
  maxBackoffMs: 8_000,
};

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("relationship outbox consumer", () => {
  it("builds bounded production configuration", () => {
    expect(
      relationshipOutboxConsumerConfig({
        APP_BASE_URL: "https://museum.example/base",
        RELATIONSHIP_WORKER_SECRET: "secret",
        RELATIONSHIP_OUTBOX_BATCH_SIZE: "999",
        RELATIONSHIP_OUTBOX_POLL_MS: "10",
        RELATIONSHIP_OUTBOX_MAX_BACKOFF_MS: "999999",
      }),
    ).toEqual({
      endpoint:
        "https://museum.example/api/internal/relationship-outbox/drain",
      secret: "secret",
      batchSize: 25,
      pollIntervalMs: 250,
      maxBackoffMs: 300_000,
    });
  });

  it("posts one scope-free batch without exposing the secret in the body", async () => {
    const fetchImpl = vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer test-secret",
      });
      expect(JSON.parse(String(init?.body))).toEqual({ batchSize: 7 });
      expect(String(init?.body)).not.toContain("test-secret");
      return jsonResponse({ claimed: 4, processed: 4, failed: 0 });
    }) as unknown as typeof fetch;

    await expect(pollRelationshipOutboxOnce(config, fetchImpl)).resolves.toEqual(
      { claimed: 4, processed: 4, failed: 0 },
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("backs off on transport and partial batch failures, then stops cleanly", async () => {
    const controller = new AbortController();
    const sleeps: number[] = [];
    const logs: Array<Record<string, unknown>> = [];
    let request = 0;
    const fetchImpl = vi.fn(async () => {
      request += 1;
      if (request === 1) throw new Error("network unavailable");
      if (request === 2)
        return jsonResponse({ claimed: 2, processed: 1, failed: 1 });
      return jsonResponse({ claimed: 0, processed: 0, failed: 0 });
    }) as unknown as typeof fetch;
    const logger: RelationshipOutboxConsumerLogger = {
      info: (record) => logs.push(record),
      warn: (record) => logs.push(record),
      error: (record) => logs.push(record),
    };

    await runRelationshipOutboxConsumer(config, controller.signal, {
      fetchImpl,
      logger,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        if (sleeps.length === 3) controller.abort();
      },
    });

    expect(sleeps).toEqual([1_000, 2_000, 1_000]);
    expect(logs.map((item) => item.event)).toEqual(
      expect.arrayContaining([
        "relationship_outbox_consumer_started",
        "relationship_outbox_poll_failed",
        "relationship_outbox_batch_partial_failure",
        "relationship_outbox_consumer_stopped",
      ]),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("caps exponential retry delay", () => {
    expect(relationshipOutboxBackoff(1, config)).toBe(1_000);
    expect(relationshipOutboxBackoff(4, config)).toBe(8_000);
    expect(relationshipOutboxBackoff(20, config)).toBe(8_000);
  });
});
