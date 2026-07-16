import { beforeEach, describe, expect, it } from "vitest";
import { cancelTask, confirmTask, startAgentTask } from "./agents";
import { getArtifact, resetPlatformForTests } from "./platform-store";
beforeEach(resetPlatformForTests);
describe("deterministic agent coordinator", () => {
  it("completes a guide plan with an auditable artifact", () => { const task=startAgentTask("u1",{type:"guide",input:{topic:"量子理论"}});expect(task.status).toBe("completed");expect(task.plan.every(step=>step.status==="completed")).toBe(true);expect(getArtifact(task.artifactIds[0],"u1")?.kind).toBe("learning-plan"); });
  it("keeps knowledge candidates behind review", () => {const task=startAgentTask("u1",{type:"knowledge",input:{assetId:"a1"}});expect(task.status).toBe("waiting_review");expect(confirmTask("u1",task.id)?.status).toBe("completed")});
  it("requires consent before a media task can run", () => { const task=startAgentTask("u1",{type:"media",input:{characterId:"albert-einstein"}});expect(task.status).toBe("waiting_review");expect(task.errorCode).toBe("CONSENT_REQUIRED");expect(cancelTask("u1",task.id)?.status).toBe("cancelled"); });
  it("completes structural evaluation without claiming model execution", () => { const task=startAgentTask("u1",{type:"evaluation",input:{characterId:"albert-einstein"}});expect(task.status).toBe("completed");expect(task.provider).toBe("rules"); });
});
