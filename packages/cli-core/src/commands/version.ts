import type { Command } from "commander";

import { logger } from "../core/logger";
import { getCurrentVersion } from "../utils/version";

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Print the CLI and Node.js versions.")
    .action(() => {
      logger.info(`shell-cli v${getCurrentVersion()}`);
      logger.info(`node ${process.version}`);
    });
}
