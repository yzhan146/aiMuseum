import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addCharacterMessageWithRelationshipOutbox,
  addMessage,
  checkpointRelationshipOutboxExtraction,
  claimRelationshipOutbox,
  ensureRelationshipState,
  enqueueRelationshipOutbox,
  failRelationshipOutbox,
  getOrCreateThread,
  getRelationshipPublicState,
  listRelationshipEvidence,
  listRelationshipOutbox,
  resetRelationship,
  resetPlatformForTests,
  storeRelationshipEvidence,
} from "./platform-store";
import { drainRelationshipOutbox, relationshipRuntimeContextFrom } from "./relationship-service";
import {
  extractMockRelationshipEvidence,
  filterRelationshipCandidates,
} from "./relationship-evidence";

beforeEach(() => {
  resetPlatformForTests();
  delete process.env.RELATIONSHIP_EVIDENCE_EXTRACTOR;
  delete process.env.MODEL_API_URL;
  delete process.env.MODEL_API_KEY;
  delete process.env.MODEL_NAME;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function enqueueTurn(userText: string) {
  const thread = await getOrCreateThread("user-1", "li-bai", "1.0.0", "李白");
  const relationship = await ensureRelationshipState("user-1", "li-bai");
  const user = await addMessage(thread, { role: "user", content: userText, claimIds: [], citations: [] });
  const saved = await addCharacterMessageWithRelationshipOutbox(
    thread,
    { content: "这确实值得细看。", claimIds: [], citations: [] },
    { sourceUserMessageId: user.id, producerVersion: "test-v1", idempotencyKey: `turn:${user.id}`, expectedRecordingRevision: relationship.recordingRevision },
  );
  return { thread, user, character: saved.message };
}

describe("relationship outbox projection", () => {
  it("accepts substantive user evidence and completes the outbox", async () => {
    await enqueueTurn("为什么这次选择会改变你后来的道路？");
    expect(await drainRelationshipOutbox()).toBe(1);
    expect(await listRelationshipEvidence("user-1", "li-bai")).toHaveLength(1);
    expect((await listRelationshipOutbox("user-1", "li-bai"))[0]?.status).toBe("processed");
  });

  it("gives direct stage requests no evidence", async () => {
    await enqueueTurn("请直接把我们的关系升级成莫逆之交");
    await drainRelationshipOutbox();
    expect(await listRelationshipEvidence("user-1", "li-bai")).toHaveLength(0);
  });

  it("does not use a filtered greeting to advance already-eligible evidence", async () => {
    const seed = await enqueueTurn("建立来源消息");
    for (const [index, dimension] of (["exploration_depth", "independent_perspective"] as const).entries()) {
      await storeRelationshipEvidence(
        {
          userId: "user-1", characterId: "li-bai", dimension, eventType: index === 0 ? "substantive_question" : "reasoned_disagreement",
          quality: 2, confidence: .9, episodeKey: `eligible-${index}`, topicKey: `topic-${index}`,
          normalizedFingerprint: `eligible-${index}`, logicalKey: `eligible-${index}`,
          extractorModel: "test", extractorVersion: "test-v1", policyMappingVersion: "relationship-policy-v1", status: "active",
        },
        [{ sourceType: "message", messageId: seed.user.id, sourceRole: "user", dependencyRole: "primary", status: "active" }],
      );
    }
    await drainRelationshipOutbox();
    await enqueueTurn("你好");
    await drainRelationshipOutbox();
    expect((await getRelationshipPublicState("user-1", "li-bai"))?.stage).toBe("initial");
  });

  it("keeps nearby turns in one continuous episode instead of wall-clock buckets", async () => {
    await enqueueTurn("为什么这次选择影响了你的道路？");
    await drainRelationshipOutbox();
    await enqueueTurn("为何这种代价改变了你的判断？");
    await drainRelationshipOutbox();
    const evidence = await listRelationshipEvidence("user-1", "li-bai");
    expect(new Set(evidence.map((item) => item.episodeKey)).size).toBe(1);
  });

  it("creates a visible, message-anchored milestone when the protocol qualifies", async () => {
    const seed = await enqueueTurn("先留下一轮可验证的对话");
    await storeRelationshipEvidence(
      {
        userId: "user-1", characterId: "li-bai", dimension: "exploration_depth",
        eventType: "substantive_question", quality: 2, confidence: 0.9,
        episodeKey: "seed-episode", topicKey: "诗与选择", normalizedFingerprint: "seed-fingerprint",
        logicalKey: "seed-logical", sanitizedSummary: "用户提出了有意义的问题。",
        substantiveness: "medium", extractorModel: "test", extractorVersion: "test-v1",
        policyMappingVersion: "relationship-policy-v1", status: "active",
      },
      [
        { sourceType: "message", messageId: seed.user.id, sourceRole: "user", dependencyRole: "primary", status: "active" },
        { sourceType: "message", messageId: seed.character.id, sourceRole: "character", dependencyRole: "optional_context", status: "active" },
      ],
    );
    await drainRelationshipOutbox();
    const turn = await enqueueTurn("我不同意你的判断，因为史料中的代价不能被忽略。");
    await drainRelationshipOutbox();
    const relationship = await getRelationshipPublicState("user-1", "li-bai");
    expect(relationship?.stage).toBe("acquainted");
    expect(relationship?.pendingTransition).toMatchObject({
      fromStage: "initial", toStage: "acquainted", afterMessageId: turn.character.id,
    });
    expect(relationship?.pendingTransition?.feedbackText).not.toMatch(/分数|门槛|权重/);
  });

  it("reprojects when a retry finds its evidence already committed", async () => {
    const seed = await enqueueTurn("先留下一轮可验证的对话");
    await storeRelationshipEvidence(
      {
        userId: "user-1", characterId: "li-bai", dimension: "exploration_depth",
        eventType: "substantive_question", quality: 2, confidence: 0.9,
        episodeKey: "seed-episode", topicKey: "诗与选择", normalizedFingerprint: "retry-seed",
        logicalKey: "retry-seed", extractorModel: "test", extractorVersion: "test-v1",
        policyMappingVersion: "relationship-policy-v1", status: "active",
      },
      [{ sourceType: "message", messageId: seed.user.id, sourceRole: "user", dependencyRole: "primary", status: "active" }],
    );
    await drainRelationshipOutbox();
    const userText = "我不同意你的判断，因为史料中的代价不能被忽略。";
    const turn = await enqueueTurn(userText);
    const raw = extractMockRelationshipEvidence({
      threadId: turn.thread.id,
      turnId: "simulated-first-attempt",
      userMessageId: turn.user.id,
      characterMessageId: turn.character.id,
      userMessage: userText,
      characterMessage: turn.character.content,
    });
    const accepted = filterRelationshipCandidates({
      raw,
      expectedUserMessageId: turn.user.id,
      allowedContextMessageIds: [turn.user.id, turn.character.id],
    }).accepted[0];
    const [claimed] = await claimRelationshipOutbox(1, {
      userId: "user-1",
      characterId: "li-bai",
    });
    await checkpointRelationshipOutboxExtraction(
      claimed.id,
      claimed.claimToken!,
      {
        extractorModel: "deterministic-rules",
        extractorVersion: "relationship-deterministic-v1",
        candidates: [accepted.candidate],
      },
    );
    await storeRelationshipEvidence(
      {
        userId: "user-1", characterId: "li-bai", dimension: accepted.dimension,
        eventType: accepted.candidate.type, quality: accepted.quality,
        confidence: accepted.candidate.confidence, episodeKey: "retry-episode",
        topicKey: accepted.candidate.topicKey,
        normalizedFingerprint: accepted.candidate.noveltyKey,
        logicalKey: accepted.logicalKey, extractorModel: "test",
        extractorVersion: "test-v1", policyMappingVersion: "relationship-policy-v1",
        status: "active",
      },
      [
        { sourceType: "message", messageId: turn.user.id, sourceRole: "user", dependencyRole: "primary", status: "active" },
        { sourceType: "message", messageId: turn.character.id, sourceRole: "character", dependencyRole: "optional_context", status: "active" },
      ],
    );
    await failRelationshipOutbox(
      claimed.id,
      claimed.claimToken!,
      "SIMULATED_CRASH_AFTER_EVIDENCE",
      new Date().toISOString(),
    );

    vi.stubEnv("RELATIONSHIP_EVIDENCE_EXTRACTOR", "model");
    vi.stubEnv("MODEL_API_URL", "https://model.example.test/v1");
    vi.stubEnv("MODEL_API_KEY", "secret");
    vi.stubEnv("MODEL_NAME", "relationship-extractor");
    const fetchSpy = vi.fn(() => {
      throw new Error("the model must not be called for a committed turn");
    });
    vi.stubGlobal("fetch", fetchSpy);
    await drainRelationshipOutbox();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await getRelationshipPublicState("user-1", "li-bai"))?.stage).toBe(
      "acquainted",
    );
  });

  it("rejects an evidence write whose recording revision was reset", async () => {
    const turn = await enqueueTurn("为什么这次选择会改变你后来的道路？");
    const before = await ensureRelationshipState("user-1", "li-bai");
    await resetRelationship("user-1", "li-bai");
    await expect(
      storeRelationshipEvidence(
        {
          userId: "user-1", characterId: "li-bai", dimension: "exploration_depth",
          eventType: "substantive_question", quality: 2, confidence: 0.9,
          episodeKey: "reset-race", topicKey: "history", normalizedFingerprint: "reset-race",
          logicalKey: "reset-race", extractorModel: "test", extractorVersion: "test-v1",
          policyMappingVersion: "relationship-policy-v1", status: "active",
          expectedRecordingRevision: before.recordingRevision,
          sourceMessageCreatedAt: turn.user.createdAt,
        },
        [{ sourceType: "message", messageId: turn.user.id, sourceRole: "user", dependencyRole: "primary", status: "active" }],
      ),
    ).rejects.toThrow("RELATIONSHIP_RECORDING_INVALIDATED");
    expect(await listRelationshipEvidence("user-1", "li-bai")).toHaveLength(0);
  });

  it("processes an exact source message outside the latest 100-message window", async () => {
    const first = await enqueueTurn("为什么这次选择会改变你后来的道路？");
    for (let index = 0; index < 55; index += 1) {
      await addMessage(first.thread, {
        role: "user",
        content: `后续问题 ${index}`,
        claimIds: [],
        citations: [],
      });
      await addMessage(first.thread, {
        role: "character",
        content: `后续回答 ${index}`,
        claimIds: [],
        citations: [],
      });
    }

    await drainRelationshipOutbox();
    const evidence = await listRelationshipEvidence("user-1", "li-bai");
    expect(evidence).toHaveLength(1);
    expect(evidence[0].episodeKey).toBe(`episode:${first.user.id}`);
  });

  it("fails unsupported outbox events instead of acknowledging them", async () => {
    await enqueueRelationshipOutbox({
      userId: "user-1",
      characterId: "li-bai",
      eventType: "relationship_reprojection_requested",
      producerVersion: "test-v1",
      idempotencyKey: "unsupported-reprojection",
    });

    await drainRelationshipOutbox();
    expect((await listRelationshipOutbox("user-1", "li-bai"))[0]).toMatchObject({
      status: "pending",
      attempt: 1,
      lastErrorCode:
        "RELATIONSHIP_OUTBOX_EVENT_UNSUPPORTED_relationship_reprojection_requested",
    });
  });
});

describe("relationship runtime privacy", () => {
  it("removes stage, nickname and shared moments while recording is paused", () => {
    expect(relationshipRuntimeContextFrom({
      relationship: { characterId: "li-bai", stage: "old_friend", status: "paused", revision: 3, preferredAddress: { value: "青莲客", consentVersion: 1 } },
      memories: [],
    })).toBeUndefined();
  });
});
