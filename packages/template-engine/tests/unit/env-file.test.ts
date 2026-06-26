import { describe, expect, it } from "vitest";

import { mergeEnvFile } from "../../src/env-file";

describe("mergeEnvFile", () => {
  it("writes entries into an empty/null file", () => {
    const result = mergeEnvFile(null, [{ key: "DATABASE_URL", value: "postgresql://x" }]);
    expect(result).toBe("DATABASE_URL=postgresql://x\n");
  });

  it("appends a comment line before an entry that has one", () => {
    const result = mergeEnvFile(null, [
      { key: "DATABASE_URL", value: "postgresql://x", comment: "Connection string" },
    ]);
    expect(result).toBe("# Connection string\nDATABASE_URL=postgresql://x\n");
  });

  it("appends new keys to existing content without clobbering it", () => {
    const existing = "DATABASE_URL=postgresql://x\n";
    const result = mergeEnvFile(existing, [{ key: "BETTER_AUTH_SECRET", value: "abc123" }]);
    expect(result).toBe("DATABASE_URL=postgresql://x\n\nBETTER_AUTH_SECRET=abc123\n");
  });

  it("skips an entry whose key already exists, preserving the existing value", () => {
    const existing = "DATABASE_URL=postgresql://original\n";
    const result = mergeEnvFile(existing, [{ key: "DATABASE_URL", value: "postgresql://new" }]);
    expect(result).toBe(existing);
  });

  it("returns the existing content unchanged when every key already exists", () => {
    const existing = "FOO=1\nBAR=2\n";
    const result = mergeEnvFile(existing, [
      { key: "FOO", value: "x" },
      { key: "BAR", value: "y" },
    ]);
    expect(result).toBe(existing);
  });

  it("defaults a missing value to an empty string", () => {
    const result = mergeEnvFile(null, [{ key: "BETTER_AUTH_SECRET" }]);
    expect(result).toBe("BETTER_AUTH_SECRET=\n");
  });
});
