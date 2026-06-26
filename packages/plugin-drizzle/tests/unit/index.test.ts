import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import drizzlePlugin from "../../src/index";

const generate = drizzlePlugin.generate;
if (!generate) {
  throw new Error("plugin-drizzle must implement generate()");
}

interface ParsedPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

describe("plugin-drizzle", () => {
  it("registers expected metadata", () => {
    const metadata = drizzlePlugin.register();
    expect(metadata.id).toBe("drizzle");
    expect(metadata.category).toBe("orm");
  });

  it("has no extra questions and always validates", () => {
    expect(drizzlePlugin.questions()).toEqual([]);
    expect(drizzlePlugin.validate({})).toEqual({ valid: true, problems: [] });
  });

  it("reports no doctor checks", async () => {
    await expect(drizzlePlugin.doctor()).resolves.toEqual([]);
  });

  it("implements generate() and postInstall(), but not install()", () => {
    expect("install" in drizzlePlugin).toBe(false);
    expect("generate" in drizzlePlugin).toBe(true);
    expect("postInstall" in drizzlePlugin).toBe(true);
  });
});

describe("plugin-drizzle generate()", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-drizzle-generate-test-"));
    fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({ name: "app" }));
  });

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  it("writes drizzle config, schema, and db client files", async () => {
    await generate({ projectDir: targetDir, variables: {} });

    const config = fs.readFileSync(path.join(targetDir, "drizzle.config.ts"), "utf-8");
    expect(config).toContain('schema: "./lib/db/schema.ts"');
    expect(config).toContain('dialect: "postgresql"');

    const schema = fs.readFileSync(path.join(targetDir, "lib", "db", "schema.ts"), "utf-8");
    expect(schema).toContain("auth generate");
    // Must stay a real ES module even before `auth generate` adds real
    // exports — `lib/db/index.ts`'s `import * as schema from "./schema"`
    // fails TypeScript's "not a module" check on a comment-only file.
    expect(schema).toContain("export {};");

    const dbIndex = fs.readFileSync(path.join(targetDir, "lib", "db", "index.ts"), "utf-8");
    expect(dbIndex).toContain('from "drizzle-orm/node-postgres"');
    expect(dbIndex).toContain("process.env.DATABASE_URL");
  });

  it("patches package.json with Drizzle's dependencies without clobbering existing fields", async () => {
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ name: "app", dependencies: { next: "16.2.9" } }),
    );

    await generate({ projectDir: targetDir, variables: {} });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as ParsedPackageJson;
    expect(packageJson.dependencies?.next).toBe("16.2.9");
    expect(packageJson.dependencies?.["drizzle-orm"]).toBeDefined();
    expect(packageJson.dependencies?.pg).toBeDefined();
    expect(packageJson.devDependencies?.["drizzle-kit"]).toBeDefined();
  });

  it("does not touch .gitignore — Drizzle's migration output is meant to be committed", async () => {
    await generate({ projectDir: targetDir, variables: {} });
    expect(fs.existsSync(path.join(targetDir, ".gitignore"))).toBe(false);
  });
});
