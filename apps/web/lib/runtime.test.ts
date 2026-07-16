import { describe, expect, it } from "vitest";
import { einsteinPack } from "@ai-museum/characters";
import { runDialogue, type DialogueGenerator } from "./runtime";
const request = { characterId: "albert-einstein", message: "为什么获得诺贝尔奖？光电效应", ageBand: "9-12", locale: "zh-CN" };
describe("verified dialogue runtime", () => {
  it("returns claims with exact evidence locators", async () => { const result = await runDialogue(einsteinPack, request); expect(result.claimIds).toContain("claim-nobel"); expect(result.citations).toContainEqual(expect.objectContaining({ sourceId: "nobel-award", locator: "Prize motivation" })); });
  it("rejects a generator that cites knowledge outside retrieval", async () => { const bad: DialogueGenerator = { async generate() { return { answer: "越权内容", claimIds: ["claim-born"] }; } }; const result = await runDialogue(einsteinPack, request, bad); expect(result.boundary).toBe(true); expect(result.classification).toBe("引用核验失败"); });
  it("stores narrator text without duplicating its UI label", async () => { const result=await runDialogue(einsteinPack,{...request,message:"请只说说你所在的时代。"});expect(result.boundary).toBe(true);expect(result.narratorNote).not.toMatch(/^博物馆旁白/); });
  it("recalls only a supplied character-scoped memory with a message source", async () => { const memory={id:"m1",userId:"u1",characterId:"albert-einstein",type:"character_relationship" as const,content:"我们曾聊过：玻尔与量子理论",sourceMessageIds:["source-message"],confidence:.9,importance:.8,sensitivity:"low" as const,status:"active" as const,recallCount:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};const result=await runDialogue(einsteinPack,{...request,message:"玻尔与量子理论"},undefined,{memories:[memory]});expect(result.memoryCallbacks?.[0].memoryId).toBe("m1");expect(result.answer).toMatch(/还记得/); });
});
