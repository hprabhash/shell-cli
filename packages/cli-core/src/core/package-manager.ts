import {
  SUPPORTED_PACKAGE_MANAGERS,
  type CommandRunner,
  type PackageManager,
} from "@shell-cli/shared";

import { realCommandRunner } from "./command-runner";

export interface PackageManagerInfo {
  name: PackageManager;
  available: boolean;
  version: string | undefined;
}

export async function detectPackageManager(
  name: PackageManager,
  runner: CommandRunner = realCommandRunner,
): Promise<PackageManagerInfo> {
  try {
    const result = await runner(name, ["--version"]);
    if (result.exitCode !== 0) {
      return { name, available: false, version: undefined };
    }
    return { name, available: true, version: result.stdout.trim() };
  } catch {
    return { name, available: false, version: undefined };
  }
}

export async function detectAllPackageManagers(
  runner: CommandRunner = realCommandRunner,
): Promise<PackageManagerInfo[]> {
  return Promise.all(SUPPORTED_PACKAGE_MANAGERS.map((pm) => detectPackageManager(pm, runner)));
}

const PRIORITY: readonly PackageManager[] = ["pnpm", "npm", "yarn", "bun"];

/** Config-store preference wins if it's actually available; otherwise falls back to a fixed priority order. */
export function pickPreferredPackageManager(
  infos: readonly PackageManagerInfo[],
  preferred: PackageManager | null,
): PackageManager {
  if (preferred) {
    const match = infos.find((info) => info.name === preferred && info.available);
    if (match) return match.name;
  }
  for (const name of PRIORITY) {
    const match = infos.find((info) => info.name === name && info.available);
    if (match) return match.name;
  }
  return "npm";
}
