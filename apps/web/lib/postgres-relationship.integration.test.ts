import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type PlatformStore = typeof import("./platform-store");
type Database = typeof import("./database");
type EvidenceInput = Parameters<
  PlatformStore["storeRelationshipEvidence"]
>[0];

const integrationEnabled =
  process.env.AI_MUSEUM_PG_INTEGRATION === "1" &&
  Boolean(process.env.DATABASE_URL);

if (!integrationEnabled) {
  describe.skip(
    "PostgreSQL relationship integration [UNVERIFIED: use npm run test:integration:postgres]",
    () => {
      it("requires an isolated PostgreSQL test schema", () => {});
    },
  );
} else {
  describe.sequential("PostgreSQL relationship integration", () => {
    let store: PlatformStore;
    let database: Database;

    const characterId = "albert-einstein";

    function userId(label: string) {
      return `it:${label}:${randomUUID()}`;
    }

    function evidenceInput(
      ownerId: string,
      logicalKey: string,
      overrides: Partial<EvidenceInput> = {},
    ): EvidenceInput {
      return {
        userId: ownerId,
        characterId,
        dimension: "exploration_depth",
        eventType: "substantive_question",
        quality: 2,
        confidence: 0.9,
        episodeKey: `episode:${logicalKey}`,
        topicKey: `topic:${logicalKey}`,
        normalizedFingerprint: `fingerprint:${logicalKey}`,
        logicalKey,
        sanitizedSummary: "The user compared historical evidence.",
        stance: "not_applicable",
        substantiveness: "high",
        extractorModel: "postgres-integration",
        extractorVersion: "postgres-integration-v1",
        policyMappingVersion: "relationship-policy-v1",
        status: "active",
        ...overrides,
      };
    }

    async function conversation(ownerId: string) {
      const thread = await store.getOrCreateThread(
        ownerId,
        characterId,
        "1.0.0",
        "Einstein",
      );
      const userMessage = await store.addMessage(thread, {
        role: "user",
        content: "Why did this evidence change the scientific argument?",
        claimIds: [],
        citations: [],
      });
      const characterMessage = await store.addMessage(thread, {
        role: "character",
        content: "Let us compare the evidence carefully.",
        claimIds: [],
        citations: [],
      });
      return { thread, userMessage, characterMessage };
    }

    async function storeMessageEvidence(
      ownerId: string,
      messageId: string,
      logicalKey: string,
      overrides: Partial<EvidenceInput> = {},
    ) {
      return store.storeRelationshipEvidence(
        evidenceInput(ownerId, logicalKey, overrides),
        [
          {
            sourceType: "message",
            messageId,
            sourceRole: "user",
            dependencyRole: "primary",
            status: "active",
          },
        ],
      );
    }

    beforeAll(async () => {
      const schema = process.env.AI_MUSEUM_PG_TEST_SCHEMA ?? "";
      if (!/^ai_museum_it_[a-z0-9_]+$/.test(schema)) {
        throw new Error(
          "Refusing PostgreSQL integration without an isolated AI_MUSEUM_PG_TEST_SCHEMA",
        );
      }
      const databaseUrl = new URL(process.env.DATABASE_URL!);
      const databaseName = decodeURIComponent(
        databaseUrl.pathname.replace(/^\//, ""),
      );
      if (!/(?:^|[-_])(test|testing|integration|ci)(?:$|[-_])/i.test(databaseName)) {
        throw new Error(
          `Refusing PostgreSQL integration against non-test database ${databaseName}`,
        );
      }

      database = await import("./database.js");
      store = await import("./platform-store.js");
      expect(database.databaseEnabled).toBe(true);
      await database.ensureDatabaseSchema();
      const current = await database.query(
        "SELECT current_schema() AS schema_name,current_database() AS database_name",
      );
      expect(current.rows[0]?.schema_name).toBe(schema);
      expect(current.rows[0]?.database_name).toBe(databaseName);
    }, 60_000);

    afterAll(async () => {
      await database?.databasePool().end();
    });

    it("applies migration 006 in the isolated schema", async () => {
      const migrations = await database.query(
        "SELECT name FROM schema_migrations ORDER BY name",
      );
      expect(migrations.rows.map((row) => row.name)).toContain(
        "006_relationship_system.sql",
      );

      const relations = await database.query(
        `SELECT to_regclass('user_character_relationships') AS states,
                to_regclass('relationship_evidence') AS evidence,
                to_regclass('relationship_evidence_sources') AS sources,
                to_regclass('relationship_stage_transitions') AS transitions,
                to_regclass('relationship_preferences') AS preferences,
                to_regclass('relationship_outbox') AS outbox`,
      );
      expect(relations.rows[0]).toMatchObject({
        states: "user_character_relationships",
        evidence: "relationship_evidence",
        sources: "relationship_evidence_sources",
        transitions: "relationship_stage_transitions",
        preferences: "relationship_preferences",
        outbox: "relationship_outbox",
      });

      const recordingRevision = await database.query(
        `SELECT column_default,is_nullable
         FROM information_schema.columns
         WHERE table_schema=current_schema()
           AND table_name='user_character_relationships'
           AND column_name='recording_revision'`,
      );
      expect(recordingRevision.rows[0]).toMatchObject({
        column_default: "1",
        is_nullable: "NO",
      });
    });

    it("claims queued work exactly once across concurrent workers", async () => {
      const ownerId = userId("concurrent-claim");
      const queued = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          store.enqueueRelationshipOutbox({
            userId: ownerId,
            characterId,
            eventType: "relationship_reprojection_requested",
            producerVersion: "postgres-integration-v1",
            idempotencyKey: `concurrent-claim-${index}`,
          }),
        ),
      );

      const batches = await Promise.all(
        Array.from({ length: 4 }, () =>
          store.claimRelationshipOutbox(5, { userId: ownerId, characterId }),
        ),
      );
      const claimed = batches.flat();
      const queuedIds = queued.map((record) => record.id).sort();
      const claimedIds = claimed.map((record) => record.id).sort();

      expect(claimedIds).toEqual(queuedIds);
      expect(new Set(claimedIds).size).toBe(20);
      expect(claimed.every((record) => record.attempt === 1)).toBe(true);
      expect(claimed.every((record) => record.status === "processing")).toBe(
        true,
      );

      await Promise.all(
        claimed.map((record) =>
          store.completeRelationshipOutbox(record.id, record.claimToken!),
        ),
      );
      expect(
        (await store.listRelationshipOutbox(ownerId, characterId)).every(
          (record) => record.status === "processed",
        ),
      ).toBe(true);
    });

    it("deduplicates the same normalized evidence across concurrent turns", async () => {
      const ownerId = userId("concurrent-evidence");
      const firstTurn = await conversation(ownerId);
      const secondTurn = await conversation(ownerId);
      const relationship = await store.ensureRelationshipState(
        ownerId,
        characterId,
      );
      const sharedFingerprint = "fingerprint:concurrent-repeat";
      const [first, second] = await Promise.all([
        store.storeRelationshipEvidence(
          evidenceInput(ownerId, "concurrent-repeat-one", {
            normalizedFingerprint: sharedFingerprint,
            expectedRecordingRevision: relationship.recordingRevision,
            sourceMessageCreatedAt: firstTurn.userMessage.createdAt,
          }),
          [
            {
              sourceType: "message",
              messageId: firstTurn.userMessage.id,
              sourceRole: "user",
              dependencyRole: "primary",
              status: "active",
            },
          ],
        ),
        store.storeRelationshipEvidence(
          evidenceInput(ownerId, "concurrent-repeat-two", {
            normalizedFingerprint: sharedFingerprint,
            expectedRecordingRevision: relationship.recordingRevision,
            sourceMessageCreatedAt: secondTurn.userMessage.createdAt,
          }),
          [
            {
              sourceType: "message",
              messageId: secondTurn.userMessage.id,
              sourceRole: "user",
              dependencyRole: "primary",
              status: "active",
            },
          ],
        ),
      ]);

      expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
      expect(first.evidence.id).toBe(second.evidence.id);
      expect(
        await store.listRelationshipEvidence(ownerId, characterId),
      ).toHaveLength(1);
    });

    it("deduplicates bilateral same-character logical keys and repeated login merge", async () => {
      const accountId = userId("logical-account");
      const guestId = userId("logical-guest");
      const account = await conversation(accountId);
      const guest = await conversation(guestId);
      const logicalKey = "same-character-logical-key";
      await storeMessageEvidence(
        accountId,
        account.userMessage.id,
        logicalKey,
      );
      await storeMessageEvidence(guestId, guest.userMessage.id, logicalKey);

      await store.mergeGuestIntoUser(guestId, accountId);
      await store.mergeGuestIntoUser(guestId, accountId);

      const evidence = await store.listRelationshipEvidence(
        accountId,
        characterId,
      );
      expect(evidence).toHaveLength(1);
      expect(evidence[0]?.logicalKey).toBe(logicalKey);
      expect(
        await store.listRelationshipEvidenceSources(evidence[0]!.id),
      ).toHaveLength(1);
      expect(await store.listThreads(accountId)).toHaveLength(1);
      expect(
        (await store.listMessages(account.thread.id, accountId))?.messages,
      ).toHaveLength(4);
    });

    it("reprojects the canonical evidence union after merge", async () => {
      const accountId = userId("projection-account");
      const guestId = userId("projection-guest");
      const account = await conversation(accountId);
      const guest = await conversation(guestId);
      await storeMessageEvidence(
        accountId,
        account.userMessage.id,
        "projection-account",
        {
          dimension: "exploration_depth",
          episodeKey: "episode:projection-account",
          topicKey: "relativity",
        },
      );
      await storeMessageEvidence(
        guestId,
        guest.userMessage.id,
        "projection-guest",
        {
          dimension: "continuity",
          episodeKey: "episode:projection-guest",
          topicKey: "scientific-method",
        },
      );

      await store.mergeGuestIntoUser(guestId, accountId);

      const relationship = await store.getRelationshipPublicState(
        accountId,
        characterId,
      );
      expect(relationship?.stage).toBe("acquainted");
      expect(relationship?.pendingTransition).toBeUndefined();
      expect(
        await store.listRelationshipEvidence(accountId, characterId),
      ).toHaveLength(2);
    });

    it("requeues a claimed guest extraction under the account owner", async () => {
      const accountId = userId("claimed-merge-account");
      const guestId = userId("claimed-merge-guest");
      const guest = await conversation(guestId);
      await store.ensureRelationshipState(accountId, characterId);
      const state = await store.ensureRelationshipState(guestId, characterId);
      const queued = await store.addCharacterMessageWithRelationshipOutbox(
        guest.thread,
        { content: "Queued reply.", claimIds: [], citations: [] },
        {
          sourceUserMessageId: guest.userMessage.id,
          expectedRecordingRevision: state.recordingRevision,
          producerVersion: "postgres-integration-v1",
          idempotencyKey: `claimed-merge:${guest.userMessage.id}`,
          maxAttempts: 1,
        },
      );
      const claimed = (
        await store.claimRelationshipOutbox(1, {
          userId: guestId,
          characterId,
        })
      )[0];
      await store.checkpointRelationshipOutboxExtraction(
        claimed.id,
        claimed.claimToken!,
        {
          extractorModel: "postgres-integration",
          extractorVersion: "postgres-integration-v1",
          candidates: [],
        },
      );

      await store.mergeGuestIntoUser(guestId, accountId);

      await expect(
        store.completeRelationshipOutbox(claimed.id, claimed.claimToken!),
      ).rejects.toThrow("RELATIONSHIP_OUTBOX_CLAIM_CONFLICT");
      const moved = (
        await store.listRelationshipOutbox(accountId, characterId)
      ).find((item) => item.id === queued.outbox!.id);
      expect(moved).toMatchObject({
        status: "pending",
        attempt: 0,
        claimToken: undefined,
        lastErrorCode: "OWNER_MERGED",
        payload: expect.objectContaining({
          extractionCheckpointV1: expect.objectContaining({ candidates: [] }),
        }),
      });
      const reclaimed = (
        await store.claimRelationshipOutbox(1, {
          userId: accountId,
          characterId,
        })
      )[0];
      expect(reclaimed.id).toBe(claimed.id);
      await store.completeRelationshipOutbox(
        reclaimed.id,
        reclaimed.claimToken!,
      );
    });

    it("serializes guest merge before creating missing account children", async () => {
      const accountId = userId("merge-gap-account");
      const guestId = userId("merge-gap-guest");
      const guest = await conversation(guestId);
      await database.query(
        "INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING",
        [accountId],
      );
      const blocker = await database.databasePool().connect();
      let merge: Promise<void> | undefined;
      let targetRelationship: Promise<unknown> | undefined;
      let targetThread: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          `SELECT 1 FROM user_character_relationships
           WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
          [guestId, characterId],
        );
        merge = store.mergeGuestIntoUser(guestId, accountId);
        await blocker.query("SELECT pg_sleep(0.05)");
        targetRelationship = store.ensureRelationshipState(
          accountId,
          characterId,
        );
        targetThread = store.getOrCreateThread(
          accountId,
          characterId,
          "1.0.0",
          "Einstein",
        );
        const early = await Promise.race([
          Promise.all([targetRelationship, targetThread]).then(() => "created"),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("blocked"), 100),
          ),
        ]);
        expect(early).toBe("blocked");
        await blocker.query("ROLLBACK");
        await merge;
        const [relationship, thread] = await Promise.all([
          targetRelationship,
          targetThread,
        ]);
        expect(relationship).toBeTruthy();
        expect(thread).toMatchObject({ id: guest.thread.id, userId: accountId });
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        await merge?.catch(() => undefined);
        await targetRelationship?.catch(() => undefined);
        await targetThread?.catch(() => undefined);
      }
    });

    it("honors the target reset cutoff for guest evidence, memory, and queued extraction", async () => {
      const accountId = userId("cutoff-account");
      const guestId = userId("cutoff-guest");
      const guest = await conversation(guestId);
      await storeMessageEvidence(
        guestId,
        guest.userMessage.id,
        "before-target-reset",
      );
      const memory = await store.createMemory({
        userId: guestId,
        characterId,
        type: "character_relationship",
        content: "A guest memory from before the account reset.",
        sourceMessageIds: [guest.userMessage.id],
        confidence: 0.9,
        importance: 0.7,
        sensitivity: "low",
        status: "active",
      });
      const extractionMessage = await store.addMessage(guest.thread, {
        role: "user",
        content: "This extraction was queued before reset.",
        claimIds: [],
        citations: [],
      });
      const guestRelationship = await store.ensureRelationshipState(
        guestId,
        characterId,
      );
      await store.addCharacterMessageWithRelationshipOutbox(
        guest.thread,
        { content: "Queued reply.", claimIds: [], citations: [] },
        {
          sourceUserMessageId: extractionMessage.id,
          expectedRecordingRevision: guestRelationship.recordingRevision,
          producerVersion: "postgres-integration-v1",
          idempotencyKey: `cutoff:${extractionMessage.id}`,
        },
      );

      await database.query(
        "UPDATE messages SET created_at=now()-interval '2 days' WHERE thread_id=$1",
        [guest.thread.id],
      );
      await database.query(
        "UPDATE memories SET created_at=now()-interval '2 days' WHERE id=$1",
        [memory.id],
      );
      await database.query(
        `UPDATE relationship_outbox
         SET payload=jsonb_set(
           payload,'{sourceUserMessageCreatedAt}',
           to_jsonb((now()-interval '2 days')::text),true
         )
         WHERE user_id=$1 AND character_id=$2`,
        [guestId, characterId],
      );
      const accountBeforeReset = await store.ensureRelationshipState(
        accountId,
        characterId,
      );
      await store.resetRelationship(accountId, characterId);

      await store.mergeGuestIntoUser(guestId, accountId);

      await expect(
        store.storeRelationshipEvidence(
          {
            ...evidenceInput(accountId, "stale-claimed-extraction"),
            expectedRecordingRevision:
              accountBeforeReset.recordingRevision,
            sourceMessageCreatedAt: guest.userMessage.createdAt,
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
        ),
      ).rejects.toThrow("RELATIONSHIP_RECORDING_INVALIDATED");

      expect(
        (await store.getRelationshipPublicState(accountId, characterId))?.stage,
      ).toBe("initial");
      expect(
        await store.listRelationshipEvidence(accountId, characterId),
      ).toEqual([]);
      expect(
        (await store.listMemories(accountId, characterId)).find(
          (item) => item.id === memory.id,
        ),
      ).toBeUndefined();
      const forgottenMemory = await database.query(
        "SELECT status FROM memories WHERE id=$1",
        [memory.id],
      );
      expect(forgottenMemory.rows[0]?.status).toBe("forgotten");
      expect(
        (await store.listRelationshipOutbox(accountId, characterId)).filter(
          (item) => item.eventType === "evidence_extraction_requested",
        ),
      ).toEqual([]);
    });

    it("remaps duplicate learning-event sources without violating deferred foreign keys", async () => {
      const accountId = userId("event-account");
      const guestId = userId("event-guest");
      const accountEvent = {
        id: randomUUID(),
        userId: accountId,
        characterId,
        periodId: "physics-1900",
        type: "meaningful_question" as const,
        idempotencyKey: `event:${randomUUID()}`,
        rewardStars: 1,
        createdAt: new Date().toISOString(),
      };
      const guestEvent = {
        ...accountEvent,
        id: randomUUID(),
        userId: guestId,
      };
      await store.addLearningEvent(accountEvent);
      await store.addLearningEvent(guestEvent);
      await store.ensureRelationshipState(accountId, characterId);
      const guest = await conversation(guestId);
      const stored = await store.storeRelationshipEvidence(
        evidenceInput(guestId, "learning-event-remap"),
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

      await store.mergeGuestIntoUser(guestId, accountId);

      const sources = await store.listRelationshipEvidenceSources(
        stored.evidence.id,
      );
      expect(
        sources.find((item) => item.sourceType === "learning_event")
          ?.learningEventId,
      ).toBe(accountEvent.id);
      expect(
        await store.findLearningEvent(guestId, guestEvent.idempotencyKey),
      ).toBeNull();
      await database.transaction(async (client) => {
        await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      });
    });

    it("updates required memory support atomically without nulling partial fields", async () => {
      const ownerId = userId("memory-lifecycle");
      const seeded = await conversation(ownerId);
      const memory = await store.createMemory({
        userId: ownerId,
        characterId,
        type: "character_relationship",
        content: "We previously compared these two arguments.",
        sourceMessageIds: [seeded.userMessage.id],
        confidence: 0.9,
        importance: 0.7,
        sensitivity: "low",
        status: "active",
      });
      const stored = await store.storeRelationshipEvidence(
        evidenceInput(ownerId, "memory-required-support", {
          dimension: "continuity",
          eventType: "revisited_prior_topic",
        }),
        [
          {
            sourceType: "message",
            messageId: seeded.userMessage.id,
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

      const suppressed = await store.updateMemory(memory.id, ownerId, {
        status: "suppressed",
        content: undefined,
      });
      expect(suppressed).toMatchObject({
        content: "We previously compared these two arguments.",
        confidence: 0.9,
        importance: 0.7,
      });
      expect(
        (await store.listRelationshipEvidence(ownerId, characterId))[0]?.status,
      ).toBe("suspended");
      expect(
        (await store.listRelationshipEvidenceSources(stored.evidence.id)).find(
          (source) => source.memoryId === memory.id,
        )?.status,
      ).toBe("suspended");

      await store.updateMemory(memory.id, ownerId, { status: "forgotten" });
      const forgotten = await database.query(
        `SELECT content,embedding,confidence,importance,recall_count,last_recalled_at
         FROM memories WHERE id=$1`,
        [memory.id],
      );
      expect(forgotten.rows[0]).toMatchObject({
        content: "[已忘记]",
        embedding: null,
        confidence: 0,
        importance: 0,
        recall_count: 0,
        last_recalled_at: null,
      });
      expect(
        (await database.query("SELECT 1 FROM memory_sources WHERE memory_id=$1", [memory.id])).rows,
      ).toHaveLength(0);
      await expect(
        store.updateMemory(memory.id, ownerId, { status: "active" }),
      ).rejects.toThrow("MEMORY_FORGOTTEN_IS_TERMINAL");
      await expect(
        store.updateMemory(memory.id, ownerId, {
          content: "This deleted content must not return.",
        }),
      ).rejects.toThrow("MEMORY_FORGOTTEN_IS_TERMINAL");
      const terminal = await database.query(
        `SELECT status,content,confidence,importance
         FROM memories WHERE id=$1`,
        [memory.id],
      );
      expect(terminal.rows[0]).toMatchObject({
        status: "forgotten",
        content: "[已忘记]",
        confidence: 0,
        importance: 0,
      });
      expect(
        (await store.listRelationshipEvidence(ownerId, characterId))[0]?.status,
      ).toBe("revoked");
    });

    it("locks relationship aggregates before chat message and outbox writes", async () => {
      const ownerId = userId("chat-outbox-lock-order");
      const seeded = await conversation(ownerId);
      const state = await store.ensureRelationshipState(ownerId, characterId);
      const sourceMessage = await store.addMessage(seeded.thread, {
        role: "user",
        content: "Please compare one more piece of evidence.",
        claimIds: [],
        citations: [],
      });
      const blocker = await database.databasePool().connect();
      let append: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          `SELECT 1 FROM user_character_relationships
           WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
          [ownerId, characterId],
        );
        append = store.addCharacterMessageWithRelationshipOutbox(
          seeded.thread,
          { content: "Let us compare it.", claimIds: [], citations: [] },
          {
            sourceUserMessageId: sourceMessage.id,
            expectedRecordingRevision: state.recordingRevision,
            producerVersion: "postgres-integration-v1",
            idempotencyKey: `lock-order:${sourceMessage.id}`,
          },
        );
        await blocker.query("SELECT pg_sleep(0.05)");
        await blocker.query("SET LOCAL lock_timeout='500ms'");
        await expect(
          blocker.query(
            "SELECT 1 FROM character_threads WHERE id=$1 FOR UPDATE",
            [seeded.thread.id],
          ),
        ).resolves.toBeDefined();
        await blocker.query("ROLLBACK");
        await append;
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        await append?.catch(() => undefined);
      }
    });

    it("rejects stale relationship memory creation and recall after reset", async () => {
      const ownerId = userId("memory-reset-race");
      const seeded = await conversation(ownerId);
      const state = await store.ensureRelationshipState(ownerId, characterId);
      const memory = await store.createMemory({
        userId: ownerId,
        characterId,
        type: "character_relationship",
        content: "A memory created before reset.",
        sourceMessageIds: [seeded.userMessage.id, seeded.characterMessage.id],
        confidence: 0.8,
        importance: 0.6,
        sensitivity: "low",
        status: "active",
      });

      await store.resetRelationship(ownerId, characterId);
      await store.recallMemory(memory);
      const staleMemory = await store.createMemory(
        {
          userId: ownerId,
          characterId,
          type: "character_relationship",
          content: "This memory must not be recreated after reset.",
          sourceMessageIds: [
            seeded.userMessage.id,
            seeded.characterMessage.id,
          ],
          confidence: 0.8,
          importance: 0.6,
          sensitivity: "low",
          status: "active",
        },
        {
          expectedRecordingRevision: state.recordingRevision,
          sourceMessageCreatedAt: seeded.userMessage.createdAt,
        },
      );

      expect(staleMemory).toBeNull();
      const tombstone = await database.query(
        `SELECT status,content,recall_count,last_recalled_at
         FROM memories WHERE id=$1`,
        [memory.id],
      );
      expect(tombstone.rows[0]).toMatchObject({
        status: "forgotten",
        content: "[已忘记]",
        recall_count: 0,
        last_recalled_at: null,
      });
    });

    it("locks relationship aggregates before transition acknowledgement", async () => {
      const ownerId = userId("transition-lock-order");
      const seeded = await conversation(ownerId);
      const stored = await storeMessageEvidence(
        ownerId,
        seeded.userMessage.id,
        "transition-lock-order",
      );
      const state = await store.ensureRelationshipState(ownerId, characterId);
      const transition = await store.recordRelationshipTransition({
        userId: ownerId,
        characterId,
        fromStage: "initial",
        toStage: "acquainted",
        policyVersion: "relationship-policy-v1",
        evidenceRevision: state.evidenceRevision,
        evidenceSnapshotHash: stored.evidence.id,
        triggerType: "evidence_projection",
        feedbackText: "The relationship changed.",
        afterMessageId: seeded.characterMessage.id,
        idempotencyKey: `transition-lock-order:${stored.evidence.id}`,
      });
      const blocker = await database.databasePool().connect();
      let acknowledge: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          `SELECT 1 FROM user_character_relationships
           WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
          [ownerId, characterId],
        );
        acknowledge = store.acknowledgeRelationshipTransition(
          ownerId,
          characterId,
          transition.id,
          `feedback:${transition.id}`,
        );
        await blocker.query("SELECT pg_sleep(0.05)");
        await blocker.query("SET LOCAL lock_timeout='500ms'");
        await expect(
          blocker.query(
            "SELECT 1 FROM relationship_stage_transitions WHERE id=$1 FOR UPDATE",
            [transition.id],
          ),
        ).resolves.toBeDefined();
        await blocker.query("ROLLBACK");
        await acknowledge;
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        await acknowledge?.catch(() => undefined);
      }
    });

    it("locks relationship aggregates before preferred-address changes", async () => {
      const ownerId = userId("preference-lock-order");
      await store.ensureRelationshipState(ownerId, characterId);
      await database.query(
        `UPDATE user_character_relationships SET stage='young_friend'
         WHERE user_id=$1 AND character_id=$2`,
        [ownerId, characterId],
      );
      await store.grantPreferredAddress(ownerId, characterId, "Scholar");

      async function expectPreferenceRemainsUnlocked(
        operation: () => Promise<unknown>,
      ) {
        const blocker = await database.databasePool().connect();
        let change: Promise<unknown> | undefined;
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            `SELECT 1 FROM user_character_relationships
             WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
            [ownerId, characterId],
          );
          change = operation();
          await blocker.query("SELECT pg_sleep(0.05)");
          await blocker.query("SET LOCAL lock_timeout='500ms'");
          await expect(
            blocker.query(
              `SELECT 1 FROM relationship_preferences
               WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
              [ownerId, characterId],
            ),
          ).resolves.toBeDefined();
          await blocker.query("ROLLBACK");
          await change;
        } finally {
          await blocker.query("ROLLBACK").catch(() => undefined);
          blocker.release();
          await change?.catch(() => undefined);
        }
      }

      await expectPreferenceRemainsUnlocked(() =>
        store.revokePreferredAddress(ownerId, characterId),
      );
      await expectPreferenceRemainsUnlocked(() =>
        store.grantPreferredAddress(ownerId, characterId, "Friend"),
      );
    });

    it("locks relationship aggregates before memory in concurrent lifecycle writes", async () => {
      const ownerId = userId("memory-lock-order");
      const seeded = await conversation(ownerId);
      await store.ensureRelationshipState(ownerId, characterId);
      const memory = await store.createMemory({
        userId: ownerId,
        characterId,
        type: "character_relationship",
        content: "A memory used to verify lock ordering.",
        sourceMessageIds: [seeded.userMessage.id],
        confidence: 0.9,
        importance: 0.7,
        sensitivity: "low",
        status: "active",
      });
      const blocker = await database.databasePool().connect();
      let update: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          `SELECT 1 FROM user_character_relationships
           WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
          [ownerId, characterId],
        );
        update = store.updateMemory(memory.id, ownerId, {
          status: "suppressed",
        });
        await blocker.query("SELECT pg_sleep(0.05)");
        await blocker.query("SET LOCAL lock_timeout='500ms'");
        await expect(
          blocker.query("SELECT 1 FROM memories WHERE id=$1 FOR SHARE", [
            memory.id,
          ]),
        ).resolves.toBeDefined();
        await blocker.query("ROLLBACK");
        await update;
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        await update?.catch(() => undefined);
      }
    });

    it("locks relationship aggregates before guest-merge memory updates", async () => {
      const accountId = userId("merge-lock-account");
      const guestId = userId("merge-lock-guest");
      const account = await conversation(accountId);
      const guest = await conversation(guestId);
      await store.ensureRelationshipState(accountId, characterId);
      await store.ensureRelationshipState(guestId, characterId);
      const guestMemory = await store.createMemory({
        userId: guestId,
        characterId,
        type: "character_relationship",
        content: "A guest memory used to verify merge lock ordering.",
        sourceMessageIds: [guest.userMessage.id],
        confidence: 0.9,
        importance: 0.7,
        sensitivity: "low",
        status: "active",
      });
      expect(account.thread.id).toBeTruthy();
      const blocker = await database.databasePool().connect();
      let merge: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          `SELECT 1 FROM user_character_relationships
           WHERE user_id=$1 AND character_id=$2 FOR UPDATE`,
          [accountId, characterId],
        );
        merge = store.mergeGuestIntoUser(guestId, accountId);
        await blocker.query("SELECT pg_sleep(0.05)");
        await blocker.query("SET LOCAL lock_timeout='500ms'");
        await expect(
          blocker.query("SELECT 1 FROM memories WHERE id=$1 FOR UPDATE", [
            guestMemory.id,
          ]),
        ).resolves.toBeDefined();
        await blocker.query("ROLLBACK");
        await merge;
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        blocker.release();
        await merge?.catch(() => undefined);
      }
    });

    it("deletes a thread and its relationship aggregate in one committed transaction", async () => {
      const ownerId = userId("thread-delete");
      const seeded = await conversation(ownerId);
      await storeMessageEvidence(
        ownerId,
        seeded.userMessage.id,
        "thread-delete",
      );
      await store.createMemory({
        userId: ownerId,
        characterId,
        type: "character_relationship",
        content: "A shared moment removed with the thread.",
        sourceMessageIds: [seeded.userMessage.id],
        confidence: 0.9,
        importance: 0.7,
        sensitivity: "low",
        status: "active",
      });

      expect(await store.deleteThreadForUser(seeded.thread.id, ownerId)).toBe(
        true,
      );
      expect(await store.listThreads(ownerId)).toEqual([]);
      expect(await store.listMemories(ownerId, characterId)).toEqual([]);
      expect(
        await store.getRelationshipPublicState(ownerId, characterId),
      ).toBeNull();
    });

    it("exports internal relationship data and deletes the complete account graph", async () => {
      const ownerId = userId("export-delete");
      const seeded = await conversation(ownerId);
      const stored = await storeMessageEvidence(
        ownerId,
        seeded.userMessage.id,
        "export-delete",
      );
      const state = await store.ensureRelationshipState(ownerId, characterId);
      await store.recordRelationshipTransition({
        userId: ownerId,
        characterId,
        fromStage: "initial",
        toStage: "acquainted",
        policyVersion: "relationship-policy-v1",
        evidenceRevision: state.evidenceRevision,
        evidenceSnapshotHash: stored.evidence.id,
        triggerType: "evidence_projection",
        feedbackText: "The relationship changed.",
        afterMessageId: seeded.characterMessage.id,
        idempotencyKey: `transition:${stored.evidence.id}`,
      });
      await database.query(
        `UPDATE user_character_relationships SET stage='young_friend'
         WHERE user_id=$1 AND character_id=$2`,
        [ownerId, characterId],
      );
      await store.grantPreferredAddress(ownerId, characterId, "Scholar");

      const exported = await store.exportUserData(ownerId);
      expect(exported.schemaVersion).toBe("ai-museum-user-export-v1");
      expect(exported.conversations.messages).toHaveLength(2);
      expect(exported.relationships.states).toHaveLength(1);
      expect(exported.relationships.evidence).toEqual([
        expect.objectContaining({
          logical_key: "export-delete",
          quality: 2,
          policy_mapping_version: "relationship-policy-v1",
        }),
      ]);
      expect(exported.relationships.evidenceSources).toHaveLength(1);
      expect(exported.relationships.transitions).toHaveLength(1);
      expect(exported.relationships.preferences).toEqual([
        expect.objectContaining({ preferred_address: "Scholar" }),
      ]);

      expect(await store.deleteUserData(ownerId)).toBe(true);
      const remaining = await database.query(
        `SELECT
           (SELECT count(*)::int FROM users WHERE id=$1) AS users,
           (SELECT count(*)::int FROM character_threads WHERE user_id=$1) AS threads,
           (SELECT count(*)::int FROM memories WHERE user_id=$1) AS memories,
           (SELECT count(*)::int FROM user_character_relationships WHERE user_id=$1) AS relationships`,
        [ownerId],
      );
      expect(remaining.rows[0]).toMatchObject({
        users: 0,
        threads: 0,
        memories: 0,
        relationships: 0,
      });
    });
  });
}
