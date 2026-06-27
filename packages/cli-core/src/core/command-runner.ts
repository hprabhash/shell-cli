import { execa } from "execa";

import type { CommandRunner } from "@hprabhash/shared";

/** Real process-spawning implementation of `CommandRunner`. Tests inject a fake instead. */
export const realCommandRunner: CommandRunner = async (command, args, options) => {
  const result = await execa(command, args, {
    reject: false,
    ...(options?.cwd !== undefined && { cwd: options.cwd }),
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 1,
  };
};
