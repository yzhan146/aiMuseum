import { describe, expect, it } from "vitest";
import { buildConversationClues } from "./conversation-clues";

const characters = [
  { id: "li-bai", name: "李白", relationCharacterIds: ["du-fu"] },
  { id: "du-fu", name: "杜甫", relationCharacterIds: ["li-bai"] },
];

describe("conversation clues", () => {
  it("collects mentioned relationships, recent points and citations", () => {
    const clues = buildConversationClues(characters[0], characters, [
      { role: "user", content: "你认识杜甫吗？" },
      { id: "answer-1", role: "character", content: "我与杜甫曾在洛阳相遇。他比我年轻十一岁。", citations: [{ sourceId: "poets", title: "李白生平", locator: "744年相遇" }] },
    ]);

    expect(clues).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "人物", title: "谈到了杜甫" }),
      expect.objectContaining({ kind: "要点", detail: "他比我年轻十一岁。" }),
      expect.objectContaining({ kind: "史料", title: "李白生平" }),
    ]));
  });

  it("does not invent relationship clues for people absent from the thread", () => {
    const clues = buildConversationClues(characters[0], characters, [{ role: "character", content: "我喜欢在月下饮酒。" }]);
    expect(clues.some(clue => clue.kind === "人物")).toBe(false);
  });
});
