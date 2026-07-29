import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ currentAccount: vi.fn() }));
vi.mock("../../../../lib/server-account", () => ({ currentAccount: mocks.currentAccount }));

import { GET } from "./route";

describe("admin metrics route", () => {
  beforeEach(() => { mocks.currentAccount.mockReset(); process.env.ADMIN_EMAIL_ALLOWLIST = "owner@example.com"; });
  afterEach(() => { delete process.env.ADMIN_EMAIL_ALLOWLIST; });

  it("does not expose metrics to anonymous or ordinary accounts", async () => {
    mocks.currentAccount.mockResolvedValue(null);
    const anonymous = await GET();
    expect(anonymous.status).toBe(404);
    expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
    mocks.currentAccount.mockResolvedValue({ email: "reader@example.com" });
    const ordinary = await GET();
    expect(ordinary.status).toBe(404);
    expect(ordinary.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a private response to an allowlisted administrator", async () => {
    mocks.currentAccount.mockResolvedValue({ email: "owner@example.com" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ available: false, registeredTotal: 0, onlineNow: 0 });
  });
});
