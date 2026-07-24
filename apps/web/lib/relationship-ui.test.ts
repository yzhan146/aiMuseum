import { describe, expect, it } from "vitest";
import {
  countUnicodeGraphemes,
  getRelationshipStagePresentation,
  RELATIONSHIP_STAGES,
  validateRelationshipAddress,
} from "./relationship-ui";

describe("relationship stage presentation", () => {
  it("keeps the approved Chinese labels and indigo palette", () => {
    expect(RELATIONSHIP_STAGES.map((stage) => getRelationshipStagePresentation(stage))).toEqual([
      { label: "初识", foreground: "#5B6873", background: "#F2F5F7" },
      { label: "相知", foreground: "#46697A", background: "#ECF4F6" },
      { label: "小友", foreground: "#2F7075", background: "#E5F4F1" },
      { label: "老友", foreground: "#326B75", background: "#DCEEEA" },
      { label: "莫逆之交", foreground: "#3A6577", background: "#D5E7EE" },
    ]);
  });
});

describe("relationship address validation", () => {
  it("counts Unicode grapheme clusters rather than UTF-16 code units", () => {
    expect(countUnicodeGraphemes("舟")).toBe(1);
    expect(countUnicodeGraphemes("e\u0301")).toBe(1);
    expect(countUnicodeGraphemes("👨‍👩‍👧‍👦")).toBe(1);
  });

  it("trims the value and accepts one to twenty graphemes", () => {
    expect(validateRelationshipAddress("  小舟  ")).toEqual({ value: "小舟", graphemeCount: 2, error: null });
    expect(validateRelationshipAddress("舟".repeat(20)).error).toBeNull();
  });

  it("rejects empty and overlong values", () => {
    expect(validateRelationshipAddress("   ").error).toBe("请输入希望人物使用的称呼。");
    expect(validateRelationshipAddress("舟".repeat(21)).error).toBe("称呼最多为 20 个字符。");
  });
});
