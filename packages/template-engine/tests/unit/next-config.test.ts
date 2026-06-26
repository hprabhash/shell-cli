import { describe, expect, it } from "vitest";

import { mergeNextConfigServerExternalPackages } from "../../src/next-config";

const BASE_CONFIG = [
  'import type { NextConfig } from "next";',
  "",
  "const nextConfig: NextConfig = {",
  "  /* config options here */",
  "};",
  "",
  "export default nextConfig;",
  "",
].join("\n");

describe("mergeNextConfigServerExternalPackages", () => {
  it("injects a new serverExternalPackages array when none exists", () => {
    const result = mergeNextConfigServerExternalPackages(BASE_CONFIG, ["@prisma/client", "pg"]);
    expect(result).toContain('serverExternalPackages: ["@prisma/client", "pg"]');
  });

  it("returns existing content unchanged when given no packages", () => {
    expect(mergeNextConfigServerExternalPackages(BASE_CONFIG, [])).toBe(BASE_CONFIG);
  });

  it("returns existing content unchanged when there's no nextConfig declaration to anchor on", () => {
    const weird = "export default {};\n";
    expect(mergeNextConfigServerExternalPackages(weird, ["pg"])).toBe(weird);
  });

  it("merges into an existing serverExternalPackages array without duplicating entries", () => {
    const withExisting = BASE_CONFIG.replace(
      "const nextConfig: NextConfig = {",
      'const nextConfig: NextConfig = {\n  serverExternalPackages: ["pg"],',
    );
    const result = mergeNextConfigServerExternalPackages(withExisting, ["pg", "@prisma/client"]);
    expect(result).toContain('serverExternalPackages: ["pg", "@prisma/client"]');
    expect(result.match(/"pg"/g)).toHaveLength(1);
  });

  it("is idempotent across repeated calls with the same packages", () => {
    const once = mergeNextConfigServerExternalPackages(BASE_CONFIG, ["better-sqlite3"]);
    const twice = mergeNextConfigServerExternalPackages(once, ["better-sqlite3"]);
    expect(twice).toBe(once);
  });
});
