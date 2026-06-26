import { describe, expect, it } from "vitest";

import { appendGitignoreEntries } from "../../src/gitignore";

describe("appendGitignoreEntries", () => {
  it("appends entries not already present", () => {
    const existing = "node_modules\n.env\n";
    const result = appendGitignoreEntries(existing, ["/generated"]);
    expect(result).toBe("node_modules\n.env\n\n/generated\n");
  });

  it("does not duplicate an entry that already exists as an exact line", () => {
    const existing = "node_modules\n/generated\n";
    const result = appendGitignoreEntries(existing, ["/generated"]);
    expect(result).toBe(existing);
  });

  it("only appends the entries that are missing out of several", () => {
    const existing = "node_modules\n";
    const result = appendGitignoreEntries(existing, ["node_modules", "/generated", "dist"]);
    expect(result).toBe("node_modules\n\n/generated\ndist\n");
  });

  it("returns existing content unchanged when there are no entries to add", () => {
    const existing = "node_modules\n";
    expect(appendGitignoreEntries(existing, [])).toBe(existing);
  });
});
