import { describe, expect, it } from "vitest";

import { isUpdateAvailable } from "../../src/utils/version";

describe("isUpdateAvailable", () => {
  it("is true when latest is greater than current", () => {
    expect(isUpdateAvailable("1.0.0", "1.1.0")).toBe(true);
  });

  it("is false when versions are equal", () => {
    expect(isUpdateAvailable("1.0.0", "1.0.0")).toBe(false);
  });

  it("is false when latest is older than current", () => {
    expect(isUpdateAvailable("2.0.0", "1.9.9")).toBe(false);
  });
});
