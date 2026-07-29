import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentAccount: vi.fn() }));
vi.mock("../../../../lib/server-account", () => ({ currentAccount: mocks.currentAccount }));

import { GET } from "./route";

describe("admin metrics route", () => {
  beforeEach(() => { mocks.currentAccount.mockReset(); process.env.ADMIN_EMAIL_ALLOWLIST = "owner@example.com"; });
  afterEach(() => { delete process.env.ADMIN_EMAIL_ALLOWLIST; });

  it("does not expose metrics to anonymous or ordinary accounts", async () => {
    mocks.currentAccount.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
    mocks.currentAccount.mockResolvedValue({ email: "reader@example.com" });
    expect((await GET()).status).toBe(403);
  });

  it("returns a private response to an allowlisted administrator", async () => {
    mocks.currentAccount.mockResolvedValue({ email: "owner@example.com" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ available: false, registeredTotal: 0, onlineNow: 0 });
  });
});
