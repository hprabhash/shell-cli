import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import betterAuthPlugin from "@shell-cli/plugin-better-auth";
import drizzlePlugin from "@shell-cli/plugin-drizzle";
import nextPlugin from "@shell-cli/plugin-next";
import postgresPlugin from "@shell-cli/plugin-postgres";
import prismaPlugin from "@shell-cli/plugin-prisma";

function assertNoDiagnostics(label: string, source: string): void {
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const diagnostics = result.diagnostics ?? [];
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    throw new Error(`${label} has TypeScript diagnostics:\n${messages.join("\n")}`);
  }
}

interface ParsedPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

describe("Next.js + Postgres + ORM + Better Auth combos (integration)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "orm-combo-test-"));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it("Prisma combo: Next.js + Postgres + Prisma + Better Auth(email-password)", async () => {
    const variables = { projectName: "my-app", packageManager: "pnpm" as const };

    await nextPlugin.generate?.({ projectDir, variables });
    await postgresPlugin.generate?.({ projectDir, variables });
    await prismaPlugin.generate?.({ projectDir, variables });
    await betterAuthPlugin.generate?.({
      projectDir,
      variables: { features: ["email-password"], orm: "prisma" },
    });

    const authSource = fs.readFileSync(path.join(projectDir, "lib", "auth.ts"), "utf-8");
    expect(authSource).toContain("prismaAdapter");
    expect(authSource).toContain('from "./prisma"');
    assertNoDiagnostics("lib/auth.ts", authSource);

    const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
    expect(env).toMatch(/DATABASE_URL=\S+/);
    expect(env).toMatch(/BETTER_AUTH_SECRET=\S+/);

    expect(fs.existsSync(path.join(projectDir, "prisma", "schema.prisma"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "prisma.config.ts"))).toBe(true);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    ) as ParsedPackageJson;
    expect(packageJson.dependencies?.next).toBeDefined();
    expect(packageJson.dependencies?.["@prisma/client"]).toBeDefined();
    expect(packageJson.dependencies?.["better-auth"]).toBeDefined();
    expect(packageJson.dependencies?.["better-sqlite3"]).toBeUndefined();
    // Turbopack can't resolve Prisma's WASM query compiler or Better Auth's
    // own nested `@better-auth/telemetry` dependency — both plugins force webpack.
    expect(packageJson.scripts?.build).toBe("next build --webpack");

    const nextConfig = fs.readFileSync(path.join(projectDir, "next.config.ts"), "utf-8");
    expect(nextConfig).toContain("serverExternalPackages");
    expect(nextConfig).toContain("@prisma/client");
  });

  it("Drizzle combo: Next.js + Postgres + Drizzle + Better Auth(email-password)", async () => {
    const variables = { projectName: "my-app", packageManager: "pnpm" as const };

    await nextPlugin.generate?.({ projectDir, variables });
    await postgresPlugin.generate?.({ projectDir, variables });
    await drizzlePlugin.generate?.({ projectDir, variables });
    await betterAuthPlugin.generate?.({
      projectDir,
      variables: { features: ["email-password"], orm: "drizzle" },
    });

    const authSource = fs.readFileSync(path.join(projectDir, "lib", "auth.ts"), "utf-8");
    expect(authSource).toContain("drizzleAdapter");
    expect(authSource).toContain('from "./db"');
    assertNoDiagnostics("lib/auth.ts", authSource);

    const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
    expect(env).toMatch(/DATABASE_URL=\S+/);
    expect(env).toMatch(/BETTER_AUTH_SECRET=\S+/);

    expect(fs.existsSync(path.join(projectDir, "drizzle.config.ts"))).toBe(true);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    ) as ParsedPackageJson;
    expect(packageJson.dependencies?.next).toBeDefined();
    expect(packageJson.dependencies?.["drizzle-orm"]).toBeDefined();
    expect(packageJson.dependencies?.["@better-auth/drizzle-adapter"]).toBeDefined();
    expect(packageJson.dependencies?.["better-sqlite3"]).toBeUndefined();
    // Better Auth forces webpack regardless of ORM — Turbopack can't resolve
    // its own nested `@better-auth/telemetry` dependency either way.
    expect(packageJson.scripts?.build).toBe("next build --webpack");

    const schema = fs.readFileSync(path.join(projectDir, "lib", "db", "schema.ts"), "utf-8");
    expect(schema).toContain("export {};");
  });
});
