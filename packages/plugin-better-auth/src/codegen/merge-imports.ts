const NAMED_IMPORT_PATTERN = /^import \{([^}]+)\} from "([^"]+)";$/;

/**
 * Combines multiple `import { a } from "x";` lines targeting the same module
 * path into one `import { a, b } from "x";` line — features independently
 * declare their own imports, and several plugins commonly import from the same
 * `better-auth/plugins` module path.
 */
export function mergeImportLines(lines: readonly string[]): string[] {
  const namesByModule = new Map<string, Set<string>>();
  const moduleOrder: string[] = [];
  const passthrough: string[] = [];

  for (const line of lines) {
    const match = NAMED_IMPORT_PATTERN.exec(line.trim());
    const namesPart = match?.[1];
    const modulePath = match?.[2];
    if (namesPart === undefined || modulePath === undefined) {
      passthrough.push(line);
      continue;
    }

    let names = namesByModule.get(modulePath);
    if (!names) {
      names = new Set<string>();
      namesByModule.set(modulePath, names);
      moduleOrder.push(modulePath);
    }
    for (const name of namesPart.split(",")) {
      names.add(name.trim());
    }
  }

  const merged = moduleOrder.map((modulePath) => {
    const names = [...(namesByModule.get(modulePath) ?? [])];
    return `import { ${names.join(", ")} } from "${modulePath}";`;
  });

  return [...passthrough, ...merged];
}
