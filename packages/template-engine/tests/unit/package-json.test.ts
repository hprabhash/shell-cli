import { describe, expect, it } from "vitest";

import { mergePackageJsonFragment } from "../../src/package-json";

interface ParsedPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function parse(json: string): ParsedPackageJson {
  return JSON.parse(json) as ParsedPackageJson;
}

describe("mergePackageJsonFragment", () => {
  it("merges new dependencies without clobbering existing ones", () => {
    const existing = JSON.stringify({ name: "app", dependencies: { next: "16.2.9" } });
    const result = mergePackageJsonFragment(existing, {
      dependencies: { "better-auth": "^1.6.22" },
    });
    expect(parse(result).dependencies).toEqual({ next: "16.2.9", "better-auth": "^1.6.22" });
  });

  it("overwrites a key that already exists in both", () => {
    const existing = JSON.stringify({ dependencies: { foo: "^1.0.0" } });
    const result = mergePackageJsonFragment(existing, { dependencies: { foo: "^2.0.0" } });
    expect(parse(result).dependencies).toEqual({ foo: "^2.0.0" });
  });

  it("merges devDependencies and scripts independently of dependencies", () => {
    const existing = JSON.stringify({ scripts: { dev: "next dev" } });
    const result = mergePackageJsonFragment(existing, {
      devDependencies: { typescript: "^5" },
      scripts: { lint: "eslint" },
    });
    const parsed = parse(result);
    expect(parsed.scripts).toEqual({ dev: "next dev", lint: "eslint" });
    expect(parsed.devDependencies).toEqual({ typescript: "^5" });
  });

  it("leaves unrelated top-level fields untouched", () => {
    const existing = JSON.stringify({ name: "app", version: "0.1.0", private: true });
    const result = mergePackageJsonFragment(existing, { dependencies: { foo: "1.0.0" } });
    const parsed = parse(result);
    expect(parsed.name).toBe("app");
    expect(parsed.version).toBe("0.1.0");
    expect(parsed.private).toBe(true);
  });

  it("throws a clear error for invalid JSON", () => {
    expect(() => mergePackageJsonFragment("not json", {})).toThrow(/Could not parse/);
  });
});
