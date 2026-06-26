import os from "node:os";
import path from "node:path";
import { z } from "zod";

import { CACHE_DIR_NAME, CONFIG_DIR_NAME, DEFAULT_REGISTRY_URL } from "../constants";

export const packageManagerSchema = z.enum(["npm", "pnpm", "yarn", "bun"]);
export const databaseSchema = z.enum(["postgresql"]);

/**
 * Schema for `~/.shell-cli/config.json`. `cacheDir`'s default is computed lazily
 * (a function, not a literal) so it respects whatever HOME/USERPROFILE is set when
 * the CLI actually runs — this matters for tests, which override the home dir.
 */
export const configSchema = z.object({
  packageManager: packageManagerSchema.nullable().default(null),
  preferredDatabase: databaseSchema.nullable().default(null),
  telemetry: z.boolean().default(false),
  registryUrl: z.url().default(DEFAULT_REGISTRY_URL),
  cacheDir: z.string().default(() => path.join(os.homedir(), CONFIG_DIR_NAME, CACHE_DIR_NAME)),
});

export type ShellCliConfig = z.infer<typeof configSchema>;
export type ShellCliConfigKey = keyof ShellCliConfig;

export const CONFIG_KEYS = configSchema.keyof().options;

export function getDefaultConfig(): ShellCliConfig {
  return configSchema.parse({});
}
