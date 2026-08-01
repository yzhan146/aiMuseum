import { describe, expect, it } from "vitest";
import { publicCharacter, publicCharacterIds, publicHall, publicHallIds, publicPeriod, publicPeriodIds } from "./public-museum";

describe("public museum projection", () => {
  it("resolves every published public entity without user state", () => {
    expect(publicCharacterIds()).toHaveLength(36);
    expect(publicPeriodIds()).toHaveLength(3);
    expect(publicHallIds()).toHaveLength(9);
    expect(publicCharacterIds().every((id) => Boolean(publicCharacter(id)))).toBe(true);
    expect(publicPeriodIds().every((id) => Boolean(publicPeriod(id)))).toBe(true);
    expect(publicHallIds().every((id) => Boolean(publicHall(id)))).toBe(true);
  });

  it("keeps hall relationships linked to catalog people", () => {
    for (const id of publicHallIds()) {
      const hall = publicHall(id)!;
      expect(hall.characters).toHaveLength(hall.pack.hall.characterRefs.length);
      expect(hall.characters.every((character) => Boolean(publicCharacter(character.id)))).toBe(true);
    }
  });

  it("publishes the complete Florence flagship object set for indexing", () => {
    const result = publicHall("renaissance-florence");
    expect(result?.pack.objects).toHaveLength(6);
    expect(result?.pack.objects.every((object) => Boolean(object.assetId) && object.sourceIds.length >= 2)).toBe(true);
    expect(result?.pack.hall.experience).toMatchObject({ kind: "guided_gallery", recommendedMinutes: 10, quickMinutes: 3 });
  });
});
