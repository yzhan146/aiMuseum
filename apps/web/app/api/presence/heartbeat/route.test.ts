import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveIdentity: vi.fn() }));
vi.mock("../../../../lib/identity", () => ({ resolveIdentity: mocks.resolveIdentity }));

import { POST } from "./route";

describe("presence heartbeat route", () => {
  beforeEach(() => mocks.resolveIdentity.mockReset());

  it("rejects requests without a same-origin signal before resolving identity", async () => {
    const response = await POST(new Request("http://localhost/api/presence/heartbeat", { method: "POST" }));
    expect(response.status).toBe(403);
    expect(mocks.resolveIdentity).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mocks.resolveIdentity.mockResolvedValue({ userId: "guest:ephemeral" });
    const response = await POST(new Request("http://localhost/api/presence/heartbeat", { method: "POST", headers: { origin: "http://localhost" } }));
    expect(response.status).toBe(401);
  });

  it("touches an authenticated session without accepting a client user id", async () => {
    mocks.resolveIdentity.mockResolvedValue({ userId: "account:1", sessionId: "session:1", account: { userId: "account:1", email: "owner@example.com", displayName: "Owner", emailVerified: true } });
    const response = await POST(new Request("http://localhost/api/presence/heartbeat", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify({ userId: "account:attacker" }) }));
    expect(response.status).toBe(204);
    expect(mocks.resolveIdentity).toHaveBeenCalledTimes(1);
  });
});
