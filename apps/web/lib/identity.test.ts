import { describe, expect, it } from "vitest";
import { withIdentity } from "./identity";

describe("identity response cookies", () => {
  it("adds a guest cookie to an immutable redirect response", () => {
    const response = withIdentity(Response.redirect("https://museum.test/login"), {
      userId: "guest:test-visitor",
      setCookie: "museum_guest=test-visitor; Path=/; HttpOnly; SameSite=Lax",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://museum.test/login");
    expect(response.headers.get("set-cookie")).toContain(
      "museum_guest=test-visitor",
    );
  });

  it("returns an existing response unchanged when no cookie is required", () => {
    const response = Response.json({ ok: true });

    expect(withIdentity(response, { userId: "guest:known" })).toBe(response);
  });
});
