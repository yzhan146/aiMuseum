import { describe, expect, it } from "vitest";
import { supportingPacks } from "@ai-museum/characters";
import { buildCharacterSystemPrompt, relationshipContextFor } from "./model-provider";

const liBai = supportingPacks.find(pack => pack.manifest.id === "li-bai")!;
const request = { characterId: "li-bai", message: "你认识杜甫吗？", ageBand: "9-12", locale: "zh-CN" };

describe("character system prompt", () => {
  it("injects a sourced relationship with computed age difference", () => {
    const relationships = relationshipContextFor(liBai, request.message);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({ characterName: "杜甫", type: "personally-knew", firstKnownContact: "0744", ageDifferenceYears: 11, relativeAgeDescription: "杜甫比李白年轻11岁", provenance: "public-source" });
  });

  it("keeps model-suggested catalog links uncertain", () => {
    const relationships = relationshipContextFor(liBai, "你认识阿倍仲麻吕吗？");
    expect(relationships[0]).toMatchObject({ characterName: "阿倍仲麻吕", provenance: "model-suggested" });
    expect(relationships[0]?.certaintyRule).toMatch(/不得声称亲自认识/);
  });

  it("encodes identity, lifetime, voice and epistemic limits", () => {
    const prompt = buildCharacterSystemPrompt(liBai, request);
    expect(prompt).toContain("你正在扮演历史人物李白");
    expect(prompt).toContain("严格截止于0762-12-01");
    expect(prompt).toContain("澎湃");
    expect(prompt).toContain("不得解释其现代原理");
    expect(prompt).toContain("杜甫");
  });
});
