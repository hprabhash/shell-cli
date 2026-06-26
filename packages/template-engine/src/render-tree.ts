import fs from "node:fs";
import path from "node:path";

import { FileSystemError } from "@shell-cli/shared";

import { registerPartialsDir, renderFile } from "./engine";
import { ProjectWriter } from "./project-writer";

const TEMPLATE_EXTENSION = ".hbs";
/** A directory named `_partials` anywhere under the template root is registered as partials and excluded from output, same idea as Eleventy's `_includes`. */
const PARTIALS_DIR_NAME = "_partials";

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith("_")) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function destRelativePath(templateRootDir: string, sourceFile: string): string {
  const relative = path.relative(templateRootDir, sourceFile);
  return sourceFile.endsWith(TEMPLATE_EXTENSION)
    ? relative.slice(0, -TEMPLATE_EXTENSION.length)
    : relative;
}

export interface RenderTreeResult {
  filesWritten: string[];
}

/**
 * Renders every file under `templateRootDir` into `targetDir`: `*.hbs` files are
 * rendered through Handlebars (extension stripped from the output name);
 * everything else is copied byte-for-byte. On any failure, the partial output is
 * rolled back via `ProjectWriter` before the error propagates — this is the
 * "rollback partially generated projects" guarantee.
 */
export function renderTemplateTree(
  templateRootDir: string,
  targetDir: string,
  variables: Record<string, unknown>,
): Promise<RenderTreeResult> {
  // Everything here is synchronous today, but the public API is Promise-based —
  // consistent with the rest of the codebase's async I/O — so future plugins can
  // do real async work in generate() without a breaking signature change. Wrapping
  // the whole body in `.then()` (rather than `async`) turns any synchronous throw
  // into a proper rejection without an `await`-less async function.
  return Promise.resolve().then(() => {
    if (!fs.existsSync(templateRootDir)) {
      throw new FileSystemError(`Template directory not found: ${templateRootDir}`);
    }

    // Partial names are relative to _partials itself, not the template root — a file at
    // `_partials/header.hbs` is referenced in templates as `{{> header}}`, not `{{> _partials/header}}`.
    registerPartialsDir(path.join(templateRootDir, PARTIALS_DIR_NAME));

    const writer = new ProjectWriter(targetDir);
    const sourceFiles = walk(templateRootDir);

    try {
      for (const sourceFile of sourceFiles) {
        const relativeDest = destRelativePath(templateRootDir, sourceFile);
        if (sourceFile.endsWith(TEMPLATE_EXTENSION)) {
          writer.writeFile(relativeDest, renderFile(sourceFile, variables));
        } else {
          writer.copyFile(sourceFile, relativeDest);
        }
      }
    } catch (error) {
      writer.rollback();
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError(
        "Failed to render template tree; changes were rolled back.",
        undefined,
        error,
      );
    }

    const filesWritten = [...writer.getWrittenFiles()];
    writer.commit();
    return { filesWritten };
  });
}
