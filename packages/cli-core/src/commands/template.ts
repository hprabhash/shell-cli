import {
  ConfigError,
  NetworkError,
  ValidationError,
  type RegistryManifest,
} from "@shell-cli/shared";
import type { Command } from "commander";

import { loadConfig } from "../core/config-store";
import { logger } from "../core/logger";
import { fetchManifest } from "../core/registry-client";
import {
  activateVersion,
  findPreviousCachedVersion,
  getActiveVersion,
  installVersion,
  listCachedVersions,
  readCachedManifest,
  writeCachedManifest,
} from "../core/template-cache";

interface RegistryUrlOption {
  registryUrl?: string;
}

function resolveRegistryUrl(options: RegistryUrlOption): string {
  return options.registryUrl ?? loadConfig().registryUrl;
}

export function registerTemplateCommand(program: Command): void {
  const template = program.command("template").description("Manage the remote template registry.");

  template
    .command("list")
    .description("List available templates and their cached/active versions.")
    .option("--registry-url <url>", "Override the configured registry URL for this command.")
    .action(async (options: RegistryUrlOption) => {
      const registryUrl = resolveRegistryUrl(options);
      const cacheDir = loadConfig().cacheDir;

      let manifest: RegistryManifest;
      let offline = false;
      try {
        manifest = await logger.spinner("Fetching the template registry...", () =>
          fetchManifest(registryUrl),
        );
        writeCachedManifest(cacheDir, manifest);
      } catch (error) {
        if (!(error instanceof NetworkError)) {
          throw error;
        }
        const cached = readCachedManifest(cacheDir);
        if (cached === null) {
          logger.warn(`Could not reach the registry: ${error.message}`);
          return;
        }
        manifest = cached;
        offline = true;
      }

      if (manifest.templates.length === 0) {
        logger.info("No templates are published in this registry yet.");
        return;
      }

      if (offline) {
        logger.warn("Offline — showing the last cached registry listing.");
      }

      logger.info("");
      for (const entry of manifest.templates) {
        const active = getActiveVersion(cacheDir, entry.id);
        logger.info(`${entry.id}  ${entry.name}  (latest: v${entry.latest})`);
        logger.info(`  ${entry.description}`);
        if (active !== null) {
          const updateNote =
            active === entry.latest ? "" : ` (update available -> v${entry.latest})`;
          logger.info(`  cached: v${active}${updateNote}`);
        }
      }
    });

  template
    .command("update [id]")
    .description("Download and activate the latest version of one template, or every template.")
    .option("--registry-url <url>", "Override the configured registry URL for this command.")
    .action(async (id: string | undefined, options: RegistryUrlOption) => {
      const registryUrl = resolveRegistryUrl(options);
      const cacheDir = loadConfig().cacheDir;

      let manifest: RegistryManifest;
      try {
        manifest = await logger.spinner("Fetching the template registry...", () =>
          fetchManifest(registryUrl),
        );
        writeCachedManifest(cacheDir, manifest);
      } catch (error) {
        if (error instanceof NetworkError) {
          logger.error(`Could not reach the registry: ${error.message}`);
          return;
        }
        throw error;
      }

      const targets =
        id === undefined ? manifest.templates : manifest.templates.filter((t) => t.id === id);
      if (targets.length === 0) {
        throw new ValidationError(
          `Template "${id}" isn't published in this registry.`,
          `Available: ${manifest.templates.map((t) => t.id).join(", ") || "none"}.`,
        );
      }

      for (const entry of targets) {
        const active = getActiveVersion(cacheDir, entry.id);
        if (active === entry.latest) {
          logger.info(`${entry.id} is already up to date (v${active}).`);
          continue;
        }
        try {
          await logger.spinner(`Updating ${entry.id} to v${entry.latest}...`, async () => {
            await installVersion(cacheDir, registryUrl, entry.id, entry.latest);
            activateVersion(cacheDir, entry.id, entry.latest);
          });
          logger.success(`${entry.id} updated to v${entry.latest}.`);
        } catch (error) {
          logger.warn(
            `Could not update "${entry.id}": ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });

  template
    .command("rollback <id> [version]")
    .description("Revert a template to a previously cached version (or the one before active).")
    .option("--registry-url <url>", "Override the configured registry URL for this command.")
    .action(async (id: string, version: string | undefined, options: RegistryUrlOption) => {
      const registryUrl = resolveRegistryUrl(options);
      const cacheDir = loadConfig().cacheDir;

      if (version !== undefined) {
        await logger.spinner(`Rolling back ${id} to v${version}...`, async () => {
          await installVersion(cacheDir, registryUrl, id, version);
          activateVersion(cacheDir, id, version);
        });
        logger.success(`${id} rolled back to v${version}.`);
        return;
      }

      const active = getActiveVersion(cacheDir, id);
      if (active === null) {
        throw new ConfigError(
          `Template "${id}" has no active version cached.`,
          `Run "shell template update ${id}" first.`,
        );
      }
      const cached = listCachedVersions(cacheDir, id);
      const previous = findPreviousCachedVersion(cached, active);
      if (previous === null) {
        throw new ConfigError(
          `No older cached version of "${id}" to roll back to.`,
          `Currently cached: ${cached.join(", ") || "none"}.`,
        );
      }
      activateVersion(cacheDir, id, previous);
      logger.success(`${id} rolled back to v${previous}.`);
    });
}
