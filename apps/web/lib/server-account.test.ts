import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("./database", () => ({ databaseEnabled: false }));

import { LOCAL_TEST_ACCOUNT } from "./auth-store";
import { currentAccount } from "./server-account";

const originalE2eAccount = process.env.E2E_TEST_ACCOUNT;

beforeEach(() => {
  mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });
  process.env.E2E_TEST_ACCOUNT = "true";
});

afterEach(() => {
  if (originalE2eAccount === undefined) delete process.env.E2E_TEST_ACCOUNT;
  else process.env.E2E_TEST_ACCOUNT = originalE2eAccount;
  vi.restoreAllMocks();
});

describe("currentAccount local test bypass", () => {
  it("uses the documented local test account so local admin routes are available", async () => {
    await expect(currentAccount()).resolves.toEqual({
      userId: LOCAL_TEST_ACCOUNT.userId,
      email: LOCAL_TEST_ACCOUNT.email,
      displayName: LOCAL_TEST_ACCOUNT.displayName,
      emailVerified: true,
    });
  });
});
