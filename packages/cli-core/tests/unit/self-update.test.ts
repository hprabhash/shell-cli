import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CommandRunner } from "@shell-cli/shared";

import { saveConfig } from "../../src/core/config-store";
import {
  applyVersion,
  buildGlobalInstallCommand,
  formatInstallCommand,
  getRollbackTarget,
  resolveInstallCommand,
} from "../../src/core/self-update";

function fakeRunner(
  responses: Record<string, { stdout: string; exitCode: number }>,
): CommandRunner {
  return (command) => {
    const response = responses[command];
    if (!response) {
      return Promise.resolve({ stdout: "", stderr: "not found", exitCode: 127 });
    }
    return Promise.resolve({ stdout: response.stdout, stderr: "", exitCode: response.exitCode });
  };
}

let tmpHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "shell-cli-self-update-test-"));
  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("buildGlobalInstallCommand", () => {
  it("builds the right global install invocation per package manager", () => {
    expect(buildGlobalInstallCommand("pnpm", "@hprabhash/shell-cli", "1.2.3")).toEqual({
      command: "pnpm",
      args: ["add", "-g", "@hprabhash/shell-cli@1.2.3"],
    });
    expect(buildGlobalInstallCommand("npm", "@hprabhash/shell-cli", "1.2.3")).toEqual({
      command: "npm",
      args: ["install", "-g", "@hprabhash/shell-cli@1.2.3"],
    });
    expect(buildGlobalInstallCommand("yarn", "@hprabhash/shell-cli", "1.2.3")).toEqual({
      command: "yarn",
      args: ["global", "add", "@hprabhash/shell-cli@1.2.3"],
    });
    expect(buildGlobalInstallCommand("bun", "@hprabhash/shell-cli", "1.2.3")).toEqual({
      command: "bun",
      args: ["add", "-g", "@hprabhash/shell-cli@1.2.3"],
    });
  });
});

describe("formatInstallCommand", () => {
  it("joins command and args into a single readable string", () => {
    expect(formatInstallCommand({ command: "npm", args: ["install", "-g", "pkg@1.0.0"] })).toBe(
      "npm install -g pkg@1.0.0",
    );
  });
});

describe("resolveInstallCommand", () => {
  it("picks an available package manager based on detection", async () => {
    const runner = fakeRunner({ pnpm: { stdout: "9.0.0", exitCode: 0 } });
    const install = await resolveInstallCommand("@hprabhash/shell-cli", "2.0.0", runner);
    expect(install).toEqual({ command: "pnpm", args: ["add", "-g", "@hprabhash/shell-cli@2.0.0"] });
  });

  it("falls back to npm when nothing is detected as available", async () => {
    const install = await resolveInstallCommand("@hprabhash/shell-cli", "2.0.0", fakeRunner({}));
    expect(install.command).toBe("npm");
  });
});

describe("applyVersion", () => {
  it("records the previous version as the rollback target before running the install", async () => {
    const runner: CommandRunner = () => Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    const result = await applyVersion(
      { command: "npm", args: ["install", "-g", "pkg@2.0.0"] },
      "1.0.0",
      runner,
    );
    expect(result).toEqual({ success: true, exitCode: 0, stderr: "" });
    expect(getRollbackTarget()).toBe("1.0.0");
  });

  it("reports failure without throwing when the install command exits non-zero", async () => {
    const runner: CommandRunner = () =>
      Promise.resolve({ stdout: "", stderr: "permission denied", exitCode: 1 });
    const result = await applyVersion(
      { command: "npm", args: ["install", "-g", "pkg@2.0.0"] },
      "1.0.0",
      runner,
    );
    expect(result).toEqual({ success: false, exitCode: 1, stderr: "permission denied" });
  });

  it("a second applyVersion call swaps the rollback target to the version it just replaced", async () => {
    const runner: CommandRunner = () => Promise.resolve({ stdout: "", stderr: "", exitCode: 0 });
    await applyVersion({ command: "npm", args: [] }, "1.0.0", runner);
    expect(getRollbackTarget()).toBe("1.0.0");

    await applyVersion({ command: "npm", args: [] }, "2.0.0", runner);
    expect(getRollbackTarget()).toBe("2.0.0");
  });
});

describe("getRollbackTarget", () => {
  it("is null until an update has ever been applied", () => {
    expect(getRollbackTarget()).toBeNull();
  });

  it("reflects whatever was last saved to config", () => {
    saveConfig({
      packageManager: null,
      preferredDatabase: null,
      telemetry: false,
      registryUrl: "https://example.com/templates.json",
      cacheDir: tmpHome,
      lastKnownGoodVersion: "0.9.0",
    });
    expect(getRollbackTarget()).toBe("0.9.0");
  });
});
