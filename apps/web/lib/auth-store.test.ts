import { describe, expect, it } from "vitest";
import {
  AuthError,
  hashPassword,
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
        password: "十五个字符以上的密码短语 museum",
      }),
    ).toMatchObject({
      email: "visitor@example.com",
      displayName: "小小历史家",
    });

    expect(() =>
      validateRegistration({
        email: "visitor@example.com",
        displayName: "访客",
        password: "too-short",
      }),
    ).toThrow(AuthError);
  });
});
