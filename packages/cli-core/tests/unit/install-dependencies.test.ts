import { describe, expect, it } from "vitest";

import type { CommandRunner } from "@hprabhash/shared";

import { runInstall } from "../../src/core/install-dependencies";

describe("runInstall", () => {
  it("invokes '<packageManager> install' in the given directory", async () => {
    const calls: { command: string; args: readonly string[]; cwd?: string | undefined }[] = [];
    const runner: CommandRunner = (command, args, options) => {
      calls.push({ command, args, cwd: options?.cwd });
      return Promise.resolve({ stdout: "installed", stderr: "", exitCode: 0 });
    };

    const result = await runInstall("/tmp/my-app", "pnpm", runner);

    expect(calls).toEqual([{ command: "pnpm", args: ["install"], cwd: "/tmp/my-app" }]);
    expect(result).toEqual({ success: true, output: "installed" });
  });

  it("reports failure with combined stdout/stderr output", async () => {
    const runner: CommandRunner = () =>
      Promise.resolve({ stdout: "", stderr: "network error", exitCode: 1 });

    const result = await runInstall("/tmp/my-app", "npm", runner);

    expect(result.success).toBe(false);
    expect(result.output).toContain("network error");
  });
});
