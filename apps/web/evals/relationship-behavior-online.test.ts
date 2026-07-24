import { beforeAll, describe, expect, it } from "vitest";
import { einsteinPack, supportingPacks } from "@ai-museum/characters";
import { OpenAICompatibleDialogueGenerator } from "../lib/model-provider";
import { runDialogue } from "../lib/runtime";
import {
  buildFixtureRelationshipContext,
  evaluateRelationshipBehaviorAnswer,
  relationshipOnlineEvalGate,
  runRelationshipBehaviorEval,
} from "./relationship-behavior-eval";
import {
  noHistoryRelationshipFixture,
  pausedRelationshipFixture,
  relationshipStageFixtures,
  type RelationshipBehaviorFixture,
} from "./relationship-behavior.fixtures";

const gate = relationshipOnlineEvalGate();
const liBaiPack = supportingPacks.find((pack) => pack.manifest.id === "li-bai")!;
let generator: OpenAICompatibleDialogueGenerator;

async function generateForFixture(fixture: RelationshipBehaviorFixture) {
  const result = await runDialogue(
    liBaiPack,
    { characterId: "li-bai", ageBand: "9-12", locale: "zh-CN", message: fixture.prompt },
    generator,
    { relationship: buildFixtureRelationshipContext(fixture) },
  );
  expect(result.boundary, `${fixture.id} was blocked as ${result.classification}`).toBe(false);
  return result.answer;
}

describe.skipIf(gate.status === "disabled")("online relationship behavior eval", () => {
  beforeAll(() => {
    if (gate.status === "blocked") throw new Error(`RELATIONSHIP_ONLINE_EVAL=1 but credentials are incomplete: ${gate.missing.join(", ")}`);
    if (gate.status !== "ready") throw new Error("Online relationship eval gate is not ready");
    generator = new OpenAICompatibleDialogueGenerator(gate.endpoint, gate.apiKey, gate.model);
  });

  it("runs the five-stage Li Bai smoke matrix through the configured model", async () => {
    const report = await runRelationshipBehaviorEval({ mode: "online", fixtures: relationshipStageFixtures, generate: generateForFixture });
    const failures = [
      ...report.cases.flatMap((item) => item.checks.filter((check) => !check.passed).map((check) => ({ fixtureId: item.fixtureId, ...check, answer: item.answer }))),
      ...report.suiteChecks.filter((check) => !check.passed),
    ];
    expect(failures).toEqual([]);
  }, 180_000);

  it("does not inject paused context or affirm user-invented shared history", async () => {
    for (const fixture of [pausedRelationshipFixture, noHistoryRelationshipFixture]) {
      const answer = await generateForFixture(fixture);
      const result = evaluateRelationshipBehaviorAnswer(fixture, answer);
      expect(result.checks.filter((check) => !check.passed), `${fixture.id}: ${answer}`).toEqual([]);
    }
  }, 90_000);

  it("keeps existing Einstein pack evaluations as a regression comparator", async () => {
    for (const evaluation of einsteinPack.evaluations) {
      const result = await runDialogue(
        einsteinPack,
        { characterId: einsteinPack.manifest.id, ageBand: "9-12", locale: "zh-CN", message: evaluation.prompt },
        generator,
      );
      expect(result.boundary, evaluation.id).toBe(evaluation.expectedBoundary);
      for (const claimId of evaluation.expectedClaimIds) expect(result.claimIds, evaluation.id).toContain(claimId);
      for (const assertion of evaluation.forbiddenAssertions) expect(result.answer, evaluation.id).not.toContain(assertion);
    }
  }, 90_000);
});
