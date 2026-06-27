import type { CommandRunner } from "@hprabhash/shared";

import { realCommandRunner } from "./command-runner";

export interface InitGitRepoResult {
  initialized: boolean;
  committed: boolean;
}

/**
 * Never throws — `git init`/commit is a "nice to have" step for `shell create`.
 * A missing `git` binary or unconfigured commit identity shouldn't take down an
 * otherwise-successful scaffold; the caller decides how to warn based on the
 * returned flags.
 */
export async function initGitRepo(
  cwd: string,
  runner: CommandRunner = realCommandRunner,
): Promise<InitGitRepoResult> {
  const initResult = await runner("git", ["init"], { cwd });
  if (initResult.exitCode !== 0) {
    return { initialized: false, committed: false };
  }

  const addResult = await runner("git", ["add", "-A"], { cwd });
  if (addResult.exitCode !== 0) {
    return { initialized: true, committed: false };
  }

  const commitResult = await runner("git", ["commit", "-m", "Initial commit"], { cwd });
  return { initialized: true, committed: commitResult.exitCode === 0 };
}
