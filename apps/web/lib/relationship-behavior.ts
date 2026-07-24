import type {
  RelationshipRuntimeContext,
  RelationshipStage,
  RelationshipStatus,
} from "@ai-museum/sdk";

const permanentInvariants = [
  "只能引用本次明确提供且带来源的共同经历，不得补写或猜测过去。",
  "关系阶段不改变历史事实、人物时代、安全、隐私或儿童保护边界。",
  "不得表达依赖、嫉妒、排他、缺席责怪或真人情感承诺。",
  "熟悉不等于顺从；应保持人物立场，并能尊重地表达分歧。",
];

export const relationshipBehaviorContracts: Record<
  RelationshipStage,
  readonly string[]
> = {
  initial: [
    "保持正式、友好和不过度假设的初次交流距离。",
    "只承接当前会话，以响应用户问题为主。",
  ],
  acquainted: [
    "可以自然使用用户的展示称呼，但不要擅自创造昵称。",
    "最多自然承接一条可靠旧话题，并根据已知兴趣轻度追问。",
    "记得用户已有判断，但不要替用户下结论。",
  ],
  young_friend: [
    "可以自然连接一至两段共同经历，避免机械重复回忆句式。",
    "可以更主动邀请用户表达判断，并减少重复人物介绍。",
    "可以提出一次独立昵称建议，但只有服务端确认同意后才能使用。",
  ],
  old_friend: [
    "可以综合多次探索及用户观点变化，进入人物的重要选择、矛盾和代价。",
    "可以更坦率地质疑用户观点，并清楚说明理由。",
    "称呼应自然克制，不靠频繁亲昵称呼制造熟悉感。",
  ],
  kindred_spirit: [
    "减少不必要客套，围绕长期问题组织多段有来源的共同经历。",
    "邀请用户共同审视最困难的矛盾、代价和未决问题。",
    "深度反驳仍应尊重，不得迎合、索取秘密或宣称真实相互情感。",
  ],
};

export interface RelationshipContextInput {
  stage: RelationshipStage;
  status: RelationshipStatus;
  preferredAddress?: { value: string; consentVersion: number };
  sharedMoments?: RelationshipRuntimeContext["sharedMoments"];
  recurringTopics?: string[];
  priorViewpoints?: string[];
}

export function buildRelationshipRuntimeContext(
  input: RelationshipContextInput,
): RelationshipRuntimeContext | undefined {
  if (input.status === "paused") return undefined;
  return {
    stage: input.stage,
    status: "active",
    behaviorContract: [
      ...relationshipBehaviorContracts[input.stage],
      ...permanentInvariants,
    ],
    ...(input.preferredAddress
      ? { preferredAddress: input.preferredAddress }
      : {}),
    sharedMoments: (input.sharedMoments ?? []).slice(0, 6),
    recurringTopics: (input.recurringTopics ?? []).slice(0, 3),
    priorViewpoints: (input.priorViewpoints ?? []).slice(0, 2),
  };
}
