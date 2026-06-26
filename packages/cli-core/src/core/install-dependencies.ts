import type { CommandRunner, PackageManager } from "@shell-cli/shared";

import { realCommandRunner } from "./command-runner";

export interface RunInstallResult {
  success: boolean;
  output: string;
}

/**
 * Never throws — a failed install shouldn't roll back an otherwise-valid
 * scaffold (that's what `ProjectWriter`'s rollback is for, during generation
 * itself). The caller warns with `output` and the exact command to retry.
 */
export async function runInstall(
  cwd: string,
  packageManager: PackageManager,
  runner: CommandRunner = realCommandRunner,
): Promise<RunInstallResult> {
  const result = await runner(packageManager, ["install"], { cwd });
  return {
    success: result.exitCode === 0,
    output: `${result.stdout}\n${result.stderr}`.trim(),
  };
}
