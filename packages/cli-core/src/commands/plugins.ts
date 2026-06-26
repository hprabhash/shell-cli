import type { Command } from "commander";

import { logger } from "../core/logger";
import { getAllPlugins, getPluginMetadata } from "../core/plugin-registry";

export function registerPluginsCommand(program: Command): void {
  program
    .command("plugins")
    .description("List built-in plugins.")
    .action(() => {
      const plugins = getAllPlugins();
      if (plugins.length === 0) {
        logger.info("No plugins are registered.");
        return;
      }
      for (const plugin of plugins) {
        const metadata = getPluginMetadata(plugin);
        logger.info(
          `${metadata.id}  ${metadata.name}  [${metadata.category}]  v${metadata.version}`,
        );
        if (metadata.description !== undefined) {
          logger.info(`  ${metadata.description}`);
        }
      }
    });
}
