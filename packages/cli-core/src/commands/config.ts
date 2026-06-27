import { CONFIG_KEYS, ValidationError, type ShellCliConfigKey } from "@hprabhash/shared";
import type { Command } from "commander";

import { getConfigValue, loadConfig, resetConfig, setConfigValue } from "../core/config-store";
import { logger } from "../core/logger";
import { getConfigFilePath } from "../core/paths";
import { promptConfirm } from "../core/prompts";

function assertKnownKey(key: string): ShellCliConfigKey {
  if (!(CONFIG_KEYS as readonly string[]).includes(key)) {
    throw new ValidationError(
      `Unknown config key "${key}".`,
      `Valid keys: ${CONFIG_KEYS.join(", ")}`,
    );
  }
  return key as ShellCliConfigKey;
}

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Read and write CLI configuration (~/.shell-cli/config.json).");

  config
    .command("list")
    .description("Print the full configuration.")
    .action(() => {
      const current = loadConfig();
      for (const [key, value] of Object.entries(current)) {
        logger.info(`${key} = ${JSON.stringify(value)}`);
      }
    });

  config
    .command("get <key>")
    .description("Print a single configuration value.")
    .action((key: string) => {
      const validKey = assertKnownKey(key);
      logger.info(JSON.stringify(getConfigValue(validKey)));
    });

  config
    .command("set <key> <value>")
    .description("Set a single configuration value.")
    .action((key: string, value: string) => {
      const validKey = assertKnownKey(key);
      const updated = setConfigValue(validKey, value);
      logger.success(`${validKey} = ${JSON.stringify(updated[validKey])}`);
    });

  config
    .command("path")
    .description("Print the path to the configuration file.")
    .action(() => {
      logger.info(getConfigFilePath());
    });

  config
    .command("reset")
    .description("Reset configuration to defaults.")
    .option("-y, --yes", "Skip the confirmation prompt.")
    .action(async (options: { yes?: boolean }) => {
      if (options.yes !== true) {
        const confirmed = await promptConfirm({
          message: "Reset all configuration to defaults?",
          initialValue: false,
        });
        if (!confirmed) {
          logger.info("Cancelled.");
          return;
        }
      }
      resetConfig();
      logger.success("Configuration reset to defaults.");
    });
}
