import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import postgresPlugin from "../../src/index";

const generate = postgresPlugin.generate;
if (!generate) {
  throw new Error("plugin-postgres must implement generate()");
}

describe("plugin-postgres", () => {
  it("registers expected metadata", () => {
    const metadata = postgresPlugin.register();
    expect(metadata.id).toBe("postgresql");
    expect(metadata.category).toBe("database");
  });

  it("has no extra questions and always validates", () => {
    expect(postgresPlugin.questions()).toEqual([]);
    expect(postgresPlugin.validate({})).toEqual({ valid: true, problems: [] });
  });

  it("implements generate() but not install/postInstall", () => {
    expect("install" in postgresPlugin).toBe(false);
    expect("generate" in postgresPlugin).toBe(true);
    expect("postInstall" in postgresPlugin).toBe(false);
  });

  // doctor() shells out to the real `docker` binary — whether it's on PATH
  // varies by machine, so this only asserts the result shape, not pass/warn.
  it("doctor() resolves to a well-formed check list regardless of whether docker is installed", async () => {
    const results = await postgresPlugin.doctor();
    expect(Array.isArray(results)).toBe(true);
    for (const result of results) {
      expect(["pass", "warn", "fail"]).toContain(result.status);
    }
  });
});

describe("plugin-postgres generate()", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-postgres-generate-test-"));
  });

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  it("writes a docker-compose.yml that matches the contributed DATABASE_URL", async () => {
    await generate({ projectDir: targetDir, variables: {} });

    const compose = fs.readFileSync(path.join(targetDir, "docker-compose.yml"), "utf-8");
    expect(compose).toContain("image: postgres:18");
    expect(compose).toContain("POSTGRES_USER: postgres");
    expect(compose).toContain("POSTGRES_PASSWORD: postgres");
    expect(compose).toContain("POSTGRES_DB: app_dev");
    expect(compose).toContain('"5432:5432"');

    const env = fs.readFileSync(path.join(targetDir, ".env"), "utf-8");
    expect(env).toContain("DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev");
    const envExample = fs.readFileSync(path.join(targetDir, ".env.example"), "utf-8");
    expect(envExample).toContain(
      "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev",
    );
  });

  it("merges into an existing .env without clobbering other keys", async () => {
    fs.writeFileSync(path.join(targetDir, ".env"), "BETTER_AUTH_SECRET=abc123\n");

    await generate({ projectDir: targetDir, variables: {} });

    const env = fs.readFileSync(path.join(targetDir, ".env"), "utf-8");
    expect(env).toContain("BETTER_AUTH_SECRET=abc123");
    expect(env).toContain("DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_dev");
  });
});
