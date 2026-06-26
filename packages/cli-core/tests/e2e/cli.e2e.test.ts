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

  it("plugins lists the built-in next plugin", async () => {
    const result = await runCli(["plugins"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("next");
    expect(result.stdout).toContain("framework");
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
});
