import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("public discovery routes", () => {
  it("lists every canonical public entity in the sitemap", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(urls).toHaveLength(52);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("/people/li-bai");
    expect(urls).toContain("/periods/tang-east-asia");
    expect(urls).toContain("/halls/physics-solvay");
    expect(urls.some((url) => url.startsWith("/api/"))).toBe(false);
  });

  it("allows public knowledge while protecting private product areas", () => {
    const policy = robots();
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    const general = rules.find((rule) => rule.userAgent === "*");
    const openAi = rules.find((rule) => rule.userAgent === "OAI-SearchBot");
    expect(general?.allow).toBe("/");
    expect(general?.disallow).toContain("/api/");
    expect(general?.disallow).toContain("/museum");
    expect(openAi?.allow).toContain("/people/");
    expect(policy.sitemap).toContain("/sitemap.xml");
  });
});
