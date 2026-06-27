#!/usr/bin/env node
import { isShellCliError } from "@hprabhash/shared";

import { createProgram } from "./cli";
import { colors } from "./core/colors";
import { logger } from "./core/logger";

async function main(): Promise<void> {
  const program = createProgram();
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  if (isShellCliError(error)) {
    logger.error(error.message);
    if (error.hint !== undefined) {
      logger.info(colors.dim(error.hint));
    }
    if (logger.getLevel() === "debug" && error.stack !== undefined) {
      logger.debug(error.stack);
    }
    process.exitCode = error.exitCode;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  if (error instanceof Error && error.stack !== undefined) {
    logger.debug(error.stack);
  }
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled rejection: ${message}`);
  process.exitCode = 1;
});
