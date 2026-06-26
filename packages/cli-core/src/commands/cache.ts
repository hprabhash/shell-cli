import fs from "node:fs";

import type { Command } from "commander";

import { loadConfig } from "../core/config-store";
import { logger } from "../core/logger";

export function registerCacheCommand(program: Command): void {
  const cache = program.command("cache").description("Manage the local template/registry cache.");

  cache
    .command("clear")
    .description("Delete all cached files.")
    .action(() => {
      const { cacheDir } = loadConfig();
      if (!fs.existsSync(cacheDir)) {
        logger.info("Cache is already empty.");
        return;
      }
      fs.rmSync(cacheDir, { recursive: true, force: true });
      logger.success(`Cleared cache at ${cacheDir}.`);
    });
}
