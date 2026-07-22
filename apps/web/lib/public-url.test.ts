import { afterEach, describe, expect, it } from "vitest";
import { applicationBaseUrl, applicationUrl } from "./public-url";

const originalBaseUrl = process.env.APP_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = originalBaseUrl;
});

describe("public application URLs", () => {
  it("uses the configured public origin instead of an internal request host", () => {
    process.env.APP_BASE_URL = "https://museum.marshallzzz.com/";
    expect(applicationBaseUrl()).toBe("https://museum.marshallzzz.com");
    expect(applicationUrl("/museum?verified=1")).toBe(
      "https://museum.marshallzzz.com/museum?verified=1",
    );
  });

  it("does not allow paths in a configured base URL to leak into links", () => {
    process.env.APP_BASE_URL = "https://museum.example.com/internal/path";
    expect(applicationUrl("api/auth/verify-email?token=test")).toBe(
      "https://museum.example.com/api/auth/verify-email?token=test",
    );
  });
});
