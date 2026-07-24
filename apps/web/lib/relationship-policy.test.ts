import { describe, expect, it } from "vitest";
import {
  projectRelationshipStage,
  type ProjectableRelationshipEvidence,
} from "./relationship-policy";

const dimensions = [
  "continuity",
  "exploration_depth",
  "demonstrated_understanding",
  "reciprocal_context",
  "independent_perspective",
] as const;

function evidence(count: number): ProjectableRelationshipEvidence[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `e-${String(index).padStart(2, "0")}`,
    logicalKey: `logical-${index}`,
    dimension: dimensions[index % dimensions.length],
    type:
      index === count - 1
        ? "viewpoint_evolution"
        : index % 5 === 2
          ? "explanation_or_application"
          : "responsive_followup",
    quality: 3,
    episodeKey: `episode-${index}`,
    topicKey: `topic-${index % 4}`,
    status: "active",
  }));
}

describe("relationship policy", () => {
  it("advances at most one stage even when all later gates qualify", () => {
    const result = projectRelationshipStage({
      currentStage: "initial",
      evidence: evidence(12),
    });
    expect(result.eligibleStage).toBe("kindred_spirit");
    expect(result.nextStage).toBe("acquainted");
  });

  it("supports all four adjacent promotions with the same fixture", () => {
    const fixture = evidence(12);
    const stages = [
      "initial",
      "acquainted",
      "young_friend",
      "old_friend",
    ] as const;
    expect(
      stages.map(
        (currentStage) =>
          projectRelationshipStage({ currentStage, evidence: fixture }).nextStage,
      ),
    ).toEqual([
      "acquainted",
      "young_friend",
      "old_friend",
      "kindred_spirit",
    ]);
  });

  it("is deterministic regardless of evidence order", () => {
    const fixture = evidence(8);
    const forward = projectRelationshipStage({
      currentStage: "young_friend",
      evidence: fixture,
    });
    const reverse = projectRelationshipStage({
      currentStage: "young_friend",
      evidence: [...fixture].reverse(),
    });
    expect(reverse).toEqual(forward);
  });

  it("counts only the strongest duplicate in the same episode/topic/type cap", () => {
    const fixture: ProjectableRelationshipEvidence[] = [
      {
        id: "weak",
        logicalKey: "one",
        dimension: "exploration_depth",
        type: "substantive_question",
        quality: 1,
        episodeKey: "episode-1",
        topicKey: "poetry",
        status: "active",
      },
      {
        id: "strong",
        logicalKey: "two",
        dimension: "exploration_depth",
        type: "substantive_question",
        quality: 3,
        episodeKey: "episode-1",
        topicKey: "poetry",
        status: "active",
      },
    ];
    const result = projectRelationshipStage({
      currentStage: "initial",
      evidence: fixture,
    });
    expect(result.totalQuality).toBe(3);
    expect(result.countedEvidenceIds).toEqual(["strong"]);
  });

  it("never lowers an already achieved stage", () => {
    expect(
      projectRelationshipStage({
        currentStage: "old_friend",
        evidence: [],
      }).nextStage,
    ).toBe("old_friend");
  });
});
