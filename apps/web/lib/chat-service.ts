import { getPublishedPack } from "./repository";
import { runDialogue } from "./runtime";
import {
  activeCharacterMemories,
  addCharacterMessageWithRelationshipOutbox,
  addMessage,
  createMemory,
  ensureRelationshipState,
  exposeTopic,
  getRelationshipPublicState,
  listMastery,
  recallMemory,
} from "./platform-store";
import type { ChatResult, ConversationThread } from "@ai-museum/sdk";
import { configuredDialogueGenerator } from "./model-provider";
import { databaseEnabled } from "./database";
import {
  drainRelationshipOutbox,
  relationshipRuntimeContextFrom,
} from "./relationship-service";
import { relationshipAutomationEnabledForCharacter } from "./relationship-rollout";

export async function sendThreadMessage(
  userId: string,
  thread: ConversationThread,
  content: string,
  ageBand = "9-12",
  locale = "zh-CN",
): Promise<ChatResult> {
  const pack = getPublishedPack(thread.characterId, thread.characterVersion);
  if (!pack) throw new Error("线程固定的人物版本不存在");
  const userMessage = await addMessage(thread, {
    role: "user",
    content,
    claimIds: [],
    citations: [],
  });
  const memories = await activeCharacterMemories(userId, thread.characterId);
  const mastery = await listMastery(userId);
  const relationshipStateBefore = await ensureRelationshipState(
    userId,
    thread.characterId,
  );
  const relationshipBefore = await getRelationshipPublicState(
    userId,
    thread.characterId,
  );
  const result = await runDialogue(
    pack,
    {
      characterId: thread.characterId,
      version: thread.characterVersion,
      ageBand,
      locale,
      message: content,
      sessionId: thread.id,
    },
    configuredDialogueGenerator(),
    {
      memories: relationshipBefore?.status === "paused" ? [] : memories,
      mastery,
      relationship: relationshipRuntimeContextFrom({
        relationship: relationshipBefore,
        memories,
      }),
    },
  );
  for (const callback of result.memoryCallbacks ?? []) {
    const memory = memories.find((item) => item.id === callback.memoryId);
    if (memory) await recallMemory(memory);
  }
  const characterInput = {
    content: result.answer,
    claimIds: result.claimIds,
    citations: result.citations,
  };
  const relationshipAutomationEnabled =
    relationshipAutomationEnabledForCharacter(thread.characterId);
  const committed = relationshipBefore?.status === "paused" || !relationshipAutomationEnabled
    ? { message: await addMessage(thread, { role: "character", ...characterInput }), outbox: undefined }
    : await addCharacterMessageWithRelationshipOutbox(
          thread,
          characterInput,
          {
            sourceUserMessageId: userMessage.id,
            producerVersion: "relationship-chat-v1",
            idempotencyKey: `turn:${userMessage.id}`,
            expectedRecordingRevision: relationshipStateBefore.recordingRevision,
          },
        );
  const characterMessage = committed.message;
  if (committed.outbox && !databaseEnabled) {
    try {
      await drainRelationshipOutbox(1, {
        userId,
        characterId: thread.characterId,
      });
    } catch (error) {
      console.error(
        "Relationship evidence processing failed",
        error instanceof Error ? error.message : error,
      );
    }
  }
  const claims = pack.claims.filter((claim) =>
    result.claimIds.includes(claim.id),
  );
  const topics = [...new Set(claims.flatMap((claim) => claim.topicIds))];
  for (const topic of topics)
    await exposeTopic(userId, topic, [userMessage.id, characterMessage.id]);
  if (!result.boundary && result.claimIds.length && Boolean(committed.outbox)) {
    const entities = claims
      .flatMap((claim) => [claim.subjectId, claim.objectId].filter(Boolean))
      .map(
        (id) =>
          pack.entities.find((entity) => entity.id === id)?.names[
            pack.manifest.defaultLocale
          ],
      )
      .filter(Boolean);
    const labels = [...new Set([...entities, ...topics])].slice(0, 6);
    await createMemory({
      userId,
      characterId: thread.characterId,
      type: "character_relationship",
      content: `我们曾聊过：${labels.join("、")}`,
      sourceMessageIds: [userMessage.id, characterMessage.id],
      confidence: 0.8,
      importance: 0.6,
      sensitivity: "low",
      status: "active",
    }, {
      expectedRecordingRevision: relationshipStateBefore.recordingRevision,
      sourceMessageCreatedAt: userMessage.createdAt,
    });
  }
  const freshMastery = await listMastery(userId);
  const exposed = topics
    .map((topic) => freshMastery.find((item) => item.topicId === topic))
    .find(Boolean);
  const relationship = await getRelationshipPublicState(
    userId,
    thread.characterId,
  );
  return {
    ...result,
    messageId: characterMessage.id,
    threadId: thread.id,
    masteryPrompt:
      exposed?.level === "exposed"
        ? {
            topicId: exposed.topicId,
            currentLevel: exposed.level,
            prompt: `关于${exposed.topicId}，你愿意用自己的话说说你是怎么理解的吗？`,
          }
        : result.masteryPrompt,
    relationship: relationship ?? undefined,
  };
}
