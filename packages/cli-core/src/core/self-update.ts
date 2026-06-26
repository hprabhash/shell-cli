import type { CommandRunner, PackageManager } from "@shell-cli/shared";

import { realCommandRunner } from "./command-runner";
import { loadConfig, saveConfig } from "./config-store";
import { detectAllPackageManagers, pickPreferredPackageManager } from "./package-manager";

export interface GlobalInstallCommand {
  command: string;
  args: string[];
}

export function buildGlobalInstallCommand(
  pm: PackageManager,
  packageName: string,
  version: string,
): GlobalInstallCommand {
  const spec = `${packageName}@${version}`;
  switch (pm) {
    case "pnpm":
      return { command: "pnpm", args: ["add", "-g", spec] };
    case "yarn":
      return { command: "yarn", args: ["global", "add", spec] };
    case "bun":
      return { command: "bun", args: ["add", "-g", spec] };
    case "npm":
      return { command: "npm", args: ["install", "-g", spec] };
  }
}

export function formatInstallCommand(install: GlobalInstallCommand): string {
  return `${install.command} ${install.args.join(" ")}`;
}

export async function resolveInstallCommand(
  packageName: string,
  version: string,
  runner: CommandRunner = realCommandRunner,
): Promise<GlobalInstallCommand> {
  const config = loadConfig();
  const detected = await detectAllPackageManagers(runner);
  const pm = pickPreferredPackageManager(detected, config.packageManager);
  return buildGlobalInstallCommand(pm, packageName, version);
}

export interface ApplyVersionResult {
  success: boolean;
  exitCode: number;
  stderr: string;
}

/**
 * Records `fromVersion` as the new rollback target *before* running the
 * install, then runs it — so a later `shell update --rollback` can always
 * swap back to whichever version was active immediately before this one,
 * not just the very first version ever replaced.
 */
export async function applyVersion(
  install: GlobalInstallCommand,
  fromVersion: string,
  runner: CommandRunner = realCommandRunner,
): Promise<ApplyVersionResult> {
  saveConfig({ ...loadConfig(), lastKnownGoodVersion: fromVersion });
  const result = await runner(install.command, install.args);
  return { success: result.exitCode === 0, exitCode: result.exitCode, stderr: result.stderr };
}

export function getRollbackTarget(): string | null {
  return loadConfig().lastKnownGoodVersion;
}
