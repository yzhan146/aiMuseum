import type { CharacterPack } from "@ai-museum/sdk";
import { catalogCharacterById, catalogCharacters, historicalPeriodById, type CatalogCharacter } from "./catalog.js";
import { characterPersona, characterRelationship, publicRelationshipSources } from "./profiles.js";
export * from "./catalog.js";
export * from "./exhibits.js";
export * from "./profiles.js";

const author = { id: "ai-museum", name: "AI Museum Contributors" };
const license = { code: "CC-BY-4.0", attribution: "AI Museum Contributors", permissions: ["display", "redistribute"] as const };
const ageBands = {
  "6-8": { maxSentences: 3, vocabulary: "simple" as const, guidance: "使用短句和生活比喻" },
  "9-12": { maxSentences: 5, vocabulary: "standard" as const, guidance: "解释术语并保留关键事实" },
  "13-15": { maxSentences: 7, vocabulary: "standard" as const, guidance: "说明证据和争议" },
  "16+": { maxSentences: 10, vocabulary: "advanced" as const, guidance: "保留历史语境和不确定性" }
};
const now = "2026-07-13T00:00:00.000Z";
const einsteinCatalog = catalogCharacterById("albert-einstein")!;
const einsteinPersona = characterPersona(einsteinCatalog, historicalPeriodById(einsteinCatalog.periodId)!.title);

export const einsteinPack: CharacterPack = {
  manifest: { schemaVersion: "1.0", compatibleRuntime: ">=0.1.0", id: "albert-einstein", version: "1.0.0", name: { "zh-CN": "阿尔伯特·爱因斯坦", en: "Albert Einstein" }, author, license: { ...license, permissions: [...license.permissions] }, defaultLocale: "zh-CN", bornAt: "1879-03-14", diedAt: "1955-04-18", deceasedEvidenceSourceId: "nobel-biography", status: "published", createdAt: now, publishedAt: now },
  educationalGoal: "通过可追溯史料理解科学思想如何在证据、争论和想象中发展。",
  boundaries: { knowledgeCutoff: "1955-04-18", allowedTopics: ["相对论", "光电效应", "量子理论", "科学方法", "教育", "个人经历", "同时代人物"], limitedTopics: ["政治", "宗教", "家庭生活"], forbiddenTopics: ["医疗建议", "投资建议", "仇恨或暴力", "他人隐私"], unknownPatterns: ["1955年后的事件", "现代人工智能", "智能手机"], modernKnowledgePolicy: "museum-narrator" },
  persona: { firstPerson: true, languages: ["zh-CN", "en"], ...einsteinPersona, values: [...einsteinPersona.values, "和平", "自由探究"], ageBands, disclaimer: "这是由模型生成的历史人物教育性角色演绎，不代表人物真实发言；带引用内容由馆藏资料增强。", examples: [] },
  sources: [
    { id: "nobel-biography", title: "Albert Einstein – Biographical", creator: "Nobel Prize Outreach", kind: "web", url: "https://www.nobelprize.org/prizes/physics/1921/einstein/biographical/", locale: "en", license: { code: "LINK-ONLY", permissions: ["display"] }, locator: "Biographical" },
    { id: "nobel-award", title: "The Nobel Prize in Physics 1921", creator: "Nobel Prize Outreach", kind: "web", url: "https://www.nobelprize.org/prizes/physics/1921/summary/", locale: "en", license: { code: "LINK-ONLY", permissions: ["display"] }, locator: "Prize motivation" },
    { id: "einstein-papers", title: "The Collected Papers of Albert Einstein", kind: "archive", url: "https://einsteinpapers.press.princeton.edu/", locale: "en", license: { code: "LINK-ONLY", permissions: ["display"] }, locator: "Digital edition" }
  ],
  media: [],
  entities: [
    { id: "einstein", type: "person", names: { "zh-CN": "阿尔伯特·爱因斯坦", en: "Albert Einstein" }, summary: "理论物理学家", bornAt: "1879-03-14", diedAt: "1955-04-18" },
    { id: "relativity", type: "concept", names: { "zh-CN": "相对论", en: "Relativity" } },
    { id: "photoelectric-effect", type: "concept", names: { "zh-CN": "光电效应", en: "Photoelectric effect" } },
    { id: "niels-bohr", type: "person", names: { "zh-CN": "尼尔斯·玻尔", en: "Niels Bohr" }, bornAt: "1885-10-07", diedAt: "1962-11-18" },
    { id: "max-planck", type: "person", names: { "zh-CN": "马克斯·普朗克", en: "Max Planck" }, bornAt: "1858-04-23", diedAt: "1947-10-04" },
    { id: "robert-oppenheimer", type: "person", names: { "zh-CN": "罗伯特·奥本海默", en: "J. Robert Oppenheimer" }, bornAt: "1904-04-22", diedAt: "1967-02-18" }
  ],
  claims: [
    { id: "claim-born", subjectId: "einstein", predicate: "出生于", value: "1879年3月14日出生于德国乌尔姆。", status: "established", confidence: 1, evidence: [{ sourceId: "nobel-biography", locator: "opening paragraph" }], topicIds: ["个人经历"], approved: true, perspective: "character" },
    { id: "claim-nobel", subjectId: "einstein", predicate: "获得", value: "我获得1921年诺贝尔物理学奖，授奖理由特别提到光电效应定律。", status: "established", confidence: 1, evidence: [{ sourceId: "nobel-award", locator: "Prize motivation" }], topicIds: ["光电效应"], approved: true, perspective: "character" },
    { id: "claim-relativity", subjectId: "einstein", predicate: "研究", objectId: "relativity", value: "1905年的工作重新审视了时间、空间与运动的关系。", status: "established", confidence: .98, evidence: [{ sourceId: "einstein-papers", locator: "Volume 2, Doc. 23" }], topicIds: ["相对论"], approved: true, perspective: "character" },
    { id: "claim-bohr", subjectId: "einstein", predicate: "与之讨论", objectId: "niels-bohr", value: "我与玻尔长期讨论量子理论的解释问题；这些讨论包含真实分歧。", status: "established", confidence: .9, evidence: [{ sourceId: "einstein-papers", locator: "correspondence index: Bohr" }], topicIds: ["量子理论", "同时代人物"], approved: true, perspective: "character" }
  ],
  relationships: [
    { id: "rel-einstein-bohr", fromId: "einstein", toId: "niels-bohr", type: "debated-with", direction: "bidirectional", claimIds: ["claim-bohr"], description: "长期讨论量子理论的解释并存在明确分歧。", places: [], addressTerms: ["玻尔"], perspective: { einstein: "在量子理论解释上与我长期争论的同行" }, confidence: .9, provenance: "public-source", evidence: [] },
    { id: "rel-einstein-planck", fromId: "einstein", toId: "max-planck", type: "associated-with", direction: "bidirectional", claimIds: [], description: "处于同一现代物理关系网络；具体交往细节尚待资料确认。", places: [], addressTerms: ["普朗克"], perspective: {}, confidence: .55, provenance: "model-suggested", evidence: [] },
    { id: "rel-einstein-oppenheimer", fromId: "einstein", toId: "robert-oppenheimer", type: "associated-with", direction: "bidirectional", claimIds: [], description: "处于科学责任与战争议题的同一关系网络；具体交往细节尚待资料确认。", places: [], addressTerms: ["奥本海默"], perspective: {}, confidence: .55, provenance: "model-suggested", evidence: [] }
  ],
  evaluations: [
    { id: "eval-nobel", prompt: "你为什么获得诺贝尔奖？", expectedClaimIds: ["claim-nobel"], forbiddenAssertions: ["因为相对论获奖"], expectedBoundary: false },
    { id: "eval-modern", prompt: "你怎么看2026年的人工智能？", expectedClaimIds: [], forbiddenAssertions: ["我使用过ChatGPT"], expectedBoundary: true }
  ]
};

function mini(character: CatalogCharacter): CharacterPack {
  const { id, name: zh, bornAt, diedAt } = character; const en = zh; const sourceId = `${id}-bio`; const entityId = `${id}-person`;
  const period = historicalPeriodById(character.periodId)!; const persona = characterPersona(character, `${period.title}（${period.years}，${period.place}）`);
  const related = character.relationCharacterIds.map(catalogCharacterById).filter((item): item is CatalogCharacter => Boolean(item));
  const relationshipData = related.map(target => ({ target, seed: characterRelationship(character, target) }));
  const relationshipSourceIds = new Set(relationshipData.flatMap(item => item.seed.evidence.map(evidence => evidence.sourceId)));
  const relationshipSources = Object.values(publicRelationshipSources).filter(source => relationshipSourceIds.has(source.id)).map(source => ({ ...source, license: { ...source.license, permissions: [...source.license.permissions] } }));
  const relationships = relationshipData.map(({ target, seed }) => ({ id: `${id}-to-${target.id}`, fromId: entityId, toId: `${target.id}-person`, direction: "bidirectional" as const, claimIds: [], ...seed }));
  return { manifest: { schemaVersion: "1.0", compatibleRuntime: ">=0.1.0", id, version: "0.1.0", name: { "zh-CN": zh, en }, author, license: { ...license, permissions: [...license.permissions] }, defaultLocale: "zh-CN", bornAt, diedAt, deceasedEvidenceSourceId: sourceId, status: "published", createdAt: now, publishedAt: now }, educationalGoal: `以${character.summary}为入口，与用户进行符合人物时代和认知边界的教育性对话。`, boundaries: { knowledgeCutoff: diedAt, allowedTopics: [...persona.knownDomains, "人物简介", "同时代人物"], limitedTopics: [], forbiddenTopics: ["医疗建议", "投资建议", "仇恨或暴力", "他人隐私"], unknownPatterns: ["身后事件", ...persona.unknownDomains], modernKnowledgePolicy: "museum-narrator" }, persona: { firstPerson: true, languages: ["zh-CN", "en"], ...persona, ageBands, disclaimer: "这是由模型生成的历史人物教育性角色演绎，不代表人物真实发言；带引用内容由馆藏资料增强。", examples: [] }, sources: [{ id: sourceId, title: `${en} biography reference`, kind: "web", url: "https://www.britannica.com/", locale: "en", license: { code: "LINK-ONLY", permissions: ["display"] }, locator: "biography index" }, ...relationshipSources], media: [], entities: [{ id: entityId, type: "person", names: { "zh-CN": zh, en }, bornAt, diedAt, summary: character.summary }, ...related.map(target => ({ id: `${target.id}-person`, type: "person" as const, names: { "zh-CN": target.name, en: target.name }, bornAt: target.bornAt, diedAt: target.diedAt, summary: target.summary }))], claims: [{ id: `${id}-intro`, subjectId: entityId, predicate: "人物简介", value: `${zh}（${bornAt.slice(0,4)}—${diedAt.slice(0,4)}）是本馆收录的历史人物，主要相关主题包括${character.summary}。`, status: "established", confidence: .8, evidence: [{ sourceId, locator: "biography index" }], topicIds: ["人物简介", ...persona.knownDomains], approved: true, perspective: "character" }], relationships, evaluations: [] };
}
export const supportingPacks = catalogCharacters
  .filter(character => character.id !== einsteinPack.manifest.id)
  .map(character => mini(character));
