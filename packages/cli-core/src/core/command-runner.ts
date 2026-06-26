import { execa } from "execa";

import type { CommandRunner } from "@shell-cli/shared";

/** Real process-spawning implementation of `CommandRunner`. Tests inject a fake instead. */
export const realCommandRunner: CommandRunner = async (command, args) => {
  const result = await execa(command, args, { reject: false });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 1,
  };
};
