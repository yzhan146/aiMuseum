import { beforeEach, describe, expect, it } from "vitest";
import { einsteinPack } from "@ai-museum/characters";
import {
  addMessage,
  createMemory,
  deleteThreadForUser,
  deleteUserData,
  ensureRelationshipState,
  exportUserData,
  getOrCreateThread,
  getRelationshipPublicState,
  listMemories,
  listRelationshipEvidence,
  listRelationshipEvidenceSources,
  listThreads,
  recallMemory,
  resetPlatformForTests,
  resetRelationship,
  storeRelationshipEvidence,
  updateMemory,
} from "./platform-store";

const userId = "guest:data-lifecycle";
const characterId = einsteinPack.manifest.id;

beforeEach(() => resetPlatformForTests());

async function seedRelationshipData() {
  const thread = await getOrCreateThread(
    userId,
    characterId,
    einsteinPack.manifest.version,
    "Einstein",
  );
  const message = await addMessage(thread, {
    role: "user",
    content: "我想比较相对论与经典力学的证据。",
    claimIds: [],
    citations: [],
  });
  await ensureRelationshipState(userId, characterId);
  await storeRelationshipEvidence(
    {
      userId,
      characterId,
      dimension: "exploration_depth",
      eventType: "substantive_question",
      quality: 2,
      confidence: 0.9,
      episodeKey: "episode:one",
      topicKey: "relativity",
      normalizedFingerprint: "question:relativity:comparison",
      logicalKey: "substantive_question:relativity:comparison",
      sanitizedSummary: "用户比较两种理论的证据。",
      stance: "not_applicable",
      substantiveness: "high",
      extractorModel: "test",
      extractorVersion: "test-v1",
      policyMappingVersion: "relationship-policy-v1",
      status: "active",
    },
    [
      {
        sourceType: "message",
        messageId: message.id,
        sourceRole: "user",
        dependencyRole: "primary",
        status: "active",
      },
    ],
  );
  await createMemory({
    userId,
    characterId,
    type: "character_relationship",
    content: "我们曾比较两种理论的证据。",
    sourceMessageIds: [message.id],
    confidence: 0.9,
    importance: 0.7,
    sensitivity: "low",
    status: "active",
  });
  return thread;
}

describe("relationship data lifecycle", () => {
  it("includes internal relationship evidence in the account export", async () => {
    await seedRelationshipData();

    const exported = await exportUserData(userId);

    expect(exported.schemaVersion).toBe("ai-museum-user-export-v1");
    expect(exported.relationships.states).toHaveLength(1);
    expect(exported.relationships.evidence).toEqual([
      expect.objectContaining({
        dimension: "exploration_depth",
        quality: 2,
        policyMappingVersion: "relationship-policy-v1",
      }),
    ]);
    expect(exported.relationships.evidenceSources).toHaveLength(1);
    expect(exported.conversations.messages).toHaveLength(1);
  });

  it("deletes the relationship aggregate before removing its thread", async () => {
    const thread = await seedRelationshipData();

    expect(await deleteThreadForUser(thread.id, userId)).toBe(true);

    expect(await listThreads(userId)).toHaveLength(0);
    expect(await listMemories(userId, characterId)).toHaveLength(0);
    expect(await getRelationshipPublicState(userId, characterId)).toBeNull();
  });

  it("removes all relationship-derived data with the user", async () => {
    await seedRelationshipData();

    expect(await deleteUserData(userId)).toBe(true);
    const exported = await exportUserData(userId);

    expect(exported.conversations.threads).toHaveLength(0);
    expect(exported.memories).toHaveLength(0);
    expect(exported.relationships.states).toHaveLength(0);
    expect(exported.relationships.evidence).toHaveLength(0);
    expect(exported.relationships.evidenceSources).toHaveLength(0);
  });

  it("preserves partial memory fields and propagates required-support lifecycle", async () => {
    const thread = await getOrCreateThread(
      userId,
      characterId,
      einsteinPack.manifest.version,
      "Einstein",
    );
    const message = await addMessage(thread, {
      role: "user",
      content: "我想继续比较这两种证据。",
      claimIds: [],
      citations: [],
    });
    await ensureRelationshipState(userId, characterId);
    const memory = await createMemory({
      userId,
      characterId,
      type: "character_relationship",
      content: "我们曾比较两种理论的证据。",
      sourceMessageIds: [message.id],
      confidence: 0.9,
      importance: 0.7,
      sensitivity: "low",
      status: "active",
    });
    const stored = await storeRelationshipEvidence(
      {
        userId,
        characterId,
        dimension: "continuity",
        eventType: "revisited_prior_topic",
        quality: 2,
        confidence: 0.9,
        episodeKey: "episode:memory-support",
        topicKey: "relativity",
        normalizedFingerprint: "memory-support",
        logicalKey: "memory-support",
        extractorModel: "test",
        extractorVersion: "test-v1",
        policyMappingVersion: "relationship-policy-v1",
        status: "active",
      },
      [
        {
          sourceType: "message",
          messageId: message.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
        {
          sourceType: "memory",
          memoryId: memory.id,
          sourceRole: "system",
          dependencyRole: "required_support",
          status: "active",
        },
      ],
    );

    const suppressed = await updateMemory(memory.id, userId, {
      status: "suppressed",
      content: undefined,
    });
    expect(suppressed).toMatchObject({
      content: "我们曾比较两种理论的证据。",
      confidence: 0.9,
      importance: 0.7,
      status: "suppressed",
    });
    expect((await listRelationshipEvidence(userId, characterId))[0]?.status).toBe(
      "suspended",
    );
    expect(
      (await listRelationshipEvidenceSources(stored.evidence.id)).find(
        (source) => source.memoryId === memory.id,
      )?.status,
    ).toBe("suspended");
    await expect(
      storeRelationshipEvidence(
        {
          userId,
          characterId,
          dimension: "continuity",
          eventType: "revisited_prior_topic",
          quality: 2,
          confidence: 0.9,
          episodeKey: "episode:inactive-memory",
          topicKey: "relativity",
          normalizedFingerprint: "inactive-memory",
          logicalKey: "inactive-memory",
          extractorModel: "test",
          extractorVersion: "test-v1",
          policyMappingVersion: "relationship-policy-v1",
          status: "active",
        },
        [
          {
            sourceType: "message",
            messageId: message.id,
            sourceRole: "user",
            dependencyRole: "primary",
            status: "active",
          },
          {
            sourceType: "memory",
            memoryId: memory.id,
            sourceRole: "system",
            dependencyRole: "required_support",
            status: "suspended",
          },
        ],
      ),
    ).rejects.toThrow("RELATIONSHIP_EVIDENCE_MEMORY_INACTIVE");

    await updateMemory(memory.id, userId, { status: "active" });
    expect((await listRelationshipEvidence(userId, characterId))[0]?.status).toBe(
      "active",
    );

    await updateMemory(memory.id, userId, { status: "forgotten" });
    expect(
      (await listMemories(userId, characterId)).find(
        (item) => item.id === memory.id,
      ),
    ).toBeUndefined();
    expect(
      (await exportUserData(userId)).memories.find(
        (item) => item.id === memory.id,
      ),
    ).toMatchObject({
      content: "[已忘记]",
      sourceMessageIds: [],
      confidence: 0,
      importance: 0,
    });
    await expect(
      updateMemory(memory.id, userId, { status: "active" }),
    ).rejects.toThrow("MEMORY_FORGOTTEN_IS_TERMINAL");
    await expect(
      updateMemory(memory.id, userId, { content: "恢复已删除内容" }),
    ).rejects.toThrow("MEMORY_FORGOTTEN_IS_TERMINAL");
    await recallMemory(memory);
    expect(
      (await exportUserData(userId)).memories.find(
        (item) => item.id === memory.id,
      ),
    ).toMatchObject({
      status: "forgotten",
      content: "[已忘记]",
      sourceMessageIds: [],
      confidence: 0,
      importance: 0,
      recallCount: 0,
      lastRecalledAt: undefined,
    });
    expect((await listRelationshipEvidence(userId, characterId))[0]?.status).toBe(
      "revoked",
    );
    expect(
      (await listRelationshipEvidenceSources(stored.evidence.id)).find(
        (source) => source.memoryId === memory.id,
      )?.status,
    ).toBe("revoked");
  });

  it("does not recreate relationship memory from a turn invalidated by reset", async () => {
    const thread = await getOrCreateThread(
      userId,
      characterId,
      einsteinPack.manifest.version,
      "Einstein",
    );
    const userMessage = await addMessage(thread, {
      role: "user",
      content: "这条消息会在重置前创建。",
      claimIds: [],
      citations: [],
    });
    const characterMessage = await addMessage(thread, {
      role: "character",
      content: "这条回复也在重置前创建。",
      claimIds: [],
      citations: [],
    });
    const state = await ensureRelationshipState(userId, characterId);

    await resetRelationship(userId, characterId);

    const staleMemory = await createMemory(
      {
        userId,
        characterId,
        type: "character_relationship",
        content: "不应在重置后重新出现",
        sourceMessageIds: [userMessage.id, characterMessage.id],
        confidence: 0.8,
        importance: 0.6,
        sensitivity: "low",
        status: "active",
      },
      {
        expectedRecordingRevision: state.recordingRevision,
        sourceMessageCreatedAt: userMessage.createdAt,
      },
    );

    expect(staleMemory).toBeNull();
    expect(await listMemories(userId, characterId)).toEqual([]);
  });
});
