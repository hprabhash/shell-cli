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
export class ProjectWriter {
  private readonly targetDir: string;
  private readonly targetDirPreexisted: boolean;
  private readonly writtenFiles: string[] = [];
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

  /** Marks the run as done — a later `rollback()` call becomes a no-op. */
  commit(): void {
    this.committed = true;
    this.writtenFiles.length = 0;
  }

  rollback(): void {
    if (this.committed) {
      return;
    }

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
