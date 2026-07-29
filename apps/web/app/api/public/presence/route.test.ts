import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

afterEach(() => { delete process.env.PUBLIC_ONLINE_PRESENCE; });

describe("public presence route", () => {
  it("does not query or expose metrics while the public feature is off", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toEqual({ onlineLabel: null });
  });

  it("hides presence when enabled without an authoritative database", async () => {
    process.env.PUBLIC_ONLINE_PRESENCE = "true";
    const response = await GET();
    const result = await response.json();
    expect(result.onlineLabel).toBeNull();
    expect(result.updatedAt).toEqual(expect.any(String));
  });
});
