import fs from "node:fs";

import {
  ConfigError,
  configSchema,
  getDefaultConfig,
  type ShellCliConfig,
  type ShellCliConfigKey,
} from "@hprabhash/shared";

import { getConfigDir, getConfigFilePath } from "./paths";

export function loadConfig(): ShellCliConfig {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) {
    return getDefaultConfig();
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new ConfigError(`Could not read config file at ${filePath}.`, undefined, error);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(
      `Config file at ${filePath} is not valid JSON.`,
      "Run `shell config reset` to restore defaults.",
      error,
    );
  }

  const result = configSchema.safeParse(parsedJson);
  if (!result.success) {
    throw new ConfigError(
      `Config file at ${filePath} failed validation: ${result.error.issues.map((i) => i.message).join("; ")}`,
      "Run `shell config reset` to restore defaults.",
    );
  }
  return result.data;
}

/** Writes via a temp-file-then-rename so a crash mid-write can't corrupt the config. */
export function saveConfig(config: ShellCliConfig): void {
  const dir = getConfigDir();
  const filePath = getConfigFilePath();
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    throw new ConfigError(`Could not write config file at ${filePath}.`, undefined, error);
  }
}

export function getConfigValue(key: ShellCliConfigKey): unknown {
  return loadConfig()[key];
}

function coerceValue(key: ShellCliConfigKey, rawValue: string): unknown {
  if (key === "telemetry") {
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
    throw new ConfigError(`"telemetry" must be "true" or "false", got "${rawValue}".`);
  }
  if (key === "packageManager" || key === "preferredDatabase") {
    return rawValue === "null" || rawValue === "none" ? null : rawValue;
  }
  return rawValue;
}

export function setConfigValue(key: ShellCliConfigKey, rawValue: string): ShellCliConfig {
  const current = loadConfig();
  const candidate: Record<string, unknown> = { ...current, [key]: coerceValue(key, rawValue) };
  const result = configSchema.safeParse(candidate);
  if (!result.success) {
    throw new ConfigError(
      `Invalid value for "${key}": "${rawValue}".`,
      result.error.issues.map((i) => i.message).join("; "),
    );
  }
  saveConfig(result.data);
  return result.data;
}

export function resetConfig(): ShellCliConfig {
  const defaults = getDefaultConfig();
  saveConfig(defaults);
  return defaults;
}
