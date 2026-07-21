import { describe, expect, it } from "vitest";
import {
  AuthError,
  hashPassword,
  validatePassword,
  validateRegistration,
  verifyPassword,
} from "./auth-store";

describe("account password storage", () => {
  it("hashes a password with a unique salt and verifies it", async () => {
    const password = "this is a long museum passphrase";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword("a different long password", first)).resolves.toBe(
      false,
    );
  });

  it("normalizes account input and rejects short passwords", () => {
    expect(
      validateRegistration({
        email: "  VISITOR@Example.COM ",
        displayName: " 小小历史家 ",
        password: "Museum!2026",
      }),
    ).toMatchObject({
      email: "visitor@example.com",
      displayName: "小小历史家",
    });

    expect(() =>
      validateRegistration({
        email: "visitor@example.com",
        displayName: "访客",
        password: "lowercase1!",
      }),
    ).toThrow(AuthError);

    expect(validatePassword("Museum!2026")).toBe("Museum!2026");
  });
});
