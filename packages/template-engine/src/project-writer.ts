import fs from "node:fs";
import path from "node:path";

import { FileSystemError } from "@shell-cli/shared";

/**
 * Tracks every file a generation run writes into `targetDir` so a failure
 * partway through can be rolled back cleanly: if `targetDir` didn't exist
 * before this writer was constructed, `rollback()` removes it entirely; if it
 * already existed (e.g. the user ran `create` into an empty existing folder),
 * rollback removes only what this run added.
 */
interface PatchedFile {
  fullPath: string;
  /** `null` means the file didn't exist before the patch — rollback deletes it like a fresh write. */
  originalContent: string | null;
}

export class ProjectWriter {
  private readonly targetDir: string;
  private readonly targetDirPreexisted: boolean;
  private readonly writtenFiles: string[] = [];
  private readonly patchedFiles: PatchedFile[] = [];
  private committed = false;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
    this.targetDirPreexisted = fs.existsSync(targetDir);
  }

  getWrittenFiles(): readonly string[] {
    return this.writtenFiles;
  }

  writeFile(relativePath: string, content: string): void {
    const fullPath = path.join(this.targetDir, relativePath);
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
    } catch (error) {
      throw new FileSystemError(`Could not write file at ${fullPath}.`, undefined, error);
    }
    this.writtenFiles.push(fullPath);
  }

  copyFile(sourcePath: string, relativePath: string): void {
    const fullPath = path.join(this.targetDir, relativePath);
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.copyFileSync(sourcePath, fullPath);
    } catch (error) {
      throw new FileSystemError(`Could not copy file to ${fullPath}.`, undefined, error);
    }
    this.writtenFiles.push(fullPath);
  }

  /**
   * For files a *previous* plugin's writer may have already created (e.g. a
   * shared `package.json`) — unlike `writeFile`, rollback restores the
   * original content instead of deleting a file this run didn't create.
   */
  patchFile(relativePath: string, newContent: string): void {
    const fullPath = path.join(this.targetDir, relativePath);
    try {
      const originalContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf-8") : null;
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, newContent, "utf-8");
      this.patchedFiles.push({ fullPath, originalContent });
    } catch (error) {
      throw new FileSystemError(`Could not patch file at ${fullPath}.`, undefined, error);
    }
  }

  /** Marks the run as done — a later `rollback()` call becomes a no-op. */
  commit(): void {
    this.committed = true;
    this.writtenFiles.length = 0;
    this.patchedFiles.length = 0;
  }

  rollback(): void {
    if (this.committed) {
      return;
    }

    for (const patch of [...this.patchedFiles].reverse()) {
      try {
        if (patch.originalContent === null) {
          fs.rmSync(patch.fullPath, { force: true });
        } else {
          fs.writeFileSync(patch.fullPath, patch.originalContent, "utf-8");
        }
      } catch {
        // Best-effort cleanup — a failed restore here shouldn't mask the original error.
      }
    }
    this.patchedFiles.length = 0;

    for (const filePath of [...this.writtenFiles].reverse()) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // Best-effort cleanup — a failed delete here shouldn't mask the original error.
      }
    }
    this.writtenFiles.length = 0;

    if (!this.targetDirPreexisted) {
      fs.rmSync(this.targetDir, { recursive: true, force: true });
      return;
    }

    this.pruneEmptyDirs(this.targetDir);
  }

  private pruneEmptyDirs(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        this.pruneEmptyDirs(path.join(dir, entry.name));
      }
    }
    if (dir === this.targetDir) {
      return; // never remove targetDir itself if it pre-existed
    }
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
}
