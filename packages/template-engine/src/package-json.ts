import { FileSystemError } from "@hprabhash/shared";

export interface PackageJsonFragment {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  /**
   * Appended into `pnpm.onlyBuiltDependencies` — pnpm blocks a native
   * dependency's install/build script by default, so without this a package
   * like `better-sqlite3` installs with no compiled binary at all.
   */
  onlyBuiltDependencies?: string[];
}

interface PnpmConfig {
  onlyBuiltDependencies?: string[];
}

type MergeableKey = "dependencies" | "devDependencies" | "scripts";
const MERGEABLE_KEYS: readonly MergeableKey[] = ["dependencies", "devDependencies", "scripts"];

/**
 * Merges a fragment of dependencies/devDependencies/scripts into an existing
 * `package.json` string — for a plugin (e.g. Better Auth) adding to a
 * `package.json` a different plugin (e.g. Next.js) already wrote. Existing
 * entries are preserved; only overlapping keys are overwritten.
 */
export function mergePackageJsonFragment(
  existingJson: string,
  fragment: PackageJsonFragment,
): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(existingJson) as Record<string, unknown>;
  } catch (error) {
    throw new FileSystemError(
      "Could not parse existing package.json while merging.",
      undefined,
      error,
    );
  }

  for (const key of MERGEABLE_KEYS) {
    const incoming = fragment[key];
    if (!incoming) {
      continue;
    }
    const current = (parsed[key] as Record<string, string> | undefined) ?? {};
    parsed[key] = { ...current, ...incoming };
  }

  if (fragment.onlyBuiltDependencies && fragment.onlyBuiltDependencies.length > 0) {
    const pnpmConfig = (parsed.pnpm as PnpmConfig | undefined) ?? {};
    const existing = pnpmConfig.onlyBuiltDependencies ?? [];
    parsed.pnpm = {
      ...pnpmConfig,
      onlyBuiltDependencies: [...new Set([...existing, ...fragment.onlyBuiltDependencies])],
    };
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}
