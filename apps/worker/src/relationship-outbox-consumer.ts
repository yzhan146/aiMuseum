export interface RelationshipOutboxDrainResult {
  claimed: number;
  processed: number;
  failed: number;
}

export interface RelationshipOutboxConsumerConfig {
  endpoint: string;
  secret: string;
  batchSize: number;
  pollIntervalMs: number;
  maxBackoffMs: number;
}

export interface RelationshipOutboxConsumerLogger {
  info(record: Record<string, unknown>): void;
  warn(record: Record<string, unknown>): void;
  error(record: Record<string, unknown>): void;
}

export interface RelationshipOutboxConsumerDependencies {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  logger?: RelationshipOutboxConsumerLogger;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
}

export function relationshipOutboxConsumerConfig(
  env: NodeJS.ProcessEnv = process.env,
): RelationshipOutboxConsumerConfig {
  const baseUrl = env.RELATIONSHIP_OUTBOX_BASE_URL ?? env.APP_BASE_URL;
  const secret = env.RELATIONSHIP_WORKER_SECRET?.trim();
  if (!baseUrl) throw new Error("RELATIONSHIP_OUTBOX_BASE_URL_REQUIRED");
  if (!secret) throw new Error("RELATIONSHIP_WORKER_SECRET_REQUIRED");
  return {
    endpoint: new URL(
      "/api/internal/relationship-outbox/drain",
      baseUrl,
    ).toString(),
    secret,
    batchSize: boundedInteger(
      env.RELATIONSHIP_OUTBOX_BATCH_SIZE,
      1,
      1,
      25,
    ),
    pollIntervalMs: boundedInteger(
      env.RELATIONSHIP_OUTBOX_POLL_MS,
      2_000,
      250,
      60_000,
    ),
    maxBackoffMs: boundedInteger(
      env.RELATIONSHIP_OUTBOX_MAX_BACKOFF_MS,
      30_000,
      1_000,
      300_000,
    ),
  };
}

const consoleLogger: RelationshipOutboxConsumerLogger = {
  info: (record) => console.info(JSON.stringify(record)),
  warn: (record) => console.warn(JSON.stringify(record)),
  error: (record) => console.error(JSON.stringify(record)),
};

function abortableSleep(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(done, milliseconds);
    function done() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}

export function relationshipOutboxBackoff(
  consecutiveFailures: number,
  config: Pick<
    RelationshipOutboxConsumerConfig,
    "pollIntervalMs" | "maxBackoffMs"
  >,
) {
  return Math.min(
    config.maxBackoffMs,
    config.pollIntervalMs * 2 ** Math.max(0, consecutiveFailures - 1),
  );
}

export async function pollRelationshipOutboxOnce(
  config: RelationshipOutboxConsumerConfig,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<RelationshipOutboxDrainResult> {
  const timeout = AbortSignal.timeout(60_000);
  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ batchSize: config.batchSize }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok)
    throw new Error(`RELATIONSHIP_OUTBOX_HTTP_${response.status}`);
  const result = (await response.json()) as Partial<RelationshipOutboxDrainResult>;
  if (
    !Number.isInteger(result.claimed) ||
    !Number.isInteger(result.processed) ||
    !Number.isInteger(result.failed)
  )
    throw new Error("RELATIONSHIP_OUTBOX_RESPONSE_INVALID");
  return result as RelationshipOutboxDrainResult;
}

export async function runRelationshipOutboxConsumer(
  config: RelationshipOutboxConsumerConfig,
  signal: AbortSignal,
  dependencies: RelationshipOutboxConsumerDependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? abortableSleep;
  const logger = dependencies.logger ?? consoleLogger;
  let consecutiveFailures = 0;
  logger.info({
    event: "relationship_outbox_consumer_started",
    batchSize: config.batchSize,
    pollIntervalMs: config.pollIntervalMs,
  });
  while (!signal.aborted) {
    try {
      const startedAt = Date.now();
      const result = await pollRelationshipOutboxOnce(
        config,
        fetchImpl,
        signal,
      );
      if (result.failed > 0) {
        consecutiveFailures += 1;
        logger.warn({
          event: "relationship_outbox_batch_partial_failure",
          ...result,
          consecutiveFailures,
          durationMs: Date.now() - startedAt,
        });
      } else {
        consecutiveFailures = 0;
        if (result.claimed > 0)
          logger.info({
            event: "relationship_outbox_batch_processed",
            ...result,
            durationMs: Date.now() - startedAt,
          });
      }
    } catch (error) {
      if (signal.aborted) break;
      consecutiveFailures += 1;
      logger.error({
        event: "relationship_outbox_poll_failed",
        errorCode:
          error instanceof Error
            ? error.message.slice(0, 160)
            : "RELATIONSHIP_OUTBOX_UNKNOWN_FAILURE",
        consecutiveFailures,
      });
    }
    if (signal.aborted) break;
    const delay =
      consecutiveFailures > 0
        ? relationshipOutboxBackoff(consecutiveFailures, config)
        : config.pollIntervalMs;
    await sleep(delay, signal);
  }
  logger.info({ event: "relationship_outbox_consumer_stopped" });
}
