import { FileSystemError } from "@shell-cli/shared";

export interface PackageJsonFragment {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
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

  return `${JSON.stringify(parsed, null, 2)}\n`;
}
