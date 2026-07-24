import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { einsteinPack } from "@ai-museum/characters";
import { sendThreadMessage } from "./chat-service";
import {
  getOrCreateThread,
  createMemory,
  listRelationshipEvidence,
  listRelationshipOutbox,
  resetPlatformForTests,
  setRelationshipStatus,
} from "./platform-store";

beforeEach(() => {
  resetPlatformForTests();
  delete process.env.MODEL_API_URL;
  delete process.env.MODEL_API_KEY;
  delete process.env.MODEL_NAME;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("chat relationship vertical slice", () => {
  it("returns the public relationship and processes evidence after the reply is saved", async () => {
    const thread = await getOrCreateThread(
      "user-1",
      einsteinPack.manifest.id,
      einsteinPack.manifest.version,
      "爱因斯坦",
    );
    const result = await sendThreadMessage(
      "user-1",
      thread,
      "为什么光电效应会改变人们对光的理解？",
    );
    expect(result.messageId).toBeTruthy();
    expect(result.relationship).toMatchObject({
      characterId: einsteinPack.manifest.id,
      stage: "initial",
      status: "active",
    });
    expect(await listRelationshipEvidence("user-1", einsteinPack.manifest.id)).toHaveLength(1);
    expect((await listRelationshipOutbox("user-1", einsteinPack.manifest.id))[0]?.status).toBe("processed");
  });

  it("keeps the visible tag but creates no evidence work while paused", async () => {
    const thread = await getOrCreateThread(
      "user-1",
      einsteinPack.manifest.id,
      einsteinPack.manifest.version,
      "爱因斯坦",
    );
    await setRelationshipStatus("user-1", einsteinPack.manifest.id, "paused");
    const result = await sendThreadMessage(
      "user-1",
      thread,
      "为什么光电效应会改变人们对光的理解？",
    );
    expect(result.relationship?.status).toBe("paused");
    expect(await listRelationshipEvidence("user-1", einsteinPack.manifest.id)).toHaveLength(0);
    expect(await listRelationshipOutbox("user-1", einsteinPack.manifest.id)).toHaveLength(0);
  });

  it("keeps non-canary production characters out of relationship automation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RELATIONSHIP_CANARY_CHARACTER_IDS", "li-bai");
    const thread = await getOrCreateThread(
      "user-1",
      einsteinPack.manifest.id,
      einsteinPack.manifest.version,
      "爱因斯坦",
    );
    const result = await sendThreadMessage(
      "user-1",
      thread,
      "为什么光电效应会改变人们对光的理解？",
    );
    expect(result.relationship).toMatchObject({
      characterId: einsteinPack.manifest.id,
      stage: "initial",
    });
    expect(
      await listRelationshipEvidence("user-1", einsteinPack.manifest.id),
    ).toHaveLength(0);
    expect(
      await listRelationshipOutbox("user-1", einsteinPack.manifest.id),
    ).toHaveLength(0);
  });

  it("does not place old relationship memories in the model prompt while paused", async () => {
    const thread = await getOrCreateThread("user-1", einsteinPack.manifest.id, einsteinPack.manifest.version, "爱因斯坦");
    await createMemory({ userId: "user-1", characterId: einsteinPack.manifest.id, type: "character_relationship", content: "我们曾聊过：不应出现在暂停后的提示词里", sourceMessageIds: ["source-1"], confidence: .9, importance: .8, sensitivity: "low", status: "active" });
    await setRelationshipStatus("user-1", einsteinPack.manifest.id, "paused");
    process.env.MODEL_API_URL = "https://model.example.test";
    process.env.MODEL_API_KEY = "test-key";
    process.env.MODEL_NAME = "test-model";
    let systemPrompt = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      systemPrompt = body.messages[0].content;
      return Response.json({ choices: [{ message: { content: "我们只讨论你现在提出的问题。" } }] });
    }));
    await sendThreadMessage("user-1", thread, "玻尔与量子理论");
    expect(systemPrompt).not.toContain("不应出现在暂停后的提示词里");
    expect(systemPrompt).toContain("本轮没有提供可用的用户关系上下文");
  });
});
