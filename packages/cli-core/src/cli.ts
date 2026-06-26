import { Command } from "commander";

import { registerCacheCommand } from "./commands/cache";
import { registerConfigCommand } from "./commands/config";
import { registerCreateCommand } from "./commands/create";
import { registerDoctorCommand } from "./commands/doctor";
import { registerPluginsCommand } from "./commands/plugins";
import { registerTemplateCommand } from "./commands/template";
import { registerUpdateCommand } from "./commands/update";
import { registerVersionCommand } from "./commands/version";
import { logger, type LogLevel } from "./core/logger";
import { getCurrentVersion } from "./utils/version";

interface GlobalOptions {
  verbose?: boolean;
  debug?: boolean;
  silent?: boolean;
  color: boolean;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("shell")
    .description(
      "Plugin-driven full-stack project generator — scaffold Next.js, Better Auth, Prisma/Drizzle, PostgreSQL, and shadcn/ui apps.",
    )
    .version(getCurrentVersion(), "-V, --version", "Print the CLI version and exit.")
    .option("--verbose", "Show additional progress detail.")
    .option("--debug", "Show internal debug output (implies --verbose).")
    .option("--silent", "Suppress all non-error output.")
    .option("--no-color", "Disable colored output.")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts<GlobalOptions>();
      const level: LogLevel = opts.silent
        ? "silent"
        : opts.debug
          ? "debug"
          : opts.verbose
            ? "verbose"
            : "normal";
      const color = thisCommand.getOptionValueSource("color") === "cli" ? opts.color : undefined;
      logger.configure({ level, color });
    });

  registerCreateCommand(program);
  registerDoctorCommand(program);
  registerVersionCommand(program);
  registerUpdateCommand(program);
  registerPluginsCommand(program);
  registerConfigCommand(program);
  registerTemplateCommand(program);
  registerCacheCommand(program);

  return program;
}
