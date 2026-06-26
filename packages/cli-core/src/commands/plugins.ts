import type { Command } from "commander";

import { notImplementedYet } from "./_shared";

export function registerPluginsCommand(program: Command): void {
  program
    .command("plugins")
    .description("List installed plugins. (Plugin system lands in Phase 2.)")
    .action(() => {
      notImplementedYet("The plugin system", 2, "Plugin architecture");
    });
}
