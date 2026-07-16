import { getPublishedPack } from "./repository";
import { runDialogue } from "./runtime";
import { activeCharacterMemories, addMessage, createMemory, exposeTopic, listMastery, recallMemory } from "./platform-store";
import type { ChatResult, ConversationThread } from "@ai-museum/sdk";
import { configuredDialogueGenerator } from "./model-provider";

export async function sendThreadMessage(userId: string, thread: ConversationThread, content: string, ageBand = "9-12", locale = "zh-CN"): Promise<ChatResult> {
  const pack = getPublishedPack(thread.characterId, thread.characterVersion); if (!pack) throw new Error("线程固定的人物版本不存在");
  const userMessage = addMessage(thread, { role: "user", content, claimIds: [], citations: [] });
  const memories = activeCharacterMemories(userId, thread.characterId); const mastery = listMastery(userId);
  const result = await runDialogue(pack, { characterId: thread.characterId, version: thread.characterVersion, ageBand, locale, message: content, sessionId: thread.id }, configuredDialogueGenerator(), { memories, mastery });
  for (const callback of result.memoryCallbacks ?? []) { const memory = memories.find(item => item.id === callback.memoryId); if (memory) recallMemory(memory); }
  const characterMessage = addMessage(thread, { role: "character", content: result.answer, claimIds: result.claimIds, citations: result.citations });
  const claims = pack.claims.filter(claim => result.claimIds.includes(claim.id)); const topics = [...new Set(claims.flatMap(claim => claim.topicIds))];
  for (const topic of topics) exposeTopic(userId, topic, [userMessage.id, characterMessage.id]);
  if (!result.boundary && result.claimIds.length) { const entities=claims.flatMap(claim=>[claim.subjectId,claim.objectId].filter(Boolean)).map(id=>pack.entities.find(entity=>entity.id===id)?.names[pack.manifest.defaultLocale]).filter(Boolean);const labels=[...new Set([...entities,...topics])].slice(0,6);createMemory({ userId, characterId: thread.characterId, type: "character_relationship", content: `我们曾聊过：${labels.join("、")}`, sourceMessageIds: [userMessage.id, characterMessage.id], confidence: .8, importance: .6, sensitivity: "low", status: "active" }); }
  const freshMastery = listMastery(userId); const exposed = topics.map(topic => freshMastery.find(item => item.topicId === topic)).find(Boolean);
  return { ...result, messageId: characterMessage.id, threadId: thread.id, masteryPrompt: exposed?.level === "exposed" ? { topicId: exposed.topicId, currentLevel: exposed.level, prompt: `关于${exposed.topicId}，你愿意用自己的话说说你是怎么理解的吗？` } : result.masteryPrompt };
}
