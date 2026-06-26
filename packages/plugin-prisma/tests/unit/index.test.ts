import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import prismaPlugin from "../../src/index";

const generate = prismaPlugin.generate;
if (!generate) {
  throw new Error("plugin-prisma must implement generate()");
}

interface ParsedPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

describe("plugin-prisma", () => {
  it("registers expected metadata", () => {
    const metadata = prismaPlugin.register();
    expect(metadata.id).toBe("prisma");
    expect(metadata.category).toBe("orm");
  });

  it("has no extra questions and always validates", () => {
    expect(prismaPlugin.questions()).toEqual([]);
    expect(prismaPlugin.validate({})).toEqual({ valid: true, problems: [] });
  });

  it("reports no doctor checks", async () => {
    await expect(prismaPlugin.doctor()).resolves.toEqual([]);
  });

  it("implements generate() and postInstall(), but not install()", () => {
    expect("install" in prismaPlugin).toBe(false);
    expect("generate" in prismaPlugin).toBe(true);
    expect("postInstall" in prismaPlugin).toBe(true);
  });
});

describe("plugin-prisma generate()", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-prisma-generate-test-"));
    fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({ name: "app" }));
    fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules\n");
  });

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  it("writes a Prisma 7 driver-adapter schema and client", async () => {
    await generate({ projectDir: targetDir, variables: {} });

    const schema = fs.readFileSync(path.join(targetDir, "prisma", "schema.prisma"), "utf-8");
    expect(schema).toContain('provider = "prisma-client"');
    expect(schema).toContain('output   = "../generated/prisma"');
    expect(schema).toContain('provider = "postgresql"');
    // Prisma 7 rejects a `url` field inside schema.prisma's datasource block —
    // the connection string for Migrate lives in prisma.config.ts instead.
    expect(schema).not.toContain("url");

    const lib = fs.readFileSync(path.join(targetDir, "lib", "prisma.ts"), "utf-8");
    expect(lib).toContain("PrismaPg");
    expect(lib).toContain('from "../generated/prisma/client"');
  });

  it("writes a prisma.config.ts that supplies the Migrate datasource URL", async () => {
    await generate({ projectDir: targetDir, variables: {} });

    const config = fs.readFileSync(path.join(targetDir, "prisma.config.ts"), "utf-8");
    expect(config).toContain('import "dotenv/config"');
    expect(config).toContain('from "prisma/config"');
    expect(config).toContain('schema: "prisma/schema.prisma"');
    expect(config).toContain('env("DATABASE_URL")');
  });

  it("patches package.json with Prisma's dependencies without clobbering existing fields", async () => {
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ name: "app", dependencies: { next: "16.2.9" } }),
    );

    await generate({ projectDir: targetDir, variables: {} });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as ParsedPackageJson;
    expect(packageJson.dependencies?.next).toBe("16.2.9");
    expect(packageJson.dependencies?.["@prisma/client"]).toBeDefined();
    expect(packageJson.dependencies?.["@prisma/adapter-pg"]).toBeDefined();
    expect(packageJson.dependencies?.pg).toBeDefined();
    expect(packageJson.devDependencies?.dotenv).toBeDefined();
    expect(packageJson.devDependencies?.prisma).toBeDefined();
  });

  it("forces webpack for dev/build — Turbopack can't resolve Prisma's WASM query compiler", async () => {
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ name: "app", scripts: { dev: "next dev", build: "next build" } }),
    );

    await generate({ projectDir: targetDir, variables: {} });

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as ParsedPackageJson;
    expect(packageJson.scripts?.dev).toBe("next dev --webpack");
    expect(packageJson.scripts?.build).toBe("next build --webpack");
  });

  it("patches next.config.ts to externalize Prisma's runtime packages when present", async () => {
    fs.writeFileSync(
      path.join(targetDir, "next.config.ts"),
      [
        'import type { NextConfig } from "next";',
        "",
        "const nextConfig: NextConfig = {",
        "  /* config options here */",
        "};",
        "",
        "export default nextConfig;",
        "",
      ].join("\n"),
    );

    await generate({ projectDir: targetDir, variables: {} });

    const nextConfig = fs.readFileSync(path.join(targetDir, "next.config.ts"), "utf-8");
    expect(nextConfig).toContain('serverExternalPackages: ["@prisma/client", "pg"]');
  });

  it("skips patching next.config.ts when it doesn't exist (non-Next.js framework)", async () => {
    await generate({ projectDir: targetDir, variables: {} });
    expect(fs.existsSync(path.join(targetDir, "next.config.ts"))).toBe(false);
  });

  it("adds /generated to .gitignore without duplicating it on a second run", async () => {
    await generate({ projectDir: targetDir, variables: {} });
    const firstPass = fs.readFileSync(path.join(targetDir, ".gitignore"), "utf-8");
    expect(firstPass).toContain("/generated");

    fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({ name: "app" }));
    await generate({ projectDir: targetDir, variables: {} });
    const secondPass = fs.readFileSync(path.join(targetDir, ".gitignore"), "utf-8");
    expect(secondPass.match(/\/generated/g)).toHaveLength(1);
  });
});
