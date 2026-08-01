import { describe, expect, it } from "vitest";
import { catalogCharacterById, historicalPeriods } from "./catalog.js";
import { publishedExhibitPacks } from "./hall-scenes.js";

describe("published exhibit registry", () => {
  it("contains a valid exhibit pack for every public hall", () => {
    const guidedExpectations: Record<string, { objects: number; guides: string[]; base: string }> = {
      "renaissance-florence": { objects: 6, guides: ["leonardo-da-vinci", "michelangelo"], base: "/exhibits/renaissance-florence/2.0.0/" },
      "renaissance-rome": { objects: 5, guides: ["raphael", "michelangelo"], base: "/exhibits/renaissance-rome/2.0.0/" },
      "renaissance-observation": { objects: 6, guides: ["galileo", "johannes-kepler"], base: "/exhibits/renaissance-observation/2.0.0/" },
    };
    const hallIds = historicalPeriods.flatMap((period) => period.halls.map((hall) => hall.id));
    expect(publishedExhibitPacks).toHaveLength(9);
    expect(publishedExhibitPacks.map((pack) => pack.hall.id).sort()).toEqual(hallIds.sort());
    for (const pack of publishedExhibitPacks) {
      if (pack.hall.experience?.kind === "guided_gallery") {
        const expectation = guidedExpectations[pack.hall.id];
        expect(expectation).toBeDefined();
        expect(pack.hall.stations.map((station) => station.type)).toEqual(["gallery", "gallery", "gallery", "gallery"]);
        expect(pack.objects).toHaveLength(expectation.objects);
        expect(pack.hall.experience.guideCharacterIds).toEqual(expectation.guides);
        expect(pack.assets.every((asset) => asset.path.startsWith(expectation.base))).toBe(true);
      } else {
        expect(pack.hall.stations.map((station) => station.type)).toEqual(["orientation", "object", "character_relation", "reflection"]);
        expect(pack.assets[0].path).toMatch(/^\/exhibits\/.+\/1\.0\.0\/scene\.webp$/);
      }
      expect(pack.hall.characterRefs.every((ref) => Boolean(catalogCharacterById(ref.id)))).toBe(true);
    }
  });

  it("keeps every guided-gallery object visible in a station and backed by an image and source", () => {
    for (const pack of publishedExhibitPacks.filter((item) => item.hall.experience?.kind === "guided_gallery")) {
      const displayed = new Set(pack.hall.stations.flatMap((station) => station.objectIds));
      const assetIds = new Set(pack.assets.map((asset) => asset.id));
      const sourceIds = new Set(pack.sources.map((source) => source.id));
      for (const object of pack.objects) {
        expect(displayed.has(object.id)).toBe(true);
        expect(assetIds.has(object.assetId!)).toBe(true);
        expect(object.sourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
      }
    }
  });
});
