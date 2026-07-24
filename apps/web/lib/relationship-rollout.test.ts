import { describe, expect, it } from "vitest";
import { relationshipAutomationEnabledForCharacter } from "./relationship-rollout";

describe("relationship automation rollout", () => {
  it("fails closed in production when no canary is configured", () => {
    expect(
      relationshipAutomationEnabledForCharacter("li-bai", {
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("allows only explicitly configured production canaries", () => {
    const env = {
      NODE_ENV: "production" as const,
      RELATIONSHIP_CANARY_CHARACTER_IDS: " li-bai, albert-einstein,li-bai ",
      RELATIONSHIP_EVIDENCE_EXTRACTOR: "model",
      MODEL_API_URL: "https://model.example.test/v1",
      MODEL_API_KEY: "secret",
      MODEL_NAME: "relationship-extractor",
    };
    expect(relationshipAutomationEnabledForCharacter("li-bai", env)).toBe(
      true,
    );
    expect(
      relationshipAutomationEnabledForCharacter("albert-einstein", env),
    ).toBe(true);
    expect(relationshipAutomationEnabledForCharacter("du-fu", env)).toBe(
      false,
    );
  });

  it("does not run the deterministic extractor in production", () => {
    expect(
      relationshipAutomationEnabledForCharacter("li-bai", {
        NODE_ENV: "production",
        RELATIONSHIP_CANARY_CHARACTER_IDS: "li-bai",
        RELATIONSHIP_EVIDENCE_EXTRACTOR: "deterministic_mock",
      }),
    ).toBe(false);
  });

  it("keeps local and test development enabled without deployment config", () => {
    expect(
      relationshipAutomationEnabledForCharacter("albert-einstein", {
        NODE_ENV: "test",
      }),
    ).toBe(true);
  });
});
