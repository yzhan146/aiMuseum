import type {
  RelationshipDimension,
  RelationshipEvidenceStatus,
  RelationshipEvidenceType,
  RelationshipStage,
} from "@ai-museum/sdk";

export const RELATIONSHIP_POLICY_VERSION = "relationship-policy-v1";

export const relationshipStageOrder: RelationshipStage[] = [
  "initial",
  "acquainted",
  "young_friend",
  "old_friend",
  "kindred_spirit",
];

export interface ProjectableRelationshipEvidence {
  id: string;
  logicalKey: string;
  dimension: RelationshipDimension;
  type: RelationshipEvidenceType;
  quality: 1 | 2 | 3;
  episodeKey: string;
  topicKey: string;
  status: RelationshipEvidenceStatus;
}

export interface RelationshipProjection {
  policyVersion: string;
  currentStage: RelationshipStage;
  eligibleStage: RelationshipStage;
  nextStage: RelationshipStage;
  totalQuality: number;
  dimensions: RelationshipDimension[];
  episodeCount: number;
  topicCount: number;
  countedEvidenceIds: string[];
}

type ProjectionFacts = Omit<
  RelationshipProjection,
  "policyVersion" | "currentStage" | "eligibleStage" | "nextStage"
>;

function stageIndex(stage: RelationshipStage) {
  return relationshipStageOrder.indexOf(stage);
}

function deduplicateAndCap(evidence: ProjectableRelationshipEvidence[]) {
  const byLogicalKey = new Map<string, ProjectableRelationshipEvidence>();
  for (const item of [...evidence].sort((a, b) =>
    a.logicalKey.localeCompare(b.logicalKey) || a.id.localeCompare(b.id),
  )) {
    if (item.status !== "active") continue;
    const current = byLogicalKey.get(item.logicalKey);
    if (
      !current ||
      item.quality > current.quality ||
      (item.quality === current.quality && item.id < current.id)
    ) {
      byLogicalKey.set(item.logicalKey, item);
    }
  }

  const capped = new Map<string, ProjectableRelationshipEvidence>();
  for (const item of byLogicalKey.values()) {
    const capKey = `${item.episodeKey}\u0000${item.topicKey}\u0000${item.type}`;
    const current = capped.get(capKey);
    if (
      !current ||
      item.quality > current.quality ||
      (item.quality === current.quality && item.id < current.id)
    ) {
      capped.set(capKey, item);
    }
  }
  return [...capped.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function factsFor(evidence: ProjectableRelationshipEvidence[]): ProjectionFacts {
  const counted = deduplicateAndCap(evidence);
  return {
    totalQuality: counted.reduce((total, item) => total + item.quality, 0),
    dimensions: [...new Set(counted.map((item) => item.dimension))].sort(),
    episodeCount: new Set(counted.map((item) => item.episodeKey)).size,
    topicCount: new Set(counted.map((item) => item.topicKey).filter(Boolean)).size,
    countedEvidenceIds: counted.map((item) => item.id),
  };
}

function qualifies(
  stage: RelationshipStage,
  facts: ProjectionFacts,
  evidence: ProjectableRelationshipEvidence[],
) {
  const countedIds = new Set(facts.countedEvidenceIds);
  const counted = evidence.filter((item) => countedIds.has(item.id));
  const understandingEpisodes = new Set(
    counted
      .filter((item) => item.dimension === "demonstrated_understanding")
      .map((item) => item.episodeKey),
  ).size;
  const hasUnderstandingOrPerspective = counted.some(
    (item) =>
      item.dimension === "demonstrated_understanding" ||
      item.dimension === "independent_perspective",
  );
  const hasEvolutionOrSynthesis = counted.some(
    (item) =>
      item.type === "viewpoint_evolution" ||
      item.type === "cross_topic_synthesis",
  );

  switch (stage) {
    case "initial":
      return true;
    case "acquainted":
      return (
        facts.totalQuality >= 4 &&
        facts.dimensions.length >= 2 &&
        facts.episodeCount >= 2
      );
    case "young_friend":
      return (
        facts.totalQuality >= 10 &&
        facts.dimensions.length >= 3 &&
        facts.episodeCount >= 3 &&
        facts.topicCount >= 2
      );
    case "old_friend":
      return (
        facts.totalQuality >= 18 &&
        facts.dimensions.length >= 4 &&
        facts.episodeCount >= 5 &&
        facts.topicCount >= 3 &&
        hasUnderstandingOrPerspective
      );
    case "kindred_spirit":
      return (
        facts.totalQuality >= 30 &&
        facts.dimensions.length === 5 &&
        facts.episodeCount >= 8 &&
        facts.topicCount >= 4 &&
        understandingEpisodes >= 2 &&
        hasEvolutionOrSynthesis
      );
  }
}

export function projectRelationshipStage(input: {
  currentStage: RelationshipStage;
  evidence: ProjectableRelationshipEvidence[];
}): RelationshipProjection {
  const facts = factsFor(input.evidence);
  let eligibleStage: RelationshipStage = "initial";
  for (const stage of relationshipStageOrder) {
    if (qualifies(stage, facts, input.evidence)) eligibleStage = stage;
  }

  const currentIndex = stageIndex(input.currentStage);
  const eligibleIndex = stageIndex(eligibleStage);
  const nextIndex = Math.max(
    currentIndex,
    Math.min(currentIndex + 1, eligibleIndex),
  );

  return {
    policyVersion: RELATIONSHIP_POLICY_VERSION,
    currentStage: input.currentStage,
    eligibleStage,
    nextStage: relationshipStageOrder[nextIndex],
    ...facts,
  };
}
