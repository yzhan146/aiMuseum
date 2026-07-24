import { createHash } from "node:crypto";
import type { MemoryRecord, RelationshipRuntimeContext, RelationshipStage } from "@ai-museum/sdk";
import { buildRelationshipRuntimeContext } from "./relationship-behavior";
import { extractRelationshipEvidence, filterRelationshipCandidates } from "./relationship-evidence";
import { projectRelationshipStage, RELATIONSHIP_POLICY_VERSION } from "./relationship-policy";
import { relationshipAutomationEnabledForCharacter } from "./relationship-rollout";
import {
  claimRelationshipOutbox,
  checkpointRelationshipOutboxExtraction,
  completeRelationshipOutbox,
  failRelationshipOutbox,
  getMessageForUser,
  getRelationshipPublicState,
  getRelationshipState,
  getThreadForUser,
  listRelationshipEvidence,
  recentUserMessagesBefore,
  recordRelationshipTransition,
  relationshipEpisodeKeyForMessage,
  storeRelationshipEvidence,
  type RelationshipOutboxRecord,
} from "./platform-store";

const DETERMINISTIC_EXTRACTOR_VERSION = "relationship-deterministic-v1";
const MODEL_EXTRACTOR_VERSION = "relationship-model-v1";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const transitionFeedback: Partial<Record<RelationshipStage, string>> = {
  acquainted: "你们开始记住彼此的想法，交谈也更自然了一些。",
  young_friend: "一些话题不必再从头说起，你们成了可以认真交换想法的小友。",
  old_friend: "许多次共同探索累积成了默契，你们已是老友。",
  kindred_spirit: "你们能坦诚讨论最难的问题，也能保留各自判断，成为莫逆之交。",
};

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || !value) throw new Error(`INVALID_RELATIONSHIP_OUTBOX_${key.toUpperCase()}`);
  return value;
}

function evidenceSnapshotHash(ids: string[]) {
  return createHash("sha256").update([...ids].sort().join("\n")).digest("hex");
}

export function relationshipRuntimeContextFrom(input: {
  relationship: Awaited<ReturnType<typeof getRelationshipPublicState>>;
  memories: MemoryRecord[];
}): RelationshipRuntimeContext | undefined {
  if (!input.relationship) return undefined;
  return buildRelationshipRuntimeContext({
    stage: input.relationship.stage,
    status: input.relationship.status,
    preferredAddress: input.relationship.preferredAddress,
    sharedMoments: input.memories
      .filter((memory) => memory.sourceMessageIds.length > 0)
      .slice(0, 6)
      .map((memory) => ({
        memoryId: memory.id,
        summary: memory.content,
        sourceMessageIds: memory.sourceMessageIds,
      })),
    recurringTopics: input.memories.slice(0, 3).map((memory) => memory.content),
    priorViewpoints: [],
  });
}

async function processEvidenceExtraction(outbox: RelationshipOutboxRecord) {
  if (!relationshipAutomationEnabledForCharacter(outbox.characterId)) return;
  const threadId = stringPayload(outbox.payload, "threadId");
  const sourceUserMessageId = stringPayload(outbox.payload, "sourceUserMessageId");
  const characterMessageId = stringPayload(outbox.payload, "characterMessageId");
  const expectedRecordingRevision = Number(outbox.payload.recordingRevision);
  const state = await getRelationshipState(outbox.userId, outbox.characterId);
  if (!state || state.status !== "active") return;
  if (
    !Number.isInteger(expectedRecordingRevision) ||
    state.recordingRevision !== expectedRecordingRevision
  )
    return;
  const sourceUserMessageCreatedAt = String(outbox.payload.sourceUserMessageCreatedAt ?? "");
  if (state.resetCutoffAt && sourceUserMessageCreatedAt && state.resetCutoffAt >= sourceUserMessageCreatedAt) return;

  const thread = await getThreadForUser(threadId, outbox.userId);
  if (!thread || thread.characterId !== outbox.characterId) throw new Error("RELATIONSHIP_OUTBOX_THREAD_NOT_OWNED");
  const [userMessage, characterMessage, recentUserMessages, turnEpisodeKey] =
    await Promise.all([
      getMessageForUser(threadId, outbox.userId, sourceUserMessageId),
      getMessageForUser(threadId, outbox.userId, characterMessageId),
      recentUserMessagesBefore(
        threadId,
        outbox.userId,
        sourceUserMessageId,
        8,
      ),
      relationshipEpisodeKeyForMessage(
        threadId,
        outbox.userId,
        sourceUserMessageId,
        FOUR_HOURS_MS,
      ),
    ]);
  if (!userMessage || !characterMessage) throw new Error("RELATIONSHIP_OUTBOX_MESSAGES_NOT_OWNED");
  if (userMessage.role !== "user" || characterMessage.role !== "character")
    throw new Error("RELATIONSHIP_OUTBOX_MESSAGES_NOT_OWNED");
  if (!recentUserMessages || !turnEpisodeKey)
    throw new Error("RELATIONSHIP_OUTBOX_MESSAGE_CONTEXT_MISSING");

  const checkpointValue = outbox.payload.extractionCheckpointV1;
  let accepted: ReturnType<typeof filterRelationshipCandidates>["accepted"];
  let extractorModel: string;
  let extractorVersion: string;
  if (checkpointValue !== undefined) {
    if (!checkpointValue || typeof checkpointValue !== "object")
      throw new Error("RELATIONSHIP_EXTRACTION_CHECKPOINT_INVALID");
    const checkpoint = checkpointValue as Record<string, unknown>;
    if (
      typeof checkpoint.extractorModel !== "string" ||
      typeof checkpoint.extractorVersion !== "string" ||
      !Array.isArray(checkpoint.candidates)
    )
      throw new Error("RELATIONSHIP_EXTRACTION_CHECKPOINT_INVALID");
    extractorModel = checkpoint.extractorModel;
    extractorVersion = checkpoint.extractorVersion;
    const restored = filterRelationshipCandidates({
      raw: {
        schemaVersion: "relationship-evidence-v1",
        source: {
          threadId,
          turnId: outbox.id,
          messageIds: [userMessage.id, characterMessage.id],
        },
        candidates: checkpoint.candidates,
        blocked: [],
      },
      expectedUserMessageId: userMessage.id,
      allowedContextMessageIds: [userMessage.id, characterMessage.id],
    });
    if (restored.accepted.length !== checkpoint.candidates.length)
      throw new Error("RELATIONSHIP_EXTRACTION_CHECKPOINT_INVALID");
    accepted = restored.accepted;
  } else {
    const existing = await listRelationshipEvidence(
      outbox.userId,
      outbox.characterId,
    );
    const extracted = await extractRelationshipEvidence({
      threadId,
      turnId: outbox.id,
      userMessageId: userMessage.id,
      characterMessageId: characterMessage.id,
      userMessage: userMessage.content,
      characterMessage: characterMessage.content,
      recentUserMessages,
    });
    const modelExtractor =
      process.env.RELATIONSHIP_EVIDENCE_EXTRACTOR === "model";
    extractorModel = modelExtractor
      ? `model:${process.env.MODEL_NAME?.trim() ?? "unconfigured"}`
      : "deterministic-rules";
    extractorVersion = modelExtractor
      ? MODEL_EXTRACTOR_VERSION
      : DETERMINISTIC_EXTRACTOR_VERSION;
    const filtered = filterRelationshipCandidates({
      raw: extracted,
      expectedUserMessageId: userMessage.id,
      allowedContextMessageIds: [userMessage.id, characterMessage.id],
      seenNoveltyKeys: new Set(
        existing.map((item) => item.normalizedFingerprint),
      ),
    });
    accepted = filtered.accepted;
    await checkpointRelationshipOutboxExtraction(
      outbox.id,
      outbox.claimToken!,
      {
        extractorModel,
        extractorVersion,
        candidates: accepted.map((item) => item.candidate),
      },
    );
  }
  if (accepted.length === 0) return;

  for (const item of accepted) {
      await storeRelationshipEvidence(
        {
          userId: outbox.userId,
          characterId: outbox.characterId,
          dimension: item.dimension,
          eventType: item.candidate.type,
          quality: item.quality,
          confidence: item.candidate.confidence,
          episodeKey: turnEpisodeKey,
          topicKey: item.candidate.topicKey,
          normalizedFingerprint: item.candidate.noveltyKey,
          logicalKey: item.logicalKey,
          sanitizedSummary: item.candidate.sanitizedSummary,
          stance:
            item.candidate.stance === "none"
              ? "not_applicable"
              : item.candidate.stance,
          substantiveness: item.candidate.substantiveness,
          extractorModel,
          extractorVersion,
          policyMappingVersion: RELATIONSHIP_POLICY_VERSION,
          status: "active",
          expectedRecordingRevision,
          sourceMessageCreatedAt: sourceUserMessageCreatedAt,
        },
        [
          {
            sourceType: "message",
            messageId: userMessage.id,
            sourceRole: "user",
            dependencyRole: "primary",
            status: "active",
          },
          {
            sourceType: "message",
            messageId: characterMessage.id,
            sourceRole: "character",
            dependencyRole: "optional_context",
            status: "active",
          },
        ],
      );
  }

  const latestState = await getRelationshipState(
    outbox.userId,
    outbox.characterId,
  );
  if (
    !latestState ||
    latestState.status !== "active" ||
    latestState.recordingRevision !== expectedRecordingRevision
  )
    return;
  const evidence = await listRelationshipEvidence(outbox.userId, outbox.characterId);
  const projection = projectRelationshipStage({
    currentStage: latestState.stage,
    evidence: evidence.map((item) => ({
      id: item.id,
      logicalKey: item.logicalKey,
      dimension: item.dimension,
      type: item.eventType,
      quality: item.quality,
      episodeKey: item.episodeKey,
      topicKey: item.topicKey,
      status: item.status,
    })),
  });
  if (projection.nextStage !== latestState.stage) {
    await recordRelationshipTransition({
      userId: outbox.userId,
      characterId: outbox.characterId,
      fromStage: latestState.stage,
      toStage: projection.nextStage,
      policyVersion: projection.policyVersion,
      evidenceRevision: latestState.evidenceRevision,
      evidenceSnapshotHash: evidenceSnapshotHash(projection.countedEvidenceIds),
      triggerType: "evidence_projection",
      feedbackText: transitionFeedback[projection.nextStage] ?? "你们的关系有了新的变化。",
      afterMessageId: characterMessage.id,
      idempotencyKey: `projection:${outbox.id}:${projection.nextStage}`,
      expectedRecordingRevision,
      expectedEvidenceRevision: latestState.evidenceRevision,
    });
  }
}

async function processClaimedOutbox(outbox: RelationshipOutboxRecord) {
  if (!outbox.claimToken) throw new Error("RELATIONSHIP_OUTBOX_MISSING_CLAIM_TOKEN");
  try {
    if (outbox.eventType !== "evidence_extraction_requested")
      throw new Error(`RELATIONSHIP_OUTBOX_EVENT_UNSUPPORTED_${outbox.eventType}`);
    await processEvidenceExtraction(outbox);
    await completeRelationshipOutbox(outbox.id, outbox.claimToken);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "RELATIONSHIP_RECORDING_INVALIDATED" ||
        error.message === "RELATIONSHIP_IS_PAUSED")
    ) {
      await completeRelationshipOutbox(outbox.id, outbox.claimToken).catch(
        () => undefined,
      );
      return;
    }
    const retryDelayMs = Math.min(
      5 * 60 * 1000,
      1_000 * 2 ** Math.max(0, outbox.attempt - 1),
    );
    await failRelationshipOutbox(
      outbox.id,
      outbox.claimToken,
      error instanceof Error ? error.message.slice(0, 120) : "RELATIONSHIP_PROCESSOR_FAILED",
      new Date(Date.now() + retryDelayMs).toISOString(),
    );
    throw error;
  }
}

export async function drainRelationshipOutboxBatch(
  batchSize = 1,
  scope?: { userId: string; characterId: string },
) {
  const claimed = await claimRelationshipOutbox(batchSize, scope);
  let processed = 0;
  let failed = 0;
  for (const outbox of claimed) {
    try {
      await processClaimedOutbox(outbox);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: "relationship_outbox_record_failed",
          outboxId: outbox.id,
          eventType: outbox.eventType,
          attempt: outbox.attempt,
          errorCode:
            error instanceof Error
              ? error.message.slice(0, 120)
              : "RELATIONSHIP_PROCESSOR_FAILED",
        }),
      );
    }
  }
  return { claimed: claimed.length, processed, failed };
}

export async function drainRelationshipOutbox(
  batchSize = 1,
  scope?: { userId: string; characterId: string },
) {
  return (await drainRelationshipOutboxBatch(batchSize, scope)).claimed;
}
