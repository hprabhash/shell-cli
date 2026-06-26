import { mergeImportLines } from "./codegen/merge-imports";
import { RawCode } from "./codegen/serialize-object";

export interface EnvVarSpec {
  key: string;
  comment?: string;
}

/** What a single selected feature contributes toward the generated `auth.ts`/`auth-client.ts`/`package.json`/`.env`. */
export interface BetterAuthContribution {
  /** Deep-merged into the `betterAuth({...})` config object; leaf values may be `RawCode`. */
  config?: Record<string, unknown>;
  /** Entries appended to the `plugins: [...]` array in `auth.ts`. */
  pluginCalls?: string[];
  /** Deduped and appended to `trustedOrigins: [...]`. */
  trustedOrigins?: string[];
  /** Import lines for `auth.ts` — merged per module path. */
  serverImports?: string[];
  /** Entries appended to the auth client's `plugins: [...]` array. */
  clientPluginCalls?: string[];
  /** Import lines for `auth-client.ts` — merged per module path. */
  clientImports?: string[];
  /** Merged into the generated project's `package.json` dependencies. */
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** Merged into `.env`/`.env.example`, deduped by key. */
  envVars?: EnvVarSpec[];
  /** Standalone helper functions/constants inserted above the `betterAuth()` call. */
  helperCode?: string[];
}

export interface BetterAuthFeature {
  id: string;
  label: string;
  hint?: string;
  /** Other feature ids that must also be selected (e.g. `teams` requires `organization`). */
  requires?: string[];
  getContribution(selectedIds: ReadonlySet<string>): BetterAuthContribution;
}

export interface MergedBetterAuthContribution {
  config: Record<string, unknown>;
  pluginCalls: string[];
  trustedOrigins: string[];
  serverImports: string[];
  clientPluginCalls: string[];
  clientImports: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  envVars: EnvVarSpec[];
  helperCode: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof RawCode) &&
    !Array.isArray(value)
  );
}

function deepMergeConfig(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];
    result[key] =
      isPlainObject(targetValue) && isPlainObject(sourceValue)
        ? deepMergeConfig(targetValue, sourceValue)
        : sourceValue;
  }
  return result;
}

/** Folds every selected feature's contribution into one merged structure ready for codegen. */
export function mergeContributions(
  contributions: readonly BetterAuthContribution[],
): MergedBetterAuthContribution {
  let config: Record<string, unknown> = {};
  const pluginCalls: string[] = [];
  const trustedOrigins = new Set<string>();
  const serverImportLines: string[] = [];
  const clientPluginCalls: string[] = [];
  const clientImportLines: string[] = [];
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};
  const envVarsByKey = new Map<string, EnvVarSpec>();
  const helperCode: string[] = [];

  for (const contribution of contributions) {
    if (contribution.config) {
      config = deepMergeConfig(config, contribution.config);
    }
    if (contribution.pluginCalls) {
      pluginCalls.push(...contribution.pluginCalls);
    }
    if (contribution.trustedOrigins) {
      for (const origin of contribution.trustedOrigins) {
        trustedOrigins.add(origin);
      }
    }
    if (contribution.serverImports) {
      serverImportLines.push(...contribution.serverImports);
    }
    if (contribution.clientPluginCalls) {
      clientPluginCalls.push(...contribution.clientPluginCalls);
    }
    if (contribution.clientImports) {
      clientImportLines.push(...contribution.clientImports);
    }
    if (contribution.dependencies) {
      dependencies = { ...dependencies, ...contribution.dependencies };
    }
    if (contribution.devDependencies) {
      devDependencies = { ...devDependencies, ...contribution.devDependencies };
    }
    if (contribution.envVars) {
      for (const envVar of contribution.envVars) {
        envVarsByKey.set(envVar.key, envVar);
      }
    }
    if (contribution.helperCode) {
      helperCode.push(...contribution.helperCode);
    }
  }

  return {
    config,
    pluginCalls,
    trustedOrigins: [...trustedOrigins],
    serverImports: mergeImportLines(serverImportLines),
    clientPluginCalls,
    clientImports: mergeImportLines(clientImportLines),
    dependencies,
    devDependencies,
    envVars: [...envVarsByKey.values()],
    helperCode,
  };
}
