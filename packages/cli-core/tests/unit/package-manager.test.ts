import { describe, expect, it } from "vitest";

import {
  pickPreferredPackageManager,
  type PackageManagerInfo,
} from "../../src/core/package-manager";

const infos: PackageManagerInfo[] = [
  { name: "npm", available: true, version: "10.0.0" },
  { name: "pnpm", available: true, version: "9.0.0" },
  { name: "yarn", available: false, version: undefined },
  { name: "bun", available: false, version: undefined },
];

describe("pickPreferredPackageManager", () => {
  it("uses the stored preference when it's available", () => {
    expect(pickPreferredPackageManager(infos, "npm")).toBe("npm");
  });

  it("falls back to priority order when the preference is unavailable", () => {
    expect(pickPreferredPackageManager(infos, "yarn")).toBe("pnpm");
  });

  it("defaults to pnpm-first priority with no preference", () => {
    expect(pickPreferredPackageManager(infos, null)).toBe("pnpm");
  });

  it("falls back to npm if nothing is available", () => {
    const noneAvailable = infos.map((info) => ({ ...info, available: false }));
    expect(pickPreferredPackageManager(noneAvailable, null)).toBe("npm");
  });
});
