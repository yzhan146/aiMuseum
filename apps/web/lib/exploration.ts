import { randomInt, randomUUID } from "node:crypto";
import { catalogCharacterById, historicalPeriodById, historicalPeriods, type CatalogCharacter, type CharacterTier } from "@ai-museum/characters";
import { addDraw, addLearningEvent, findCharacterLearningEvent, findDraw, findLearningEvent, getDraw, getOrCreateCollection, latestCommittedDraw, saveExplorationState, type DrawRecord, type LearningEventRecord } from "./platform-store";

const rewardByType: Record<LearningEventRecord["type"], number> = { evidence_viewed: 0, encounter_completed: 20, meaningful_question: 20 };
const tierWeight: Record<CharacterTier, number> = { white: 35, blue: 30, purple: 20, orange: 10, gold: 5 };

export function explorationSnapshot(userId: string) {
  const collection = getOrCreateCollection(userId);
  return { periods: historicalPeriods, collection, pendingDraw: latestCommittedDraw(userId) };
}

export function recordLearningEvent(userId: string, input: { characterId: string; periodId: string; type: LearningEventRecord["type"]; idempotencyKey: string }) {
  const previous = findLearningEvent(userId, input.idempotencyKey);
  if (previous) return { event: previous, collection: getOrCreateCollection(userId), repeated: true };
  const completedEncounter = input.type === "encounter_completed" ? findCharacterLearningEvent(userId, input.characterId, input.type) : null;
  if (completedEncounter) return { event: completedEncounter, collection: getOrCreateCollection(userId), repeated: true };
  const character = catalogCharacterById(input.characterId); const period = historicalPeriodById(input.periodId);
  if (!character || !period || character.periodId !== period.id) throw new Error("人物与历史时期不匹配");
  if (!Object.hasOwn(rewardByType, input.type)) throw new Error("不支持的学习事件");
  const collection = getOrCreateCollection(userId); const rewardStars = rewardByType[input.type];
  const event: LearningEventRecord = { id: randomUUID(), userId, ...input, rewardStars, createdAt: new Date().toISOString() };
  collection.stars += rewardStars;
  if (input.type === "encounter_completed" && !collection.firstFreeUsed) collection.firstFreeEligible = true;
  collection.revision++; collection.updatedAt = event.createdAt; addLearningEvent(event);
  return { event, collection, repeated: false };
}

function weightedPick(characters: CatalogCharacter[]) {
  const weighted = characters.map(character => ({ character, weight: tierWeight[character.tier] / characters.filter(item => item.tier === character.tier).length }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0); let cursor = randomInt(0, 1_000_000) / 1_000_000 * total;
  for (const item of weighted) { cursor -= item.weight; if (cursor <= 0) return item.character; }
  return weighted.at(-1)!.character;
}

export function commitDraw(userId: string, input: { periodId: string; idempotencyKey: string }) {
  const previous = findDraw(userId, input.idempotencyKey);
  if (previous) return { draw: previous, collection: getOrCreateCollection(userId), repeated: true };
  const period = historicalPeriodById(input.periodId); if (!period) throw new Error("卡包不存在");
  const collection = getOrCreateCollection(userId); const allOwned = period.characters.every(character => collection.ownedCharacterIds.includes(character.id));
  if (allOwned) throw new Error("这个时期的12位人物已经全部收齐");
  const free = collection.firstFreeEligible && !collection.firstFreeUsed;
  if (!free && collection.stars < 60) throw new Error(`探索星还不够，还差${60 - collection.stars}星`);
  const candidates = free ? period.characters.filter(character => !collection.ownedCharacterIds.includes(character.id)) : period.characters;
  const result = weightedPick(candidates); const duplicate = collection.ownedCharacterIds.includes(result.id); const now = new Date().toISOString();
  if (free) { collection.firstFreeEligible = false; collection.firstFreeUsed = true; } else collection.stars -= 60;
  if (duplicate) collection.fragments += 20; else collection.ownedCharacterIds.push(result.id);
  collection.revision++; collection.updatedAt = now;
  const draw: DrawRecord = { id: randomUUID(), userId, periodId: period.id, idempotencyKey: input.idempotencyKey, costStars: free ? 0 : 60, resultCharacterId: result.id, duplicate, fragmentReward: duplicate ? 20 : 0, status: "committed", createdAt: now };
  addDraw(draw);
  return { draw, collection, repeated: false };
}

export function revealDraw(userId: string, drawId: string) {
  const draw = getDraw(drawId, userId); if (!draw) throw new Error("抽取结果不存在");
  if (draw.status === "committed") { draw.status = "revealed"; draw.revealedAt = new Date().toISOString(); saveExplorationState(); }
  return { draw, collection: getOrCreateCollection(userId) };
}
