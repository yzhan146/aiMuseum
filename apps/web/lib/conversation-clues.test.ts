import { describe, expect, it } from "vitest";
import { buildConversationClues } from "./conversation-clues";

const liBai = {
  id: "li-bai",
  name: "李白",
  exhibit: {
    discoveries: [
      { id: "moon", kind: "名句", title: "故乡的月光", content: "举头望明月，低头思故乡。", keywords: ["月亮", "故乡"] },
      { id: "du-fu", kind: "关系", title: "李白与杜甫", content: "两位诗人约在744年相遇。", keywords: ["杜甫"] },
    ],
  },
};

describe("conversation discoveries", () => {
  it("unlocks curated treasures instead of copying arbitrary model sentences", () => {
    const clues = buildConversationClues(liBai, [
      { role: "user", content: "你认识杜甫吗？" },
      { role: "character", content: "哈哈，小友问得好！" },
    ]);
    expect(clues).toEqual([expect.objectContaining({ kind: "关系", title: "李白与杜甫", verified: true })]);
    expect(clues.some(clue => clue.detail.includes("哈哈"))).toBe(false);
  });

  it("keeps cited source locations as verified discoveries", () => {
    const clues = buildConversationClues(liBai, [{ role: "character", content: "谈诗", citations: [{ sourceId: "poets", title: "李白生平", locator: "Biography" }] }]);
    expect(clues).toContainEqual(expect.objectContaining({ kind: "史料", title: "李白生平", verified: true }));
  });
});
