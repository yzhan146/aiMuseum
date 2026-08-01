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
    expect(prompt).toContain("李白数字角色，不是历史人物本人");
    expect(prompt).toContain("是否为 AI");
    expect(prompt).toContain("严格截止于0762-12-01");
    expect(prompt).toContain("澎湃");
    expect(prompt).toContain("不得解释其现代原理");
    expect(prompt).toContain("杜甫");
  });

  it("injects relationship behavior and a consented address without exposing thresholds", () => {
    const prompt = buildCharacterSystemPrompt(liBai, request, [], [], {
      recalledMemories: [],
      relationship: {
        stage: "young_friend",
        status: "active",
        behaviorContract: ["可以更主动邀请用户表达判断。"],
        preferredAddress: { value: "青莲客", consentVersion: 1 },
        sharedMoments: [], recurringTopics: ["诗与仕途"], priorViewpoints: [],
      },
    });
    expect(prompt).toContain("young_friend");
    expect(prompt).toContain("青莲客");
    expect(prompt).toContain("不得提及内部数值、门槛、权重或晋级攻略");
  });

  it("injects a curated hall guide manual without creating relationship memory", () => {
    const prompt = buildCharacterSystemPrompt(liBai, request, [], [], {
      recalledMemories: [],
      museumGuide: {
        hallTitle: "测试展厅",
        hallQuestion: "作品如何诞生？",
        stationTitle: "工坊",
        stationBody: "观察共同生产。",
        currentObject: {
          name: "测试作品",
          dateLabel: "1500",
          description: "已审核的展品说明。",
          significance: "它说明协作的重要性。",
          factStatus: "interpretation",
        },
        nearbyObjects: [],
        routeReminderUsed: false,
        history: [],
      },
    });
    expect(prompt).toContain("当前数字展厅导览手册");
    expect(prompt).toContain("测试作品");
    expect(prompt).toContain("本轮导览不写入长期记忆");
    expect(prompt).toContain("不得修改作者、年代、地点");
  });
});
