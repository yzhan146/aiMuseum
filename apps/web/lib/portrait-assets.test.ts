import { existsSync } from "node:fs";
import path from "node:path";
import { catalogCharacters } from "@ai-museum/characters";
import { describe, expect, it } from "vitest";

describe("catalog portrait assets", () => {
  it("contains both portrait variants for all 36 characters", () => {
    for (const character of catalogCharacters) {
      for (const style of ["cartoon", "realistic"] as const) {
        const assetPath = character.portraitVariants[style].assetPath;
        expect(assetPath, `${character.id} ${style} path`).toBeTruthy();
        expect(
          existsSync(path.join(process.cwd(), "public", assetPath!.slice(1))),
          `${character.id} ${style} file`,
        ).toBe(true);
      }
    }
  });
});
