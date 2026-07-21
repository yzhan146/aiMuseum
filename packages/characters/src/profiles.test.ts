import { describe, expect, it } from "vitest";
import { catalogCharacters } from "./catalog.js";
import { supportingPacks } from "./index.js";
import { voiceProfileIds } from "./profiles.js";

describe("persona and relationship profiles", () => {
  it("provides a voice profile for every catalog character", () => {
    expect(new Set(voiceProfileIds)).toEqual(new Set(catalogCharacters.map(character => character.id)));
  });

  it("keeps the Li Bai and Du Fu relationship sourced and directional in perspective", () => {
    const liBai = supportingPacks.find(pack => pack.manifest.id === "li-bai")!;
    const relation = liBai.relationships.find(item => item.toId === "du-fu-person")!;
    expect(relation).toMatchObject({ type: "personally-knew", provenance: "public-source", firstKnownContact: "0744", confidence: .92 });
    expect(relation.evidence[0]?.sourceId).toBe("li-bai-du-fu-poets-org");
    expect(liBai.sources.some(source => source.id === relation.evidence[0]?.sourceId)).toBe(true);
  });

  it("marks unverified catalog links as model suggestions", () => {
    const packs = new Map(supportingPacks.map(pack => [pack.manifest.id, pack]));
    for (const character of catalogCharacters.filter(item => item.id !== "albert-einstein")) {
      const pack = packs.get(character.id)!;
      expect(pack.relationships).toHaveLength(character.relationCharacterIds.length);
      for (const relation of pack.relationships) expect(["public-source", "model-suggested"]).toContain(relation.provenance);
    }
  });
});
