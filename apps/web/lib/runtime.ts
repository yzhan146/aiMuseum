import type { ChatRequest, ChatResult, CharacterPack, Claim, MasteryRecord, MemoryRecord } from "@ai-museum/sdk";
import { retrieveKnowledge } from "./knowledge";

export interface GeneratedDraft { answer: string; claimIds: string[]; mode?: "rules" | "local-model" | "cloud-model" }
export interface DialogueGenerator { generate(pack: CharacterPack, request: ChatRequest, claims: Claim[]): Promise<GeneratedDraft> }
export interface DialogueRuntimeContext { memories?: MemoryRecord[]; mastery?: MasteryRecord[] }
export class EvidenceFirstGenerator implements DialogueGenerator {
  async generate(pack: CharacterPack, request: ChatRequest, claims: Claim[]): Promise<GeneratedDraft> {
    const simple = request.ageBand === "6-8"; const disputed = claims.some(claim => claim.status === "disputed" || claim.status === "inference");
    const lead = simple ? "简单地说，" : disputed ? "依据现有资料，需要谨慎地区分事实、争议与推演：" : "依据已审核史料，";
    const parts = claims.map(claim => `${claim.value ?? claim.predicate}${claim.status === "disputed" ? "（来源间存在争议）" : claim.status === "inference" ? "（合理推演）" : ""}`);
    const maxSentences = pack.persona.ageBands[request.ageBand]?.maxSentences ?? 5;
    return { answer: `${lead}${parts.join("；")}`.split(/(?<=[。！？])/).slice(0, maxSentences).join(""), claimIds: claims.map(claim => claim.id) };
  }
}
function boundaryResult(pack: CharacterPack, classification: string, reason?: string): ChatResult { return { answer: classification === "safety" ? "这个问题可能带来现实伤害，我不能以人物身份提供具体做法。" : pack.persona.refusalStyle, narratorNote: reason ? `${reason}。` : undefined, classification, boundary: true, claimIds: [], citations: [], suggestions: pack.boundaries.allowedTopics.slice(0, 3), version: pack.manifest.version }; }
function memoryGrams(text: string) { const value=text.toLowerCase().normalize("NFKC").replace(/[\s，。？！、：；“”‘’()（）]/g,"");const grams=new Set<string>();for(let index=0;index<value.length-1;index++)grams.add(value.slice(index,index+2));return grams; }
function memoryScore(memory: MemoryRecord, message: string) { const query=memoryGrams(message);const stored=memoryGrams(memory.content);let score=0;for(const gram of query)if(stored.has(gram))score++;return score; }
export async function runDialogue(pack: CharacterPack, request: ChatRequest, generator: DialogueGenerator = new EvidenceFirstGenerator(), context: DialogueRuntimeContext = {}): Promise<ChatResult> {
  const selection = retrieveKnowledge(pack, request.message);
  if (selection.boundary) return boundaryResult(pack, selection.classification, selection.reason);
  if (!selection.claims.length) return boundaryResult(pack, "资料不足", "当前人物包中没有足够的已审核 Claim 支持回答");
  const draft = await generator.generate(pack, request, selection.claims);
  const allowed = new Map(selection.claims.map(claim => [claim.id, claim])); const verifiedClaims = draft.claimIds.map(id => allowed.get(id)).filter((claim): claim is Claim => Boolean(claim));
  if (!verifiedClaims.length || draft.claimIds.length !== verifiedClaims.length) return boundaryResult(pack, "引用核验失败", "生成内容引用了检索范围之外的知识");
  const forbidden = pack.evaluations.flatMap(evaluation => evaluation.forbiddenAssertions).find(assertion => draft.answer.includes(assertion));
  if (forbidden) return boundaryResult(pack, "输出复检失败", "生成内容包含人物包明确禁止的断言");
  const sources = new Map(pack.sources.filter(source => !source.revokedAt).map(source => [source.id, source]));
  const citations = verifiedClaims.flatMap(claim => claim.evidence.map(evidence => ({ sourceId: evidence.sourceId, title: sources.get(evidence.sourceId)?.title ?? evidence.sourceId, locator: evidence.locator, url: sources.get(evidence.sourceId)?.url }))).filter((citation, index, all) => sources.has(citation.sourceId) && all.findIndex(item => item.sourceId === citation.sourceId && item.locator === citation.locator) === index);
  if (!citations.length) return boundaryResult(pack, "引用核验失败", "回答没有可用的来源定位");
  const memory = (context.memories ?? []).filter(item => item.confidence >= .6).map(item => ({ item, score: memoryScore(item, request.message) })).filter(item => item.score >= 2).sort((a, b) => b.score - a.score || b.item.importance - a.item.importance)[0]?.item;
  const callback = memory ? `你还记得我们之前聊过这件事吗？${draft.answer}` : draft.answer;
  const topics = [...new Set(verifiedClaims.flatMap(claim => claim.topicIds))]; const mastery = topics.map(topic => context.mastery?.find(item => item.topicId === topic)).find(item => item?.level === "exposed");
  return { answer: callback, classification: selection.classification === "limited-topic" ? "有限主题" : verifiedClaims.some(claim => claim.status === "disputed" || claim.status === "inference") ? "争议或推演" : "史料明确", boundary: false, claimIds: verifiedClaims.map(claim => claim.id), citations, suggestions: topics.slice(0, 3), version: pack.manifest.version, memoryCallbacks: memory ? [{ memoryId: memory.id, text: memory.content, confidence: memory.confidence }] : [], masteryPrompt: mastery ? { topicId: mastery.topicId, currentLevel: mastery.level, prompt: `关于${mastery.topicId}，你愿意用自己的话说说你是怎么理解的吗？` } : undefined, mode: draft.mode ?? "rules" };
}
