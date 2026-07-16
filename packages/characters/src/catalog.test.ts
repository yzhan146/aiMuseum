import { describe, expect, it } from "vitest";
import { catalogCharacters, historicalPeriods } from "./catalog.js";

describe("historical catalog", () => {
  it("contains three complete periods and 36 stable character ids", () => {
    expect(historicalPeriods).toHaveLength(3);
    expect(historicalPeriods.every(period => period.characters.length === 12)).toBe(true);
    expect(catalogCharacters).toHaveLength(36);
    expect(new Set(catalogCharacters.map(character => character.id)).size).toBe(36);
  });

  it("uses the approved 3/3/3/2/1 tier distribution in every period", () => {
    for (const period of historicalPeriods) {
      const counts = period.characters.reduce<Record<string, number>>((result, character) => ({ ...result, [character.tier]: (result[character.tier] ?? 0) + 1 }), {});
      expect(counts.white).toBe(3);
      expect(counts.blue).toBe(3);
      expect(counts.purple).toBe(3);
      expect(counts.orange).toBe(2);
      expect(counts.gold).toBe(1);
    }
  });

  it("keeps every relation inside the public catalog", () => {
    const ids = new Set(catalogCharacters.map(character => character.id));
    for (const character of catalogCharacters) for (const relationId of character.relationCharacterIds) expect(ids.has(relationId)).toBe(true);
  });

  it("provides independently licensed cartoon and realistic portrait slots", () => {
    for (const character of catalogCharacters) {
      expect(character.portraitVariants.cartoon.alt).toContain(character.name);
      expect(character.portraitVariants.realistic.alt).toContain(character.name);
      expect(character.portraitVariants.cartoon.representation).toBe("artistic_interpretation");
      expect(character.portraitVariants.realistic.representation).toBe("artistic_interpretation");
    }
  });
});
