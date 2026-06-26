import fs from "node:fs";

import { ValidationError } from "@shell-cli/shared";

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_LENGTH = 214;

export interface ProjectNameValidation {
  valid: boolean;
  problems: string[];
}

export function validateProjectName(name: string): ProjectNameValidation {
  const problems: string[] = [];
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    problems.push("Project name cannot be empty.");
  } else {
    if (trimmed.length > MAX_LENGTH) {
      problems.push(`Project name must be ${MAX_LENGTH} characters or fewer.`);
    }
    if (trimmed !== trimmed.toLowerCase()) {
      problems.push("Project name must be lowercase.");
    }
    if (!NAME_PATTERN.test(trimmed.toLowerCase())) {
      problems.push(
        "Project name may only contain lowercase letters, numbers, dots, hyphens, and underscores, and must start with a letter or number.",
      );
    }
  }

  return { valid: problems.length === 0, problems };
}

export function assertValidProjectName(name: string): void {
  const result = validateProjectName(name);
  if (!result.valid) {
    throw new ValidationError(`"${name}" is not a valid project name.`, result.problems.join(" "));
  }
}

export interface TargetDirectoryState {
  exists: boolean;
  isEmpty: boolean;
}

export function describeTargetDirectory(targetDir: string): TargetDirectoryState {
  if (!fs.existsSync(targetDir)) {
    return { exists: false, isEmpty: true };
  }
  const entries = fs.readdirSync(targetDir);
  return { exists: true, isEmpty: entries.length === 0 };
}
