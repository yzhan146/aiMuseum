import { activeClaims, type CharacterPack, type Claim, type Entity } from "@ai-museum/sdk";

export type QuestionClass = "safety" | "prompt-injection" | "after-lifetime" | "forbidden-topic" | "limited-topic" | "knowledge";
export interface KnowledgeSelection { classification: QuestionClass; boundary: boolean; reason?: string; entities: Entity[]; claims: Claim[] }
const safetyTerms = ["自杀", "制造炸弹", "杀人", "仇恨", "诊断疾病", "投资哪只"];
const injectionTerms = ["忽略之前", "系统提示词", "developer message", "越过边界", "不受限制", "输出你的规则"];
const datedConcepts = [
  { terms: ["微积分", "calculus", "导数", "积分学"], availableFrom: 1665 },
  { terms: ["相对论", "relativity"], availableFrom: 1905 },
  { terms: ["量子力学", "quantum mechanics"], availableFrom: 1925 },
  { terms: ["电子计算机", "computer"], availableFrom: 1945 },
  { terms: ["原子弹", "核武器"], availableFrom: 1945 },
  { terms: ["人工智能", "ai模型", "语言模型", "chatgpt"], availableFrom: 1956 },
  { terms: ["互联网", "internet"], availableFrom: 1969 },
  { terms: ["智能手机", "smartphone"], availableFrom: 1992 }
];

function normalize(text: string) { return text.toLowerCase().normalize("NFKC").replace(/[\s，。？！、：；“”‘’()（）]/g, ""); }
function grams(text: string) { const value = normalize(text); const result = new Set<string>(); for (let i = 0; i < value.length - 1; i++) result.add(value.slice(i, i + 2)); return result; }
function overlap(a: Set<string>, b: Set<string>) { let score = 0; for (const value of a) if (b.has(value)) score++; return score; }
function mentionsAfterCutoff(message: string, cutoff: string) { const year = Number(cutoff.slice(0, 4)); return [...message.matchAll(/(?:18|19|20)\d{2}/g)].some(match => Number(match[0]) > year); }
function unavailableConcept(message: string, cutoff: string) { const text=normalize(message);const cutoffYear=Number(cutoff.slice(0,4));return datedConcepts.find(item=>item.availableFrom>cutoffYear&&item.terms.some(term=>text.includes(normalize(term)))); }
function namedEntities(pack: CharacterPack, message: string) { const normalized = normalize(message); return pack.entities.filter(entity => Object.values(entity.names).some(name => normalized.includes(normalize(name)))); }
function reachableEntities(pack: CharacterPack, seeds: Set<string>, depth = 1) { const reached = new Set(seeds); for (let level = 0; level < depth; level++) for (const relation of pack.relationships) { if (reached.has(relation.fromId)) reached.add(relation.toId); if (reached.has(relation.toId)) reached.add(relation.fromId); } return reached; }

export function classifyQuestion(pack: CharacterPack, message: string): Omit<KnowledgeSelection, "entities" | "claims"> {
  const text = normalize(message);
  if (safetyTerms.some(term => text.includes(normalize(term)))) return { classification: "safety", boundary: true, reason: "问题可能造成现实伤害" };
  if (injectionTerms.some(term => text.includes(normalize(term)))) return { classification: "prompt-injection", boundary: true, reason: "问题试图改变人物边界或系统规则" };
  const datedConcept=unavailableConcept(message,pack.boundaries.knowledgeCutoff);
  if (mentionsAfterCutoff(message, pack.boundaries.knowledgeCutoff) || datedConcept || pack.boundaries.unknownPatterns.some(term => text.includes(normalize(term)))) return { classification: "after-lifetime", boundary: true, reason: datedConcept ? `“${datedConcept.terms[0]}”在人物所处时代尚未形成` : `人物认知截止于 ${pack.boundaries.knowledgeCutoff}` };
  if (pack.boundaries.forbiddenTopics.some(term => text.includes(normalize(term)))) return { classification: "forbidden-topic", boundary: true, reason: "命中人物包禁答主题" };
  if (pack.boundaries.limitedTopics.some(term => text.includes(normalize(term)))) return { classification: "limited-topic", boundary: false, reason: "该主题需要更谨慎地引用与表述" };
  return { classification: "knowledge", boundary: false };
}

export function retrieveKnowledge(pack: CharacterPack, message: string, limit = 5): KnowledgeSelection {
  const classification = classifyQuestion(pack, message);
  if (classification.boundary) return { ...classification, entities: [], claims: [] };
  const mentioned = namedEntities(pack, message); const root = pack.entities[0];
  const reachable = reachableEntities(pack, new Set([root?.id, ...mentioned.map(entity => entity.id)].filter(Boolean)), 1);
  const queryGrams = grams(message);
  const scored = activeClaims(pack).filter(claim => reachable.has(claim.subjectId) && (!claim.objectId || reachable.has(claim.objectId))).map(claim => {
    const subject = pack.entities.find(entity => entity.id === claim.subjectId); const object = pack.entities.find(entity => entity.id === claim.objectId);
    const text = [claim.predicate, claim.value, ...claim.topicIds, ...Object.values(subject?.names ?? {}), ...Object.values(object?.names ?? {})].filter(Boolean).join(" ");
    let score = overlap(queryGrams, grams(text));
    for (const topic of claim.topicIds) if (normalize(message).includes(normalize(topic))) score += 8;
    if (mentioned.some(entity => entity.id === claim.subjectId || entity.id === claim.objectId)) score += 5;
    if (claim.status === "established") score += 1;
    return { claim, score };
  }).filter(item => item.score > 2).sort((a, b) => b.score - a.score || b.claim.confidence - a.claim.confidence).slice(0, limit);
  const entityIds = new Set(scored.flatMap(item => [item.claim.subjectId, item.claim.objectId].filter(Boolean) as string[]));
  return { ...classification, entities: pack.entities.filter(entity => entityIds.has(entity.id)), claims: scored.map(item => item.claim) };
}
