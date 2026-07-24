import { describe, expect, it } from "vitest";
import {
  buildRelationshipRuntimeContext,
  relationshipBehaviorContracts,
} from "./relationship-behavior";

describe("relationship behavior contracts", () => {
  it("defines behavior for all five stages without a character hardcode", () => {
    expect(Object.keys(relationshipBehaviorContracts)).toEqual([
      "initial",
      "acquainted",
      "young_friend",
      "old_friend",
      "kindred_spirit",
    ]);
    expect(JSON.stringify(relationshipBehaviorContracts)).not.toMatch(
      /李白|li-bai/i,
    );
  });

  it("removes the entire relationship context while paused", () => {
    expect(
      buildRelationshipRuntimeContext({
        stage: "old_friend",
        status: "paused",
        preferredAddress: { value: "小舟", consentVersion: 2 },
        sharedMoments: [
          {
            memoryId: "memory-1",
            summary: "旧话题",
            sourceMessageIds: ["message-1"],
          },
        ],
        recurringTopics: ["诗歌"],
        priorViewpoints: ["才华不取决于外部承认"],
      }),
    ).toBeUndefined();
  });

  it("bounds active relationship context before prompt assembly", () => {
    const result = buildRelationshipRuntimeContext({
      stage: "acquainted",
      status: "active",
      sharedMoments: Array.from({ length: 8 }, (_, index) => ({
        memoryId: `memory-${index}`,
        summary: `moment-${index}`,
        sourceMessageIds: [`message-${index}`],
      })),
      recurringTopics: ["a", "b", "c", "d"],
      priorViewpoints: ["one", "two", "three"],
    });
    expect(result?.sharedMoments).toHaveLength(6);
    expect(result?.recurringTopics).toHaveLength(3);
    expect(result?.priorViewpoints).toHaveLength(2);
  });
});
