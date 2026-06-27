import os from "node:os";
import path from "node:path";

import { CACHE_DIR_NAME, CONFIG_DIR_NAME, CONFIG_FILE_NAME } from "@hprabhash/shared";

export function getConfigDir(): string {
  return path.join(os.homedir(), CONFIG_DIR_NAME);
}

export function getConfigFilePath(): string {
  return path.join(getConfigDir(), CONFIG_FILE_NAME);
}

export function getDefaultCacheDir(): string {
  return path.join(getConfigDir(), CACHE_DIR_NAME);
}
