export const APP_NAME = "shell-cli";
export const BIN_NAME = "shell";

export const CONFIG_DIR_NAME = ".shell-cli";
export const CONFIG_FILE_NAME = "config.json";
export const CACHE_DIR_NAME = "cache";

export const MIN_NODE_MAJOR_VERSION = 20;

export const NPM_REGISTRY_BASE_URL = "https://registry.npmjs.org";

/** Placeholder — the real template registry is built in Phase 7. Not a working endpoint yet. */
export const DEFAULT_REGISTRY_URL = "https://registry.shell-cli.dev/templates.json";

export const SUPPORTED_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export const SUPPORTED_DATABASES = ["postgresql"] as const;
export const SUPPORTED_ORMS = ["prisma", "drizzle"] as const;
