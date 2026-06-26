export interface EnvFileEntry {
  key: string;
  value?: string;
  comment?: string;
}

/**
 * Appends entries whose key (the `KEY=` prefix) isn't already present —
 * never overwrites an existing value. Needed once more than one plugin writes
 * into the same `.env`/`.env.example` (e.g. a database plugin's `DATABASE_URL`
 * and an auth plugin's `BETTER_AUTH_SECRET`).
 */
export function mergeEnvFile(
  existingContent: string | null,
  entries: readonly EnvFileEntry[],
): string {
  const existingKeys = new Set<string>();
  if (existingContent !== null) {
    for (const line of existingContent.split("\n")) {
      const match = /^([A-Z0-9_]+)=/.exec(line.trim());
      if (match?.[1] !== undefined) {
        existingKeys.add(match[1]);
      }
    }
  }

  const additions: string[] = [];
  for (const entry of entries) {
    if (existingKeys.has(entry.key)) {
      continue;
    }
    if (entry.comment !== undefined) {
      additions.push(`# ${entry.comment}`);
    }
    additions.push(`${entry.key}=${entry.value ?? ""}`);
  }

  if (additions.length === 0) {
    return existingContent ?? "";
  }

  const base =
    existingContent !== null && existingContent.trim().length > 0
      ? `${existingContent.replace(/\n+$/, "")}\n\n`
      : "";
  return `${base}${additions.join("\n")}\n`;
}
