import { ConfigError, NetworkError } from "@shell-cli/shared";
import type { Command } from "commander";

import { logger } from "../core/logger";
import { promptConfirm } from "../core/prompts";
import {
  applyVersion,
  formatInstallCommand,
  getRollbackTarget,
  resolveInstallCommand,
  type GlobalInstallCommand,
} from "../core/self-update";
import {
  getCurrentVersion,
  getLatestPublishedVersion,
  getOwnPackageName,
  isUpdateAvailable,
} from "../utils/version";

/** Asks to confirm (unless `--yes`), then runs the install. */
async function confirmAndApply(
  install: GlobalInstallCommand,
  fromVersion: string,
  toVersion: string,
  yes: boolean,
): Promise<void> {
  const apply =
    yes ||
    (await promptConfirm({
      message: `Run "${formatInstallCommand(install)}" now?`,
      initialValue: true,
    }));
  if (!apply) {
    logger.info(`Run it yourself when ready: ${formatInstallCommand(install)}`);
    return;
  }

  const result = await logger.spinner(`Installing v${toVersion}...`, () =>
    applyVersion(install, fromVersion),
  );
  if (result.success) {
    logger.success(`Updated to v${toVersion}.`);
  } else {
    logger.warn(
      `Install command exited with code ${result.exitCode}. Run it yourself: ${formatInstallCommand(install)}`,
    );
    if (result.stderr.length > 0) {
      logger.debug(result.stderr);
    }
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Check whether a newer version is published, and optionally install it.")
    .option("-y, --yes", "Apply the update without confirming.")
    .option("--rollback", "Reinstall the version this command last replaced.")
    .action(async (options: { yes?: boolean; rollback?: boolean }) => {
      const packageName = getOwnPackageName();
      const current = getCurrentVersion();

      if (options.rollback === true) {
        const target = getRollbackTarget();
        if (target === null) {
          throw new ConfigError(
            "There's no previous version recorded to roll back to.",
            "Roll back is only available after `shell update` has applied an update at least once.",
          );
        }
        const install = await resolveInstallCommand(packageName, target);
        await confirmAndApply(install, current, target, options.yes === true);
        return;
      }

      logger.info(`Current version: v${current}`);

      let latest: string;
      try {
        latest = await logger.spinner("Checking the npm registry for updates...", () =>
          getLatestPublishedVersion(packageName),
        );
      } catch (error) {
        if (error instanceof NetworkError) {
          logger.warn(`Could not check for updates: ${error.message}`);
          return;
        }
        throw error;
      }

      if (!isUpdateAvailable(current, latest)) {
        logger.success("You're already on the latest version.");
        return;
      }

      const install = await resolveInstallCommand(packageName, latest);
      logger.info(`A new version is available: v${current} -> v${latest}`);

      await confirmAndApply(install, current, latest, options.yes === true);
    });
}
