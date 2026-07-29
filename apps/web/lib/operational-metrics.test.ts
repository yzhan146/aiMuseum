import { describe, expect, it } from "vitest";
import { isMetricsAdmin, onlineCountBucket, publicPresenceEnabled } from "./operational-metrics";

describe("operational metrics policy", () => {
  it("buckets public online counts without exposing small or exact values", () => {
    expect(onlineCountBucket(0)).toBeNull();
    expect(onlineCountBucket(9)).toBeNull();
    expect(onlineCountBucket(10)).toBe("10+");
    expect(onlineCountBucket(29)).toBe("20+");
    expect(onlineCountBucket(149)).toBe("100+");
    expect(onlineCountBucket(999)).toBe("950+");
    expect(onlineCountBucket(1450)).toBe("1400+");
  });

  it("fails closed unless an email is explicitly allowlisted", () => {
    const env = { NODE_ENV: "production", ADMIN_EMAIL_ALLOWLIST: "owner@example.com, ops@example.com" } as NodeJS.ProcessEnv;
    expect(isMetricsAdmin({ email: "Owner@Example.com" }, env)).toBe(true);
    expect(isMetricsAdmin({ email: "reader@example.com" }, env)).toBe(false);
    expect(isMetricsAdmin(null, env)).toBe(false);
  });

  it("requires an explicit public presence flag", () => {
    expect(publicPresenceEnabled({ ...process.env, PUBLIC_ONLINE_PRESENCE: "true" })).toBe(true);
    expect(publicPresenceEnabled({ ...process.env, PUBLIC_ONLINE_PRESENCE: "1" })).toBe(false);
  });
});
