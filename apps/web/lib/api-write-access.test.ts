import { beforeEach, describe, expect, it } from "vitest";
import { getPublishedPack } from "./repository";
import {
  getOrCreateThread,
  getRelationshipPublicState,
  listThreads,
  resetPlatformForTests,
} from "./platform-store";
import { POST as postChat } from "../app/api/chat/route";
import { POST as postThread } from "../app/api/threads/route";
import { POST as postThreadMessage } from "../app/api/threads/[id]/messages/route";

const origin = "https://museum.example";
const guestCookie = "museum_guest=write-access-test";
const guestUserId = "guest:write-access-test";
const lockedCharacterId = "ernest-rutherford";

function writeRequest(path: string, body: Record<string, unknown>) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: guestCookie,
      origin,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => resetPlatformForTests());

describe("long-term conversation write access", () => {
  it("rejects direct chat for a published but locked character", async () => {
    const response = await postChat(
      writeRequest("/api/chat", {
        characterId: lockedCharacterId,
        message: "你好",
      }),
    );

    expect(response.status).toBe(403);
    expect(await listThreads(guestUserId)).toHaveLength(0);
    expect(
      await getRelationshipPublicState(guestUserId, lockedCharacterId),
    ).toBeNull();
  });

  it("rejects direct thread creation for a locked character", async () => {
    const response = await postThread(
      writeRequest("/api/threads", { characterId: lockedCharacterId }),
    );

    expect(response.status).toBe(403);
    expect(await listThreads(guestUserId)).toHaveLength(0);
  });

  it("rejects messages to a legacy locked-character thread", async () => {
    const pack = getPublishedPack(lockedCharacterId);
    expect(pack).not.toBeNull();
    const thread = await getOrCreateThread(
      guestUserId,
      lockedCharacterId,
      pack!.manifest.version,
      "locked",
    );

    const response = await postThreadMessage(
      writeRequest(`/api/threads/${thread.id}/messages`, {
        message: "这条消息不应被保存",
      }),
      { params: Promise.resolve({ id: thread.id }) },
    );

    expect(response.status).toBe(403);
    expect(
      await getRelationshipPublicState(guestUserId, lockedCharacterId),
    ).toBeNull();
  });

  it("rejects chat writes without an Origin header before creating state", async () => {
    const response = await postChat(
      new Request(`${origin}/api/chat`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: guestCookie,
        },
        body: JSON.stringify({
          characterId: "albert-einstein",
          message: "你好",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await listThreads(guestUserId)).toHaveLength(0);
  });
});
