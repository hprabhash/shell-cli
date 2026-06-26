import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(here, "../../dist/bin.js");

let tmpHome: string;

beforeAll(() => {
  if (!fs.existsSync(binPath)) {
    throw new Error(`Built CLI not found at ${binPath}. Run "pnpm build" before "pnpm test:e2e".`);
  }
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "shell-cli-e2e-"));
});

afterAll(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function runCli(args: string[]) {
  return execa("node", [binPath, ...args], {
    cwd: tmpHome,
    env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
    reject: false,
  });
}

describe("shell CLI (e2e)", () => {
  it("lists all top-level commands in --help", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    for (const command of [
      "create",
      "doctor",
      "version",
      "update",
      "plugins",
      "config",
      "template",
      "cache",
      "help",
    ]) {
      expect(result.stdout).toContain(command);
    }
  });

  it("prints a semver-looking version", async () => {
    const result = await runCli(["version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("doctor exits 0 and reports the Node.js check", async () => {
    const result = await runCli(["doctor"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Node.js version");
  });

  it("round-trips config set/get", async () => {
    const setResult = await runCli(["config", "set", "packageManager", "pnpm"]);
    expect(setResult.exitCode).toBe(0);

    const getResult = await runCli(["config", "get", "packageManager"]);
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout.trim()).toBe('"pnpm"');
  });

  it("config list includes all default keys", async () => {
    const result = await runCli(["config", "list"]);
    expect(result.exitCode).toBe(0);
    for (const key of [
      "packageManager",
      "preferredDatabase",
      "telemetry",
      "registryUrl",
      "cacheDir",
    ]) {
      expect(result.stdout).toContain(key);
    }
  });

  it("cache clear exits 0 even when the cache dir doesn't exist", async () => {
    const result = await runCli(["cache", "clear"]);
    expect(result.exitCode).toBe(0);
  });

  it("template list/update print a forward-reference to Phase 7 and exit 0", async () => {
    const list = await runCli(["template", "list"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout + list.stderr).toContain("Phase 7");

    const update = await runCli(["template", "update"]);
    expect(update.exitCode).toBe(0);
    expect(update.stdout + update.stderr).toContain("Phase 7");
  });

  it("plugins lists the built-in next and better-auth plugins", async () => {
    const result = await runCli(["plugins"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("next");
    expect(result.stdout).toContain("framework");
    expect(result.stdout).toContain("better-auth");
    expect(result.stdout).toContain("auth");
  });

  it("create resolves a plan non-interactively and scaffolds a real Next.js project", async () => {
    const targetDir = path.join(tmpHome, "my-app");
    const result = await runCli([
      "create",
      "my-app",
      "--yes",
      "--pm",
      "pnpm",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Resolved project plan");
    expect(result.stdout).toContain("Created my-app");

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as { name: string };
    expect(packageJson.name).toBe("my-app");
    expect(fs.existsSync(path.join(targetDir, "app", "page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, ".git"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "node_modules"))).toBe(false);
  });

  it("create initializes git by default and skips it with --no-git", async () => {
    const withGitDir = path.join(tmpHome, "with-git-app");
    const withGitResult = await runCli([
      "create",
      "with-git-app",
      "--yes",
      "--pm",
      "npm",
      "--no-install",
    ]);
    expect(withGitResult.exitCode).toBe(0);
    expect(fs.existsSync(path.join(withGitDir, ".git"))).toBe(true);

    const withoutGitDir = path.join(tmpHome, "without-git-app");
    const withoutGitResult = await runCli([
      "create",
      "without-git-app",
      "--yes",
      "--pm",
      "npm",
      "--no-git",
      "--no-install",
    ]);
    expect(withoutGitResult.exitCode).toBe(0);
    expect(fs.existsSync(path.join(withoutGitDir, ".git"))).toBe(false);
  });

  it("create accepts a framework that's actually registered", async () => {
    const targetDir = path.join(tmpHome, "my-next-app");
    const result = await runCli([
      "create",
      "my-next-app",
      "--yes",
      "--framework",
      "next",
      "--pm",
      "npm",
      "--no-git",
      "--no-install",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Framework:");
    expect(fs.existsSync(path.join(targetDir, "package.json"))).toBe(true);
  });

  it("rejects a framework that isn't registered", async () => {
    const result = await runCli([
      "create",
      "my-unregistered-framework-app",
      "--yes",
      "--framework",
      "totally-fake",
      "--pm",
      "npm",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("isn't registered");
  });

  it("rejects an invalid project name with a non-zero exit code", async () => {
    const result = await runCli(["create", "Invalid Name", "--yes", "--pm", "npm"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("not a valid project name");
  });

  it("create with --auth better-auth scaffolds real auth files alongside the Next.js app", async () => {
    const targetDir = path.join(tmpHome, "auth-app");
    const result = await runCli([
      "create",
      "auth-app",
      "--yes",
      "--pm",
      "npm",
      "--auth",
      "better-auth",
      "--auth-features",
      "email-password,google",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Authentication:        better-auth");
    expect(fs.existsSync(path.join(targetDir, "lib", "auth.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "lib", "auth-client.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "app", "api", "auth", "[...all]", "route.ts"))).toBe(
      true,
    );

    const authSource = fs.readFileSync(path.join(targetDir, "lib", "auth.ts"), "utf-8");
    expect(authSource).toContain("emailAndPassword");
    expect(authSource).toContain("GOOGLE_CLIENT_ID");

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as {
      name: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
      pnpm?: { onlyBuiltDependencies?: string[] };
    };
    expect(packageJson.name).toBe("auth-app");
    expect(packageJson.dependencies.next).toBeDefined();
    expect(packageJson.dependencies["better-auth"]).toBeDefined();
    // Turbopack can't resolve Better Auth's own nested `@better-auth/telemetry`
    // dependency, regardless of which database adapter is in use.
    expect(packageJson.scripts.build).toBe("next build --webpack");
    // pnpm blocks better-sqlite3's own install script by default — without
    // this, `pnpm install` "succeeds" but the native binary never gets built.
    expect(packageJson.pnpm?.onlyBuiltDependencies).toEqual(["better-sqlite3"]);

    const nextConfig = fs.readFileSync(path.join(targetDir, "next.config.ts"), "utf-8");
    expect(nextConfig).toContain('serverExternalPackages: ["better-sqlite3"]');
  });

  it("create without --auth still works exactly as before (no auth files)", async () => {
    const targetDir = path.join(tmpHome, "no-auth-app");
    const result = await runCli([
      "create",
      "no-auth-app",
      "--yes",
      "--pm",
      "npm",
      "--no-git",
      "--no-install",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Authentication:        none");
    expect(fs.existsSync(path.join(targetDir, "lib", "auth.ts"))).toBe(false);
  });

  it("rejects an invalid Better Auth feature combination (teams without organization)", async () => {
    const result = await runCli([
      "create",
      "invalid-auth-app",
      "--yes",
      "--pm",
      "npm",
      "--auth",
      "better-auth",
      "--auth-features",
      "teams",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("requires");
  });

  it("rejects an auth plugin that isn't registered", async () => {
    const result = await runCli([
      "create",
      "fake-auth-app",
      "--yes",
      "--pm",
      "npm",
      "--auth",
      "totally-fake-auth",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("isn't registered");
  });

  it("create with --orm prisma --database postgresql scaffolds Prisma + docker-compose", async () => {
    const targetDir = path.join(tmpHome, "prisma-app");
    const result = await runCli([
      "create",
      "prisma-app",
      "--yes",
      "--pm",
      "npm",
      "--orm",
      "prisma",
      "--database",
      "postgresql",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ORM:                   prisma");
    expect(result.stdout).toContain("Database:              postgresql");
    expect(fs.existsSync(path.join(targetDir, "prisma", "schema.prisma"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "prisma.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "lib", "prisma.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "docker-compose.yml"))).toBe(true);

    const env = fs.readFileSync(path.join(targetDir, ".env"), "utf-8");
    expect(env).toContain("DATABASE_URL=");

    const nextConfig = fs.readFileSync(path.join(targetDir, "next.config.ts"), "utf-8");
    expect(nextConfig).toContain("serverExternalPackages");
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts.build).toBe("next build --webpack");
  });

  it("create with --orm drizzle defaults the database to the first registered provider under --yes", async () => {
    const targetDir = path.join(tmpHome, "drizzle-app");
    const result = await runCli([
      "create",
      "drizzle-app",
      "--yes",
      "--pm",
      "npm",
      "--orm",
      "drizzle",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ORM:                   drizzle");
    expect(fs.existsSync(path.join(targetDir, "drizzle.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "lib", "db", "index.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "docker-compose.yml"))).toBe(true);
  });

  it("create with --orm drizzle --database none skips provisioning a database", async () => {
    const targetDir = path.join(tmpHome, "drizzle-no-db-app");
    const result = await runCli([
      "create",
      "drizzle-no-db-app",
      "--yes",
      "--pm",
      "npm",
      "--orm",
      "drizzle",
      "--database",
      "none",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Database:              none");
    expect(fs.existsSync(path.join(targetDir, "drizzle.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, "docker-compose.yml"))).toBe(false);
  });

  it("create without --orm scaffolds no ORM/database files (regression)", async () => {
    const targetDir = path.join(tmpHome, "no-orm-app");
    const result = await runCli([
      "create",
      "no-orm-app",
      "--yes",
      "--pm",
      "npm",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ORM:                   none");
    expect(result.stdout).toContain("Database:              none");
    expect(fs.existsSync(path.join(targetDir, "prisma"))).toBe(false);
    expect(fs.existsSync(path.join(targetDir, "docker-compose.yml"))).toBe(false);
  });

  it("rejects --database without --orm", async () => {
    const result = await runCli([
      "create",
      "bad-database-app",
      "--yes",
      "--pm",
      "npm",
      "--database",
      "postgresql",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("--database requires an ORM");
  });

  it("create with --orm prisma --auth better-auth wires Better Auth to the Prisma adapter", async () => {
    const targetDir = path.join(tmpHome, "prisma-auth-app");
    const result = await runCli([
      "create",
      "prisma-auth-app",
      "--yes",
      "--pm",
      "npm",
      "--orm",
      "prisma",
      "--auth",
      "better-auth",
      "--auth-features",
      "email-password",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(0);
    const authSource = fs.readFileSync(path.join(targetDir, "lib", "auth.ts"), "utf-8");
    expect(authSource).toContain("prismaAdapter");
    expect(authSource).toContain('from "./prisma"');

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(targetDir, "package.json"), "utf-8"),
    ) as { dependencies: Record<string, string>; scripts: Record<string, string> };
    expect(packageJson.dependencies["@prisma/client"]).toBeDefined();
    expect(packageJson.dependencies["@better-auth/prisma-adapter"]).toBeDefined();
    expect(packageJson.dependencies["better-sqlite3"]).toBeUndefined();
    expect(packageJson.scripts.build).toBe("next build --webpack");
  });
});
