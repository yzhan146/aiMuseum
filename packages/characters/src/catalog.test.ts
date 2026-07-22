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
      expect(character.portraitVariants.realistic.representation).toBe("evidence_based_reconstruction");
      expect(character.portraitVariants.cartoon.assetPath).toBe(
        `/characters/cartoon/${character.id}.png`,
      );
      expect(character.portraitVariants.realistic.assetPath).toBe(`/characters/realistic/${character.id}.png`);
    }
  });

  it("gives every hall a visitor-facing introduction without implementation jargon", () => {
    for (const period of historicalPeriods) {
      for (const hall of period.halls) {
        expect(hall.guideTitle.length).toBeGreaterThan(10);
        expect(hall.guideText.length).toBeGreaterThan(25);
        expect(`${hall.guideTitle}${hall.guideText}`).not.toMatch(
          /Claim|Prompt|system|模型|服务端|人物包|API|Key/i,
        );
      }
    }
  });

  it("gives every character a useful introduction and curated discoveries", () => {
    for (const character of catalogCharacters) {
      expect(character.exhibit.overview.length).toBeGreaterThan(20);
      expect(character.exhibit.biography.length).toBeGreaterThanOrEqual(3);
      expect(character.exhibit.influence.length).toBeGreaterThan(15);
      expect(character.exhibit.legacy.length).toBeGreaterThan(15);
      expect(character.exhibit.works.length).toBeGreaterThanOrEqual(2);
      expect(character.exhibit.conversationStarters.length).toBeGreaterThanOrEqual(3);
      expect(character.exhibit.discoveries.length).toBeGreaterThanOrEqual(1);
      expect(character.exhibit.discoveries.every(discovery => discovery.keywords.length > 0)).toBe(true);
    }
  });
});
