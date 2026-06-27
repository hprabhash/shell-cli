import fs from "node:fs";
import path from "node:path";

import { FileSystemError } from "@hprabhash/shared";
import Handlebars from "handlebars";

// A dedicated instance (not the module-level default export) so registering
// helpers/partials here can't leak into — or be polluted by — any other
// Handlebars consumer in the same process.
const handlebars = Handlebars.create();

// Handlebars has no built-in multi-value comparison, and "conditional rendering"
// is an explicit requirement — these make `{{#if (eq orm "prisma")}}`-style
// subexpressions possible.
handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
handlebars.registerHelper("and", (...args: unknown[]) => args.slice(0, -1).every(Boolean));
handlebars.registerHelper("or", (...args: unknown[]) => args.slice(0, -1).some(Boolean));
handlebars.registerHelper("not", (a: unknown) => !a);

// `CompileOptions` isn't exported by @types/handlebars, so its shape is derived
// structurally from `compile`'s own signature instead of naming it directly.
type CompileOptions = Parameters<typeof handlebars.compile>[1];

// noEscape: true — these templates generate source code and config files, never
// HTML. Handlebars' default HTML-escaping (`"` -> `&quot;`, etc.) would corrupt
// generated code the moment a variable contained a quote.
const COMPILE_OPTIONS: CompileOptions = { noEscape: true, strict: false };

export function renderString(template: string, variables: Record<string, unknown>): string {
  try {
    const compiled = handlebars.compile(template, COMPILE_OPTIONS);
    return compiled(variables);
  } catch (error) {
    throw new FileSystemError("Failed to render template string.", undefined, error);
  }
}

export function renderFile(filePath: string, variables: Record<string, unknown>): string {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new FileSystemError(`Could not read template file at ${filePath}.`, undefined, error);
  }
  try {
    const compiled = handlebars.compile(raw, COMPILE_OPTIONS);
    return compiled(variables);
  } catch (error) {
    throw new FileSystemError(`Failed to render template file at ${filePath}.`, undefined, error);
  }
}

function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/** Registers every `*.hbs` file under `dir` as a partial, named by its path relative to `dir` (extension stripped). */
export function registerPartialsDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const filePath of walkFiles(dir)) {
    if (!filePath.endsWith(".hbs")) {
      continue;
    }
    const relative = path.relative(dir, filePath).split(path.sep).join("/");
    const name = relative.slice(0, -".hbs".length);
    handlebars.registerPartial(name, fs.readFileSync(filePath, "utf-8"));
  }
}
