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
});
