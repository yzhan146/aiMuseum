import { describe, expect, it } from "vitest";
import {
  publicRelationshipSchema,
  relationshipEvidenceCandidateOutputSchema,
  relationshipEvidenceSourceSchema,
  relationshipRuntimeContextSchema,
  relationshipStageSchema,
  relationshipStages,
} from "./relationship.js";

const validOutput = {
  schemaVersion: "relationship-evidence-v1",
  source: {
    threadId: "thread-1",
    turnId: "turn-1",
    messageIds: ["user-1", "character-1"],
  },
  candidates: [
    {
      subjectRole: "user",
      primaryUserMessageId: "user-1",
      type: "reasoned_disagreement",
      topicKey: "talent-and-recognition",
      sanitizedSummary: "用户区分了才华与外部承认。",
      stance: "disagree",
      substantiveness: "high",
      noveltyKey: "reasoned-disagreement:talent-recognition",
      confidence: 0.91,
      contextMessageIds: ["user-1", "character-1"],
    },
  ],
  blocked: [],
};

describe("relationship schemas", () => {
  it("defines exactly the approved five stages", () => {
    expect(relationshipStages).toEqual([
      "initial",
      "acquainted",
      "young_friend",
      "old_friend",
      "kindred_spirit",
    ]);
    for (const stage of relationshipStages) {
      expect(relationshipStageSchema.parse(stage)).toBe(stage);
    }
  });

  it("keeps the transition placement message in the public DTO", () => {
    const result = publicRelationshipSchema.parse({
      characterId: "li-bai",
      stage: "acquainted",
      status: "active",
      revision: 2,
      stageChangedAt: "2026-07-23T10:00:00.000Z",
      pendingTransition: {
        id: "transition-1",
        fromStage: "initial",
        toStage: "acquainted",
        feedbackText: "我们对彼此的想法多了一些了解。",
        createdAt: "2026-07-23T10:00:00.000Z",
        afterMessageId: "character-message-1",
      },
    });
    expect(result.pendingTransition?.afterMessageId).toBe(
      "character-message-1",
    );
  });

  it("requires the primary source to be the user's message", () => {
    expect(() =>
      relationshipEvidenceSourceSchema.parse({
        sourceType: "message",
        sourceId: "character-message-1",
        sourceRole: "character_message",
        dependencyRole: "primary",
      }),
    ).toThrow(/user message/);
  });

  it("accepts a bounded active runtime context", () => {
    const result = relationshipRuntimeContextSchema.parse({
      stage: "young_friend",
      status: "active",
      behaviorContract: ["自然承接一段有来源的共同经历。"],
      sharedMoments: [
        {
          memoryId: "memory-1",
          summary: "曾讨论诗歌与外部承认。",
          sourceMessageIds: ["message-1"],
        },
      ],
      recurringTopics: ["诗歌"],
      priorViewpoints: [],
    });
    expect(result.sharedMoments).toHaveLength(1);
  });

  it("rejects candidates that assign the evidence to the character", () => {
    expect(
      relationshipEvidenceCandidateOutputSchema.safeParse({
        ...validOutput,
        candidates: [
          { ...validOutput.candidates[0], subjectRole: "character" },
        ],
      }).success,
    ).toBe(false);
  });

  it.each(["stage", "score", "weight"])(
    "rejects the forbidden candidate field %s",
    (field) => {
      expect(
        relationshipEvidenceCandidateOutputSchema.safeParse({
          ...validOutput,
          candidates: [
            { ...validOutput.candidates[0], [field]: field === "stage" ? "old_friend" : 10 },
          ],
        }).success,
      ).toBe(false);
    },
  );
});
