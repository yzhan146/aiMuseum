import type { RelationshipStage } from "@ai-museum/sdk";

export type RelationshipStagePresentation = {
  label: string;
  foreground: string;
  background: string;
};

export const RELATIONSHIP_STAGES: readonly RelationshipStage[] = [
  "initial",
  "acquainted",
  "young_friend",
  "old_friend",
  "kindred_spirit",
];

export const RELATIONSHIP_STAGE_PRESENTATION = {
  initial: { label: "初识", foreground: "#5B6873", background: "#F2F5F7" },
  acquainted: { label: "相知", foreground: "#46697A", background: "#ECF4F6" },
  young_friend: { label: "小友", foreground: "#2F7075", background: "#E5F4F1" },
  old_friend: { label: "老友", foreground: "#326B75", background: "#DCEEEA" },
  kindred_spirit: { label: "莫逆之交", foreground: "#3A6577", background: "#D5E7EE" },
} as const satisfies Record<RelationshipStage, RelationshipStagePresentation>;

export function getRelationshipStagePresentation(stage: RelationshipStage): RelationshipStagePresentation {
  return RELATIONSHIP_STAGE_PRESENTATION[stage];
}

const graphemeSegmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

export function countUnicodeGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

export type RelationshipAddressValidation = {
  value: string;
  graphemeCount: number;
  error: string | null;
};

export function validateRelationshipAddress(value: string): RelationshipAddressValidation {
  const normalized = value.trim();
  const graphemeCount = countUnicodeGraphemes(normalized);
  if (graphemeCount === 0) return { value: normalized, graphemeCount, error: "请输入希望人物使用的称呼。" };
  if (graphemeCount > 20) return { value: normalized, graphemeCount, error: "称呼最多为 20 个字符。" };
  return { value: normalized, graphemeCount, error: null };
}
