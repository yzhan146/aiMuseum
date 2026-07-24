import { beforeEach, describe, expect, it } from "vitest";
import type {
  RelationshipStage,
} from "@ai-museum/sdk";
import {
  acknowledgeRelationshipTransition,
  addCharacterMessageWithRelationshipOutbox,
  addLearningEvent,
  addMessage,
  claimRelationshipOutbox,
  checkpointRelationshipOutboxExtraction,
  completeRelationshipOutbox,
  createMemory,
  deleteRelationship,
  ensureRelationshipState,
  enqueueRelationshipOutbox,
  failRelationshipOutbox,
  getOrCreateThread,
  getRelationshipPublicState,
  grantPreferredAddress,
  listMessages,
  listRelationshipEvidence,
  listRelationshipEvidenceSources,
  listRelationshipOutbox,
  listRelationshipPublicStates,
  mergeGuestIntoUser,
  platform,
  recordRelationshipTransition,
  resetPlatformForTests,
  resetRelationship,
  revokePreferredAddress,
  setRelationshipStatus,
  storeRelationshipEvidence,
} from "./platform-store";

beforeEach(resetPlatformForTests);

const characterId = "albert-einstein";

function evidenceInput(
  userId: string,
  logicalKey: string,
) {
  return {
    userId,
    characterId,
    dimension: "exploration_depth" as const,
    eventType: "substantive_question" as const,
    quality: 2 as const,
    confidence: 0.91,
    episodeKey: "relativity-episode",
    topicKey: "relativity",
    normalizedFingerprint: `fingerprint:${logicalKey}`,
    logicalKey,
    sanitizedSummary: "Asked a substantive question about relativity.",
    stance: "not_applicable" as const,
    substantiveness: "high" as const,
    extractorModel: "test-model",
    extractorVersion: "relationship-extractor-v1",
    policyMappingVersion: "relationship-policy-v1",
    status: "active" as const,
  };
}

async function conversation(userId: string) {
  const thread = await getOrCreateThread(
    userId,
    characterId,
    "1.0.0",
    "Einstein",
  );
  const userMessage = await addMessage(thread, {
    role: "user",
    content: "How did your view of relativity evolve?",
    claimIds: [],
    citations: [],
  });
  const characterMessage = await addMessage(thread, {
    role: "character",
    content: "It changed over many years.",
    claimIds: [],
    citations: [],
  });
  return { thread, userMessage, characterMessage };
}

async function promote(
  userId: string,
  fromStage: RelationshipStage,
  toStage: RelationshipStage,
  suffix: string,
) {
  const { characterMessage } = await conversation(userId);
  const state = await ensureRelationshipState(userId, characterId);
  return recordRelationshipTransition({
    userId,
    characterId,
    fromStage,
    toStage,
    policyVersion: "relationship-policy-v1",
    evidenceRevision: state.evidenceRevision,
    evidenceSnapshotHash: `snapshot:${suffix}`,
    triggerType: "evidence_projection",
    feedbackText: `Relationship advanced to ${toStage}.`,
    afterMessageId: characterMessage.id,
    idempotencyKey: `transition:${suffix}`,
  });
}

describe("relationship public state and consent", () => {
  it("ensures and lists only the public relationship projection", async () => {
    const state = await ensureRelationshipState("u1", characterId);
    const publicState = await getRelationshipPublicState("u1", characterId);

    expect(state.stage).toBe("initial");
    expect(publicState).toEqual({
      characterId,
      stage: "initial",
      status: "active",
      stageChangedAt: state.stageChangedAt,
      revision: 1,
      preferredAddress: undefined,
      pendingTransition: undefined,
    });
    expect(await listRelationshipPublicStates("u1")).toEqual([publicState]);
    expect(JSON.stringify(publicState)).not.toContain("evidenceRevision");
    expect(JSON.stringify(publicState)).not.toContain("policyVersion");
  });

  it("retains the visible stage while paused and resumed", async () => {
    await promote("u1", "initial", "acquainted", "u1-acquainted");
    const before = await getRelationshipPublicState("u1", characterId);
    const recordingBefore = (
      await ensureRelationshipState("u1", characterId)
    ).recordingRevision;
    const paused = await setRelationshipStatus(
      "u1",
      characterId,
      "paused",
      before!.revision,
    );
    const pausedRecordingRevision = paused.recordingRevision;
    const resumed = await setRelationshipStatus(
      "u1",
      characterId,
      "active",
      paused.revision,
    );

    expect(paused.stage).toBe("acquainted");
    expect(resumed.stage).toBe("acquainted");
    expect(pausedRecordingRevision).toBe(recordingBefore + 1);
    expect(resumed.recordingRevision).toBe(recordingBefore + 2);
    expect((await getRelationshipPublicState("u1", characterId))?.stage).toBe(
      "acquainted",
    );
  });

  it("grants and revokes the preferred address without leaking revoked consent", async () => {
    await promote("u1", "initial", "acquainted", "address-acquainted");
    await promote("u1", "acquainted", "young_friend", "address-young");
    const granted = await grantPreferredAddress("u1", characterId, "小爱");
    expect(granted.consentVersion).toBe(1);
    expect(
      (await getRelationshipPublicState("u1", characterId))?.preferredAddress,
    ).toEqual({ value: "小爱", consentVersion: 1 });

    const revoked = await revokePreferredAddress("u1", characterId);
    expect(revoked?.consentVersion).toBe(2);
    expect(
      (await getRelationshipPublicState("u1", characterId))?.preferredAddress,
    ).toBeUndefined();
    await expect(
      grantPreferredAddress("u1", characterId, " nickname "),
    ).rejects.toThrow("INVALID_PREFERRED_ADDRESS");
  });
});

describe("relationship evidence, transition, and reset", () => {
  it("stores one primary user source and deduplicates by logical key", async () => {
    const { userMessage } = await conversation("u1");
    const input = evidenceInput("u1", "logical:one");
    const source = {
      sourceType: "message" as const,
      messageId: userMessage.id,
      sourceRole: "user" as const,
      dependencyRole: "primary" as const,
      status: "active" as const,
    };

    const first = await storeRelationshipEvidence(input, [source]);
    const duplicate = await storeRelationshipEvidence(input, [source]);
    const repeatedTurn = await storeRelationshipEvidence(
      { ...input, logicalKey: "logical:two" },
      [source],
    );

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(repeatedTurn.created).toBe(false);
    expect(repeatedTurn.evidence.id).toBe(first.evidence.id);
    expect(await listRelationshipEvidence("u1", characterId)).toHaveLength(1);
    expect(await listRelationshipEvidenceSources(first.evidence.id)).toHaveLength(
      1,
    );
  });

  it("rejects evidence whose primary source belongs to another user", async () => {
    const { userMessage } = await conversation("u2");
    await expect(
      storeRelationshipEvidence(evidenceInput("u1", "logical:spoof"), [
        {
          sourceType: "message",
          messageId: userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
      ]),
    ).rejects.toThrow("RELATIONSHIP_EVIDENCE_SOURCE_NOT_OWNED");
  });

  it("rejects a transition built from a stale evidence snapshot", async () => {
    const { userMessage, characterMessage } = await conversation("u1");
    const before = await ensureRelationshipState("u1", characterId);
    const staleEvidenceRevision = before.evidenceRevision;
    await storeRelationshipEvidence(evidenceInput("u1", "snapshot-race"), [
      {
        sourceType: "message",
        messageId: userMessage.id,
        sourceRole: "user",
        dependencyRole: "primary",
        status: "active",
      },
    ]);

    await expect(
      recordRelationshipTransition({
        userId: "u1",
        characterId,
        fromStage: "initial",
        toStage: "acquainted",
        policyVersion: "relationship-policy-v1",
        evidenceRevision: staleEvidenceRevision,
        evidenceSnapshotHash: "stale-snapshot",
        triggerType: "evidence_projection",
        feedbackText: "This must not be committed.",
        afterMessageId: characterMessage.id,
        idempotencyKey: "stale-snapshot",
        expectedEvidenceRevision: staleEvidenceRevision,
      }),
    ).rejects.toThrow("RELATIONSHIP_EVIDENCE_REVISION_CONFLICT");
  });

  it("acknowledges pending stage feedback idempotently", async () => {
    const transition = await promote(
      "u1",
      "initial",
      "acquainted",
      "ack",
    );
    expect(
      (await getRelationshipPublicState("u1", characterId))?.pendingTransition
        ?.id,
    ).toBe(transition.id);

    const first = await acknowledgeRelationshipTransition(
      "u1",
      characterId,
      transition.id,
      "feedback:ack",
    );
    const repeated = await acknowledgeRelationshipTransition(
      "u1",
      characterId,
      transition.id,
      "feedback:ack",
    );

    expect(first?.feedbackStatus).toBe("acknowledged");
    expect(repeated?.revision).toBe(first?.revision);
    expect(
      (await getRelationshipPublicState("u1", characterId))?.pendingTransition,
    ).toBeUndefined();
  });

  it("resets relationship data and nickname but retains conversation messages", async () => {
    const { thread, userMessage } = await conversation("u1");
    await storeRelationshipEvidence(evidenceInput("u1", "logical:reset"), [
      {
        sourceType: "message",
        messageId: userMessage.id,
        sourceRole: "user",
        dependencyRole: "primary",
        status: "active",
      },
    ]);
    await promote("u1", "initial", "acquainted", "reset");
    await promote("u1", "acquainted", "young_friend", "reset-young");
    await grantPreferredAddress("u1", characterId, "小爱");
    await enqueueRelationshipOutbox({
      userId: "u1",
      characterId,
      eventType: "relationship_reprojection_requested",
      producerVersion: "test-v1",
      idempotencyKey: "reset-outbox",
    });
    const beforeMessages = (await listMessages(thread.id, "u1"))!.messages.length;

    const reset = await resetRelationship("u1", characterId);

    expect(reset.stage).toBe("initial");
    expect(reset.evidenceRevision).toBe(0);
    expect(reset.resetCutoffAt).toBeTruthy();
    expect(await listRelationshipEvidence("u1", characterId)).toEqual([]);
    expect(await listRelationshipOutbox("u1", characterId)).toEqual([]);
    const publicState = await getRelationshipPublicState("u1", characterId);
    expect(publicState?.preferredAddress).toBeUndefined();
    expect(publicState?.pendingTransition).toBeUndefined();
    await expect(
      grantPreferredAddress("u1", characterId, "重置前已检查的昵称"),
    ).rejects.toThrow("RELATIONSHIP_PREFERRED_ADDRESS_NOT_ELIGIBLE");
    expect((await listMessages(thread.id, "u1"))!.messages).toHaveLength(
      beforeMessages,
    );
  });
});

describe("relationship outbox", () => {
  it("commits one character message and one outbox record idempotently", async () => {
    const thread = await getOrCreateThread(
      "u1",
      characterId,
      "1.0.0",
      "Einstein",
    );
    const userMessage = await addMessage(thread, {
      role: "user",
      content: "Tell me about your work.",
      claimIds: [],
      citations: [],
    });
    const commit = () =>
      addCharacterMessageWithRelationshipOutbox(
        thread,
        { content: "Of course.", claimIds: [], citations: [] },
        {
          sourceUserMessageId: userMessage.id,
          expectedRecordingRevision: 1,
          producerVersion: "chat-v1",
          idempotencyKey: `message:${userMessage.id}`,
        },
      );

    const first = await commit();
    const repeated = await commit();

    expect(repeated.message.id).toBe(first.message.id);
    expect(repeated.outbox?.id).toBe(first.outbox?.id);
    expect(first.outbox?.payload).toMatchObject({
      recordingRevision: 1,
      sourceUserMessageCreatedAt: userMessage.createdAt,
    });
    expect((await listMessages(thread.id, "u1"))!.messages).toHaveLength(2);
    expect(await listRelationshipOutbox("u1", characterId)).toHaveLength(1);
  });

  it("saves the character reply but skips recording when paused during the model call", async () => {
    const thread = await getOrCreateThread(
      "u1",
      characterId,
      "1.0.0",
      "Einstein",
    );
    const relationship = await ensureRelationshipState("u1", characterId);
    const userMessage = await addMessage(thread, {
      role: "user",
      content: "A question sent before pausing.",
      claimIds: [],
      citations: [],
    });
    const expectedRecordingRevision = relationship.recordingRevision;
    const paused = await setRelationshipStatus("u1", characterId, "paused");

    const result = await addCharacterMessageWithRelationshipOutbox(
      thread,
      { content: "The reply is still delivered.", claimIds: [], citations: [] },
      {
        sourceUserMessageId: userMessage.id,
        expectedRecordingRevision,
        producerVersion: "chat-v1",
        idempotencyKey: `pause-race:${userMessage.id}`,
      },
    );

    expect(paused.recordingRevision).toBe(expectedRecordingRevision + 1);
    expect(result.outbox).toBeUndefined();
    expect((await listMessages(thread.id, "u1"))?.messages).toHaveLength(2);
    expect(await listRelationshipOutbox("u1", characterId)).toEqual([]);
  });

  it("forgets relationship memories and skips stale recording after reset", async () => {
    const thread = await getOrCreateThread(
      "u1",
      characterId,
      "1.0.0",
      "Einstein",
    );
    const relationship = await ensureRelationshipState("u1", characterId);
    const userMessage = await addMessage(thread, {
      role: "user",
      content: "A question sent before reset.",
      claimIds: [],
      citations: [],
    });
    await createMemory({
      userId: "u1",
      characterId,
      type: "character_relationship",
      content: "A prior shared moment",
      sourceMessageIds: [userMessage.id],
      confidence: 0.8,
      importance: 0.7,
      sensitivity: "low",
      status: "active",
    });
    const expectedRecordingRevision = relationship.recordingRevision;
    const reset = await resetRelationship("u1", characterId);

    const result = await addCharacterMessageWithRelationshipOutbox(
      thread,
      { content: "The reply survives the reset.", claimIds: [], citations: [] },
      {
        sourceUserMessageId: userMessage.id,
        expectedRecordingRevision,
        producerVersion: "chat-v1",
        idempotencyKey: `reset-race:${userMessage.id}`,
      },
    );

    expect(reset.recordingRevision).toBe(expectedRecordingRevision + 1);
    expect(result.outbox).toBeUndefined();
    expect(
      platform.memories.find((item) => item.userId === "u1")?.status,
    ).toBe("forgotten");
    expect((await listMessages(thread.id, "u1"))?.messages).toHaveLength(2);
    expect(await listRelationshipOutbox("u1", characterId)).toEqual([]);
  });

  it("does not invalidate recording for evidence, nickname, transition, or acknowledgement", async () => {
    const { thread, userMessage, characterMessage } = await conversation("u1");
    const relationship = await ensureRelationshipState("u1", characterId);
    const expectedRecordingRevision = relationship.recordingRevision;
    await storeRelationshipEvidence(evidenceInput("u1", "logical:ordinary"), [
      {
        sourceType: "message",
        messageId: userMessage.id,
        sourceRole: "user",
        dependencyRole: "primary",
        status: "active",
      },
    ]);
    const transition = await recordRelationshipTransition({
      userId: "u1",
      characterId,
      fromStage: "initial",
      toStage: "acquainted",
      policyVersion: "relationship-policy-v1",
      evidenceRevision: 1,
      evidenceSnapshotHash: "ordinary-snapshot",
      triggerType: "evidence_projection",
      feedbackText: "Now acquainted.",
      afterMessageId: characterMessage.id,
      idempotencyKey: "ordinary-transition",
    });
    await promote(
      "u1",
      "acquainted",
      "young_friend",
      "ordinary-young",
    );
    await grantPreferredAddress("u1", characterId, "小爱");
    await acknowledgeRelationshipTransition(
      "u1",
      characterId,
      transition.id,
      "ordinary-ack",
    );
    const nextUserMessage = await addMessage(thread, {
      role: "user",
      content: "Continue after ordinary relationship writes.",
      claimIds: [],
      citations: [],
    });

    const result = await addCharacterMessageWithRelationshipOutbox(
      thread,
      { content: "Continuing.", claimIds: [], citations: [] },
      {
        sourceUserMessageId: nextUserMessage.id,
        expectedRecordingRevision,
        producerVersion: "chat-v1",
        idempotencyKey: `ordinary:${nextUserMessage.id}`,
      },
    );

    expect(
      (await ensureRelationshipState("u1", characterId)).recordingRevision,
    ).toBe(expectedRecordingRevision);
    expect(result.outbox).toBeDefined();
  });

  it("claims only the requested user and character aggregate", async () => {
    const scoped = await enqueueRelationshipOutbox({
      userId: "u1",
      characterId,
      eventType: "relationship_reprojection_requested",
      producerVersion: "worker-v1",
      idempotencyKey: "scoped-job",
    });
    const otherUser = await enqueueRelationshipOutbox({
      userId: "u2",
      characterId,
      eventType: "relationship_reprojection_requested",
      producerVersion: "worker-v1",
      idempotencyKey: "other-user-job",
    });
    const otherCharacter = await enqueueRelationshipOutbox({
      userId: "u1",
      characterId: "marie-curie",
      eventType: "relationship_reprojection_requested",
      producerVersion: "worker-v1",
      idempotencyKey: "other-character-job",
    });

    const claimed = await claimRelationshipOutbox(10, {
      userId: "u1",
      characterId,
    });

    expect(claimed.map((item) => item.id)).toEqual([scoped.id]);
    expect(
      platform.relationshipOutbox.find((item) => item.id === otherUser.id)
        ?.status,
    ).toBe("pending");
    expect(
      platform.relationshipOutbox.find((item) => item.id === otherCharacter.id)
        ?.status,
    ).toBe("pending");
  });

  it("reclaims stale scoped claims and dead-letters exhausted work", async () => {
    const record = await enqueueRelationshipOutbox({
      userId: "u1",
      characterId,
      eventType: "relationship_reprojection_requested",
      producerVersion: "worker-v1",
      idempotencyKey: "stale-job",
      maxAttempts: 2,
    });
    const [first] = await claimRelationshipOutbox(1, {
      userId: "u1",
      characterId,
    });
    const firstToken = first.claimToken;
    first.claimedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();

    const [reclaimed] = await claimRelationshipOutbox(1, {
      userId: "u1",
      characterId,
    });
    expect(reclaimed.id).toBe(record.id);
    expect(reclaimed.attempt).toBe(2);
    expect(reclaimed.claimToken).not.toBe(firstToken);
    expect(reclaimed.lastErrorCode).toBe("STALE_CLAIM");

    reclaimed.claimedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    expect(
      await claimRelationshipOutbox(1, { userId: "u1", characterId }),
    ).toEqual([]);
    expect(
      platform.relationshipOutbox.find((item) => item.id === record.id)?.status,
    ).toBe("dead_letter");
  });

  it("claims, retries, completes, and dead-letters with token validation", async () => {
    await enqueueRelationshipOutbox({
      userId: "u1",
      characterId,
      eventType: "relationship_reprojection_requested",
      producerVersion: "worker-v1",
      idempotencyKey: "retry-job",
      maxAttempts: 2,
    });
    const [firstClaim] = await claimRelationshipOutbox();
    await expect(
      completeRelationshipOutbox(firstClaim.id, "wrong-token"),
    ).rejects.toThrow("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    const retry = await failRelationshipOutbox(
      firstClaim.id,
      firstClaim.claimToken!,
      "MODEL_TIMEOUT",
    );
    expect(retry.status).toBe("pending");

    const [secondClaim] = await claimRelationshipOutbox();
    const dead = await failRelationshipOutbox(
      secondClaim.id,
      secondClaim.claimToken!,
      "MODEL_TIMEOUT",
    );
    expect(dead.status).toBe("dead_letter");

    const completedJob = await enqueueRelationshipOutbox({
      userId: "u1",
      characterId,
      eventType: "evidence_source_changed",
      producerVersion: "worker-v1",
      idempotencyKey: "complete-job",
    });
    const claimed = (await claimRelationshipOutbox()).find(
      (item) => item.id === completedJob.id,
    )!;
    expect(
      (await completeRelationshipOutbox(claimed.id, claimed.claimToken!))
        ?.status,
    ).toBe("processed");
  });
});

describe("relationship deletion and guest merge", () => {
  it("deletes relationship state without deleting conversation messages", async () => {
    const { thread } = await conversation("u1");
    await ensureRelationshipState("u1", characterId);
    expect(await deleteRelationship("u1", characterId)).toBe(true);
    expect(await getRelationshipPublicState("u1", characterId)).toBeNull();
    expect((await listMessages(thread.id, "u1"))!.messages).toHaveLength(2);
  });

  it("keeps the higher guest stage, account nickname, and deduplicated evidence", async () => {
    const account = await conversation("account:1");
    const guest = await conversation("guest:1");
    await storeRelationshipEvidence(
      evidenceInput("account:1", "logical:shared"),
      [
        {
          sourceType: "message",
          messageId: account.userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
      ],
    );
    await storeRelationshipEvidence(evidenceInput("guest:1", "logical:shared"), [
      {
        sourceType: "message",
        messageId: guest.userMessage.id,
        sourceRole: "user",
        dependencyRole: "primary",
        status: "active",
      },
    ]);
    const accountAcquainted = await promote(
      "account:1",
      "initial",
      "acquainted",
      "account-merge",
    );
    await acknowledgeRelationshipTransition(
      "account:1",
      characterId,
      accountAcquainted.id,
      `ack:${accountAcquainted.id}`,
    );
    const accountYoungFriend = await promote(
      "account:1",
      "acquainted",
      "young_friend",
      "account-merge-young",
    );
    await acknowledgeRelationshipTransition(
      "account:1",
      characterId,
      accountYoungFriend.id,
      `ack:${accountYoungFriend.id}`,
    );
    await promote("guest:1", "initial", "acquainted", "guest-merge");
    await promote(
      "guest:1",
      "acquainted",
      "young_friend",
      "guest-merge-young",
    );
    await grantPreferredAddress("account:1", characterId, "账户昵称");
    await grantPreferredAddress("guest:1", characterId, "游客昵称");

    await mergeGuestIntoUser("guest:1", "account:1");
    await mergeGuestIntoUser("guest:1", "account:1");

    const merged = await getRelationshipPublicState("account:1", characterId);
    expect(merged?.stage).toBe("young_friend");
    expect(merged?.preferredAddress?.value).toBe("账户昵称");
    expect(merged?.pendingTransition).toBeUndefined();
    expect(
      await listRelationshipEvidence("account:1", characterId),
    ).toHaveLength(1);
    expect(
      platform.relationships.some((item) => item.userId === "guest:1"),
    ).toBe(false);
  });

  it("does not resurrect guest relationship data older than the account reset cutoff", async () => {
    const guest = await conversation("guest:reset");
    await storeRelationshipEvidence(
      evidenceInput("guest:reset", "logical:before-reset"),
      [
        {
          sourceType: "message",
          messageId: guest.userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
      ],
    );
    const guestMemory = await createMemory({
      userId: "guest:reset",
      characterId,
      type: "character_relationship",
      content: "Guest memory from before the account reset",
      sourceMessageIds: [guest.userMessage.id],
      confidence: 0.8,
      importance: 0.7,
      sensitivity: "low",
      status: "active",
    });
    await promote(
      "guest:reset",
      "initial",
      "acquainted",
      "guest-before-reset",
    );
    const extractionUserMessage = await addMessage(guest.thread, {
      role: "user",
      content: "This extraction was queued before reset.",
      claimIds: [],
      citations: [],
    });
    await addCharacterMessageWithRelationshipOutbox(
      guest.thread,
      { content: "Queued reply.", claimIds: [], citations: [] },
      {
        sourceUserMessageId: extractionUserMessage.id,
        expectedRecordingRevision: 1,
        producerVersion: "merge-test-v1",
        idempotencyKey: "guest-old-extraction",
      },
    );
    await ensureRelationshipState("account:reset", characterId);
    await resetRelationship("account:reset", characterId);

    await mergeGuestIntoUser("guest:reset", "account:reset");

    const merged = await getRelationshipPublicState(
      "account:reset",
      characterId,
    );
    expect(merged?.stage).toBe("initial");
    expect(merged?.pendingTransition).toBeUndefined();
    expect(
      await listRelationshipEvidence("account:reset", characterId),
    ).toEqual([]);
    expect(
      platform.memories.find(
        (item) => item.userId === "account:reset" && item.id === guestMemory.id,
      ),
    ).toMatchObject({
      status: "forgotten",
      content: "[已忘记]",
      sourceMessageIds: [],
    });
    expect(
      (await listRelationshipOutbox("account:reset", characterId)).filter(
        (item) => item.eventType === "evidence_extraction_requested",
      ),
    ).toEqual([]);
  });

  it("requeues claimed guest extraction under the account owner during merge", async () => {
    const guest = await conversation("guest:claimed-merge");
    await ensureRelationshipState("account:claimed-merge", characterId);
    const state = await ensureRelationshipState(
      "guest:claimed-merge",
      characterId,
    );
    const queued = await addCharacterMessageWithRelationshipOutbox(
      guest.thread,
      { content: "Queued reply", claimIds: [], citations: [] },
      {
        sourceUserMessageId: guest.userMessage.id,
        expectedRecordingRevision: state.recordingRevision,
        producerVersion: "test-v1",
        idempotencyKey: `claimed-merge:${guest.userMessage.id}`,
        maxAttempts: 1,
      },
    );
    const claimed = (
      await claimRelationshipOutbox(1, {
        userId: "guest:claimed-merge",
        characterId,
      })
    )[0];
    await checkpointRelationshipOutboxExtraction(
      claimed.id,
      claimed.claimToken!,
      {
        extractorModel: "test",
        extractorVersion: "test-v1",
        candidates: [],
      },
    );

    await mergeGuestIntoUser(
      "guest:claimed-merge",
      "account:claimed-merge",
    );

    await expect(
      completeRelationshipOutbox(claimed.id, claimed.claimToken!),
    ).rejects.toThrow("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
    expect(
      (await listRelationshipOutbox("account:claimed-merge", characterId)).find(
        (item) => item.id === queued.outbox!.id,
      ),
    ).toMatchObject({
      status: "pending",
      attempt: 0,
      claimToken: undefined,
      lastErrorCode: "OWNER_MERGED",
      payload: expect.objectContaining({
        extractionCheckpointV1: expect.objectContaining({ candidates: [] }),
      }),
    });
    const reclaimed = (
      await claimRelationshipOutbox(1, {
        userId: "account:claimed-merge",
        characterId,
      })
    )[0];
    expect(reclaimed.id).toBe(claimed.id);
    await completeRelationshipOutbox(reclaimed.id, reclaimed.claimToken!);
  });

  it("reprojects the canonical evidence union after merge", async () => {
    const account = await conversation("account:projection");
    const guest = await conversation("guest:projection");
    await storeRelationshipEvidence(
      {
        ...evidenceInput("account:projection", "logical:account-projection"),
        dimension: "exploration_depth",
        episodeKey: "account-episode",
        topicKey: "relativity",
      },
      [
        {
          sourceType: "message",
          messageId: account.userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
      ],
    );
    await storeRelationshipEvidence(
      {
        ...evidenceInput("guest:projection", "logical:guest-projection"),
        dimension: "continuity",
        episodeKey: "guest-episode",
        topicKey: "scientific-method",
      },
      [
        {
          sourceType: "message",
          messageId: guest.userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
      ],
    );

    await mergeGuestIntoUser("guest:projection", "account:projection");

    const merged = await getRelationshipPublicState(
      "account:projection",
      characterId,
    );
    expect(merged?.stage).toBe("acquainted");
    expect(merged?.pendingTransition).toBeUndefined();
    expect(
      await listRelationshipEvidence("account:projection", characterId),
    ).toHaveLength(2);
  });

  it("redirects duplicate guest learning-event sources to the account event", async () => {
    const accountEvent = {
      id: "00000000-0000-4000-8000-000000000001",
      userId: "account:event",
      characterId,
      periodId: "period-1",
      type: "meaningful_question" as const,
      idempotencyKey: "shared-learning-event",
      rewardStars: 1,
      createdAt: new Date().toISOString(),
    };
    const guestEvent = {
      ...accountEvent,
      id: "00000000-0000-4000-8000-000000000002",
      userId: "guest:event",
    };
    await addLearningEvent(accountEvent);
    await addLearningEvent(guestEvent);
    await ensureRelationshipState("account:event", characterId);
    const guest = await conversation("guest:event");
    const stored = await storeRelationshipEvidence(
      evidenceInput("guest:event", "logical:event-source"),
      [
        {
          sourceType: "message",
          messageId: guest.userMessage.id,
          sourceRole: "user",
          dependencyRole: "primary",
          status: "active",
        },
        {
          sourceType: "learning_event",
          learningEventId: guestEvent.id,
          sourceRole: "system",
          dependencyRole: "optional_context",
          status: "active",
        },
      ],
    );

    await mergeGuestIntoUser("guest:event", "account:event");

    const sources = await listRelationshipEvidenceSources(stored.evidence.id);
    expect(
      sources.find((item) => item.sourceType === "learning_event")
        ?.learningEventId,
    ).toBe(accountEvent.id);
    expect(
      platform.learningEvents.some((item) => item.id === guestEvent.id),
    ).toBe(false);
  });
});
