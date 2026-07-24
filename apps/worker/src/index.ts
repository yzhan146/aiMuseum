import { Worker } from "bullmq";
import {
  relationshipOutboxConsumerConfig,
  runRelationshipOutboxConsumer,
} from "./relationship-outbox-consumer.js";

export interface IngestionPayload {
  jobId: string;
  assetId: string;
  storageKey: string;
  mimeType: string;
}

export function startWorker() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  const connection = {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
  return new Worker<IngestionPayload>(
    "museum-ingestion",
    async (job) => {
      await job.updateProgress(10);
      /* OCR、转录与模型只能由管理员注册的受控适配器执行。 */
      await job.updateProgress(100);
      return { jobId: job.data.jobId, status: "review" };
    },
    { connection },
  );
}

export function startRelationshipOutboxWorker() {
  const controller = new AbortController();
  const done = runRelationshipOutboxConsumer(
    relationshipOutboxConsumerConfig(),
    controller.signal,
  );
  return {
    done,
    stop: () => controller.abort(),
  };
}

async function startConfiguredWorkers() {
  const ingestion =
    process.env.RUN_INGESTION_WORKER === "true" ||
    process.env.RUN_WORKER === "true"
      ? startWorker()
      : undefined;
  const relationship =
    process.env.RUN_RELATIONSHIP_WORKER === "true"
      ? startRelationshipOutboxWorker()
      : undefined;
  if (!ingestion && !relationship) return;

  let stopping = false;
  const stop = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    console.info(
      JSON.stringify({ event: "museum_worker_stopping", signal }),
    );
    relationship?.stop();
    await Promise.allSettled([
      relationship?.done ?? Promise.resolve(),
      ingestion?.close() ?? Promise.resolve(),
    ]);
    console.info(JSON.stringify({ event: "museum_worker_stopped" }));
  };
  process.once("SIGTERM", () => void stop("SIGTERM"));
  process.once("SIGINT", () => void stop("SIGINT"));
}

void startConfiguredWorkers().catch((error) => {
  console.error(
    JSON.stringify({
      event: "museum_worker_start_failed",
      errorCode:
        error instanceof Error ? error.message : "WORKER_START_UNKNOWN_FAILURE",
    }),
  );
  process.exitCode = 1;
});
