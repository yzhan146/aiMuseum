import { describe, expect, it } from "vitest";
import { catalogCharacterById, historicalPeriods } from "./catalog.js";
import { publishedExhibitPacks } from "./hall-scenes.js";

describe("published exhibit registry", () => {
  it("contains a valid four-station pack for every public hall", () => {
    const hallIds = historicalPeriods.flatMap((period) => period.halls.map((hall) => hall.id));
    expect(publishedExhibitPacks).toHaveLength(9);
    expect(publishedExhibitPacks.map((pack) => pack.hall.id).sort()).toEqual(hallIds.sort());
    for (const pack of publishedExhibitPacks) {
      expect(pack.hall.stations.map((station) => station.type)).toEqual(["orientation", "object", "character_relation", "reflection"]);
      expect(pack.hall.characterRefs.every((ref) => Boolean(catalogCharacterById(ref.id)))).toBe(true);
      expect(pack.assets[0].path).toMatch(/^\/exhibits\/.+\/1\.0\.0\/scene\.webp$/);
    }
  });
});
