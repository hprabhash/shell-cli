/**
 * Appends lines not already present (exact match) — never duplicates entries
 * when more than one plugin wants to add to the same `.gitignore` (e.g. Next.js
 * and Prisma's generated-client output directory).
 */
export function appendGitignoreEntries(
  existingContent: string,
  entries: readonly string[],
): string {
  const existingLines = new Set(existingContent.split("\n").map((line) => line.trim()));
  const additions = entries.filter((entry) => !existingLines.has(entry));
  if (additions.length === 0) {
    return existingContent;
  }
  const base = existingContent.replace(/\n+$/, "");
  return `${base}\n\n${additions.join("\n")}\n`;
}
