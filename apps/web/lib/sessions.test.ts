import { beforeEach, describe, expect, it } from "vitest";
import { clearSessionsForTests, resolveSessionVersion } from "./sessions";
beforeEach(clearSessionsForTests);
describe("conversation version pinning", () => {
  it("keeps the original version after a newer version appears", () => { expect(resolveSessionVersion("s1", "person", undefined, "1.0.0")).toBe("1.0.0"); expect(resolveSessionVersion("s1", "person", undefined, "1.1.0")).toBe("1.0.0"); });
  it("rejects character or version switching inside one session", () => { resolveSessionVersion("s1", "person", undefined, "1.0.0"); expect(() => resolveSessionVersion("s1", "other", undefined, "1.0.0")).toThrow(); expect(() => resolveSessionVersion("s1", "person", "2.0.0", "2.0.0")).toThrow(); });
});
