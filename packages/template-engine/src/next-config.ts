const NEXT_CONFIG_DECLARATION = "const nextConfig: NextConfig = {";
const SERVER_EXTERNAL_PACKAGES_PATTERN = /serverExternalPackages:\s*\[([^\]]*)\]/;

function parsePackageList(arrayBody: string): string[] {
  const matches = arrayBody.match(/"([^"]+)"/g) ?? [];
  return matches.map((entry) => entry.slice(1, -1));
}

/**
 * Appends to (or creates) `next.config.ts`'s `serverExternalPackages` array —
 * needed whenever a native/WASM-backed package (Prisma's generated client,
 * `better-sqlite3`, ...) can't be resolved by Next.js's bundler and must be
 * left to plain Node `require`/`import` at runtime instead. Append-if-missing,
 * the same non-clobbering style as `mergeEnvFile`/`appendGitignoreEntries`,
 * since more than one plugin (an ORM, Better Auth, ...) may need to contribute
 * entries to the same file.
 */
export function mergeNextConfigServerExternalPackages(
  existingContent: string,
  packages: readonly string[],
): string {
  if (packages.length === 0) {
    return existingContent;
  }

  const existingMatch = SERVER_EXTERNAL_PACKAGES_PATTERN.exec(existingContent);
  if (existingMatch?.[1] !== undefined) {
    const existingPackages = parsePackageList(existingMatch[1]);
    const merged = [...new Set([...existingPackages, ...packages])];
    return existingContent.replace(
      SERVER_EXTERNAL_PACKAGES_PATTERN,
      `serverExternalPackages: [${merged.map((pkg) => `"${pkg}"`).join(", ")}]`,
    );
  }

  if (!existingContent.includes(NEXT_CONFIG_DECLARATION)) {
    return existingContent;
  }
  const list = packages.map((pkg) => `"${pkg}"`).join(", ");
  return existingContent.replace(
    NEXT_CONFIG_DECLARATION,
    `${NEXT_CONFIG_DECLARATION}\n  serverExternalPackages: [${list}],`,
  );
}
