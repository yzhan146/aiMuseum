import { describe, expect, it } from "vitest";
import { exhibitPackSchema } from "./hall-scenes.js";

describe("exhibitPackSchema", () => {
  it("rejects an unknown anchor object", () => {
    const result = exhibitPackSchema.safeParse({
      manifest: { schemaVersion: "1.0", id: "sample-hall", version: "1.0.0", status: "published", author: { id: "museum", name: "Museum" }, licenseCode: "Apache-2.0", publishedAt: "2026-07-22T00:00:00.000Z" },
      hall: {
        id: "sample-hall", periodId: "sample-period", sceneVersion: "1.0.0", locale: "zh-CN", title: "示例", question: "问题", guideTitle: "导览", guideText: "说明",
        theme: { themeKey: "sample", tokens: { bgDeep: "#111111", bgSoft: "#eeeeee", surface: "#ffffff", ink: "#111111", accent: "#cc4422", highlight: "#ffcc55" }, lightAssetId: "scene", archiveAssetId: "scene" },
        entrance: { kicker: "入口", primaryActionLabel: "开始", anchorObjectId: "missing" },
        stations: [
          { id: "one", order: 1, type: "orientation", title: "入口", body: "说明", objectIds: [], characterIds: [] },
          { id: "two", order: 2, type: "object", title: "物件", body: "说明", objectIds: [], characterIds: [] },
          { id: "three", order: 3, type: "character_relation", title: "人物", body: "说明", objectIds: [], characterIds: ["person"] },
          { id: "four", order: 4, type: "reflection", title: "离场", body: "说明", objectIds: [], characterIds: [] },
        ],
        characterRefs: [{ id: "person", relationshipLabel: "相关人物" }], exit: { reflectionQuestion: "你会怎样想？" },
      },
      objects: [{ id: "object", name: "物件", kind: "document", dateLabel: "某时期", shortLabel: "一件物件", description: "说明", significance: "意义", visualDescription: "视觉说明", representation: "decorative_illustration", sourceIds: ["source"], relatedCharacterIds: ["person"], status: "published" }],
      assets: [{ id: "scene", path: "/exhibits/sample/1.0.0/scene.webp", contentType: "image/webp", width: 1200, height: 800, representation: "decorative_illustration", sourceIds: ["source"], alt: "示例展厅艺术重建", licenseCode: "CC-BY-4.0" }],
      sources: [{ id: "source", title: "策展资料", note: "公开资料综合" }],
    });
    expect(result.success).toBe(false);
  });
});
