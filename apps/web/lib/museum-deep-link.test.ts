import { describe, expect, it } from "vitest";
import { resolveMuseumHallDeepLink } from "./museum-deep-link";

const periods = [
  { id: "renaissance-science", halls: [{ id: "renaissance-florence" }] },
  { id: "physics-revolution", halls: [{ id: "physics-solvay" }] },
];

describe("museum hall deep link", () => {
  it("resolves a catalog hall to its period", () => {
    expect(resolveMuseumHallDeepLink(periods, "renaissance-florence")).toEqual({ periodId: "renaissance-science", hallId: "renaissance-florence" });
  });

  it("rejects unknown or empty hall ids", () => {
    expect(resolveMuseumHallDeepLink(periods, "unknown-hall")).toBeNull();
    expect(resolveMuseumHallDeepLink(periods, "")).toBeNull();
  });
});
