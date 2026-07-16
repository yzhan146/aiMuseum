import { beforeEach, describe, expect, it } from "vitest";
import { commitDraw, explorationSnapshot, recordLearningEvent, revealDraw } from "./exploration";
import { resetPlatformForTests } from "./platform-store";

describe("exploration rewards and draws", () => {
  beforeEach(() => resetPlatformForTests());

  it("rewards one character encounter only once even with a new request key", () => {
    const userId = "guest:test-learning";
    const first = recordLearningEvent(userId, { characterId: "ernest-rutherford", periodId: "physics-revolution", type: "encounter_completed", idempotencyKey: "one" });
    const repeated = recordLearningEvent(userId, { characterId: "ernest-rutherford", periodId: "physics-revolution", type: "encounter_completed", idempotencyKey: "two" });
    expect(first.collection.stars).toBe(80);
    expect(first.collection.firstFreeEligible).toBe(true);
    expect(repeated.repeated).toBe(true);
    expect(repeated.collection.stars).toBe(80);
  });

  it("commits the free result before reveal and restores idempotent retries", () => {
    const userId = "guest:test-draw";
    recordLearningEvent(userId, { characterId: "ernest-rutherford", periodId: "physics-revolution", type: "encounter_completed", idempotencyKey: "encounter" });
    const committed = commitDraw(userId, { periodId: "physics-revolution", idempotencyKey: "draw-one" });
    expect(committed.draw.status).toBe("committed");
    expect(committed.draw.costStars).toBe(0);
    expect(committed.draw.duplicate).toBe(false);
    expect(committed.collection.ownedCharacterIds).toContain(committed.draw.resultCharacterId);
    const retry = commitDraw(userId, { periodId: "physics-revolution", idempotencyKey: "draw-one" });
    expect(retry.repeated).toBe(true);
    expect(retry.draw.id).toBe(committed.draw.id);
    expect(explorationSnapshot(userId).pendingDraw?.id).toBe(committed.draw.id);
    expect(revealDraw(userId, committed.draw.id).draw.status).toBe("revealed");
    expect(explorationSnapshot(userId).pendingDraw).toBeNull();
  });
});
