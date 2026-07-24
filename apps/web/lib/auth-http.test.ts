import { describe, expect, it } from "vitest";
import { AuthError } from "./auth-store";
import { enforceSameOrigin } from "./auth-http";

describe("enforceSameOrigin", () => {
  it("accepts an exact same-origin request", () => {
    const request = new Request("https://museum.example/api/relationship", {
      headers: { origin: "https://museum.example" },
    });

    expect(() => enforceSameOrigin(request)).not.toThrow();
  });

  it("rejects a write request without an Origin header", () => {
    const request = new Request("https://museum.example/api/relationship");

    expect(() => enforceSameOrigin(request)).toThrowError(AuthError);
    try {
      enforceSameOrigin(request);
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_ORIGIN", status: 403 });
    }
  });

  it("rejects a cross-origin request", () => {
    const request = new Request("https://museum.example/api/relationship", {
      headers: { origin: "https://attacker.example" },
    });

    expect(() => enforceSameOrigin(request)).toThrowError(AuthError);
  });
});
