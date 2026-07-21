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
  ThreadEpoch,
} from "@ai-museum/sdk";
import { databaseEnabled, query as dbQuery, transaction } from "./database";

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
        (characterId === undefined || memory.characterId === characterId),
    );
  const result = await dbQuery(
    `${memorySelect} WHERE m.user_id=$1 ${characterId ? "AND m.character_id=$2" : ""} GROUP BY m.id ORDER BY m.updated_at DESC`,
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

export async function createMemory(
  input: Omit<MemoryRecord, "id" | "recallCount" | "createdAt" | "updatedAt">,
) {
  if (!databaseEnabled) {
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

export async function updateMemory(
  id: string,
  userId: string,
  patch: Partial<
    Pick<MemoryRecord, "content" | "status" | "importance" | "confidence">
  >,
) {
  if (!databaseEnabled) {
    const memory = platform.memories.find(
      (item) => item.id === id && item.userId === userId,
    );
    if (!memory) return null;
    Object.assign(memory, patch, { updatedAt: new Date().toISOString() });
    persist();
    return memory;
  }
  const current = await dbQuery(
    "SELECT * FROM memories WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  if (!current.rows[0]) return null;
  const next = { ...asMemory(current.rows[0]), ...patch };
  const result = await dbQuery(
    "UPDATE memories SET content=$1,status=$2,importance=$3,confidence=$4,updated_at=now() WHERE id=$5 AND user_id=$6 RETURNING *",
    [next.content, next.status, next.importance, next.confidence, id, userId],
  );
  return asMemory({
    ...result.rows[0],
    source_message_ids: next.sourceMessageIds,
  });
}
export async function recallMemory(memory: MemoryRecord) {
  if (!databaseEnabled) {
    memory.recallCount++;
    memory.lastRecalledAt = new Date().toISOString();
    memory.updatedAt = memory.lastRecalledAt;
    persist();
    return;
  }
  await dbQuery(
    "UPDATE memories SET recall_count=recall_count+1,last_recalled_at=now(),updated_at=now() WHERE id=$1",
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
    platform.learningEvents
      .filter((item) => item.userId === guestId)
      .forEach((item) => (item.userId = userId));
    platform.draws
      .filter((item) => item.userId === guestId)
      .forEach((item) => (item.userId = userId));
    persist();
    return;
  }
  await transaction(async (client) => {
    await ensureUser(userId, client);
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
    await client.query(
      "DELETE FROM learning_events g USING learning_events u WHERE g.user_id=$1 AND u.user_id=$2 AND (g.idempotency_key=u.idempotency_key OR (g.type='encounter_completed' AND u.type=g.type AND u.character_id=g.character_id))",
      [guestId, userId],
    );
    await client.query(
      "UPDATE learning_events SET user_id=$1 WHERE user_id=$2",
      [userId, guestId],
    );
    await client.query(
      "DELETE FROM character_draws g USING character_draws u WHERE g.user_id=$1 AND u.user_id=$2 AND g.idempotency_key=u.idempotency_key",
      [guestId, userId],
    );
    await client.query(
      "UPDATE character_draws SET user_id=$1 WHERE user_id=$2",
      [userId, guestId],
    );
  });
}
