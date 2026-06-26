export const APP_NAME = "shell-cli";
export const BIN_NAME = "shell";

export const CONFIG_DIR_NAME = ".shell-cli";
export const CONFIG_FILE_NAME = "config.json";
export const CACHE_DIR_NAME = "cache";

export const MIN_NODE_MAJOR_VERSION = 20;

export const NPM_REGISTRY_BASE_URL = "https://registry.npmjs.org";

/**
 * The real registry manifest, served straight out of this repo's own `registry/`
 * directory via raw.githubusercontent.com. Every other registry resource (a
 * template version's manifest, its files) is resolved as a relative URL against
 * this one — see `core/registry-client.ts`.
 */
export const DEFAULT_REGISTRY_URL =
  "https://raw.githubusercontent.com/hprabhash/shell-cli/main/registry/templates.json";

export const TEMPLATES_CACHE_SUBDIR_NAME = "templates";
export const REGISTRY_MANIFEST_CACHE_FILE_NAME = "registry-manifest.json";

export const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
