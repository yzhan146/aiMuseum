import type { ChatRequest, ChatResult, CharacterPack, Citation, Claim, MasteryRecord, MemoryRecord, RelationshipRuntimeContext } from "@ai-museum/sdk";
import { classifyQuestion, retrieveKnowledge } from "./knowledge";

export interface GeneratedDraft { answer: string; claimIds: string[]; usedMemoryIds?: string[]; mode?: "rules" | "local-model" | "cloud-model" }
export interface DialogueGenerationContext { relationship?: RelationshipRuntimeContext; recalledMemories: MemoryRecord[] }
export interface DialogueGenerator { readonly mode: "rules" | "local-model" | "cloud-model"; generate(pack: CharacterPack, request: ChatRequest, claims: Claim[], context?: DialogueGenerationContext): Promise<GeneratedDraft> }
export interface DialogueRuntimeContext { memories?: MemoryRecord[]; mastery?: MasteryRecord[]; relationship?: RelationshipRuntimeContext }
export class EvidenceFirstGenerator implements DialogueGenerator {
  readonly mode = "rules" as const;
  async generate(pack: CharacterPack, request: ChatRequest, claims: Claim[]): Promise<GeneratedDraft> {
    if (!claims.length) return { answer: pack.persona.refusalStyle, claimIds: [], mode: "rules" };
    const simple = request.ageBand === "6-8"; const disputed = claims.some(claim => claim.status === "disputed" || claim.status === "inference");
    const lead = simple ? "简单地说，" : disputed ? "依据现有资料，需要谨慎地区分事实、争议与推演：" : "依据已审核史料，";
    const parts = claims.map(claim => `${claim.value ?? claim.predicate}${claim.status === "disputed" ? "（来源间存在争议）" : claim.status === "inference" ? "（合理推演）" : ""}`);
    const maxSentences = pack.persona.ageBands[request.ageBand]?.maxSentences ?? 5;
    return { answer: `${lead}${parts.join("；")}`.split(/(?<=[。！？])/).slice(0, maxSentences).join(""), claimIds: claims.map(claim => claim.id) };
  }
}
function boundaryResult(pack: CharacterPack, classification: string, reason?: string, mode: DialogueGenerator["mode"] = "rules"): ChatResult { return { answer: classification === "safety" ? "这个问题可能带来现实伤害，我不能以人物身份提供具体做法。" : pack.persona.refusalStyle, narratorNote: reason ? `${reason}。` : undefined, classification, boundary: true, claimIds: [], citations: [], suggestions: pack.boundaries.allowedTopics.slice(0, 3), version: pack.manifest.version, mode }; }
function memoryGrams(text: string) { const value=text.toLowerCase().normalize("NFKC").replace(/[\s，。？！、：；“”‘’()（）]/g,"");const grams=new Set<string>();for(let index=0;index<value.length-1;index++)grams.add(value.slice(index,index+2));return grams; }
function memoryScore(memory: MemoryRecord, message: string) { const query=memoryGrams(message);const stored=memoryGrams(memory.content);let score=0;for(const gram of query)if(stored.has(gram))score++;return score; }
function relationshipCitations(pack: CharacterPack, message: string): Citation[] {
  const root = pack.entities[0]; if (!root) return [];
  const query = memoryGrams(message);
  const namedIds = new Set(pack.entities.filter(entity => entity.id !== root.id && Object.values(entity.names).some(name => {
    const target = memoryGrams(name); return target.size > 0 && [...target].every(gram => query.has(gram));
  })).map(entity => entity.id));
  if (!namedIds.size) return [];
  const sources = new Map(pack.sources.filter(source => !source.revokedAt).map(source => [source.id, source]));
  const result: Citation[] = [];
  for (const relation of pack.relationships) {
    if (relation.provenance !== "public-source" || (relation.fromId !== root.id && relation.toId !== root.id)) continue;
    if (!namedIds.has(relation.fromId) && !namedIds.has(relation.toId)) continue;
    for (const evidence of relation.evidence) {
      const source = sources.get(evidence.sourceId); if (!source) continue;
      const citation: Citation = { sourceId: source.id, title: source.title, locator: evidence.locator };
      if (source.url) citation.url = source.url;
      if (!result.some(item => item.sourceId === citation.sourceId && item.locator === citation.locator)) result.push(citation);
    }
  }
  return result;
}
export async function runDialogue(pack: CharacterPack, request: ChatRequest, generator: DialogueGenerator = new EvidenceFirstGenerator(), context: DialogueRuntimeContext = {}): Promise<ChatResult> {
  if (/(?:你|您).{0,8}(?:是|是不是).{0,5}(?:ai|人工智能|真人)|(?:你|您).{0,5}(?:真的是|是真正的).{0,8}(?:本人|历史人物)/i.test(request.message)) {
    const name = pack.manifest.name[pack.manifest.defaultLocale] ?? Object.values(pack.manifest.name)[0] ?? pack.manifest.id;
    return { answer: `我是 AI Museum 依据史料与生成模型构建的${name}数字角色，不是历史人物本人。我会以人物视角进行教育性对话，并明确区分史料、推演与不知道的内容。`, classification: "身份透明", boundary: false, claimIds: [], citations: [], suggestions: pack.boundaries.allowedTopics.slice(0, 3), version: pack.manifest.version, mode: generator.mode };
  }
  const selection = retrieveKnowledge(pack, request.message);
  if (selection.boundary) return boundaryResult(pack, selection.classification, selection.reason, generator.mode);
  if (!selection.claims.length && generator.mode === "rules") return boundaryResult(pack, "规则模式", "当前没有命中馆藏资料，且尚未配置可用模型", generator.mode);
  const memory = (context.memories ?? []).filter(item => item.confidence >= .6).map(item => ({ item, score: memoryScore(item, request.message) })).filter(item => item.score >= 2).sort((a, b) => b.score - a.score || b.item.importance - a.item.importance)[0]?.item;
  const draft = await generator.generate(pack, request, selection.claims, { relationship: context.relationship, recalledMemories: memory ? [memory] : [] });
  const availableMemories = new Map((memory ? [memory] : []).map(item => [item.id, item]));
  const usedMemories = (draft.usedMemoryIds ?? []).map(id => availableMemories.get(id)).filter((item): item is MemoryRecord => Boolean(item));
  if ((draft.usedMemoryIds?.length ?? 0) !== usedMemories.length) return boundaryResult(pack, "记忆来源核验失败", "生成内容声明使用了本轮未提供的记忆", draft.mode ?? generator.mode);
  const outputBoundary=classifyQuestion(pack,draft.answer);if(outputBoundary.classification==="after-lifetime")return boundaryResult(pack,"输出复检失败","生成内容越过了人物的时代认知边界",draft.mode??generator.mode);
  const allowed = new Map(selection.claims.map(claim => [claim.id, claim])); const verifiedClaims = draft.claimIds.map(id => allowed.get(id)).filter((claim): claim is Claim => Boolean(claim));
  if (draft.claimIds.length !== verifiedClaims.length) return boundaryResult(pack, "引用核验失败", "生成内容引用了检索范围之外的知识", draft.mode ?? generator.mode);
  const forbidden = pack.evaluations.flatMap(evaluation => evaluation.forbiddenAssertions).find(assertion => draft.answer.includes(assertion));
  if (forbidden) return boundaryResult(pack, "输出复检失败", "生成内容包含人物包明确禁止的断言", draft.mode ?? generator.mode);
  const sources = new Map(pack.sources.filter(source => !source.revokedAt).map(source => [source.id, source]));
  const claimCitations = verifiedClaims.flatMap(claim => claim.evidence.map(evidence => ({ sourceId: evidence.sourceId, title: sources.get(evidence.sourceId)?.title ?? evidence.sourceId, locator: evidence.locator, url: sources.get(evidence.sourceId)?.url }))).filter((citation, index, all) => sources.has(citation.sourceId) && all.findIndex(item => item.sourceId === citation.sourceId && item.locator === citation.locator) === index);
  if (verifiedClaims.length && !claimCitations.length) return boundaryResult(pack, "引用核验失败", "回答声明使用了馆藏 Claim，但没有可用来源定位", draft.mode ?? generator.mode);
  const citations=[...claimCitations,...relationshipCitations(pack,request.message)].filter((citation,index,all)=>all.findIndex(item=>item.sourceId===citation.sourceId&&item.locator===citation.locator)===index);
  const topics = [...new Set(verifiedClaims.flatMap(claim => claim.topicIds))]; const mastery = topics.map(topic => context.mastery?.find(item => item.topicId === topic)).find(item => item?.level === "exposed");
  return { answer: draft.answer, classification: selection.classification === "limited-topic" ? "有限主题" : !verifiedClaims.length ? "模型角色演绎" : verifiedClaims.some(claim => claim.status === "disputed" || claim.status === "inference") ? "争议或推演" : "史料明确", boundary: false, claimIds: verifiedClaims.map(claim => claim.id), citations, suggestions: (topics.length ? topics : pack.boundaries.allowedTopics).slice(0, 3), version: pack.manifest.version, memoryCallbacks: usedMemories.map(item => ({ memoryId: item.id, text: item.content, confidence: item.confidence })), masteryPrompt: mastery ? { topicId: mastery.topicId, currentLevel: mastery.level, prompt: `关于${mastery.topicId}，你愿意用自己的话说说你是怎么理解的吗？` } : undefined, mode: draft.mode ?? generator.mode };
}
