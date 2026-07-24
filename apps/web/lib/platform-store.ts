import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  AgentArtifact,
  AgentTask,
  ConversationMessage,
  ConversationThread,
  MasteryRecord,
  MemoryRecord,
  HallVisitState,
  ThreadEpoch,
  RelationshipDimension,
  RelationshipEvidenceStatus,
  RelationshipEvidenceType,
  RelationshipPublicState,
  RelationshipStage,
  RelationshipStatus,
  RelationshipSourceDependency,
} from "@ai-museum/sdk";
import { databaseEnabled, query as dbQuery, transaction } from "./database";
import { projectRelationshipStage } from "./relationship-policy";

export interface CollectionRecord {
  userId: string;
  ownedCharacterIds: string[];
  stars: number;
  fragments: number;
  firstFreeEligible: boolean;
  firstFreeUsed: boolean;
  revision: number;
  updatedAt: string;
}
export interface LearningEventRecord {
  id: string;
  userId: string;
  characterId: string;
  periodId: string;
  type: "evidence_viewed" | "encounter_completed" | "meaningful_question";
  idempotencyKey: string;
  rewardStars: number;
  createdAt: string;
}
export interface DrawRecord {
  id: string;
  userId: string;
  periodId: string;
  idempotencyKey: string;
  costStars: number;
  resultCharacterId: string;
  duplicate: boolean;
  fragmentReward: number;
  status: "committed" | "revealed";
  createdAt: string;
  revealedAt?: string;
}

export interface RelationshipStateRecord {
  userId: string;
  characterId: string;
  stage: RelationshipStage;
  status: RelationshipStatus;
  policyVersion: string;
  evidenceRevision: number;
  recordingRevision: number;
  revision: number;
  stageChangedAt: string;
  evaluatedAt?: string;
  pausedAt?: string;
  resetCutoffAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipEvidenceRecord {
  id: string;
  userId: string;
  characterId: string;
  dimension: RelationshipDimension;
  eventType: RelationshipEvidenceType;
  quality: 1 | 2 | 3;
  confidence: number;
  episodeKey: string;
  topicKey: string;
  normalizedFingerprint: string;
  logicalKey: string;
  sanitizedSummary?: string;
  stance?: "agree" | "disagree" | "mixed" | "not_applicable";
  substantiveness?: "low" | "medium" | "high";
  extractorModel: string;
  extractorVersion: string;
  policyMappingVersion: string;
  status: RelationshipEvidenceStatus;
  rejectionReasonCode?: string;
  supersededById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipEvidenceSourceRecord {
  id: string;
  evidenceId: string;
  sourceType: "message" | "memory" | "learning_event";
  messageId?: string;
  memoryId?: string;
  learningEventId?: string;
  sourceRole: "user" | "character" | "system";
  dependencyRole: RelationshipSourceDependency;
  status: "active" | "suspended" | "revoked";
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipTransitionRecord {
  id: string;
  userId: string;
  characterId: string;
  fromStage: RelationshipStage;
  toStage: RelationshipStage;
  policyVersion: string;
  evidenceRevision: number;
  evidenceSnapshotHash: string;
  triggerType:
    | "evidence_projection"
    | "guest_merge"
    | "policy_reprojection";
  feedbackStatus: "pending" | "acknowledged";
  feedbackText: string;
  afterMessageId: string;
  idempotencyKey: string;
  feedbackIdempotencyKey?: string;
  feedbackAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipPreferenceRecord {
  userId: string;
  characterId: string;
  preferredAddress: string;
  consentStatus: "granted" | "revoked";
  consentVersion: number;
  grantedAt: string;
  revokedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipOutboxRecord {
  id: string;
  userId: string;
  characterId: string;
  aggregateKey: string;
  eventType:
    | "evidence_extraction_requested"
    | "relationship_reprojection_requested"
    | "evidence_source_changed";
  payload: Record<string, unknown>;
  producerVersion: string;
  idempotencyKey: string;
  status: "pending" | "processing" | "processed" | "dead_letter";
  attempt: number;
  maxAttempts: number;
  availableAt: string;
  claimedAt?: string;
  claimToken?: string;
  processedAt?: string;
  lastErrorCode?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RelationshipEvidenceSourceInput = Omit<
  RelationshipEvidenceSourceRecord,
  "id" | "evidenceId" | "createdAt" | "updatedAt"
>;

export type StoreRelationshipEvidenceInput = Omit<
  RelationshipEvidenceRecord,
  "id" | "createdAt" | "updatedAt"
> & {
  expectedRecordingRevision?: number;
  sourceMessageCreatedAt?: string;
};

export type RecordRelationshipTransitionInput = Omit<
  RelationshipTransitionRecord,
  | "id"
  | "feedbackStatus"
  | "feedbackIdempotencyKey"
  | "feedbackAt"
  | "revision"
  | "createdAt"
  | "updatedAt"
> & {
  expectedRecordingRevision?: number;
  expectedEvidenceRevision?: number;
};

export type EnqueueRelationshipOutboxInput = Pick<
  RelationshipOutboxRecord,
  | "userId"
  | "characterId"
  | "eventType"
  | "producerVersion"
  | "idempotencyKey"
> & {
  aggregateKey?: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
  availableAt?: string;
};

export interface CharacterMessageRelationshipOutboxInput {
  sourceUserMessageId: string;
  expectedRecordingRevision: number;
  producerVersion: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface RelationshipMemoryWriteGuard {
  expectedRecordingRevision: number;
  sourceMessageCreatedAt: string;
}

interface PlatformState {
  threads: ConversationThread[];
  epochs: ThreadEpoch[];
  messages: ConversationMessage[];
  memories: MemoryRecord[];
  mastery: MasteryRecord[];
  tasks: AgentTask[];
  artifacts: AgentArtifact[];
  collections: CollectionRecord[];
  learningEvents: LearningEventRecord[];
  draws: DrawRecord[];
  hallVisits: HallVisitState[];
  relationships: RelationshipStateRecord[];
  relationshipEvidence: RelationshipEvidenceRecord[];
  relationshipEvidenceSources: RelationshipEvidenceSourceRecord[];
  relationshipTransitions: RelationshipTransitionRecord[];
  relationshipPreferences: RelationshipPreferenceRecord[];
  relationshipOutbox: RelationshipOutboxRecord[];
}
const empty = (): PlatformState => ({
  threads: [],
  epochs: [],
  messages: [],
  memories: [],
  mastery: [],
  tasks: [],
  artifacts: [],
  collections: [],
  learningEvents: [],
  draws: [],
  hallVisits: [],
  relationships: [],
  relationshipEvidence: [],
  relationshipEvidenceSources: [],
  relationshipTransitions: [],
  relationshipPreferences: [],
  relationshipOutbox: [],
});
const runtimeDir = path.join(process.cwd(), "..", "..", "data", "runtime");
const stateFile = path.join(
  runtimeDir,
  process.env.VITEST ? "platform.test.json" : "platform.json",
);
function load(): PlatformState {
  try {
    if (existsSync(stateFile))
      return { ...empty(), ...JSON.parse(readFileSync(stateFile, "utf8")) };
  } catch {
    /* Local recovery only. PostgreSQL is authoritative in production. */
  }
  return empty();
}
const globals = globalThis as typeof globalThis & {
  __platformState?: PlatformState;
};
export const platform = (globals.__platformState ??= load());
function persist() {
  mkdirSync(runtimeDir, { recursive: true });
  const temp = `${stateFile}.tmp`;
  writeFileSync(temp, JSON.stringify(platform, null, 2), "utf8");
  writeFileSync(stateFile, readFileSync(temp));
}
export function resetPlatformForTests() {
  Object.assign(platform, empty());
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}
function asThread(row: Record<string, any>): ConversationThread {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    currentEpochId: row.current_epoch_id,
    characterVersion: row.character_version,
    title: row.title,
    summary: row.summary ?? undefined,
    lastMessageAt: iso(row.last_message_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function asMessage(row: Record<string, any>): ConversationMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    epochId: row.epoch_id,
    role: row.role,
    content: row.content,
    characterVersion: row.character_version,
    claimIds: row.claim_ids ?? [],
    citations: row.citations ?? [],
    createdAt: iso(row.created_at)!,
  };
}
function asMemory(row: Record<string, any>): MemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id ?? undefined,
    type: row.type,
    content: row.content,
    sourceMessageIds: row.source_message_ids ?? [],
    confidence: row.confidence,
    importance: row.importance,
    sensitivity: row.sensitivity,
    status: row.status,
    lastRecalledAt: iso(row.last_recalled_at),
    recallCount: row.recall_count,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function asMastery(row: Record<string, any>): MasteryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    topicId: row.topic_id,
    level: row.level,
    confidence: row.confidence,
    evidenceMessageIds: row.evidence_message_ids ?? [],
    lastPracticedAt: iso(row.last_practiced_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function asTask(row: Record<string, any>): AgentTask {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    input: row.input ?? {},
    plan: row.plan ?? [],
    currentStep: row.current_step,
    artifactIds: row.artifact_ids ?? [],
    provider: row.provider,
    model: row.model,
    attempt: row.attempt,
    createdBy: row.user_id,
    consentId: row.consent_id ?? undefined,
    errorCode: row.error_code ?? undefined,
    resumeToken: row.resume_token,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}
function asArtifact(row: Record<string, any>): AgentArtifact {
  return {
    id: row.id,
    taskId: row.task_id,
    kind: row.kind,
    name: row.name,
    contentType: row.content_type,
    data: row.data ?? undefined,
    storageKey: row.storage_key ?? undefined,
    createdAt: iso(row.created_at)!,
  };
}
function asCollection(row: Record<string, any>): CollectionRecord {
  return {
    userId: row.user_id,
    ownedCharacterIds: row.owned_character_ids ?? [],
    stars: row.stars,
    fragments: row.fragments,
    firstFreeEligible: row.first_free_eligible,
    firstFreeUsed: row.first_free_used,
    revision: row.revision,
    updatedAt: iso(row.updated_at)!,
  };
}
function asLearningEvent(row: Record<string, any>): LearningEventRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    periodId: row.period_id,
    type: row.type,
    idempotencyKey: row.idempotency_key,
    rewardStars: row.reward_stars,
    createdAt: iso(row.created_at)!,
  };
}
function asDraw(row: Record<string, any>): DrawRecord {
  return {
    id: row.id,
    userId: row.user_id,
    periodId: row.period_id,
    idempotencyKey: row.idempotency_key,
    costStars: row.cost_stars,
    resultCharacterId: row.result_character_id,
    duplicate: row.duplicate,
    fragmentReward: row.fragment_reward,
    status: row.status,
    createdAt: iso(row.created_at)!,
    revealedAt: iso(row.revealed_at),
  };
}

function asRelationshipState(row: Record<string, any>): RelationshipStateRecord {
  return {
    userId: row.user_id,
    characterId: row.character_id,
    stage: row.stage,
    status: row.status,
    policyVersion: row.policy_version,
    evidenceRevision: row.evidence_revision,
    recordingRevision: row.recording_revision,
    revision: row.revision,
    stageChangedAt: iso(row.stage_changed_at)!,
    evaluatedAt: iso(row.evaluated_at),
    pausedAt: iso(row.paused_at),
    resetCutoffAt: iso(row.reset_cutoff_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function asRelationshipEvidence(
  row: Record<string, any>,
): RelationshipEvidenceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    dimension: row.dimension,
    eventType: row.event_type,
    quality: row.quality,
    confidence: row.confidence,
    episodeKey: row.episode_key,
    topicKey: row.topic_key,
    normalizedFingerprint: row.normalized_fingerprint,
    logicalKey: row.logical_key,
    sanitizedSummary: row.sanitized_summary ?? undefined,
    stance: row.stance ?? undefined,
    substantiveness: row.substantiveness ?? undefined,
    extractorModel: row.extractor_model,
    extractorVersion: row.extractor_version,
    policyMappingVersion: row.policy_mapping_version,
    status: row.status,
    rejectionReasonCode: row.rejection_reason_code ?? undefined,
    supersededById: row.superseded_by_id ?? undefined,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function asRelationshipEvidenceSource(
  row: Record<string, any>,
): RelationshipEvidenceSourceRecord {
  return {
    id: row.id,
    evidenceId: row.evidence_id,
    sourceType: row.source_type,
    messageId: row.message_id ?? undefined,
    memoryId: row.memory_id ?? undefined,
    learningEventId: row.learning_event_id ?? undefined,
    sourceRole: row.source_role,
    dependencyRole: row.dependency_role,
    status: row.status,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function asRelationshipTransition(
  row: Record<string, any>,
): RelationshipTransitionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    policyVersion: row.policy_version,
    evidenceRevision: row.evidence_revision,
    evidenceSnapshotHash: row.evidence_snapshot_hash,
    triggerType: row.trigger_type,
    feedbackStatus: row.feedback_status,
    feedbackText: row.feedback_text,
    afterMessageId: row.after_message_id,
    idempotencyKey: row.idempotency_key,
    feedbackIdempotencyKey: row.feedback_idempotency_key ?? undefined,
    feedbackAt: iso(row.feedback_at),
    revision: row.revision,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function asRelationshipPreference(
  row: Record<string, any>,
): RelationshipPreferenceRecord {
  return {
    userId: row.user_id,
    characterId: row.character_id,
    preferredAddress: row.preferred_address,
    consentStatus: row.consent_status,
    consentVersion: row.consent_version,
    grantedAt: iso(row.granted_at)!,
    revokedAt: iso(row.revoked_at),
    revision: row.revision,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

function asRelationshipOutbox(
  row: Record<string, any>,
): RelationshipOutboxRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    aggregateKey: row.aggregate_key,
    eventType: row.event_type,
    payload: row.payload ?? {},
    producerVersion: row.producer_version,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    availableAt: iso(row.available_at)!,
    claimedAt: iso(row.claimed_at),
    claimToken: row.claim_token ?? undefined,
    processedAt: iso(row.processed_at),
    lastErrorCode: row.last_error_code ?? undefined,
    lastErrorAt: iso(row.last_error_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

const relationshipStageOrder: RelationshipStage[] = [
  "initial",
  "acquainted",
  "young_friend",
  "old_friend",
  "kindred_spirit",
];
const defaultRelationshipPolicyVersion = "relationship-policy-v1";

function relationshipAggregateKey(userId: string, characterId: string) {
  return `relationship:${userId}:${characterId}`;
}

function relationshipStageRank(stage: RelationshipStage) {
  return relationshipStageOrder.indexOf(stage);
}

function assertAdjacentRelationshipTransition(
  fromStage: RelationshipStage,
  toStage: RelationshipStage,
) {
  if (relationshipStageRank(toStage) !== relationshipStageRank(fromStage) + 1)
    throw new Error("RELATIONSHIP_TRANSITION_NOT_ADJACENT");
}

function assertPreferredAddress(value: string) {
  const trimmed = value.trim();
  if (
    trimmed !== value ||
    trimmed.length < 1 ||
    Array.from(trimmed).length > 20 ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(trimmed)
  )
    throw new Error("INVALID_PREFERRED_ADDRESS");
  return trimmed;
}

function ensureRelationshipInMemory(
  userId: string,
  characterId: string,
  policyVersion = defaultRelationshipPolicyVersion,
) {
  const existing = platform.relationships.find(
    (item) => item.userId === userId && item.characterId === characterId,
  );
  if (existing) {
    const migrated =
      !Number.isInteger(existing.recordingRevision) ||
      existing.recordingRevision < 1;
    if (migrated) existing.recordingRevision = 1;
    return { state: existing, created: migrated };
  }
  const now = new Date().toISOString();
  const state: RelationshipStateRecord = {
    userId,
    characterId,
    stage: "initial",
    status: "active",
    policyVersion,
    evidenceRevision: 0,
    recordingRevision: 1,
    revision: 1,
    stageChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  platform.relationships.push(state);
  return { state, created: true };
}

async function ensureRelationshipWithClient(
  userId: string,
  characterId: string,
  policyVersion: string,
  client: PoolClient,
) {
  await ensureUser(userId, client);
  await client.query(
    `INSERT INTO user_character_relationships(user_id,character_id,policy_version)
     VALUES($1,$2,$3) ON CONFLICT(user_id,character_id) DO NOTHING`,
    [userId, characterId, policyVersion],
  );
  const result = await client.query(
    "SELECT * FROM user_character_relationships WHERE user_id=$1 AND character_id=$2",
    [userId, characterId],
  );
  return asRelationshipState(result.rows[0]);
}

function publicRelationshipFromRecords(
  state: RelationshipStateRecord,
  preference?: RelationshipPreferenceRecord,
  transition?: RelationshipTransitionRecord,
): RelationshipPublicState {
  return {
    characterId: state.characterId,
    stage: state.stage,
    status: state.status,
    stageChangedAt: state.stageChangedAt,
    revision: state.revision,
    preferredAddress:
      preference?.consentStatus === "granted"
        ? {
            value: preference.preferredAddress,
            consentVersion: preference.consentVersion,
          }
        : undefined,
    pendingTransition:
      transition?.feedbackStatus === "pending"
        ? {
            id: transition.id,
            fromStage: transition.fromStage,
            toStage: transition.toStage,
            feedbackText: transition.feedbackText,
            createdAt: transition.createdAt,
            afterMessageId: transition.afterMessageId,
          }
        : undefined,
  };
}

async function ensureUser(userId: string, client?: PoolClient) {
  if (!databaseEnabled) return;
  const execute = client ? client.query.bind(client) : dbQuery;
  await execute("INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING", [
    userId,
  ]);
}

export async function getOrCreateThread(
  userId: string,
  characterId: string,
  characterVersion: string,
  title: string,
) {
  if (!databaseEnabled) {
    const existing = platform.threads.find(
      (thread) =>
        thread.userId === userId && thread.characterId === characterId,
    );
    if (existing) return existing;
    const now = new Date().toISOString();
    const threadId = randomUUID();
    const epoch: ThreadEpoch = {
      id: randomUUID(),
      threadId,
      characterVersion,
      startedAt: now,
    };
    const thread: ConversationThread = {
      id: threadId,
      userId,
      characterId,
      currentEpochId: epoch.id,
      characterVersion,
      title,
      createdAt: now,
      updatedAt: now,
    };
    platform.threads.push(thread);
    platform.epochs.push(epoch);
    persist();
    return thread;
  }
  return transaction(async (client) => {
    await ensureUser(userId, client);
    const found = await client.query(
      "SELECT * FROM character_threads WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    if (found.rows[0]) return asThread(found.rows[0]);
    const now = new Date();
    const threadId = randomUUID();
    const epochId = randomUUID();
    const inserted = await client.query(
      "INSERT INTO character_threads(id,user_id,character_id,character_version,current_epoch_id,title,created_at,updated_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$6) ON CONFLICT(user_id,character_id) DO NOTHING RETURNING *",
      [threadId, userId, characterId, characterVersion, title, now],
    );
    if (!inserted.rows[0])
      return asThread(
        (
          await client.query(
            "SELECT * FROM character_threads WHERE user_id=$1 AND character_id=$2",
            [userId, characterId],
          )
        ).rows[0],
      );
    await client.query(
      "INSERT INTO thread_epochs(id,thread_id,character_version,started_at) VALUES($1,$2,$3,$4)",
      [epochId, threadId, characterVersion, now],
    );
    return asThread(
      (
        await client.query(
          "UPDATE character_threads SET current_epoch_id=$1 WHERE id=$2 RETURNING *",
          [epochId, threadId],
        )
      ).rows[0],
    );
  });
}

export async function listThreads(userId: string) {
  if (!databaseEnabled)
    return platform.threads
      .filter((thread) => thread.userId === userId)
      .sort((a, b) =>
        (b.lastMessageAt ?? b.updatedAt).localeCompare(
          a.lastMessageAt ?? a.updatedAt,
        ),
      );
  const result = await dbQuery(
    "SELECT t.*, latest.last_message_at FROM character_threads t LEFT JOIN LATERAL (SELECT max(created_at) AS last_message_at FROM messages WHERE thread_id=t.id) latest ON true WHERE t.user_id=$1 ORDER BY coalesce(latest.last_message_at,t.updated_at) DESC",
    [userId],
  );
  return result.rows.map(asThread);
}

export async function getThreadForUser(threadId: string, userId: string) {
  if (!databaseEnabled)
    return (
      platform.threads.find(
        (thread) => thread.id === threadId && thread.userId === userId,
      ) ?? null
    );
  const result = await dbQuery(
    "SELECT t.*, latest.last_message_at FROM character_threads t LEFT JOIN LATERAL (SELECT max(created_at) AS last_message_at FROM messages WHERE thread_id=t.id) latest ON true WHERE t.id=$1 AND t.user_id=$2",
    [threadId, userId],
  );
  return result.rows[0] ? asThread(result.rows[0]) : null;
}

export async function listMessages(
  threadId: string,
  userId: string,
  cursor?: string,
  limit = 50,
) {
  if (!databaseEnabled) {
    const owned = platform.threads.some(
      (thread) => thread.id === threadId && thread.userId === userId,
    );
    if (!owned) return null;
    const all = platform.messages.filter(
      (message) => message.threadId === threadId,
    );
    const end = cursor
      ? Math.max(
          0,
          all.findIndex((message) => message.id === cursor),
        )
      : all.length;
    const start = Math.max(0, end - Math.min(limit, 100));
    return {
      messages: all.slice(start, end),
      nextCursor: start > 0 ? all[start].id : undefined,
    };
  }
  if (!(await getThreadForUser(threadId, userId))) return null;
  const capped = Math.min(limit, 100);
  const cursorDate = cursor
    ? (
        await dbQuery(
          "SELECT created_at FROM messages WHERE id=$1 AND thread_id=$2",
          [cursor, threadId],
        )
      ).rows[0]?.created_at
    : undefined;
  const result = await dbQuery(
    `SELECT * FROM messages WHERE thread_id=$1 ${cursorDate ? "AND created_at < $3" : ""} ORDER BY created_at DESC,id DESC LIMIT $2`,
    cursorDate ? [threadId, capped + 1, cursorDate] : [threadId, capped + 1],
  );
  const rows = result.rows.reverse();
  const hasMore = rows.length > capped;
  const visible = hasMore ? rows.slice(1) : rows;
  return {
    messages: visible.map(asMessage),
    nextCursor: hasMore ? visible[0]?.id : undefined,
  };
}

export async function getMessageForUser(
  threadId: string,
  userId: string,
  messageId: string,
) {
  if (!databaseEnabled) {
    const owned = platform.threads.some(
      (thread) => thread.id === threadId && thread.userId === userId,
    );
    if (!owned) return null;
    return (
      platform.messages.find(
        (message) => message.id === messageId && message.threadId === threadId,
      ) ?? null
    );
  }
  const result = await dbQuery(
    `SELECT m.* FROM messages m
     JOIN character_threads t ON t.id=m.thread_id
     WHERE m.id=$1 AND m.thread_id=$2 AND t.user_id=$3`,
    [messageId, threadId, userId],
  );
  return result.rows[0] ? asMessage(result.rows[0]) : null;
}

export async function recentUserMessagesBefore(
  threadId: string,
  userId: string,
  messageId: string,
  limit = 8,
) {
  const capped = Math.max(1, Math.min(50, Math.trunc(limit)));
  if (!databaseEnabled) {
    const owned = platform.threads.some(
      (thread) => thread.id === threadId && thread.userId === userId,
    );
    if (!owned) return null;
    const ordered = platform.messages
      .filter((message) => message.threadId === threadId)
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? a.id.localeCompare(b.id)
          : a.createdAt.localeCompare(b.createdAt),
      );
    const currentIndex = ordered.findIndex((message) => message.id === messageId);
    if (currentIndex < 0) return null;
    return ordered
      .slice(0, currentIndex)
      .filter((message) => message.role === "user")
      .slice(-capped)
      .map((message) => message.content);
  }
  const result = await dbQuery(
    `SELECT previous.content FROM messages current
     JOIN character_threads t ON t.id=current.thread_id
     JOIN LATERAL (
       SELECT m.content,m.created_at,m.id FROM messages m
       WHERE m.thread_id=current.thread_id AND m.role='user'
         AND (m.created_at,m.id)<(current.created_at,current.id)
       ORDER BY m.created_at DESC,m.id DESC LIMIT $4
     ) previous ON true
     WHERE current.id=$1 AND current.thread_id=$2 AND t.user_id=$3
     ORDER BY previous.created_at,previous.id`,
    [messageId, threadId, userId, capped],
  );
  return result.rows.map((row) => String(row.content));
}

export async function relationshipEpisodeKeyForMessage(
  threadId: string,
  userId: string,
  messageId: string,
  gapMs: number,
) {
  const gap = Math.max(1, Math.trunc(gapMs));
  let rows: Array<{ id: string; createdAt: string }>;
  if (!databaseEnabled) {
    const owned = platform.threads.some(
      (thread) => thread.id === threadId && thread.userId === userId,
    );
    if (!owned) return null;
    rows = platform.messages
      .filter(
        (message) => message.threadId === threadId && message.role === "user",
      )
      .map((message) => ({ id: message.id, createdAt: message.createdAt }));
  } else {
    const result = await dbQuery(
      `SELECT m.id,m.created_at FROM messages m
       JOIN character_threads t ON t.id=m.thread_id
       WHERE m.thread_id=$1 AND t.user_id=$2 AND m.role='user'
       ORDER BY m.created_at,m.id`,
      [threadId, userId],
    );
    rows = result.rows.map((row) => ({
      id: String(row.id),
      createdAt: iso(row.created_at)!,
    }));
  }
  rows.sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id)
      : a.createdAt.localeCompare(b.createdAt),
  );
  const currentIndex = rows.findIndex((message) => message.id === messageId);
  if (currentIndex < 0) return null;
  let start = rows[currentIndex];
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previous = rows[index];
    if (Date.parse(start.createdAt) - Date.parse(previous.createdAt) >= gap)
      break;
    start = previous;
  }
  return `episode:${start.id}`;
}

export async function addMessage(
  thread: ConversationThread,
  input: Omit<
    ConversationMessage,
    "id" | "threadId" | "epochId" | "characterVersion" | "createdAt"
  >,
) {
  const message: ConversationMessage = {
    ...input,
    id: randomUUID(),
    threadId: thread.id,
    epochId: thread.currentEpochId,
    characterVersion: thread.characterVersion,
    createdAt: new Date().toISOString(),
  };
  if (!databaseEnabled) {
    platform.messages.push(message);
    thread.lastMessageAt = message.createdAt;
    thread.updatedAt = message.createdAt;
    if (input.role === "user") thread.summary = input.content.slice(0, 100);
    persist();
    return message;
  }
  await dbQuery(
    "INSERT INTO messages(id,thread_id,epoch_id,role,content,character_version,claim_ids,citations,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      message.id,
      message.threadId,
      message.epochId,
      message.role,
      message.content,
      message.characterVersion,
      JSON.stringify(message.claimIds),
      JSON.stringify(message.citations),
      message.createdAt,
    ],
  );
  await dbQuery(
    "UPDATE character_threads SET updated_at=$1,summary=CASE WHEN $2='user' THEN left($3,100) ELSE summary END WHERE id=$4",
    [message.createdAt, message.role, message.content, thread.id],
  );
  return message;
}

export async function upgradeThread(
  thread: ConversationThread,
  version: string,
) {
  if (thread.characterVersion === version) return thread;
  const now = new Date().toISOString();
  const epochId = randomUUID();
  if (!databaseEnabled) {
    const current = platform.epochs.find(
      (epoch) => epoch.id === thread.currentEpochId,
    );
    if (current) current.endedAt = now;
    const epoch: ThreadEpoch = {
      id: epochId,
      threadId: thread.id,
      characterVersion: version,
      startedAt: now,
    };
    platform.epochs.push(epoch);
    thread.currentEpochId = epoch.id;
    thread.characterVersion = version;
    thread.updatedAt = now;
    persist();
    return thread;
  }
  return transaction(async (client) => {
    await client.query("UPDATE thread_epochs SET ended_at=$1 WHERE id=$2", [
      now,
      thread.currentEpochId,
    ]);
    await client.query(
      "INSERT INTO thread_epochs(id,thread_id,character_version,started_at) VALUES($1,$2,$3,$4)",
      [epochId, thread.id, version, now],
    );
    return asThread(
      (
        await client.query(
          "UPDATE character_threads SET current_epoch_id=$1,character_version=$2,updated_at=$3 WHERE id=$4 RETURNING *",
          [epochId, version, now, thread.id],
        )
      ).rows[0],
    );
  });
}

const memorySelect = `SELECT m.*,coalesce(array_agg(ms.message_id::text) FILTER (WHERE ms.message_id IS NOT NULL),'{}') AS source_message_ids FROM memories m LEFT JOIN memory_sources ms ON ms.memory_id=m.id`;
export async function listMemories(userId: string, characterId?: string) {
  if (!databaseEnabled)
    return platform.memories.filter(
      (memory) =>
        memory.userId === userId &&
        memory.status !== "forgotten" &&
        (characterId === undefined || memory.characterId === characterId),
    );
  const result = await dbQuery(
    `${memorySelect} WHERE m.user_id=$1 AND m.status<>'forgotten' ${characterId ? "AND m.character_id=$2" : ""} GROUP BY m.id ORDER BY m.updated_at DESC`,
    characterId ? [userId, characterId] : [userId],
  );
  return result.rows.map(asMemory);
}
export async function activeCharacterMemories(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled)
    return platform.memories.filter(
      (memory) =>
        memory.userId === userId &&
        memory.characterId === characterId &&
        memory.status === "active",
    );
  const result = await dbQuery(
    `${memorySelect} WHERE m.user_id=$1 AND m.character_id=$2 AND m.status='active' GROUP BY m.id ORDER BY m.importance DESC,m.updated_at DESC`,
    [userId, characterId],
  );
  return result.rows.map(asMemory);
}

type CreateMemoryInput = Omit<
  MemoryRecord,
  "id" | "recallCount" | "createdAt" | "updatedAt"
>;

export function createMemory(input: CreateMemoryInput): Promise<MemoryRecord>;
export function createMemory(
  input: CreateMemoryInput,
  guard: RelationshipMemoryWriteGuard,
): Promise<MemoryRecord | null>;
export async function createMemory(
  input: CreateMemoryInput,
  guard?: RelationshipMemoryWriteGuard,
) {
  if (!databaseEnabled) {
    if (guard) {
      const relationship = input.characterId
        ? platform.relationships.find(
            (item) =>
              item.userId === input.userId &&
              item.characterId === input.characterId,
          )
        : undefined;
      if (
        !relationship ||
        relationship.status !== "active" ||
        relationship.recordingRevision !== guard.expectedRecordingRevision ||
        (relationship.resetCutoffAt &&
          relationship.resetCutoffAt >= guard.sourceMessageCreatedAt)
      )
        return null;
    }
    const duplicate = platform.memories.find(
      (memory) =>
        memory.userId === input.userId &&
        memory.characterId === input.characterId &&
        memory.type === input.type &&
        memory.content === input.content &&
        memory.status !== "forgotten",
    );
    if (duplicate) {
      duplicate.sourceMessageIds = [
        ...new Set([...duplicate.sourceMessageIds, ...input.sourceMessageIds]),
      ];
      duplicate.confidence = Math.max(duplicate.confidence, input.confidence);
      duplicate.importance = Math.max(duplicate.importance, input.importance);
      duplicate.updatedAt = new Date().toISOString();
      persist();
      return duplicate;
    }
    const now = new Date().toISOString();
    const memory: MemoryRecord = {
      ...input,
      id: randomUUID(),
      recallCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    platform.memories.push(memory);
    persist();
    return memory;
  }
  return transaction(async (client) => {
    await ensureUser(input.userId, client);
    if (guard) {
      if (!input.characterId) return null;
      const relationshipResult = await client.query(
        `SELECT * FROM user_character_relationships
         WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
        [input.userId, input.characterId],
      );
      if (!relationshipResult.rows[0]) return null;
      const relationship = asRelationshipState(relationshipResult.rows[0]);
      if (
        relationship.status !== "active" ||
        relationship.recordingRevision !== guard.expectedRecordingRevision ||
        (relationship.resetCutoffAt &&
          relationship.resetCutoffAt >= guard.sourceMessageCreatedAt)
      )
        return null;
    }
    const duplicate = await client.query(
      "SELECT id FROM memories WHERE user_id=$1 AND character_id IS NOT DISTINCT FROM $2 AND type=$3 AND content=$4 AND status<>'forgotten' LIMIT 1",
      [input.userId, input.characterId ?? null, input.type, input.content],
    );
    const id = duplicate.rows[0]?.id ?? randomUUID();
    if (duplicate.rows[0])
      await client.query(
        "UPDATE memories SET confidence=greatest(confidence,$1),importance=greatest(importance,$2),updated_at=now() WHERE id=$3",
        [input.confidence, input.importance, id],
      );
    else
      await client.query(
        "INSERT INTO memories(id,user_id,character_id,type,content,confidence,importance,sensitivity,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())",
        [
          id,
          input.userId,
          input.characterId ?? null,
          input.type,
          input.content,
          input.confidence,
          input.importance,
          input.sensitivity,
          input.status,
        ],
      );
    for (const sourceId of input.sourceMessageIds)
      await client.query(
        "INSERT INTO memory_sources(memory_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [id, sourceId],
      );
    return asMemory(
      (await client.query(`${memorySelect} WHERE m.id=$1 GROUP BY m.id`, [id]))
        .rows[0],
    );
  });
}

function forgetMemoryContentInMemory(memory: MemoryRecord, updatedAt: string) {
  memory.status = "forgotten";
  memory.content = "[已忘记]";
  memory.sourceMessageIds = [];
  memory.confidence = 0;
  memory.importance = 0;
  memory.recallCount = 0;
  memory.lastRecalledAt = undefined;
  memory.updatedAt = updatedAt;
}

function isIdempotentForgottenMemoryPatch(
  patch: Partial<
    Pick<MemoryRecord, "content" | "status" | "importance" | "confidence">
  >,
) {
  const keys = Object.keys(patch);
  return keys.length === 0 || (keys.length === 1 && patch.status === "forgotten");
}

export async function updateMemory(
  id: string,
  userId: string,
  patch: Partial<
    Pick<MemoryRecord, "content" | "status" | "importance" | "confidence">
  >,
) {
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<
    Pick<MemoryRecord, "content" | "status" | "importance" | "confidence">
  >;
  if (!databaseEnabled) {
    const memory = platform.memories.find(
      (item) => item.id === id && item.userId === userId,
    );
    if (!memory) return null;
    if (memory.status === "forgotten") {
      if (!isIdempotentForgottenMemoryPatch(cleanPatch))
        throw new Error("MEMORY_FORGOTTEN_IS_TERMINAL");
      return memory;
    }
    const priorStatus = memory.status;
    Object.assign(memory, cleanPatch, { updatedAt: new Date().toISOString() });
    if (cleanPatch.status === "forgotten")
      forgetMemoryContentInMemory(memory, memory.updatedAt);
    if (cleanPatch.status && cleanPatch.status !== priorStatus) {
      const targetSourceStatus =
        cleanPatch.status === "forgotten"
          ? "revoked"
          : cleanPatch.status === "active"
            ? "active"
            : "suspended";
      const affectedEvidenceIds = new Set<string>();
      for (const source of platform.relationshipEvidenceSources.filter(
        (item) => item.memoryId === memory.id,
      )) {
        if (targetSourceStatus === "active") {
          if (source.status !== "suspended") continue;
        } else if (source.status === "revoked") {
          continue;
        }
        source.status = targetSourceStatus;
        source.updatedAt = memory.updatedAt;
        affectedEvidenceIds.add(source.evidenceId);
      }
      const affectedRelationships = new Set<string>();
      for (const evidence of platform.relationshipEvidence.filter((item) =>
        affectedEvidenceIds.has(item.id),
      )) {
        affectedRelationships.add(
          `${evidence.userId}\u0000${evidence.characterId}`,
        );
        if (
          evidence.status !== "active" &&
          evidence.status !== "suspended"
        )
          continue;
        const required = platform.relationshipEvidenceSources.filter(
          (source) =>
            source.evidenceId === evidence.id &&
            source.dependencyRole === "required_support",
        );
        const nextStatus = required.some(
          (source) => source.status === "revoked",
        )
          ? "revoked"
          : required.some((source) => source.status === "suspended")
            ? "suspended"
            : evidence.status === "suspended"
              ? "active"
              : evidence.status;
        if (nextStatus !== evidence.status) {
          evidence.status = nextStatus;
          evidence.updatedAt = memory.updatedAt;
        }
      }
      for (const key of affectedRelationships) {
        const [ownerId, characterId] = key.split("\u0000");
        const state = platform.relationships.find(
          (item) =>
            item.userId === ownerId && item.characterId === characterId,
        );
        if (!state) continue;
        state.evidenceRevision += 1;
        state.revision += 1;
        state.updatedAt = memory.updatedAt;
      }
    }
    persist();
    return memory;
  }
  return transaction(async (client) => {
    const identity = await client.query(
      "SELECT character_id FROM memories WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    if (!identity.rows[0]) return null;
    const relationshipCharacterId = identity.rows[0].character_id as
      | string
      | null;
    if (relationshipCharacterId)
      await client.query(
        `SELECT 1 FROM user_character_relationships
         WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
        [userId, relationshipCharacterId],
      );
    const current = await client.query(
      "SELECT * FROM memories WHERE id=$1 AND user_id=$2 FOR UPDATE",
      [id, userId],
    );
    if (!current.rows[0]) return null;
    const currentMemory = asMemory(current.rows[0]);
    if (currentMemory.status === "forgotten") {
      if (!isIdempotentForgottenMemoryPatch(cleanPatch))
        throw new Error("MEMORY_FORGOTTEN_IS_TERMINAL");
      return currentMemory;
    }
    const next = {
      ...currentMemory,
      ...cleanPatch,
      ...(cleanPatch.status === "forgotten"
        ? {
            content: "[已忘记]",
            confidence: 0,
            importance: 0,
          }
        : {}),
    };
    await client.query(
      `UPDATE memories
       SET content=$1,status=$2,importance=$3,confidence=$4,
           embedding=CASE WHEN $2='forgotten' THEN NULL ELSE embedding END,
           recall_count=CASE WHEN $2='forgotten' THEN 0 ELSE recall_count END,
           last_recalled_at=CASE WHEN $2='forgotten' THEN NULL ELSE last_recalled_at END,
           updated_at=now()
       WHERE id=$5 AND user_id=$6`,
      [next.content, next.status, next.importance, next.confidence, id, userId],
    );
    if (cleanPatch.status === "forgotten")
      await client.query("DELETE FROM memory_sources WHERE memory_id=$1", [id]);
    if (cleanPatch.status && cleanPatch.status !== currentMemory.status) {
      const targetSourceStatus =
        cleanPatch.status === "forgotten"
          ? "revoked"
          : cleanPatch.status === "active"
            ? "active"
            : "suspended";
      const sourceResult =
        targetSourceStatus === "active"
          ? await client.query(
              `UPDATE relationship_evidence_sources
               SET status='active',updated_at=now()
               WHERE memory_id=$1 AND status='suspended'
               RETURNING evidence_id`,
              [id],
            )
          : await client.query(
              `UPDATE relationship_evidence_sources
               SET status=$2,updated_at=now()
               WHERE memory_id=$1 AND status<>'revoked'
               RETURNING evidence_id`,
              [id, targetSourceStatus],
            );
      const evidenceIds = [
        ...new Set(sourceResult.rows.map((row) => String(row.evidence_id))),
      ];
      if (evidenceIds.length > 0) {
        await client.query(
          `UPDATE relationship_evidence e
           SET status=CASE
             WHEN EXISTS (
               SELECT 1 FROM relationship_evidence_sources s
               WHERE s.evidence_id=e.id AND s.dependency_role='required_support'
                 AND s.status='revoked'
             ) THEN 'revoked'
             WHEN e.status<>'revoked' AND EXISTS (
               SELECT 1 FROM relationship_evidence_sources s
               WHERE s.evidence_id=e.id AND s.dependency_role='required_support'
                 AND s.status='suspended'
             ) THEN 'suspended'
             WHEN e.status='suspended' AND NOT EXISTS (
               SELECT 1 FROM relationship_evidence_sources s
               WHERE s.evidence_id=e.id AND s.dependency_role='required_support'
                 AND s.status<>'active'
             ) THEN 'active'
             ELSE e.status END,
             updated_at=now()
           WHERE e.id=ANY($1::uuid[])
             AND e.status IN ('active','suspended')`,
          [evidenceIds],
        );
        await client.query(
          `UPDATE user_character_relationships r
           SET evidence_revision=evidence_revision+1,
               revision=revision+1,updated_at=now()
           WHERE EXISTS (
             SELECT 1 FROM relationship_evidence e
             WHERE e.id=ANY($1::uuid[]) AND e.user_id=r.user_id
               AND e.character_id=r.character_id
           )`,
          [evidenceIds],
        );
      }
    }
    const result = await client.query(
      `${memorySelect} WHERE m.id=$1 AND m.user_id=$2 GROUP BY m.id`,
      [id, userId],
    );
    return result.rows[0] ? asMemory(result.rows[0]) : null;
  });
}
export async function recallMemory(memory: MemoryRecord) {
  if (!databaseEnabled) {
    const current = platform.memories.find(
      (item) => item.id === memory.id && item.userId === memory.userId,
    );
    if (!current || current.status !== "active") return;
    current.recallCount++;
    current.lastRecalledAt = new Date().toISOString();
    current.updatedAt = current.lastRecalledAt;
    persist();
    return;
  }
  await dbQuery(
    "UPDATE memories SET recall_count=recall_count+1,last_recalled_at=now(),updated_at=now() WHERE id=$1 AND status='active'",
    [memory.id],
  );
}

const masterySelect = `SELECT m.*,coalesce(array_agg(e.message_id::text) FILTER (WHERE e.message_id IS NOT NULL),'{}') AS evidence_message_ids FROM mastery_topics m LEFT JOIN mastery_evidence e ON e.mastery_id=m.id`;
export async function listMastery(userId: string) {
  if (!databaseEnabled)
    return platform.mastery.filter((record) => record.userId === userId);
  const result = await dbQuery(
    `${masterySelect} WHERE m.user_id=$1 GROUP BY m.id ORDER BY m.updated_at DESC`,
    [userId],
  );
  return result.rows.map(asMastery);
}
export async function exposeTopic(
  userId: string,
  topicId: string,
  messageIds: string[],
) {
  if (!databaseEnabled) {
    let record = platform.mastery.find(
      (item) => item.userId === userId && item.topicId === topicId,
    );
    const now = new Date().toISOString();
    if (!record) {
      record = {
        id: randomUUID(),
        userId,
        topicId,
        level: "exposed",
        confidence: 0.25,
        evidenceMessageIds: messageIds,
        lastPracticedAt: now,
        updatedAt: now,
      };
      platform.mastery.push(record);
    } else {
      record.evidenceMessageIds = [
        ...new Set([...record.evidenceMessageIds, ...messageIds]),
      ];
      record.lastPracticedAt = now;
      record.updatedAt = now;
      if (record.level === "new" || record.level === "decayed")
        record.level = "exposed";
    }
    persist();
    return record;
  }
  return transaction(async (client) => {
    await ensureUser(userId, client);
    const id = randomUUID();
    const row = (
      await client.query(
        "INSERT INTO mastery_topics(id,user_id,topic_id,level,confidence,last_practiced_at,updated_at) VALUES($1,$2,$3,'exposed',.25,now(),now()) ON CONFLICT(user_id,topic_id) DO UPDATE SET level=CASE WHEN mastery_topics.level IN ('new','decayed') THEN 'exposed' ELSE mastery_topics.level END,last_practiced_at=now(),updated_at=now() RETURNING *",
        [id, userId, topicId],
      )
    ).rows[0];
    for (const messageId of messageIds)
      await client.query(
        "INSERT INTO mastery_evidence(mastery_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [row.id, messageId],
      );
    return asMastery(
      (
        await client.query(`${masterySelect} WHERE m.id=$1 GROUP BY m.id`, [
          row.id,
        ])
      ).rows[0],
    );
  });
}
export async function updateMastery(
  id: string,
  userId: string,
  level: MasteryRecord["level"],
) {
  const confidence =
    level === "mastered" ? 0.9 : level === "practicing" ? 0.6 : 0.3;
  if (!databaseEnabled) {
    const record = platform.mastery.find(
      (item) => item.id === id && item.userId === userId,
    );
    if (!record) return null;
    record.level = level;
    record.confidence = confidence;
    record.updatedAt = new Date().toISOString();
    persist();
    return record;
  }
  const result = await dbQuery(
    "UPDATE mastery_topics SET level=$1,confidence=$2,updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING *",
    [level, confidence, id, userId],
  );
  return result.rows[0]
    ? asMastery({ ...result.rows[0], evidence_message_ids: [] })
    : null;
}

const initialOwnedCharacterIds = [
  "li-bai",
  "wu-zetian",
  "leonardo-da-vinci",
  "raphael",
  "albert-einstein",
  "niels-bohr",
  "marie-curie",
  "max-planck",
];
export async function getOrCreateCollection(userId: string) {
  if (!databaseEnabled) {
    let record = platform.collections.find((item) => item.userId === userId);
    if (record) return record;
    record = {
      userId,
      ownedCharacterIds: [...initialOwnedCharacterIds],
      stars: 60,
      fragments: 20,
      firstFreeEligible: false,
      firstFreeUsed: false,
      revision: 1,
      updatedAt: new Date().toISOString(),
    };
    platform.collections.push(record);
    persist();
    return record;
  }
  await ensureUser(userId);
  const result = await dbQuery(
    "INSERT INTO user_collections(user_id,owned_character_ids) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING *",
    [userId, JSON.stringify(initialOwnedCharacterIds)],
  );
  return asCollection(result.rows[0]);
}
export async function saveCollection(record: CollectionRecord) {
  if (!databaseEnabled) {
    persist();
    return record;
  }
  const result = await dbQuery(
    "UPDATE user_collections SET owned_character_ids=$1,stars=$2,fragments=$3,first_free_eligible=$4,first_free_used=$5,revision=$6,updated_at=$7 WHERE user_id=$8 RETURNING *",
    [
      JSON.stringify(record.ownedCharacterIds),
      record.stars,
      record.fragments,
      record.firstFreeEligible,
      record.firstFreeUsed,
      record.revision,
      record.updatedAt,
      record.userId,
    ],
  );
  return asCollection(result.rows[0]);
}
export async function findLearningEvent(
  userId: string,
  idempotencyKey: string,
) {
  if (!databaseEnabled)
    return (
      platform.learningEvents.find(
        (item) =>
          item.userId === userId && item.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  const result = await dbQuery(
    "SELECT * FROM learning_events WHERE user_id=$1 AND idempotency_key=$2",
    [userId, idempotencyKey],
  );
  return result.rows[0] ? asLearningEvent(result.rows[0]) : null;
}
export async function findCharacterLearningEvent(
  userId: string,
  characterId: string,
  type: LearningEventRecord["type"],
) {
  if (!databaseEnabled)
    return (
      platform.learningEvents.find(
        (item) =>
          item.userId === userId &&
          item.characterId === characterId &&
          item.type === type,
      ) ?? null
    );
  const result = await dbQuery(
    "SELECT * FROM learning_events WHERE user_id=$1 AND character_id=$2 AND type=$3 LIMIT 1",
    [userId, characterId, type],
  );
  return result.rows[0] ? asLearningEvent(result.rows[0]) : null;
}
export async function addLearningEvent(event: LearningEventRecord) {
  if (!databaseEnabled) {
    platform.learningEvents.push(event);
    persist();
    return event;
  }
  await dbQuery(
    "INSERT INTO learning_events(id,user_id,character_id,period_id,type,idempotency_key,reward_stars,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,idempotency_key) DO NOTHING",
    [
      event.id,
      event.userId,
      event.characterId,
      event.periodId,
      event.type,
      event.idempotencyKey,
      event.rewardStars,
      event.createdAt,
    ],
  );
  return event;
}
export async function findDraw(userId: string, idempotencyKey: string) {
  if (!databaseEnabled)
    return (
      platform.draws.find(
        (item) =>
          item.userId === userId && item.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  const result = await dbQuery(
    "SELECT * FROM character_draws WHERE user_id=$1 AND idempotency_key=$2",
    [userId, idempotencyKey],
  );
  return result.rows[0] ? asDraw(result.rows[0]) : null;
}
export async function addDraw(draw: DrawRecord) {
  if (!databaseEnabled) {
    platform.draws.push(draw);
    persist();
    return draw;
  }
  await dbQuery(
    "INSERT INTO character_draws(id,user_id,period_id,idempotency_key,cost_stars,result_character_id,duplicate,fragment_reward,status,created_at,revealed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(user_id,idempotency_key) DO NOTHING",
    [
      draw.id,
      draw.userId,
      draw.periodId,
      draw.idempotencyKey,
      draw.costStars,
      draw.resultCharacterId,
      draw.duplicate,
      draw.fragmentReward,
      draw.status,
      draw.createdAt,
      draw.revealedAt ?? null,
    ],
  );
  return draw;
}
export async function getDraw(id: string, userId: string) {
  if (!databaseEnabled)
    return (
      platform.draws.find((item) => item.id === id && item.userId === userId) ??
      null
    );
  const result = await dbQuery(
    "SELECT * FROM character_draws WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  return result.rows[0] ? asDraw(result.rows[0]) : null;
}
export async function latestCommittedDraw(userId: string) {
  if (!databaseEnabled)
    return (
      platform.draws
        .filter((item) => item.userId === userId && item.status === "committed")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  const result = await dbQuery(
    "SELECT * FROM character_draws WHERE user_id=$1 AND status='committed' ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return result.rows[0] ? asDraw(result.rows[0]) : null;
}
export async function revealStoredDraw(id: string, userId: string) {
  if (!databaseEnabled) {
    const draw = platform.draws.find(
      (item) => item.id === id && item.userId === userId,
    );
    if (draw && draw.status === "committed") {
      draw.status = "revealed";
      draw.revealedAt = new Date().toISOString();
      persist();
    }
    return draw ?? null;
  }
  const result = await dbQuery(
    "UPDATE character_draws SET status='revealed',revealed_at=coalesce(revealed_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *",
    [id, userId],
  );
  return result.rows[0] ? asDraw(result.rows[0]) : null;
}

export async function createTask(task: AgentTask) {
  if (!databaseEnabled) {
    platform.tasks.push(task);
    persist();
    return task;
  }
  await ensureUser(task.createdBy);
  await dbQuery(
    "INSERT INTO agent_tasks(id,user_id,type,status,input,plan,current_step,artifact_ids,provider,model,attempt,consent_id,resume_token,error_code,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
    [
      task.id,
      task.createdBy,
      task.type,
      task.status,
      JSON.stringify(task.input),
      JSON.stringify(task.plan),
      task.currentStep,
      JSON.stringify(task.artifactIds),
      task.provider,
      task.model,
      task.attempt,
      task.consentId ?? null,
      task.resumeToken,
      task.errorCode ?? null,
      task.createdAt,
      task.updatedAt,
    ],
  );
  return task;
}
export async function updateTask(task: AgentTask) {
  task.updatedAt = new Date().toISOString();
  if (!databaseEnabled) {
    persist();
    return task;
  }
  await dbQuery(
    "UPDATE agent_tasks SET status=$1,plan=$2,current_step=$3,artifact_ids=$4,attempt=$5,consent_id=$6,resume_token=$7,error_code=$8,updated_at=$9 WHERE id=$10",
    [
      task.status,
      JSON.stringify(task.plan),
      task.currentStep,
      JSON.stringify(task.artifactIds),
      task.attempt,
      task.consentId ?? null,
      task.resumeToken,
      task.errorCode ?? null,
      task.updatedAt,
      task.id,
    ],
  );
  return task;
}
export async function getTask(id: string, userId: string) {
  if (!databaseEnabled)
    return (
      platform.tasks.find(
        (task) => task.id === id && task.createdBy === userId,
      ) ?? null
    );
  const result = await dbQuery(
    "SELECT * FROM agent_tasks WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  return result.rows[0] ? asTask(result.rows[0]) : null;
}
export async function listTasks(userId: string) {
  if (!databaseEnabled)
    return platform.tasks
      .filter((task) => task.createdBy === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const result = await dbQuery(
    "SELECT * FROM agent_tasks WHERE user_id=$1 ORDER BY updated_at DESC",
    [userId],
  );
  return result.rows.map(asTask);
}
export async function addArtifact(artifact: AgentArtifact) {
  if (!databaseEnabled) {
    platform.artifacts.push(artifact);
    persist();
    return artifact;
  }
  await dbQuery(
    "INSERT INTO agent_artifacts(id,task_id,kind,name,content_type,data,storage_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      artifact.id,
      artifact.taskId,
      artifact.kind,
      artifact.name,
      artifact.contentType,
      artifact.data === undefined ? null : JSON.stringify(artifact.data),
      artifact.storageKey ?? null,
      artifact.createdAt,
    ],
  );
  return artifact;
}
export async function getArtifact(id: string, userId: string) {
  if (!databaseEnabled) {
    const artifact = platform.artifacts.find((item) => item.id === id);
    if (!artifact) return null;
    return platform.tasks.some(
      (task) => task.id === artifact.taskId && task.createdBy === userId,
    )
      ? artifact
      : null;
  }
  const result = await dbQuery(
    "SELECT a.* FROM agent_artifacts a JOIN agent_tasks t ON t.id=a.task_id WHERE a.id=$1 AND t.user_id=$2",
    [id, userId],
  );
  return result.rows[0] ? asArtifact(result.rows[0]) : null;
}

function asHallVisit(row: Record<string, any>): HallVisitState {
  return {
    userId: row.user_id,
    hallId: row.hall_id,
    sceneVersion: row.scene_version,
    lastStationId: row.last_station_id,
    viewedObjectIds: row.viewed_object_ids ?? [],
    visitedCharacterIds: row.visited_character_ids ?? [],
    completedStationIds: row.completed_station_ids ?? [],
    startedAt: iso(row.started_at)!,
    updatedAt: iso(row.updated_at)!,
    completedAt: iso(row.completed_at),
    revision: row.revision,
  };
}

export async function getHallVisit(userId: string, hallId: string) {
  if (!databaseEnabled) return platform.hallVisits.find((item) => item.userId === userId && item.hallId === hallId) ?? null;
  const result = await dbQuery("SELECT * FROM hall_visit_states WHERE user_id=$1 AND hall_id=$2", [userId, hallId]);
  return result.rows[0] ? asHallVisit(result.rows[0]) : null;
}

export async function saveHallVisit(input: Omit<HallVisitState, "userId" | "startedAt" | "updatedAt" | "revision"> & { userId: string; expectedRevision?: number }) {
  const now = new Date().toISOString();
  if (!databaseEnabled) {
    const current = platform.hallVisits.find((item) => item.userId === input.userId && item.hallId === input.hallId);
    if (current && input.expectedRevision !== undefined && input.expectedRevision !== current.revision) return { state: current, conflict: true };
    const state: HallVisitState = {
      userId: input.userId,
      hallId: input.hallId,
      sceneVersion: input.sceneVersion,
      lastStationId: input.lastStationId,
      viewedObjectIds: [...new Set([...(current?.viewedObjectIds ?? []), ...input.viewedObjectIds])],
      visitedCharacterIds: [...new Set([...(current?.visitedCharacterIds ?? []), ...input.visitedCharacterIds])],
      completedStationIds: [...new Set([...(current?.completedStationIds ?? []), ...input.completedStationIds])],
      startedAt: current?.startedAt ?? now,
      updatedAt: now,
      completedAt: input.completedAt ?? current?.completedAt,
      revision: (current?.revision ?? 0) + 1,
    };
    if (current) platform.hallVisits[platform.hallVisits.indexOf(current)] = state; else platform.hallVisits.push(state);
    persist();
    return { state, conflict: false };
  }
  await ensureUser(input.userId);
  const current = await getHallVisit(input.userId, input.hallId);
  if (current && input.expectedRevision !== undefined && input.expectedRevision !== current.revision) return { state: current, conflict: true };
  const viewed = [...new Set([...(current?.viewedObjectIds ?? []), ...input.viewedObjectIds])];
  const visited = [...new Set([...(current?.visitedCharacterIds ?? []), ...input.visitedCharacterIds])];
  const completed = [...new Set([...(current?.completedStationIds ?? []), ...input.completedStationIds])];
  const result = await dbQuery(
    `INSERT INTO hall_visit_states(user_id,hall_id,scene_version,last_station_id,viewed_object_ids,visited_character_ids,completed_station_ids,started_at,updated_at,completed_at,revision)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
     ON CONFLICT(user_id,hall_id) DO UPDATE SET scene_version=excluded.scene_version,last_station_id=excluded.last_station_id,viewed_object_ids=excluded.viewed_object_ids,visited_character_ids=excluded.visited_character_ids,completed_station_ids=excluded.completed_station_ids,updated_at=excluded.updated_at,completed_at=COALESCE(excluded.completed_at,hall_visit_states.completed_at),revision=hall_visit_states.revision+1 RETURNING *`,
    [input.userId, input.hallId, input.sceneVersion, input.lastStationId, JSON.stringify(viewed), JSON.stringify(visited), JSON.stringify(completed), current?.startedAt ?? now, now, input.completedAt ?? null],
  );
  return { state: asHallVisit(result.rows[0]), conflict: false };
}

export async function ensureRelationshipState(
  userId: string,
  characterId: string,
  policyVersion = defaultRelationshipPolicyVersion,
) {
  if (!databaseEnabled) {
    const result = ensureRelationshipInMemory(
      userId,
      characterId,
      policyVersion,
    );
    if (result.created) persist();
    return result.state;
  }
  return transaction((client) =>
    ensureRelationshipWithClient(userId, characterId, policyVersion, client),
  );
}

export async function getRelationshipState(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled)
    return (
      platform.relationships.find(
        (item) => item.userId === userId && item.characterId === characterId,
      ) ?? null
    );
  const result = await dbQuery(
    `SELECT * FROM user_character_relationships
     WHERE user_id=$1 AND character_id=$2`,
    [userId, characterId],
  );
  return result.rows[0] ? asRelationshipState(result.rows[0]) : null;
}

export async function getRelationshipPublicState(
  userId: string,
  characterId: string,
): Promise<RelationshipPublicState | null> {
  if (!databaseEnabled) {
    const state = platform.relationships.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    if (!state) return null;
    const preference = platform.relationshipPreferences.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    const transition = platform.relationshipTransitions
      .filter(
        (item) =>
          item.userId === userId &&
          item.characterId === characterId &&
          item.feedbackStatus === "pending",
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? a.id.localeCompare(b.id)
          : a.createdAt.localeCompare(b.createdAt),
      )[0];
    return publicRelationshipFromRecords(state, preference, transition);
  }
  const result = await dbQuery(
    `SELECT r.*,
       p.preferred_address,p.consent_status,p.consent_version,
       t.id AS transition_id,t.from_stage,t.to_stage,t.feedback_text,
       t.after_message_id,t.created_at AS transition_created_at
     FROM user_character_relationships r
     LEFT JOIN relationship_preferences p
       ON p.user_id=r.user_id AND p.character_id=r.character_id
     LEFT JOIN LATERAL (
       SELECT * FROM relationship_stage_transitions
       WHERE user_id=r.user_id AND character_id=r.character_id
         AND feedback_status='pending'
       ORDER BY created_at,id LIMIT 1
     ) t ON true
     WHERE r.user_id=$1 AND r.character_id=$2`,
    [userId, characterId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const state = asRelationshipState(row);
  const preference = row.preferred_address
    ? ({
        userId,
        characterId,
        preferredAddress: row.preferred_address,
        consentStatus: row.consent_status,
        consentVersion: row.consent_version,
      } as RelationshipPreferenceRecord)
    : undefined;
  const transition = row.transition_id
    ? ({
        id: row.transition_id,
        fromStage: row.from_stage,
        toStage: row.to_stage,
        feedbackText: row.feedback_text,
        afterMessageId: row.after_message_id,
        feedbackStatus: "pending",
        createdAt: iso(row.transition_created_at)!,
      } as RelationshipTransitionRecord)
    : undefined;
  return publicRelationshipFromRecords(state, preference, transition);
}

export async function listRelationshipPublicStates(userId: string) {
  if (!databaseEnabled) {
    const results = await Promise.all(
      platform.relationships
        .filter((item) => item.userId === userId)
        .map((item) => getRelationshipPublicState(userId, item.characterId)),
    );
    return results.filter(
      (item): item is RelationshipPublicState => item !== null,
    );
  }
  const result = await dbQuery(
    "SELECT character_id FROM user_character_relationships WHERE user_id=$1 ORDER BY updated_at DESC,character_id",
    [userId],
  );
  const states = await Promise.all(
    result.rows.map((row) =>
      getRelationshipPublicState(userId, row.character_id),
    ),
  );
  return states.filter(
    (item): item is RelationshipPublicState => item !== null,
  );
}

export async function setRelationshipStatus(
  userId: string,
  characterId: string,
  status: RelationshipStatus,
  expectedRevision?: number,
) {
  if (!databaseEnabled) {
    const { state, created } = ensureRelationshipInMemory(userId, characterId);
    if (
      expectedRevision !== undefined &&
      expectedRevision !== state.revision
    )
      throw new Error("RELATIONSHIP_REVISION_CONFLICT");
    if (state.status === status) {
      if (created) persist();
      return state;
    }
    const now = new Date().toISOString();
    state.status = status;
    state.pausedAt = status === "paused" ? now : undefined;
    state.recordingRevision += 1;
    state.revision += 1;
    state.updatedAt = now;
    persist();
    return state;
  }
  return transaction(async (client) => {
    await ensureRelationshipWithClient(
      userId,
      characterId,
      defaultRelationshipPolicyVersion,
      client,
    );
    const currentResult = await client.query(
      "SELECT * FROM user_character_relationships WHERE user_id=$1 AND character_id=$2 FOR UPDATE",
      [userId, characterId],
    );
    const current = asRelationshipState(currentResult.rows[0]);
    if (
      expectedRevision !== undefined &&
      expectedRevision !== current.revision
    )
      throw new Error("RELATIONSHIP_REVISION_CONFLICT");
    if (current.status === status) return current;
    const result = await client.query(
      `UPDATE user_character_relationships
       SET status=$3,paused_at=CASE WHEN $3='paused' THEN now() ELSE NULL END,
           recording_revision=recording_revision+1,
           revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2 RETURNING *`,
      [userId, characterId, status],
    );
    return asRelationshipState(result.rows[0]);
  });
}

export async function grantPreferredAddress(
  userId: string,
  characterId: string,
  preferredAddress: string,
) {
  const value = assertPreferredAddress(preferredAddress);
  if (!databaseEnabled) {
    const { state } = ensureRelationshipInMemory(userId, characterId);
    if (
      relationshipStageRank(state.stage) <
      relationshipStageRank("young_friend")
    )
      throw new Error("RELATIONSHIP_PREFERRED_ADDRESS_NOT_ELIGIBLE");
    const current = platform.relationshipPreferences.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    if (
      current?.consentStatus === "granted" &&
      current.preferredAddress === value
    )
      return current;
    const now = new Date().toISOString();
    if (current) {
      current.preferredAddress = value;
      current.consentStatus = "granted";
      current.consentVersion += 1;
      current.grantedAt = now;
      current.revokedAt = undefined;
      current.revision += 1;
      current.updatedAt = now;
      state.revision += 1;
      state.updatedAt = now;
      persist();
      return current;
    }
    const record: RelationshipPreferenceRecord = {
      userId,
      characterId,
      preferredAddress: value,
      consentStatus: "granted",
      consentVersion: 1,
      grantedAt: now,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    platform.relationshipPreferences.push(record);
    state.revision += 1;
    state.updatedAt = now;
    persist();
    return record;
  }
  return transaction(async (client) => {
    await ensureRelationshipWithClient(
      userId,
      characterId,
      defaultRelationshipPolicyVersion,
      client,
    );
    const relationshipResult = await client.query(
      `SELECT stage FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [userId, characterId],
    );
    if (
      relationshipStageRank(relationshipResult.rows[0].stage) <
      relationshipStageRank("young_friend")
    )
      throw new Error("RELATIONSHIP_PREFERRED_ADDRESS_NOT_ELIGIBLE");
    const current = await client.query(
      "SELECT * FROM relationship_preferences WHERE user_id=$1 AND character_id=$2 FOR UPDATE",
      [userId, characterId],
    );
    if (
      current.rows[0]?.consent_status === "granted" &&
      current.rows[0]?.preferred_address === value
    )
      return asRelationshipPreference(current.rows[0]);
    const result = await client.query(
      `INSERT INTO relationship_preferences(
         user_id,character_id,preferred_address,consent_status,consent_version,
         granted_at,revision,created_at,updated_at
       ) VALUES($1,$2,$3,'granted',1,now(),1,now(),now())
       ON CONFLICT(user_id,character_id) DO UPDATE SET
         preferred_address=excluded.preferred_address,consent_status='granted',
         consent_version=relationship_preferences.consent_version+1,
         granted_at=now(),revoked_at=NULL,
         revision=relationship_preferences.revision+1,updated_at=now()
       RETURNING *`,
      [userId, characterId, value],
    );
    await client.query(
      `UPDATE user_character_relationships
       SET revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2`,
      [userId, characterId],
    );
    return asRelationshipPreference(result.rows[0]);
  });
}

export async function revokePreferredAddress(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled) {
    const current = platform.relationshipPreferences.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    if (!current || current.consentStatus === "revoked") return current ?? null;
    const now = new Date().toISOString();
    current.consentStatus = "revoked";
    current.consentVersion += 1;
    current.revokedAt = now;
    current.revision += 1;
    current.updatedAt = now;
    const state = platform.relationships.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    if (state) {
      state.revision += 1;
      state.updatedAt = now;
    }
    persist();
    return current;
  }
  return transaction(async (client) => {
    const relationship = await client.query(
      `SELECT 1 FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [userId, characterId],
    );
    if (!relationship.rows[0]) return null;
    const result = await client.query(
      `UPDATE relationship_preferences
       SET consent_status='revoked',consent_version=consent_version+1,
           revoked_at=now(),revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2 AND consent_status='granted'
       RETURNING *`,
      [userId, characterId],
    );
    if (result.rows[0]) {
      await client.query(
        `UPDATE user_character_relationships
         SET revision=revision+1,updated_at=now()
         WHERE user_id=$1 AND character_id=$2`,
        [userId, characterId],
      );
      return asRelationshipPreference(result.rows[0]);
    }
    const current = await client.query(
      "SELECT * FROM relationship_preferences WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    return current.rows[0] ? asRelationshipPreference(current.rows[0]) : null;
  });
}

function assertEvidenceSourceShape(
  sources: RelationshipEvidenceSourceInput[],
) {
  const primary = sources.filter(
    (source) => source.dependencyRole === "primary",
  );
  if (
    primary.length !== 1 ||
    primary[0].sourceType !== "message" ||
    primary[0].sourceRole !== "user"
  )
    throw new Error("RELATIONSHIP_EVIDENCE_PRIMARY_USER_MESSAGE_REQUIRED");
  for (const source of sources) {
    const identifiers = [
      source.messageId,
      source.memoryId,
      source.learningEventId,
    ].filter(Boolean);
    if (
      identifiers.length !== 1 ||
      (source.sourceType === "message" && !source.messageId) ||
      (source.sourceType === "memory" && !source.memoryId) ||
      (source.sourceType === "learning_event" && !source.learningEventId)
    )
      throw new Error("INVALID_RELATIONSHIP_EVIDENCE_SOURCE");
  }
}

function assertEvidenceSourcesOwnedInMemory(
  userId: string,
  characterId: string,
  sources: RelationshipEvidenceSourceInput[],
) {
  for (const source of sources) {
    if (source.sourceType === "message") {
      const message = platform.messages.find(
        (item) => item.id === source.messageId,
      );
      const thread = message
        ? platform.threads.find((item) => item.id === message.threadId)
        : undefined;
      if (
        !message ||
        !thread ||
        thread.userId !== userId ||
        thread.characterId !== characterId ||
        (source.dependencyRole === "primary" && message.role !== "user") ||
        source.sourceRole !==
          (message.role === "user" ? "user" : message.role === "character" ? "character" : "system")
      )
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
    } else if (source.sourceType === "memory") {
      const memory = platform.memories.find(
        (item) => item.id === source.memoryId,
      );
      if (
        !memory ||
        memory.userId !== userId ||
        memory.characterId !== characterId
      )
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
      const expectedStatus =
        memory.status === "forgotten"
          ? "revoked"
          : memory.status === "active"
            ? "active"
            : "suspended";
      if (
        source.status !== expectedStatus ||
        (source.dependencyRole === "required_support" &&
          memory.status !== "active")
      )
        throw new Error("RELATIONSHIP_EVIDENCE_MEMORY_INACTIVE");
    } else {
      const event = platform.learningEvents.find(
        (item) => item.id === source.learningEventId,
      );
      if (
        !event ||
        event.userId !== userId ||
        event.characterId !== characterId
      )
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
    }
  }
}

async function assertEvidenceSourcesOwnedWithClient(
  userId: string,
  characterId: string,
  sources: RelationshipEvidenceSourceInput[],
  client: PoolClient,
) {
  for (const source of sources) {
    if (source.sourceType === "message") {
      const result = await client.query(
        `SELECT m.role FROM messages m
         JOIN character_threads t ON t.id=m.thread_id
         WHERE m.id=$1 AND t.user_id=$2 AND t.character_id=$3`,
        [source.messageId, userId, characterId],
      );
      const role = result.rows[0]?.role;
      const normalizedRole =
        role === "user" ? "user" : role === "character" ? "character" : "system";
      if (
        !role ||
        normalizedRole !== source.sourceRole ||
        (source.dependencyRole === "primary" && role !== "user")
      )
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
    } else if (source.sourceType === "memory") {
      const result = await client.query(
        `SELECT status FROM memories
         WHERE id=$1 AND user_id=$2 AND character_id=$3 FOR SHARE`,
        [source.memoryId, userId, characterId],
      );
      if (!result.rows[0])
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
      const memoryStatus = String(result.rows[0].status);
      const expectedStatus =
        memoryStatus === "forgotten"
          ? "revoked"
          : memoryStatus === "active"
            ? "active"
            : "suspended";
      if (
        source.status !== expectedStatus ||
        (source.dependencyRole === "required_support" &&
          memoryStatus !== "active")
      )
        throw new Error("RELATIONSHIP_EVIDENCE_MEMORY_INACTIVE");
    } else {
      const result = await client.query(
        "SELECT 1 FROM learning_events WHERE id=$1 AND user_id=$2 AND character_id=$3",
        [source.learningEventId, userId, characterId],
      );
      if (!result.rows[0])
        throw new Error("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
    }
  }
}

export async function storeRelationshipEvidence(
  input: StoreRelationshipEvidenceInput,
  sources: RelationshipEvidenceSourceInput[],
) {
  const {
    expectedRecordingRevision,
    sourceMessageCreatedAt,
    ...evidenceInput
  } = input;
  assertEvidenceSourceShape(sources);
  if (!databaseEnabled) {
    let state: RelationshipStateRecord;
    if (expectedRecordingRevision !== undefined) {
      const current = platform.relationships.find(
        (item) =>
          item.userId === input.userId &&
          item.characterId === input.characterId,
      );
      if (
        !current ||
        current.status !== "active" ||
        current.recordingRevision !== expectedRecordingRevision ||
        (current.resetCutoffAt &&
          sourceMessageCreatedAt &&
          current.resetCutoffAt >= sourceMessageCreatedAt)
      )
        throw new Error("RELATIONSHIP_RECORDING_INVALIDATED");
      state = current;
    } else {
      state = ensureRelationshipInMemory(
        input.userId,
        input.characterId,
        input.policyMappingVersion,
      ).state;
    }
    assertEvidenceSourcesOwnedInMemory(
      input.userId,
      input.characterId,
      sources,
    );
    const duplicate = platform.relationshipEvidence.find(
      (item) =>
        item.userId === input.userId &&
        item.characterId === input.characterId &&
        (item.logicalKey === input.logicalKey ||
          item.normalizedFingerprint === input.normalizedFingerprint),
    );
    if (duplicate)
      return {
        evidence: duplicate,
        sources: platform.relationshipEvidenceSources.filter(
          (item) => item.evidenceId === duplicate.id,
        ),
        created: false,
      };
    const now = new Date().toISOString();
    const evidence: RelationshipEvidenceRecord = {
      ...evidenceInput,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const records = sources.map<RelationshipEvidenceSourceRecord>((source) => ({
      ...source,
      id: randomUUID(),
      evidenceId: evidence.id,
      createdAt: now,
      updatedAt: now,
    }));
    platform.relationshipEvidence.push(evidence);
    platform.relationshipEvidenceSources.push(...records);
    state.evidenceRevision += 1;
    state.revision += 1;
    state.updatedAt = now;
    persist();
    return { evidence, sources: records, created: true };
  }
  return transaction(async (client) => {
    let state: RelationshipStateRecord;
    if (expectedRecordingRevision !== undefined) {
      const currentResult = await client.query(
        `SELECT * FROM user_character_relationships
         WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
        [input.userId, input.characterId],
      );
      if (!currentResult.rows[0])
        throw new Error("RELATIONSHIP_RECORDING_INVALIDATED");
      state = asRelationshipState(currentResult.rows[0]);
      if (
        state.status !== "active" ||
        state.recordingRevision !== expectedRecordingRevision ||
        (state.resetCutoffAt &&
          sourceMessageCreatedAt &&
          state.resetCutoffAt >= sourceMessageCreatedAt)
      )
        throw new Error("RELATIONSHIP_RECORDING_INVALIDATED");
    } else {
      state = await ensureRelationshipWithClient(
        input.userId,
        input.characterId,
        input.policyMappingVersion,
        client,
      );
    }
    await assertEvidenceSourcesOwnedWithClient(
      input.userId,
      input.characterId,
      sources,
      client,
    );
    const existing = await client.query(
      `SELECT * FROM relationship_evidence
       WHERE user_id=$1 AND character_id=$2
         AND (logical_key=$3 OR normalized_fingerprint=$4)
       ORDER BY CASE WHEN logical_key=$3 THEN 0 ELSE 1 END,created_at,id
       LIMIT 1`,
      [
        input.userId,
        input.characterId,
        input.logicalKey,
        input.normalizedFingerprint,
      ],
    );
    if (existing.rows[0]) {
      const sourceRows = await client.query(
        "SELECT * FROM relationship_evidence_sources WHERE evidence_id=$1 ORDER BY created_at,id",
        [existing.rows[0].id],
      );
      return {
        evidence: asRelationshipEvidence(existing.rows[0]),
        sources: sourceRows.rows.map(asRelationshipEvidenceSource),
        created: false,
      };
    }
    const evidenceId = randomUUID();
    const result = await client.query(
      `INSERT INTO relationship_evidence(
         id,user_id,character_id,dimension,event_type,quality,confidence,
         episode_key,topic_key,normalized_fingerprint,logical_key,
         sanitized_summary,stance,substantiveness,extractor_model,
         extractor_version,policy_mapping_version,status,
         rejection_reason_code,superseded_by_id
       ) VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
       ) RETURNING *`,
      [
        evidenceId,
        input.userId,
        input.characterId,
        input.dimension,
        input.eventType,
        input.quality,
        input.confidence,
        input.episodeKey,
        input.topicKey,
        input.normalizedFingerprint,
        input.logicalKey,
        input.sanitizedSummary ?? null,
        input.stance ?? null,
        input.substantiveness ?? null,
        input.extractorModel,
        input.extractorVersion,
        input.policyMappingVersion,
        input.status,
        input.rejectionReasonCode ?? null,
        input.supersededById ?? null,
      ],
    );
    const sourceRecords: RelationshipEvidenceSourceRecord[] = [];
    for (const source of sources) {
      const sourceResult = await client.query(
        `INSERT INTO relationship_evidence_sources(
           id,evidence_id,source_type,message_id,memory_id,learning_event_id,
           source_role,dependency_role,status
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          randomUUID(),
          evidenceId,
          source.sourceType,
          source.messageId ?? null,
          source.memoryId ?? null,
          source.learningEventId ?? null,
          source.sourceRole,
          source.dependencyRole,
          source.status,
        ],
      );
      sourceRecords.push(asRelationshipEvidenceSource(sourceResult.rows[0]));
    }
    await client.query(
      `UPDATE user_character_relationships
       SET evidence_revision=evidence_revision+1,revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2`,
      [state.userId, state.characterId],
    );
    return {
      evidence: asRelationshipEvidence(result.rows[0]),
      sources: sourceRecords,
      created: true,
    };
  });
}

export async function listRelationshipEvidence(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled)
    return platform.relationshipEvidence.filter(
      (item) => item.userId === userId && item.characterId === characterId,
    );
  const result = await dbQuery(
    `SELECT * FROM relationship_evidence
     WHERE user_id=$1 AND character_id=$2 ORDER BY created_at,id`,
    [userId, characterId],
  );
  return result.rows.map(asRelationshipEvidence);
}

export async function listRelationshipEvidenceForPrimaryMessage(
  userId: string,
  characterId: string,
  messageId: string,
) {
  if (!databaseEnabled) {
    const evidenceIds = new Set(
      platform.relationshipEvidenceSources
        .filter(
          (source) =>
            source.messageId === messageId &&
            source.dependencyRole === "primary",
        )
        .map((source) => source.evidenceId),
    );
    return platform.relationshipEvidence.filter(
      (evidence) =>
        evidence.userId === userId &&
        evidence.characterId === characterId &&
        evidenceIds.has(evidence.id),
    );
  }
  const result = await dbQuery(
    `SELECT e.* FROM relationship_evidence e
     JOIN relationship_evidence_sources s ON s.evidence_id=e.id
     WHERE e.user_id=$1 AND e.character_id=$2 AND s.message_id=$3
       AND s.dependency_role='primary'
     ORDER BY e.created_at,e.id`,
    [userId, characterId, messageId],
  );
  return result.rows.map(asRelationshipEvidence);
}

export async function listRelationshipEvidenceSources(evidenceId: string) {
  if (!databaseEnabled)
    return platform.relationshipEvidenceSources.filter(
      (item) => item.evidenceId === evidenceId,
    );
  const result = await dbQuery(
    `SELECT s.* FROM relationship_evidence_sources s
     JOIN relationship_evidence e ON e.id=s.evidence_id
     WHERE s.evidence_id=$1 ORDER BY s.created_at,s.id`,
    [evidenceId],
  );
  return result.rows.map(asRelationshipEvidenceSource);
}

export async function recordRelationshipTransition(
  input: RecordRelationshipTransitionInput,
) {
  const {
    expectedRecordingRevision,
    expectedEvidenceRevision,
    ...transitionInput
  } = input;
  assertAdjacentRelationshipTransition(input.fromStage, input.toStage);
  if (!databaseEnabled) {
    const duplicate = platform.relationshipTransitions.find(
      (item) =>
        item.userId === input.userId &&
        item.characterId === input.characterId &&
        item.idempotencyKey === input.idempotencyKey,
    );
    if (duplicate) return duplicate;
    const { state } = ensureRelationshipInMemory(
      input.userId,
      input.characterId,
      input.policyVersion,
    );
    if (state.status !== "active")
      throw new Error("RELATIONSHIP_IS_PAUSED");
    if (
      expectedRecordingRevision !== undefined &&
      state.recordingRevision !== expectedRecordingRevision
    )
      throw new Error("RELATIONSHIP_RECORDING_INVALIDATED");
    if (
      expectedEvidenceRevision !== undefined &&
      state.evidenceRevision !== expectedEvidenceRevision
    )
      throw new Error("RELATIONSHIP_EVIDENCE_REVISION_CONFLICT");
    if (state.stage !== input.fromStage)
      throw new Error("RELATIONSHIP_STAGE_CONFLICT");
    const afterMessage = platform.messages.find(
      (item) => item.id === input.afterMessageId,
    );
    const thread = afterMessage
      ? platform.threads.find((item) => item.id === afterMessage.threadId)
      : undefined;
    if (
      !afterMessage ||
      !thread ||
      thread.userId !== input.userId ||
      thread.characterId !== input.characterId ||
      afterMessage.role !== "character"
    )
      throw new Error("RELATIONSHIP_TRANSITION_MESSAGE_NOT_OWNED");
    const sameStage = platform.relationshipTransitions.find(
      (item) =>
        item.userId === input.userId &&
        item.characterId === input.characterId &&
        item.toStage === input.toStage,
    );
    if (sameStage) return sameStage;
    const now = new Date().toISOString();
    const transition: RelationshipTransitionRecord = {
      ...transitionInput,
      id: randomUUID(),
      feedbackStatus: "pending",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    platform.relationshipTransitions.push(transition);
    state.stage = input.toStage;
    state.policyVersion = input.policyVersion;
    state.evidenceRevision = Math.max(
      state.evidenceRevision,
      input.evidenceRevision,
    );
    state.evaluatedAt = now;
    state.stageChangedAt = now;
    state.revision += 1;
    state.updatedAt = now;
    persist();
    return transition;
  }
  return transaction(async (client) => {
    await ensureRelationshipWithClient(
      input.userId,
      input.characterId,
      input.policyVersion,
      client,
    );
    const currentResult = await client.query(
      `SELECT * FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [input.userId, input.characterId],
    );
    const duplicate = await client.query(
      `SELECT * FROM relationship_stage_transitions
       WHERE user_id=$1 AND character_id=$2 AND idempotency_key=$3`,
      [input.userId, input.characterId, input.idempotencyKey],
    );
    if (duplicate.rows[0])
      return asRelationshipTransition(duplicate.rows[0]);
    const current = asRelationshipState(currentResult.rows[0]);
    if (current.status !== "active")
      throw new Error("RELATIONSHIP_IS_PAUSED");
    if (
      expectedRecordingRevision !== undefined &&
      current.recordingRevision !== expectedRecordingRevision
    )
      throw new Error("RELATIONSHIP_RECORDING_INVALIDATED");
    if (
      expectedEvidenceRevision !== undefined &&
      current.evidenceRevision !== expectedEvidenceRevision
    )
      throw new Error("RELATIONSHIP_EVIDENCE_REVISION_CONFLICT");
    if (current.stage !== input.fromStage)
      throw new Error("RELATIONSHIP_STAGE_CONFLICT");
    const message = await client.query(
      `SELECT 1 FROM messages m
       JOIN character_threads t ON t.id=m.thread_id
       WHERE m.id=$1 AND m.role='character' AND t.user_id=$2 AND t.character_id=$3`,
      [input.afterMessageId, input.userId, input.characterId],
    );
    if (!message.rows[0])
      throw new Error("RELATIONSHIP_TRANSITION_MESSAGE_NOT_OWNED");
    const result = await client.query(
      `INSERT INTO relationship_stage_transitions(
         id,user_id,character_id,from_stage,to_stage,policy_version,
         evidence_revision,evidence_snapshot_hash,trigger_type,feedback_status,
         feedback_text,after_message_id,idempotency_key,revision
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,1)
       ON CONFLICT(user_id,character_id,to_stage) DO NOTHING RETURNING *`,
      [
        randomUUID(),
        input.userId,
        input.characterId,
        input.fromStage,
        input.toStage,
        input.policyVersion,
        input.evidenceRevision,
        input.evidenceSnapshotHash,
        input.triggerType,
        input.feedbackText,
        input.afterMessageId,
        input.idempotencyKey,
      ],
    );
    if (!result.rows[0]) {
      const sameStage = await client.query(
        `SELECT * FROM relationship_stage_transitions
         WHERE user_id=$1 AND character_id=$2 AND to_stage=$3`,
        [input.userId, input.characterId, input.toStage],
      );
      return asRelationshipTransition(sameStage.rows[0]);
    }
    await client.query(
      `UPDATE user_character_relationships
       SET stage=$3,policy_version=$4,
           evidence_revision=greatest(evidence_revision,$5),evaluated_at=now(),
           stage_changed_at=now(),revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2`,
      [
        input.userId,
        input.characterId,
        input.toStage,
        input.policyVersion,
        input.evidenceRevision,
      ],
    );
    return asRelationshipTransition(result.rows[0]);
  });
}

export async function acknowledgeRelationshipTransition(
  userId: string,
  characterId: string,
  transitionId: string,
  feedbackIdempotencyKey: string,
) {
  if (!feedbackIdempotencyKey.trim())
    throw new Error("INVALID_RELATIONSHIP_FEEDBACK_IDEMPOTENCY_KEY");
  if (!databaseEnabled) {
    const transition = platform.relationshipTransitions.find(
      (item) =>
        item.id === transitionId &&
        item.userId === userId &&
        item.characterId === characterId,
    );
    if (!transition) return null;
    if (transition.feedbackStatus === "acknowledged") return transition;
    const existingKey = platform.relationshipTransitions.find(
      (item) =>
        item.userId === userId &&
        item.characterId === characterId &&
        item.feedbackIdempotencyKey === feedbackIdempotencyKey,
    );
    if (existingKey) return existingKey;
    const now = new Date().toISOString();
    transition.feedbackStatus = "acknowledged";
    transition.feedbackIdempotencyKey = feedbackIdempotencyKey;
    transition.feedbackAt = now;
    transition.revision += 1;
    transition.updatedAt = now;
    const state = platform.relationships.find(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    if (state) {
      state.revision += 1;
      state.updatedAt = now;
    }
    persist();
    return transition;
  }
  return transaction(async (client) => {
    const relationship = await client.query(
      `SELECT 1 FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [userId, characterId],
    );
    if (!relationship.rows[0]) return null;
    const current = await client.query(
      `SELECT * FROM relationship_stage_transitions
       WHERE id=$1 AND user_id=$2 AND character_id=$3 FOR UPDATE`,
      [transitionId, userId, characterId],
    );
    if (!current.rows[0]) return null;
    if (current.rows[0].feedback_status === "acknowledged")
      return asRelationshipTransition(current.rows[0]);
    const sameKey = await client.query(
      `SELECT * FROM relationship_stage_transitions
       WHERE user_id=$1 AND character_id=$2 AND feedback_idempotency_key=$3`,
      [userId, characterId, feedbackIdempotencyKey],
    );
    if (sameKey.rows[0]) return asRelationshipTransition(sameKey.rows[0]);
    const result = await client.query(
      `UPDATE relationship_stage_transitions
       SET feedback_status='acknowledged',feedback_idempotency_key=$4,
           feedback_at=now(),revision=revision+1,updated_at=now()
       WHERE id=$1 AND user_id=$2 AND character_id=$3 RETURNING *`,
      [transitionId, userId, characterId, feedbackIdempotencyKey],
    );
    await client.query(
      `UPDATE user_character_relationships
       SET revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2`,
      [userId, characterId],
    );
    return asRelationshipTransition(result.rows[0]);
  });
}

function createRelationshipOutboxRecord(
  input: EnqueueRelationshipOutboxInput,
  now = new Date().toISOString(),
) {
  return {
    id: randomUUID(),
    userId: input.userId,
    characterId: input.characterId,
    aggregateKey:
      input.aggregateKey ??
      relationshipAggregateKey(input.userId, input.characterId),
    eventType: input.eventType,
    payload: input.payload ?? {},
    producerVersion: input.producerVersion,
    idempotencyKey: input.idempotencyKey,
    status: "pending" as const,
    attempt: 0,
    maxAttempts: input.maxAttempts ?? 8,
    availableAt: input.availableAt ?? now,
    createdAt: now,
    updatedAt: now,
  } satisfies RelationshipOutboxRecord;
}

export async function enqueueRelationshipOutbox(
  input: EnqueueRelationshipOutboxInput,
) {
  if (!input.producerVersion.trim() || !input.idempotencyKey.trim())
    throw new Error("INVALID_RELATIONSHIP_OUTBOX_IDEMPOTENCY");
  if (!databaseEnabled) {
    ensureRelationshipInMemory(input.userId, input.characterId);
    const aggregateKey =
      input.aggregateKey ??
      relationshipAggregateKey(input.userId, input.characterId);
    const duplicate = platform.relationshipOutbox.find(
      (item) =>
        item.aggregateKey === aggregateKey &&
        item.eventType === input.eventType &&
        item.producerVersion === input.producerVersion &&
        item.idempotencyKey === input.idempotencyKey,
    );
    if (duplicate) return duplicate;
    const record = createRelationshipOutboxRecord({
      ...input,
      aggregateKey,
    });
    platform.relationshipOutbox.push(record);
    persist();
    return record;
  }
  return transaction(async (client) => {
    await ensureRelationshipWithClient(
      input.userId,
      input.characterId,
      defaultRelationshipPolicyVersion,
      client,
    );
    const record = createRelationshipOutboxRecord(input);
    const result = await client.query(
      `INSERT INTO relationship_outbox(
         id,user_id,character_id,aggregate_key,event_type,payload,
         producer_version,idempotency_key,status,attempt,max_attempts,available_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',0,$9,$10)
       ON CONFLICT(aggregate_key,event_type,producer_version,idempotency_key)
       DO NOTHING RETURNING *`,
      [
        record.id,
        record.userId,
        record.characterId,
        record.aggregateKey,
        record.eventType,
        JSON.stringify(record.payload),
        record.producerVersion,
        record.idempotencyKey,
        record.maxAttempts,
        record.availableAt,
      ],
    );
    if (result.rows[0]) return asRelationshipOutbox(result.rows[0]);
    const existing = await client.query(
      `SELECT * FROM relationship_outbox
       WHERE aggregate_key=$1 AND event_type=$2 AND producer_version=$3 AND idempotency_key=$4`,
      [
        record.aggregateKey,
        record.eventType,
        record.producerVersion,
        record.idempotencyKey,
      ],
    );
    return asRelationshipOutbox(existing.rows[0]);
  });
}

export async function listRelationshipOutbox(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled)
    return platform.relationshipOutbox.filter(
      (item) => item.userId === userId && item.characterId === characterId,
    );
  const result = await dbQuery(
    `SELECT * FROM relationship_outbox
     WHERE user_id=$1 AND character_id=$2 ORDER BY created_at,id`,
    [userId, characterId],
  );
  return result.rows.map(asRelationshipOutbox);
}

export async function claimRelationshipOutbox(
  batchSize = 10,
  scope?: { userId: string; characterId: string },
) {
  const limit = Math.max(1, Math.min(100, Math.trunc(batchSize)));
  if (!databaseEnabled) {
    const now = new Date().toISOString();
    const staleBefore = new Date(Date.parse(now) - 5 * 60 * 1000).toISOString();
    let reclaimed = false;
    for (const record of platform.relationshipOutbox) {
      if (
        record.status !== "processing" ||
        !record.claimedAt ||
        record.claimedAt >= staleBefore ||
        (scope &&
          (record.userId !== scope.userId ||
            record.characterId !== scope.characterId))
      )
        continue;
      reclaimed = true;
      const exhausted = record.attempt >= record.maxAttempts;
      record.status = exhausted ? "dead_letter" : "pending";
      record.claimedAt = undefined;
      record.claimToken = undefined;
      record.processedAt = exhausted ? now : undefined;
      if (!exhausted) record.availableAt = now;
      record.lastErrorCode = "STALE_CLAIM";
      record.lastErrorAt = now;
      record.updatedAt = now;
    }
    const records = platform.relationshipOutbox
      .filter(
        (item) =>
          item.status === "pending" &&
          item.availableAt <= now &&
          item.attempt < item.maxAttempts &&
          (!scope ||
            (item.userId === scope.userId &&
              item.characterId === scope.characterId)),
      )
      .sort((a, b) =>
        a.availableAt === b.availableAt
          ? a.createdAt === b.createdAt
            ? a.id.localeCompare(b.id)
            : a.createdAt.localeCompare(b.createdAt)
          : a.availableAt.localeCompare(b.availableAt),
      )
      .slice(0, limit);
    for (const record of records) {
      record.status = "processing";
      record.attempt += 1;
      record.claimedAt = now;
      record.claimToken = randomUUID();
      record.updatedAt = now;
    }
    if (reclaimed || records.length) persist();
    return records;
  }
  return transaction(async (client) => {
    await client.query(
      `WITH stale AS (
         SELECT id,attempt,max_attempts FROM relationship_outbox
         WHERE status='processing'
           AND claimed_at < now() - interval '5 minutes'
           AND ($1::text IS NULL OR (user_id=$1 AND character_id=$2))
         FOR UPDATE SKIP LOCKED
       )
       UPDATE relationship_outbox o
       SET status=CASE WHEN s.attempt>=s.max_attempts THEN 'dead_letter' ELSE 'pending' END,
           claimed_at=NULL,claim_token=NULL,
           processed_at=CASE WHEN s.attempt>=s.max_attempts THEN now() ELSE NULL END,
           available_at=CASE WHEN s.attempt<s.max_attempts THEN now() ELSE o.available_at END,
           last_error_code='STALE_CLAIM',last_error_at=now(),updated_at=now()
       FROM stale s WHERE o.id=s.id`,
      [scope?.userId ?? null, scope?.characterId ?? null],
    );
    const claimToken = randomUUID();
    const result = await client.query(
      `WITH candidates AS (
         SELECT id FROM relationship_outbox
         WHERE status='pending' AND available_at<=now() AND attempt<max_attempts
           AND ($3::text IS NULL OR (user_id=$3 AND character_id=$4))
         ORDER BY available_at,created_at,id
         FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE relationship_outbox o
       SET status='processing',attempt=o.attempt+1,claimed_at=now(),
           claim_token=$2,updated_at=now()
       FROM candidates c WHERE o.id=c.id RETURNING o.*`,
      [limit, claimToken, scope?.userId ?? null, scope?.characterId ?? null],
    );
    return result.rows.map(asRelationshipOutbox);
  });
}

export async function checkpointRelationshipOutboxExtraction(
  outboxId: string,
  claimToken: string,
  checkpoint: {
    extractorModel: string;
    extractorVersion: string;
    candidates: unknown[];
  },
) {
  if (
    !checkpoint.extractorModel.trim() ||
    !checkpoint.extractorVersion.trim() ||
    checkpoint.candidates.length > 8
  )
    throw new Error("INVALID_RELATIONSHIP_EXTRACTION_CHECKPOINT");
  if (!databaseEnabled) {
    const record = platform.relationshipOutbox.find(
      (item) => item.id === outboxId,
    );
    if (
      !record ||
      record.status !== "processing" ||
      record.claimToken !== claimToken
    )
      throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    record.payload = {
      ...record.payload,
      extractionCheckpointV1: structuredClone(checkpoint),
    };
    record.updatedAt = new Date().toISOString();
    persist();
    return record;
  }
  const result = await dbQuery(
    `UPDATE relationship_outbox
     SET payload=jsonb_set(payload,'{extractionCheckpointV1}',$3::jsonb,true),
         updated_at=now()
     WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING *`,
    [outboxId, claimToken, JSON.stringify(checkpoint)],
  );
  if (!result.rows[0])
    throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
  return asRelationshipOutbox(result.rows[0]);
}

export async function completeRelationshipOutbox(
  outboxId: string,
  claimToken: string,
) {
  if (!databaseEnabled) {
    const record = platform.relationshipOutbox.find(
      (item) => item.id === outboxId,
    );
    if (!record) return null;
    if (
      record.status !== "processing" ||
      record.claimToken !== claimToken
    )
      throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    const now = new Date().toISOString();
    record.status = "processed";
    record.claimedAt = undefined;
    record.claimToken = undefined;
    record.processedAt = now;
    record.updatedAt = now;
    persist();
    return record;
  }
  const result = await dbQuery(
    `UPDATE relationship_outbox
     SET status='processed',claimed_at=NULL,claim_token=NULL,
         processed_at=now(),updated_at=now()
     WHERE id=$1 AND status='processing' AND claim_token=$2 RETURNING *`,
    [outboxId, claimToken],
  );
  if (!result.rows[0]) {
    const existing = await dbQuery(
      "SELECT 1 FROM relationship_outbox WHERE id=$1",
      [outboxId],
    );
    if (!existing.rows[0]) return null;
    throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
  }
  return asRelationshipOutbox(result.rows[0]);
}

export async function failRelationshipOutbox(
  outboxId: string,
  claimToken: string,
  errorCode: string,
  retryAt?: string,
) {
  if (!errorCode.trim()) throw new Error("INVALID_RELATIONSHIP_OUTBOX_ERROR");
  if (!databaseEnabled) {
    const record = platform.relationshipOutbox.find(
      (item) => item.id === outboxId,
    );
    if (
      !record ||
      record.status !== "processing" ||
      record.claimToken !== claimToken
    )
      throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    const now = new Date().toISOString();
    const exhausted = record.attempt >= record.maxAttempts;
    record.status = exhausted ? "dead_letter" : "pending";
    record.claimedAt = undefined;
    record.claimToken = undefined;
    record.processedAt = exhausted ? now : undefined;
    record.availableAt = exhausted ? record.availableAt : (retryAt ?? now);
    record.lastErrorCode = errorCode;
    record.lastErrorAt = now;
    record.updatedAt = now;
    persist();
    return record;
  }
  return transaction(async (client) => {
    const currentResult = await client.query(
      `SELECT * FROM relationship_outbox
       WHERE id=$1 AND status='processing' AND claim_token=$2 FOR UPDATE`,
      [outboxId, claimToken],
    );
    if (!currentResult.rows[0])
      throw new Error("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    const current = currentResult.rows[0];
    const exhausted = current.attempt >= current.max_attempts;
    const result = await client.query(
      `UPDATE relationship_outbox
       SET status=$3,claimed_at=NULL,claim_token=NULL,
           processed_at=CASE WHEN $3='dead_letter' THEN now() ELSE NULL END,
           available_at=CASE WHEN $3='pending' THEN COALESCE($4,now()) ELSE available_at END,
           last_error_code=$5,last_error_at=now(),updated_at=now()
       WHERE id=$1 AND claim_token=$2 RETURNING *`,
      [
        outboxId,
        claimToken,
        exhausted ? "dead_letter" : "pending",
        retryAt ?? null,
        errorCode,
      ],
    );
    return asRelationshipOutbox(result.rows[0]);
  });
}

export async function addCharacterMessageWithRelationshipOutbox(
  thread: ConversationThread,
  input: Omit<
    ConversationMessage,
    "id" | "threadId" | "epochId" | "characterVersion" | "createdAt" | "role"
  >,
  outboxInput: CharacterMessageRelationshipOutboxInput,
) {
  if (!databaseEnabled) {
    const ownedThread = platform.threads.find(
      (item) => item.id === thread.id && item.userId === thread.userId,
    );
    const sourceMessage = platform.messages.find(
      (item) =>
        item.id === outboxInput.sourceUserMessageId &&
        item.threadId === thread.id &&
        item.role === "user",
    );
    if (!ownedThread || !sourceMessage)
      throw new Error("RELATIONSHIP_OUTBOX_SOURCE_MESSAGE_NOT_OWNED");
    const aggregateKey = relationshipAggregateKey(
      thread.userId,
      thread.characterId,
    );
    const duplicate = platform.relationshipOutbox.find(
      (item) =>
        item.aggregateKey === aggregateKey &&
        item.eventType === "evidence_extraction_requested" &&
        item.producerVersion === outboxInput.producerVersion &&
        item.idempotencyKey === outboxInput.idempotencyKey,
    );
    if (duplicate) {
      const existingMessage = platform.messages.find(
        (item) => item.id === duplicate.payload.characterMessageId,
      );
      if (!existingMessage)
        throw new Error("RELATIONSHIP_OUTBOX_MESSAGE_MISSING");
      return { message: existingMessage, outbox: duplicate };
    }
    const now = new Date().toISOString();
    const message: ConversationMessage = {
      ...input,
      id: randomUUID(),
      threadId: thread.id,
      epochId: thread.currentEpochId,
      role: "character",
      characterVersion: thread.characterVersion,
      createdAt: now,
    };
    const { state } = ensureRelationshipInMemory(
      thread.userId,
      thread.characterId,
    );
    platform.messages.push(message);
    thread.lastMessageAt = now;
    thread.updatedAt = now;
    if (
      state.recordingRevision !== outboxInput.expectedRecordingRevision
    ) {
      persist();
      return { message };
    }
    const outbox = createRelationshipOutboxRecord({
      userId: thread.userId,
      characterId: thread.characterId,
      eventType: "evidence_extraction_requested",
      producerVersion: outboxInput.producerVersion,
      idempotencyKey: outboxInput.idempotencyKey,
      maxAttempts: outboxInput.maxAttempts,
      payload: {
        ...(outboxInput.payload ?? {}),
        threadId: thread.id,
        sourceUserMessageId: sourceMessage.id,
        sourceUserMessageCreatedAt: sourceMessage.createdAt,
        characterMessageId: message.id,
        recordingRevision: state.recordingRevision,
      },
    }, now);
    platform.relationshipOutbox.push(outbox);
    persist();
    return { message, outbox };
  }
  return transaction(async (client) => {
    const identityResult = await client.query(
      `SELECT id FROM character_threads
       WHERE id=$1 AND user_id=$2 AND character_id=$3`,
      [thread.id, thread.userId, thread.characterId],
    );
    if (!identityResult.rows[0])
      throw new Error("RELATIONSHIP_OUTBOX_SOURCE_MESSAGE_NOT_OWNED");
    await ensureRelationshipWithClient(
      thread.userId,
      thread.characterId,
      defaultRelationshipPolicyVersion,
      client,
    );
    const stateResult = await client.query(
      `SELECT * FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [thread.userId, thread.characterId],
    );
    const state = asRelationshipState(stateResult.rows[0]);
    const threadResult = await client.query(
      `SELECT * FROM character_threads
       WHERE id=$1 AND user_id=$2 AND character_id=$3 FOR UPDATE`,
      [thread.id, thread.userId, thread.characterId],
    );
    if (!threadResult.rows[0])
      throw new Error("RELATIONSHIP_OUTBOX_SOURCE_MESSAGE_NOT_OWNED");
    const sourceResult = await client.query(
      `SELECT * FROM messages
       WHERE id=$1 AND thread_id=$2 AND role='user'`,
      [outboxInput.sourceUserMessageId, thread.id],
    );
    if (!sourceResult.rows[0])
      throw new Error("RELATIONSHIP_OUTBOX_SOURCE_MESSAGE_NOT_OWNED");
    const aggregateKey = relationshipAggregateKey(
      thread.userId,
      thread.characterId,
    );
    const duplicateResult = await client.query(
      `SELECT * FROM relationship_outbox
       WHERE aggregate_key=$1 AND event_type='evidence_extraction_requested'
         AND producer_version=$2 AND idempotency_key=$3`,
      [
        aggregateKey,
        outboxInput.producerVersion,
        outboxInput.idempotencyKey,
      ],
    );
    if (duplicateResult.rows[0]) {
      const duplicate = asRelationshipOutbox(duplicateResult.rows[0]);
      const duplicateMessageResult = await client.query(
        "SELECT * FROM messages WHERE id=$1 AND thread_id=$2",
        [duplicate.payload.characterMessageId, thread.id],
      );
      if (!duplicateMessageResult.rows[0])
        throw new Error("RELATIONSHIP_OUTBOX_MESSAGE_MISSING");
      return {
        message: asMessage(duplicateMessageResult.rows[0]),
        outbox: duplicate,
      };
    }
    const now = new Date().toISOString();
    const message: ConversationMessage = {
      ...input,
      id: randomUUID(),
      threadId: thread.id,
      epochId: threadResult.rows[0].current_epoch_id,
      role: "character",
      characterVersion: threadResult.rows[0].character_version,
      createdAt: now,
    };
    if (
      state.recordingRevision !== outboxInput.expectedRecordingRevision
    ) {
      await client.query(
        `INSERT INTO messages(
           id,thread_id,epoch_id,role,content,character_version,claim_ids,citations,created_at
         ) VALUES($1,$2,$3,'character',$4,$5,$6,$7,$8)`,
        [
          message.id,
          message.threadId,
          message.epochId,
          message.content,
          message.characterVersion,
          JSON.stringify(message.claimIds),
          JSON.stringify(message.citations),
          message.createdAt,
        ],
      );
      await client.query(
        "UPDATE character_threads SET updated_at=$1 WHERE id=$2",
        [message.createdAt, thread.id],
      );
      return { message };
    }
    const outbox = createRelationshipOutboxRecord({
      userId: thread.userId,
      characterId: thread.characterId,
      eventType: "evidence_extraction_requested",
      producerVersion: outboxInput.producerVersion,
      idempotencyKey: outboxInput.idempotencyKey,
      maxAttempts: outboxInput.maxAttempts,
      payload: {
        ...(outboxInput.payload ?? {}),
        threadId: thread.id,
        sourceUserMessageId: sourceResult.rows[0].id,
        sourceUserMessageCreatedAt: iso(sourceResult.rows[0].created_at)!,
        characterMessageId: message.id,
        recordingRevision: state.recordingRevision,
      },
    }, now);
    const outboxResult = await client.query(
      `INSERT INTO relationship_outbox(
         id,user_id,character_id,aggregate_key,event_type,payload,
         producer_version,idempotency_key,status,attempt,max_attempts,available_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',0,$9,$10)
       ON CONFLICT(aggregate_key,event_type,producer_version,idempotency_key)
       DO NOTHING RETURNING *`,
      [
        outbox.id,
        outbox.userId,
        outbox.characterId,
        outbox.aggregateKey,
        outbox.eventType,
        JSON.stringify(outbox.payload),
        outbox.producerVersion,
        outbox.idempotencyKey,
        outbox.maxAttempts,
        outbox.availableAt,
      ],
    );
    if (!outboxResult.rows[0]) {
      const existingOutboxResult = await client.query(
        `SELECT * FROM relationship_outbox
         WHERE aggregate_key=$1 AND event_type=$2 AND producer_version=$3 AND idempotency_key=$4`,
        [
          outbox.aggregateKey,
          outbox.eventType,
          outbox.producerVersion,
          outbox.idempotencyKey,
        ],
      );
      const existingOutbox = asRelationshipOutbox(
        existingOutboxResult.rows[0],
      );
      const existingMessageResult = await client.query(
        "SELECT * FROM messages WHERE id=$1 AND thread_id=$2",
        [existingOutbox.payload.characterMessageId, thread.id],
      );
      if (!existingMessageResult.rows[0])
        throw new Error("RELATIONSHIP_OUTBOX_MESSAGE_MISSING");
      return {
        message: asMessage(existingMessageResult.rows[0]),
        outbox: existingOutbox,
      };
    }
    await client.query(
      `INSERT INTO messages(
         id,thread_id,epoch_id,role,content,character_version,claim_ids,citations,created_at
       ) VALUES($1,$2,$3,'character',$4,$5,$6,$7,$8)`,
      [
        message.id,
        message.threadId,
        message.epochId,
        message.content,
        message.characterVersion,
        JSON.stringify(message.claimIds),
        JSON.stringify(message.citations),
        message.createdAt,
      ],
    );
    await client.query(
      "UPDATE character_threads SET updated_at=$1 WHERE id=$2",
      [message.createdAt, thread.id],
    );
    return {
      message,
      outbox: asRelationshipOutbox(outboxResult.rows[0]),
    };
  });
}

export async function resetRelationship(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled) {
    const { state } = ensureRelationshipInMemory(userId, characterId);
    const evidenceIds = new Set(
      platform.relationshipEvidence
        .filter(
          (item) =>
            item.userId === userId && item.characterId === characterId,
        )
        .map((item) => item.id),
    );
    platform.relationshipEvidence = platform.relationshipEvidence.filter(
      (item) => !evidenceIds.has(item.id),
    );
    platform.relationshipEvidenceSources =
      platform.relationshipEvidenceSources.filter(
        (item) => !evidenceIds.has(item.evidenceId),
      );
    platform.relationshipTransitions = platform.relationshipTransitions.filter(
      (item) =>
        item.userId !== userId || item.characterId !== characterId,
    );
    platform.relationshipPreferences = platform.relationshipPreferences.filter(
      (item) =>
        item.userId !== userId || item.characterId !== characterId,
    );
    platform.relationshipOutbox = platform.relationshipOutbox.filter(
      (item) =>
        item.userId !== userId || item.characterId !== characterId,
    );
    const now = new Date().toISOString();
    for (const memory of platform.memories) {
      if (
        memory.userId === userId &&
        memory.characterId === characterId &&
        memory.type === "character_relationship" &&
        memory.status !== "forgotten"
      ) {
        forgetMemoryContentInMemory(memory, now);
      }
    }
    state.stage = "initial";
    state.evidenceRevision = 0;
    state.recordingRevision += 1;
    state.evaluatedAt = undefined;
    state.resetCutoffAt = now;
    state.stageChangedAt = now;
    state.revision += 1;
    state.updatedAt = now;
    persist();
    return state;
  }
  return transaction(async (client) => {
    await ensureRelationshipWithClient(
      userId,
      characterId,
      defaultRelationshipPolicyVersion,
      client,
    );
    await client.query(
      `SELECT 1 FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [userId, characterId],
    );
    await client.query(
      "DELETE FROM relationship_outbox WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    await client.query(
      "DELETE FROM relationship_stage_transitions WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    await client.query(
      "DELETE FROM relationship_preferences WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    await client.query(
      "DELETE FROM relationship_evidence WHERE user_id=$1 AND character_id=$2",
      [userId, characterId],
    );
    const forgottenMemories = await client.query(
      `UPDATE memories
       SET status='forgotten',content='[已忘记]',embedding=NULL,
           confidence=0,importance=0,recall_count=0,last_recalled_at=NULL,
           updated_at=now()
       WHERE user_id=$1 AND character_id=$2
         AND type='character_relationship' AND status<>'forgotten'
       RETURNING id`,
      [userId, characterId],
    );
    const forgottenMemoryIds = forgottenMemories.rows.map((row) =>
      String(row.id),
    );
    if (forgottenMemoryIds.length > 0)
      await client.query(
        "DELETE FROM memory_sources WHERE memory_id=ANY($1::uuid[])",
        [forgottenMemoryIds],
      );
    const result = await client.query(
      `UPDATE user_character_relationships
       SET stage='initial',evidence_revision=0,evaluated_at=NULL,
           reset_cutoff_at=now(),stage_changed_at=now(),
           recording_revision=recording_revision+1,
           revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2 RETURNING *`,
      [userId, characterId],
    );
    return asRelationshipState(result.rows[0]);
  });
}

export async function deleteRelationship(
  userId: string,
  characterId: string,
) {
  if (!databaseEnabled) {
    const existed = platform.relationships.some(
      (item) => item.userId === userId && item.characterId === characterId,
    );
    const evidenceIds = new Set(
      platform.relationshipEvidence
        .filter(
          (item) =>
            item.userId === userId && item.characterId === characterId,
        )
        .map((item) => item.id),
    );
    platform.relationships = platform.relationships.filter(
      (item) => item.userId !== userId || item.characterId !== characterId,
    );
    platform.relationshipEvidence = platform.relationshipEvidence.filter(
      (item) => !evidenceIds.has(item.id),
    );
    platform.relationshipEvidenceSources =
      platform.relationshipEvidenceSources.filter(
        (item) => !evidenceIds.has(item.evidenceId),
      );
    platform.relationshipTransitions = platform.relationshipTransitions.filter(
      (item) => item.userId !== userId || item.characterId !== characterId,
    );
    platform.relationshipPreferences = platform.relationshipPreferences.filter(
      (item) => item.userId !== userId || item.characterId !== characterId,
    );
    platform.relationshipOutbox = platform.relationshipOutbox.filter(
      (item) => item.userId !== userId || item.characterId !== characterId,
    );
    if (existed) persist();
    return existed;
  }
  const result = await dbQuery(
    "DELETE FROM user_character_relationships WHERE user_id=$1 AND character_id=$2",
    [userId, characterId],
  );
  return Boolean(result.rowCount);
}

export async function deleteAllRelationshipsForUser(userId: string) {
  if (!databaseEnabled) {
    const characterIds = platform.relationships
      .filter((item) => item.userId === userId)
      .map((item) => item.characterId);
    for (const characterId of characterIds)
      await deleteRelationship(userId, characterId);
    return characterIds.length;
  }
  const result = await dbQuery(
    "DELETE FROM user_character_relationships WHERE user_id=$1",
    [userId],
  );
  return result.rowCount ?? 0;
}

export async function deleteThreadForUser(threadId: string, userId: string) {
  if (!databaseEnabled) {
    const thread = platform.threads.find(
      (item) => item.id === threadId && item.userId === userId,
    );
    if (!thread) return false;
    const epochIds = new Set(
      platform.epochs
        .filter((item) => item.threadId === thread.id)
        .map((item) => item.id),
    );
    const messageIds = new Set(
      platform.messages
        .filter((item) => item.threadId === thread.id)
        .map((item) => item.id),
    );
    platform.messages = platform.messages.filter(
      (item) => item.threadId !== thread.id,
    );
    platform.epochs = platform.epochs.filter(
      (item) => !epochIds.has(item.id),
    );
    platform.threads = platform.threads.filter((item) => item.id !== thread.id);
    platform.memories = platform.memories.filter(
      (item) =>
        item.userId !== userId || item.characterId !== thread.characterId,
    );
    for (const mastery of platform.mastery) {
      mastery.evidenceMessageIds = mastery.evidenceMessageIds.filter(
        (id) => !messageIds.has(id),
      );
    }
    await deleteRelationship(userId, thread.characterId);
    persist();
    return true;
  }

  return transaction(async (client) => {
    const identity = (
      await client.query(
        `SELECT id,character_id FROM character_threads
         WHERE id=$1 AND user_id=$2`,
        [threadId, userId],
      )
    ).rows[0];
    if (!identity) return false;
    await client.query(
      `SELECT 1 FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
      [userId, identity.character_id],
    );
    const thread = (
      await client.query(
        `SELECT id,character_id FROM character_threads
         WHERE id=$1 AND user_id=$2 FOR UPDATE`,
        [threadId, userId],
      )
    ).rows[0];
    if (!thread) return false;

    // Relationship sources use deferred NO ACTION references to messages, so
    // remove the complete relationship aggregate before deleting the thread.
    await client.query(
      `DELETE FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2`,
      [userId, thread.character_id],
    );
    await client.query(
      "DELETE FROM memories WHERE user_id=$1 AND character_id=$2",
      [userId, thread.character_id],
    );
    await client.query(
      "DELETE FROM character_threads WHERE id=$1 AND user_id=$2",
      [threadId, userId],
    );
    return true;
  });
}

export async function exportUserData(userId: string) {
  if (!databaseEnabled) {
    const threads = platform.threads.filter((item) => item.userId === userId);
    const threadIds = new Set(threads.map((item) => item.id));
    const taskIds = new Set(
      platform.tasks
        .filter((item) => item.createdBy === userId)
        .map((item) => item.id),
    );
    const relationshipEvidence = platform.relationshipEvidence.filter(
      (item) => item.userId === userId,
    );
    const relationshipEvidenceIds = new Set(
      relationshipEvidence.map((item) => item.id),
    );
    return structuredClone({
      schemaVersion: "ai-museum-user-export-v1",
      exportedAt: new Date().toISOString(),
      userId,
      conversations: {
        threads,
        epochs: platform.epochs.filter((item) => threadIds.has(item.threadId)),
        messages: platform.messages.filter((item) =>
          threadIds.has(item.threadId),
        ),
      },
      memories: platform.memories.filter((item) => item.userId === userId),
      mastery: platform.mastery.filter((item) => item.userId === userId),
      collection:
        platform.collections.find((item) => item.userId === userId) ?? null,
      learningEvents: platform.learningEvents.filter(
        (item) => item.userId === userId,
      ),
      draws: platform.draws.filter((item) => item.userId === userId),
      hallVisits: platform.hallVisits.filter((item) => item.userId === userId),
      agentTasks: platform.tasks.filter((item) => item.createdBy === userId),
      agentArtifacts: platform.artifacts.filter((item) =>
        taskIds.has(item.taskId),
      ),
      relationships: {
        states: platform.relationships.filter((item) => item.userId === userId),
        evidence: relationshipEvidence,
        evidenceSources: platform.relationshipEvidenceSources.filter((item) =>
          relationshipEvidenceIds.has(item.evidenceId),
        ),
        transitions: platform.relationshipTransitions.filter(
          (item) => item.userId === userId,
        ),
        preferences: platform.relationshipPreferences.filter(
          (item) => item.userId === userId,
        ),
      },
    });
  }

  return transaction(async (client) => {
    const one = async (sql: string, params: unknown[] = [userId]) =>
      (await client.query(sql, params)).rows;
    const threads = await one(
      "SELECT * FROM character_threads WHERE user_id=$1 ORDER BY created_at,id",
    );
    const relationshipEvidence = await one(
      `SELECT * FROM relationship_evidence
       WHERE user_id=$1 ORDER BY created_at,id`,
    );
    return {
      schemaVersion: "ai-museum-user-export-v1",
      exportedAt: new Date().toISOString(),
      userId,
      profile: (
        await one(
          `SELECT p.user_id,p.display_name,p.age_band,p.locale,p.preferences,
                  c.email,c.email_verified_at,p.user_id
           FROM user_profiles p
           LEFT JOIN auth_credentials c ON c.user_id=p.user_id
           WHERE p.user_id=$1`,
        )
      )[0] ?? null,
      conversations: {
        threads,
        epochs: await one(
          `SELECT e.* FROM thread_epochs e
           JOIN character_threads t ON t.id=e.thread_id
           WHERE t.user_id=$1 ORDER BY e.started_at,e.id`,
        ),
        messages: await one(
          `SELECT m.* FROM messages m
           JOIN character_threads t ON t.id=m.thread_id
           WHERE t.user_id=$1 ORDER BY m.created_at,m.id`,
        ),
      },
      memories: await one(
        "SELECT * FROM memories WHERE user_id=$1 ORDER BY created_at,id",
      ),
      mastery: await one(
        "SELECT * FROM mastery_topics WHERE user_id=$1 ORDER BY updated_at,id",
      ),
      collection:
        (await one("SELECT * FROM user_collections WHERE user_id=$1"))[0] ??
        null,
      learningEvents: await one(
        "SELECT * FROM learning_events WHERE user_id=$1 ORDER BY created_at,id",
      ),
      draws: await one(
        "SELECT * FROM character_draws WHERE user_id=$1 ORDER BY created_at,id",
      ),
      hallVisits: await one(
        "SELECT * FROM hall_visit_states WHERE user_id=$1 ORDER BY updated_at,hall_id",
      ),
      agentTasks: await one(
        "SELECT * FROM agent_tasks WHERE user_id=$1 ORDER BY created_at,id",
      ),
      relationships: {
        states: await one(
          `SELECT * FROM user_character_relationships
           WHERE user_id=$1 ORDER BY created_at,character_id`,
        ),
        evidence: relationshipEvidence,
        evidenceSources: await one(
          `SELECT s.* FROM relationship_evidence_sources s
           JOIN relationship_evidence e ON e.id=s.evidence_id
           WHERE e.user_id=$1 ORDER BY s.created_at,s.id`,
        ),
        transitions: await one(
          `SELECT * FROM relationship_stage_transitions
           WHERE user_id=$1 ORDER BY created_at,id`,
        ),
        preferences: await one(
          `SELECT * FROM relationship_preferences
           WHERE user_id=$1 ORDER BY created_at,character_id`,
        ),
      },
    };
  });
}

export async function deleteUserData(userId: string) {
  if (!databaseEnabled) {
    const threadIds = new Set(
      platform.threads
        .filter((item) => item.userId === userId)
        .map((item) => item.id),
    );
    const taskIds = new Set(
      platform.tasks
        .filter((item) => item.createdBy === userId)
        .map((item) => item.id),
    );
    const evidenceIds = new Set(
      platform.relationshipEvidence
        .filter((item) => item.userId === userId)
        .map((item) => item.id),
    );
    const existed =
      threadIds.size > 0 ||
      taskIds.size > 0 ||
      evidenceIds.size > 0 ||
      platform.relationships.some((item) => item.userId === userId) ||
      platform.memories.some((item) => item.userId === userId) ||
      platform.collections.some((item) => item.userId === userId);

    platform.messages = platform.messages.filter(
      (item) => !threadIds.has(item.threadId),
    );
    platform.epochs = platform.epochs.filter(
      (item) => !threadIds.has(item.threadId),
    );
    platform.threads = platform.threads.filter((item) => item.userId !== userId);
    platform.memories = platform.memories.filter((item) => item.userId !== userId);
    platform.mastery = platform.mastery.filter((item) => item.userId !== userId);
    platform.artifacts = platform.artifacts.filter(
      (item) => !taskIds.has(item.taskId),
    );
    platform.tasks = platform.tasks.filter((item) => item.createdBy !== userId);
    platform.collections = platform.collections.filter(
      (item) => item.userId !== userId,
    );
    platform.learningEvents = platform.learningEvents.filter(
      (item) => item.userId !== userId,
    );
    platform.draws = platform.draws.filter((item) => item.userId !== userId);
    platform.hallVisits = platform.hallVisits.filter(
      (item) => item.userId !== userId,
    );
    platform.relationships = platform.relationships.filter(
      (item) => item.userId !== userId,
    );
    platform.relationshipEvidence = platform.relationshipEvidence.filter(
      (item) => item.userId !== userId,
    );
    platform.relationshipEvidenceSources =
      platform.relationshipEvidenceSources.filter(
        (item) => !evidenceIds.has(item.evidenceId),
      );
    platform.relationshipTransitions = platform.relationshipTransitions.filter(
      (item) => item.userId !== userId,
    );
    platform.relationshipPreferences = platform.relationshipPreferences.filter(
      (item) => item.userId !== userId,
    );
    platform.relationshipOutbox = platform.relationshipOutbox.filter(
      (item) => item.userId !== userId,
    );
    if (existed) persist();
    return existed;
  }

  return transaction(async (client) => {
    const user = (
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId])
    ).rows[0];
    if (!user) return false;

    // Relationship aggregates go first because their source rows may point to
    // messages, memories and learning events through deferred NO ACTION FKs.
    await client.query(
      "DELETE FROM user_character_relationships WHERE user_id=$1",
      [userId],
    );
    await client.query("DELETE FROM agent_tasks WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM consents WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM memories WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM mastery_topics WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM character_threads WHERE user_id=$1", [userId]);
    await client.query(
      "DELETE FROM guest_identities WHERE user_id=$1 OR merged_into=$1",
      [userId],
    );
    await client.query("DELETE FROM user_profiles WHERE user_id=$1", [userId]);
    await client.query("DELETE FROM users WHERE id=$1", [userId]);
    return true;
  });
}

function relationshipSourceCreatedAtInMemory(
  source: RelationshipEvidenceSourceRecord,
) {
  if (source.sourceType === "message")
    return platform.messages.find((item) => item.id === source.messageId)
      ?.createdAt;
  if (source.sourceType === "memory")
    return platform.memories.find((item) => item.id === source.memoryId)
      ?.createdAt;
  return platform.learningEvents.find(
    (item) => item.id === source.learningEventId,
  )?.createdAt;
}

function removeRelationshipEvidenceInMemory(
  evidence: RelationshipEvidenceRecord,
) {
  platform.relationshipEvidenceSources =
    platform.relationshipEvidenceSources.filter(
      (item) => item.evidenceId !== evidence.id,
    );
  platform.relationshipEvidence.splice(
    platform.relationshipEvidence.indexOf(evidence),
    1,
  );
}

function applyRelationshipCutoffToGuestEvidenceInMemory(
  guestId: string,
  characterId: string,
  cutoff: string,
) {
  for (const evidence of platform.relationshipEvidence.filter(
    (item) =>
      item.userId === guestId && item.characterId === characterId,
  )) {
    const sources = platform.relationshipEvidenceSources.filter(
      (item) => item.evidenceId === evidence.id,
    );
    const primary = sources.find(
      (item) => item.dependencyRole === "primary",
    );
    const invalidRequired = sources.some((source) => {
      if (
        source.dependencyRole !== "primary" &&
        source.dependencyRole !== "required_support"
      )
        return false;
      const createdAt = relationshipSourceCreatedAtInMemory(source);
      return !createdAt || createdAt <= cutoff;
    });
    if (!primary || invalidRequired) {
      removeRelationshipEvidenceInMemory(evidence);
      continue;
    }
    for (const source of sources) {
      if (source.dependencyRole !== "optional_context") continue;
      const createdAt = relationshipSourceCreatedAtInMemory(source);
      if (!createdAt || createdAt <= cutoff)
        platform.relationshipEvidenceSources.splice(
          platform.relationshipEvidenceSources.indexOf(source),
          1,
        );
    }
  }
}

function mergeLearningEventsInMemory(guestId: string, userId: string) {
  for (const event of platform.learningEvents.filter(
    (item) => item.userId === guestId,
  )) {
    const canonical = platform.learningEvents.find(
      (item) =>
        item.userId === userId &&
        (item.idempotencyKey === event.idempotencyKey ||
          (event.type === "encounter_completed" &&
            item.type === event.type &&
            item.characterId === event.characterId)),
    );
    if (!canonical) {
      event.userId = userId;
      continue;
    }
    for (const source of platform.relationshipEvidenceSources.filter(
      (item) => item.learningEventId === event.id,
    )) {
      const evidence = platform.relationshipEvidence.find(
        (item) => item.id === source.evidenceId,
      );
      if (!evidence || canonical.characterId !== evidence.characterId) {
        if (source.dependencyRole === "required_support" && evidence) {
          evidence.status = "revoked";
          evidence.rejectionReasonCode = undefined;
          evidence.supersededById = undefined;
        }
        platform.relationshipEvidenceSources.splice(
          platform.relationshipEvidenceSources.indexOf(source),
          1,
        );
        continue;
      }
      const duplicate = platform.relationshipEvidenceSources.some(
        (item) =>
          item !== source &&
          item.evidenceId === source.evidenceId &&
          item.learningEventId === canonical.id &&
          item.dependencyRole === source.dependencyRole,
      );
      if (duplicate)
        platform.relationshipEvidenceSources.splice(
          platform.relationshipEvidenceSources.indexOf(source),
          1,
        );
      else source.learningEventId = canonical.id;
    }
    platform.learningEvents.splice(platform.learningEvents.indexOf(event), 1);
  }
}

function mergeRelationshipsInMemory(guestId: string, userId: string) {
  const guestRelationships = platform.relationships.filter(
    (item) => item.userId === guestId,
  );
  for (const guest of guestRelationships) {
    const target = platform.relationships.find(
      (item) =>
        item.userId === userId && item.characterId === guest.characterId,
    );
    const guestPreference = platform.relationshipPreferences.find(
      (item) =>
        item.userId === guestId && item.characterId === guest.characterId,
    );
    const targetPreference = platform.relationshipPreferences.find(
      (item) =>
        item.userId === userId && item.characterId === guest.characterId,
    );

    // Past guest-session promotion feedback must never replay after sign-in.
    platform.relationshipTransitions = platform.relationshipTransitions.filter(
      (item) =>
        item.userId !== guestId || item.characterId !== guest.characterId,
    );

    if (target?.resetCutoffAt) {
      for (const memory of platform.memories) {
        if (
          memory.userId === guestId &&
          memory.characterId === guest.characterId &&
          memory.type === "character_relationship" &&
          memory.createdAt <= target.resetCutoffAt
        ) {
          forgetMemoryContentInMemory(memory, new Date().toISOString());
        }
      }
      applyRelationshipCutoffToGuestEvidenceInMemory(
        guestId,
        guest.characterId,
        target.resetCutoffAt,
      );
    }
    const guestEvidence = platform.relationshipEvidence.filter(
      (item) =>
        item.userId === guestId && item.characterId === guest.characterId,
    );

    if (!target) {
      guest.userId = userId;
      for (const evidence of guestEvidence) evidence.userId = userId;
      if (guestPreference) guestPreference.userId = userId;
    } else {
      const projectionBaseline =
        !target.resetCutoffAt &&
        relationshipStageRank(guest.stage) > relationshipStageRank(target.stage)
          ? guest.stage
          : target.stage;
      target.evidenceRevision = Math.max(
        target.evidenceRevision,
        guest.evidenceRevision,
      ) + 1;
      target.revision += 1;
      target.updatedAt =
        target.updatedAt > guest.updatedAt ? target.updatedAt : guest.updatedAt;

      for (const evidence of guestEvidence) {
        const duplicate = platform.relationshipEvidence.find(
          (item) =>
            item.userId === userId &&
            item.characterId === guest.characterId &&
            (item.logicalKey === evidence.logicalKey ||
              item.normalizedFingerprint === evidence.normalizedFingerprint),
        );
        if (!duplicate) {
          evidence.userId = userId;
          continue;
        }
        const sources = platform.relationshipEvidenceSources.filter(
          (item) => item.evidenceId === evidence.id,
        );
        for (const source of sources) {
          const alreadyLinked = platform.relationshipEvidenceSources.some(
            (item) =>
              item.evidenceId === duplicate.id &&
              item.sourceType === source.sourceType &&
              item.messageId === source.messageId &&
              item.memoryId === source.memoryId &&
              item.learningEventId === source.learningEventId &&
              item.dependencyRole === source.dependencyRole,
          );
          if (alreadyLinked) {
            platform.relationshipEvidenceSources.splice(
              platform.relationshipEvidenceSources.indexOf(source),
              1,
            );
          } else {
            source.evidenceId = duplicate.id;
            if (
              source.dependencyRole === "primary" &&
              platform.relationshipEvidenceSources.some(
                (item) =>
                  item !== source &&
                  item.evidenceId === duplicate.id &&
                  item.dependencyRole === "primary",
              )
            )
              platform.relationshipEvidenceSources.splice(
                platform.relationshipEvidenceSources.indexOf(source),
                1,
              );
          }
        }
        for (const reference of platform.relationshipEvidence) {
          if (reference.supersededById === evidence.id)
            reference.supersededById = duplicate.id;
        }
        platform.relationshipEvidence.splice(
          platform.relationshipEvidence.indexOf(evidence),
          1,
        );
      }
      const projection = projectRelationshipStage({
        currentStage: projectionBaseline,
        evidence: platform.relationshipEvidence
          .filter(
            (item) =>
              item.userId === userId &&
              item.characterId === guest.characterId,
          )
          .map((item) => ({
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
      const now = new Date().toISOString();
      if (projection.nextStage !== target.stage) {
        target.stage = projection.nextStage;
        target.stageChangedAt = now;
      }
      target.policyVersion = projection.policyVersion;
      target.evaluatedAt = now;
      target.updatedAt = now;
      if (guestPreference) {
        if (targetPreference)
          platform.relationshipPreferences.splice(
            platform.relationshipPreferences.indexOf(guestPreference),
            1,
          );
        else guestPreference.userId = userId;
      }
      platform.relationships.splice(platform.relationships.indexOf(guest), 1);
    }

    for (const outbox of platform.relationshipOutbox.filter(
      (item) =>
        item.userId === guestId && item.characterId === guest.characterId,
    )) {
      const sourceCreatedAt = outbox.payload.sourceUserMessageCreatedAt;
      if (
        target?.resetCutoffAt &&
        outbox.eventType === "evidence_extraction_requested" &&
        (typeof sourceCreatedAt !== "string" ||
          sourceCreatedAt <= target.resetCutoffAt)
      ) {
        platform.relationshipOutbox.splice(
          platform.relationshipOutbox.indexOf(outbox),
          1,
        );
        continue;
      }
      const aggregateKey = relationshipAggregateKey(userId, guest.characterId);
      const duplicate = platform.relationshipOutbox.find(
        (item) =>
          item !== outbox &&
          item.aggregateKey === aggregateKey &&
          item.eventType === outbox.eventType &&
          item.producerVersion === outbox.producerVersion &&
          item.idempotencyKey === outbox.idempotencyKey,
      );
      if (duplicate)
        platform.relationshipOutbox.splice(
          platform.relationshipOutbox.indexOf(outbox),
          1,
        );
      else {
        if (outbox.status === "processing") {
          const now = new Date().toISOString();
          outbox.status = "pending";
          outbox.attempt = Math.max(0, outbox.attempt - 1);
          outbox.claimedAt = undefined;
          outbox.claimToken = undefined;
          outbox.processedAt = undefined;
          outbox.availableAt = now;
          outbox.lastErrorCode = "OWNER_MERGED";
          outbox.lastErrorAt = now;
          outbox.updatedAt = now;
        }
        outbox.userId = userId;
        outbox.aggregateKey = aggregateKey;
      }
    }
  }
}

async function applyGuestRelationshipMemoryCutoffsWithClient(
  guestId: string,
  userId: string,
  client: PoolClient,
) {
  const forgotten = await client.query(
    `UPDATE memories m
     SET status='forgotten',content='[已忘记]',embedding=NULL,
         confidence=0,importance=0,recall_count=0,last_recalled_at=NULL,
         updated_at=now()
     FROM user_character_relationships target
     WHERE m.user_id=$1 AND target.user_id=$2
       AND target.character_id=m.character_id
       AND target.reset_cutoff_at IS NOT NULL
       AND m.type='character_relationship'
       AND m.created_at<=target.reset_cutoff_at
     RETURNING m.id`,
    [guestId, userId],
  );
  const ids = forgotten.rows.map((row) => String(row.id));
  if (ids.length > 0)
    await client.query(
      "DELETE FROM memory_sources WHERE memory_id=ANY($1::uuid[])",
      [ids],
    );
}

async function mergeLearningEventsWithClient(
  guestId: string,
  userId: string,
  client: PoolClient,
) {
  const guestEvents = (
    await client.query(
      "SELECT * FROM learning_events WHERE user_id=$1 ORDER BY created_at,id",
      [guestId],
    )
  ).rows;
  for (const event of guestEvents) {
    const canonical = (
      await client.query(
        `SELECT * FROM learning_events
         WHERE user_id=$1
           AND (idempotency_key=$2 OR
             ($3='encounter_completed' AND type=$3 AND character_id=$4))
         ORDER BY CASE WHEN idempotency_key=$2 THEN 0 ELSE 1 END,id
         LIMIT 1`,
        [userId, event.idempotency_key, event.type, event.character_id],
      )
    ).rows[0];
    if (!canonical) {
      await client.query(
        "UPDATE learning_events SET user_id=$1 WHERE id=$2",
        [userId, event.id],
      );
      continue;
    }
    const sources = (
      await client.query(
        `SELECT s.*,e.character_id AS evidence_character_id
         FROM relationship_evidence_sources s
         JOIN relationship_evidence e ON e.id=s.evidence_id
         WHERE s.learning_event_id=$1`,
        [event.id],
      )
    ).rows;
    for (const source of sources) {
      if (canonical.character_id !== source.evidence_character_id) {
        if (source.dependency_role === "required_support")
          await client.query(
            `UPDATE relationship_evidence
             SET status='revoked',rejection_reason_code=NULL,
                 superseded_by_id=NULL,updated_at=now() WHERE id=$1`,
            [source.evidence_id],
          );
        await client.query(
          "DELETE FROM relationship_evidence_sources WHERE id=$1",
          [source.id],
        );
        continue;
      }
      const duplicate = (
        await client.query(
          `SELECT 1 FROM relationship_evidence_sources
           WHERE evidence_id=$1 AND learning_event_id=$2 AND dependency_role=$3`,
          [
            source.evidence_id,
            canonical.id,
            source.dependency_role,
          ],
        )
      ).rows[0];
      if (duplicate)
        await client.query(
          "DELETE FROM relationship_evidence_sources WHERE id=$1",
          [source.id],
        );
      else
        await client.query(
          `UPDATE relationship_evidence_sources
           SET learning_event_id=$1,updated_at=now() WHERE id=$2`,
          [canonical.id, source.id],
        );
    }
    await client.query("DELETE FROM learning_events WHERE id=$1", [event.id]);
  }
}

async function mergeRelationshipsWithClient(
  guestId: string,
  userId: string,
  client: PoolClient,
) {
  const guestRelationships = (
    await client.query(
      "SELECT * FROM user_character_relationships WHERE user_id=$1 FOR UPDATE",
      [guestId],
    )
  ).rows;
  for (const guest of guestRelationships) {
    const characterId = guest.character_id;
    const target = (
      await client.query(
        `SELECT * FROM user_character_relationships
         WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
        [userId, characterId],
      )
    ).rows[0];

    await client.query(
      `DELETE FROM relationship_stage_transitions
       WHERE user_id=$1 AND character_id=$2`,
      [guestId, characterId],
    );

    if (!target) {
      await client.query(
        `UPDATE relationship_evidence SET user_id=$1
         WHERE user_id=$2 AND character_id=$3`,
        [userId, guestId, characterId],
      );
      await client.query(
        `UPDATE relationship_preferences SET user_id=$1
         WHERE user_id=$2 AND character_id=$3`,
        [userId, guestId, characterId],
      );
      const guestOutbox = (
        await client.query(
          `SELECT * FROM relationship_outbox
           WHERE user_id=$1 AND character_id=$2`,
          [guestId, characterId],
        )
      ).rows;
      for (const outbox of guestOutbox) {
        await client.query(
          `UPDATE relationship_outbox
           SET user_id=$1,aggregate_key=$2,
               status=CASE WHEN status='processing' THEN 'pending' ELSE status END,
               attempt=CASE WHEN status='processing' THEN greatest(attempt-1,0) ELSE attempt END,
               claimed_at=CASE WHEN status='processing' THEN NULL ELSE claimed_at END,
               claim_token=CASE WHEN status='processing' THEN NULL ELSE claim_token END,
               processed_at=CASE WHEN status='processing' THEN NULL ELSE processed_at END,
               available_at=CASE WHEN status='processing' THEN now() ELSE available_at END,
               last_error_code=CASE WHEN status='processing' THEN 'OWNER_MERGED' ELSE last_error_code END,
               last_error_at=CASE WHEN status='processing' THEN now() ELSE last_error_at END,
               updated_at=now()
           WHERE id=$3`,
          [userId, relationshipAggregateKey(userId, characterId), outbox.id],
        );
      }
      await client.query(
        `UPDATE user_character_relationships SET user_id=$1,updated_at=now()
         WHERE user_id=$2 AND character_id=$3`,
        [userId, guestId, characterId],
      );
      continue;
    }

    const guestEvidenceRows = (
      await client.query(
        `SELECT * FROM relationship_evidence
         WHERE user_id=$1 AND character_id=$2 ORDER BY created_at,id`,
        [guestId, characterId],
      )
    ).rows;
    const guestEvidence: Record<string, any>[] = [];
    const resetCutoff = iso(target.reset_cutoff_at);
    for (const evidence of guestEvidenceRows) {
      if (!resetCutoff) {
        guestEvidence.push(evidence);
        continue;
      }
      const sources = (
        await client.query(
          `SELECT s.*,
             coalesce(m.created_at,mem.created_at,le.created_at) AS source_created_at
           FROM relationship_evidence_sources s
           LEFT JOIN messages m ON m.id=s.message_id
           LEFT JOIN memories mem ON mem.id=s.memory_id
           LEFT JOIN learning_events le ON le.id=s.learning_event_id
           WHERE s.evidence_id=$1`,
          [evidence.id],
        )
      ).rows;
      const primary = sources.find(
        (source) => source.dependency_role === "primary",
      );
      const invalidRequired = sources.some((source) => {
        if (
          source.dependency_role !== "primary" &&
          source.dependency_role !== "required_support"
        )
          return false;
        const createdAt = iso(source.source_created_at);
        return !createdAt || createdAt <= resetCutoff;
      });
      if (!primary || invalidRequired) {
        await client.query(
          "DELETE FROM relationship_evidence WHERE id=$1",
          [evidence.id],
        );
        continue;
      }
      for (const source of sources) {
        if (source.dependency_role !== "optional_context") continue;
        const createdAt = iso(source.source_created_at);
        if (!createdAt || createdAt <= resetCutoff)
          await client.query(
            "DELETE FROM relationship_evidence_sources WHERE id=$1",
            [source.id],
          );
      }
      guestEvidence.push(evidence);
    }
    for (const evidence of guestEvidence) {
        const duplicate = (
          await client.query(
            `SELECT * FROM relationship_evidence
             WHERE user_id=$1 AND character_id=$2
               AND (logical_key=$3 OR normalized_fingerprint=$4)
             ORDER BY CASE WHEN logical_key=$3 THEN 0 ELSE 1 END,created_at,id
             LIMIT 1`,
            [
              userId,
              characterId,
              evidence.logical_key,
              evidence.normalized_fingerprint,
            ],
          )
        ).rows[0];
      if (!duplicate) {
        await client.query(
          "UPDATE relationship_evidence SET user_id=$1,updated_at=now() WHERE id=$2",
          [userId, evidence.id],
        );
        continue;
      }
      const sources = (
        await client.query(
          "SELECT * FROM relationship_evidence_sources WHERE evidence_id=$1",
          [evidence.id],
        )
      ).rows;
      for (const source of sources) {
        const identifierColumn =
          source.source_type === "message"
            ? "message_id"
            : source.source_type === "memory"
              ? "memory_id"
              : "learning_event_id";
        const identifier = source[identifierColumn];
        const equivalent = (
          await client.query(
            `SELECT 1 FROM relationship_evidence_sources
             WHERE evidence_id=$1 AND ${identifierColumn}=$2 AND dependency_role=$3`,
            [duplicate.id, identifier, source.dependency_role],
          )
        ).rows[0];
        const targetPrimary =
          source.dependency_role === "primary"
            ? (
                await client.query(
                  `SELECT 1 FROM relationship_evidence_sources
                   WHERE evidence_id=$1 AND dependency_role='primary'`,
                  [duplicate.id],
                )
              ).rows[0]
            : undefined;
        if (equivalent || targetPrimary)
          await client.query(
            "DELETE FROM relationship_evidence_sources WHERE id=$1",
            [source.id],
          );
        else
          await client.query(
            "UPDATE relationship_evidence_sources SET evidence_id=$1,updated_at=now() WHERE id=$2",
            [duplicate.id, source.id],
          );
      }
      await client.query(
        `UPDATE relationship_evidence SET superseded_by_id=$1,updated_at=now()
         WHERE superseded_by_id=$2`,
        [duplicate.id, evidence.id],
      );
      await client.query("DELETE FROM relationship_evidence WHERE id=$1", [
        evidence.id,
      ]);
    }

    const targetPreference = (
      await client.query(
        `SELECT 1 FROM relationship_preferences
         WHERE user_id=$1 AND character_id=$2`,
        [userId, characterId],
      )
    ).rows[0];
    if (targetPreference)
      await client.query(
        `DELETE FROM relationship_preferences
         WHERE user_id=$1 AND character_id=$2`,
        [guestId, characterId],
      );
    else
      await client.query(
        `UPDATE relationship_preferences SET user_id=$1,updated_at=now()
         WHERE user_id=$2 AND character_id=$3`,
        [userId, guestId, characterId],
      );

    const guestOutbox = (
      await client.query(
        `SELECT * FROM relationship_outbox
         WHERE user_id=$1 AND character_id=$2`,
        [guestId, characterId],
      )
    ).rows;
    const aggregateKey = relationshipAggregateKey(userId, characterId);
    for (const outbox of guestOutbox) {
      const sourceCreatedAt = iso(
        outbox.payload?.sourceUserMessageCreatedAt,
      );
      if (
        resetCutoff &&
        outbox.event_type === "evidence_extraction_requested" &&
        (!sourceCreatedAt || sourceCreatedAt <= resetCutoff)
      ) {
        await client.query("DELETE FROM relationship_outbox WHERE id=$1", [
          outbox.id,
        ]);
        continue;
      }
      const duplicate = (
        await client.query(
          `SELECT 1 FROM relationship_outbox
           WHERE aggregate_key=$1 AND event_type=$2
             AND producer_version=$3 AND idempotency_key=$4`,
          [
            aggregateKey,
            outbox.event_type,
            outbox.producer_version,
            outbox.idempotency_key,
          ],
        )
      ).rows[0];
      if (duplicate)
        await client.query("DELETE FROM relationship_outbox WHERE id=$1", [
          outbox.id,
        ]);
      else
        await client.query(
          `UPDATE relationship_outbox
           SET user_id=$1,aggregate_key=$2,
               status=CASE WHEN status='processing' THEN 'pending' ELSE status END,
               attempt=CASE WHEN status='processing' THEN greatest(attempt-1,0) ELSE attempt END,
               claimed_at=CASE WHEN status='processing' THEN NULL ELSE claimed_at END,
               claim_token=CASE WHEN status='processing' THEN NULL ELSE claim_token END,
               processed_at=CASE WHEN status='processing' THEN NULL ELSE processed_at END,
               available_at=CASE WHEN status='processing' THEN now() ELSE available_at END,
               last_error_code=CASE WHEN status='processing' THEN 'OWNER_MERGED' ELSE last_error_code END,
               last_error_at=CASE WHEN status='processing' THEN now() ELSE last_error_at END,
               updated_at=now()
           WHERE id=$3`,
          [userId, aggregateKey, outbox.id],
        );
    }

    const projectionBaseline =
      !resetCutoff &&
      relationshipStageRank(guest.stage) > relationshipStageRank(target.stage)
        ? guest.stage
        : target.stage;
    const mergedEvidence = (
      await client.query(
        `SELECT * FROM relationship_evidence
         WHERE user_id=$1 AND character_id=$2`,
        [userId, characterId],
      )
    ).rows.map(asRelationshipEvidence);
    const projection = projectRelationshipStage({
      currentStage: projectionBaseline,
      evidence: mergedEvidence.map((item) => ({
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
    await client.query(
      `UPDATE user_character_relationships
       SET stage=$3,
           stage_changed_at=CASE WHEN stage<>$3 THEN now() ELSE stage_changed_at END,
           policy_version=$4,evaluated_at=now(),
           evidence_revision=greatest(evidence_revision,$5)+1,
           revision=revision+1,updated_at=now()
       WHERE user_id=$1 AND character_id=$2`,
      [
        userId,
        characterId,
        projection.nextStage,
        projection.policyVersion,
        guest.evidence_revision,
      ],
    );
    await client.query(
      `DELETE FROM user_character_relationships
       WHERE user_id=$1 AND character_id=$2`,
      [guestId, characterId],
    );
  }
}

export async function mergeGuestIntoUser(guestId: string, userId: string) {
  if (guestId === userId) return;
  if (!databaseEnabled) {
    for (const thread of platform.threads.filter(
      (item) => item.userId === guestId,
    )) {
      const target = platform.threads.find(
        (item) =>
          item.userId === userId && item.characterId === thread.characterId,
      );
      if (target) {
        for (const outbox of platform.relationshipOutbox) {
          if (
            outbox.userId === guestId &&
            outbox.payload.threadId === thread.id
          )
            outbox.payload.threadId = target.id;
        }
        for (const message of platform.messages.filter(
          (item) => item.threadId === thread.id,
        ))
          message.threadId = target.id;
        platform.epochs
          .filter((item) => item.threadId === thread.id)
          .forEach((epoch) => (epoch.threadId = target.id));
        platform.threads.splice(platform.threads.indexOf(thread), 1);
      } else thread.userId = userId;
    }
    mergeLearningEventsInMemory(guestId, userId);
    mergeRelationshipsInMemory(guestId, userId);
    platform.memories
      .filter((item) => item.userId === guestId)
      .forEach((item) => (item.userId = userId));
    platform.mastery
      .filter((item) => item.userId === guestId)
      .forEach((item) => (item.userId = userId));
    platform.tasks
      .filter((item) => item.createdBy === guestId)
      .forEach((item) => (item.createdBy = userId));
    const guestCollection = platform.collections.find(
      (item) => item.userId === guestId,
    );
    const userCollection = platform.collections.find(
      (item) => item.userId === userId,
    );
    if (guestCollection && userCollection) {
      userCollection.ownedCharacterIds = [
        ...new Set([
          ...userCollection.ownedCharacterIds,
          ...guestCollection.ownedCharacterIds,
        ]),
      ];
      userCollection.stars = Math.max(
        userCollection.stars,
        guestCollection.stars,
      );
      userCollection.fragments = Math.max(
        userCollection.fragments,
        guestCollection.fragments,
      );
      userCollection.firstFreeEligible ||= guestCollection.firstFreeEligible;
      userCollection.firstFreeUsed ||= guestCollection.firstFreeUsed;
      platform.collections.splice(
        platform.collections.indexOf(guestCollection),
        1,
      );
    } else if (guestCollection) guestCollection.userId = userId;
    platform.draws
      .filter((item) => item.userId === guestId)
      .forEach((item) => (item.userId = userId));
    for (const visit of platform.hallVisits.filter((item) => item.userId === guestId)) {
      const target = platform.hallVisits.find((item) => item.userId === userId && item.hallId === visit.hallId);
      if (target) {
        target.viewedObjectIds = [...new Set([...target.viewedObjectIds, ...visit.viewedObjectIds])];
        target.visitedCharacterIds = [...new Set([...target.visitedCharacterIds, ...visit.visitedCharacterIds])];
        target.completedStationIds = [...new Set([...target.completedStationIds, ...visit.completedStationIds])];
        target.updatedAt = target.updatedAt > visit.updatedAt ? target.updatedAt : visit.updatedAt;
        target.revision++;
        platform.hallVisits.splice(platform.hallVisits.indexOf(visit), 1);
      } else visit.userId = userId;
    }
    persist();
    return;
  }
  await transaction(async (client) => {
    await ensureUser(userId, client);
    await client.query(
      `SELECT id FROM users
       WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [[guestId, userId]],
    );
    await client.query(
      `SELECT 1 FROM user_character_relationships
       WHERE user_id IN ($1,$2)
       ORDER BY user_id,character_id FOR UPDATE`,
      [guestId, userId],
    );
    const guestThreads = (
      await client.query("SELECT * FROM character_threads WHERE user_id=$1", [
        guestId,
      ])
    ).rows;
    for (const row of guestThreads) {
      const target = (
        await client.query(
          "SELECT id FROM character_threads WHERE user_id=$1 AND character_id=$2",
          [userId, row.character_id],
        )
      ).rows[0];
      if (target) {
        await client.query(
          `UPDATE relationship_outbox
           SET payload=jsonb_set(payload,'{threadId}',to_jsonb($1::text),true),
               updated_at=now()
           WHERE user_id=$2 AND payload->>'threadId'=$3`,
          [target.id, guestId, row.id],
        );
        await client.query(
          "UPDATE thread_epochs SET thread_id=$1 WHERE thread_id=$2",
          [target.id, row.id],
        );
        await client.query(
          "UPDATE messages SET thread_id=$1 WHERE thread_id=$2",
          [target.id, row.id],
        );
        await client.query("DELETE FROM character_threads WHERE id=$1", [
          row.id,
        ]);
      } else
        await client.query(
          "UPDATE character_threads SET user_id=$1 WHERE id=$2",
          [userId, row.id],
        );
    }
    await applyGuestRelationshipMemoryCutoffsWithClient(
      guestId,
      userId,
      client,
    );
    await client.query("UPDATE memories SET user_id=$1 WHERE user_id=$2", [
      userId,
      guestId,
    ]);
    const guestMastery = (
      await client.query("SELECT * FROM mastery_topics WHERE user_id=$1", [
        guestId,
      ])
    ).rows;
    for (const row of guestMastery) {
      const target = (
        await client.query(
          "SELECT id FROM mastery_topics WHERE user_id=$1 AND topic_id=$2",
          [userId, row.topic_id],
        )
      ).rows[0];
      if (target) {
        await client.query(
          "INSERT INTO mastery_evidence(mastery_id,message_id,kind,created_at) SELECT $1,message_id,kind,created_at FROM mastery_evidence WHERE mastery_id=$2 ON CONFLICT DO NOTHING",
          [target.id, row.id],
        );
        await client.query("DELETE FROM mastery_topics WHERE id=$1", [row.id]);
      } else
        await client.query("UPDATE mastery_topics SET user_id=$1 WHERE id=$2", [
          userId,
          row.id,
        ]);
    }
    await client.query("UPDATE agent_tasks SET user_id=$1 WHERE user_id=$2", [
      userId,
      guestId,
    ]);
    const guestCollection = (
      await client.query("SELECT * FROM user_collections WHERE user_id=$1", [
        guestId,
      ])
    ).rows[0];
    if (guestCollection) {
      const own = (
        await client.query("SELECT * FROM user_collections WHERE user_id=$1", [
          userId,
        ])
      ).rows[0];
      if (own) {
        const ids = [
          ...new Set([
            ...(own.owned_character_ids ?? []),
            ...(guestCollection.owned_character_ids ?? []),
          ]),
        ];
        await client.query(
          "UPDATE user_collections SET owned_character_ids=$1,stars=greatest(stars,$2),fragments=greatest(fragments,$3),first_free_eligible=first_free_eligible OR $4,first_free_used=first_free_used OR $5,revision=revision+1,updated_at=now() WHERE user_id=$6",
          [
            JSON.stringify(ids),
            guestCollection.stars,
            guestCollection.fragments,
            guestCollection.first_free_eligible,
            guestCollection.first_free_used,
            userId,
          ],
        );
        await client.query("DELETE FROM user_collections WHERE user_id=$1", [
          guestId,
        ]);
      } else
        await client.query(
          "UPDATE user_collections SET user_id=$1 WHERE user_id=$2",
          [userId, guestId],
        );
    }
    await mergeLearningEventsWithClient(guestId, userId, client);
    await client.query(
      "DELETE FROM character_draws g USING character_draws u WHERE g.user_id=$1 AND u.user_id=$2 AND g.idempotency_key=u.idempotency_key",
      [guestId, userId],
    );
    await client.query(
      "UPDATE character_draws SET user_id=$1 WHERE user_id=$2",
      [userId, guestId],
    );
    await client.query(
      "DELETE FROM hall_visit_states g USING hall_visit_states u WHERE g.user_id=$1 AND u.user_id=$2 AND g.hall_id=u.hall_id",
      [guestId, userId],
    );
    await client.query(
      "UPDATE hall_visit_states SET user_id=$1 WHERE user_id=$2",
      [userId, guestId],
    );
    await mergeRelationshipsWithClient(guestId, userId, client);
  });
}
