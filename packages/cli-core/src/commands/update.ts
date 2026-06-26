import type { Command } from "commander";

import { NetworkError, type PackageManager } from "@shell-cli/shared";

import { loadConfig } from "../core/config-store";
import { logger } from "../core/logger";
import { detectAllPackageManagers, pickPreferredPackageManager } from "../core/package-manager";
import {
  getCurrentVersion,
  getLatestPublishedVersion,
  getOwnPackageName,
  isUpdateAvailable,
} from "../utils/version";

function buildGlobalInstallCommand(
  pm: PackageManager,
  packageName: string,
  version: string,
): string {
  switch (pm) {
    case "pnpm":
      return `pnpm add -g ${packageName}@${version}`;
    case "yarn":
      return `yarn global add ${packageName}@${version}`;
    case "bun":
      return `bun add -g ${packageName}@${version}`;
    case "npm":
      return `npm install -g ${packageName}@${version}`;
  }
}

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .description("Check whether a newer shell-cli version is published and show how to upgrade.")
    .action(async () => {
      const packageName = getOwnPackageName();
      const current = getCurrentVersion();
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

      const config = loadConfig();
      const detected = await detectAllPackageManagers();
      const pm = pickPreferredPackageManager(detected, config.packageManager);
      const installCommand = buildGlobalInstallCommand(pm, packageName, latest);

      logger.info(`A new version is available: v${current} -> v${latest}`);
      logger.info(`Run: ${installCommand}`);
    });
}
