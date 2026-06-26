export interface ShellCliErrorOptions {
  code: string;
  exitCode?: number | undefined;
  hint?: string | undefined;
  cause?: unknown;
}

/**
 * Base class for every error the CLI throws intentionally. `bin.ts` is the single
 * place that catches these and turns them into formatted output + a process exit
 * code — command code should just `throw` and never call `process.exit` directly.
 */
export class ShellCliError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly hint: string | undefined;

  constructor(message: string, options: ShellCliErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "ShellCliError";
    this.code = options.code;
    this.exitCode = options.exitCode ?? 1;
    this.hint = options.hint;
  }
}

export class ValidationError extends ShellCliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "VALIDATION_ERROR", exitCode: 1, hint, cause });
    this.name = "ValidationError";
  }
}

export class ConfigError extends ShellCliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "CONFIG_ERROR", exitCode: 1, hint, cause });
    this.name = "ConfigError";
  }
}

export class FileSystemError extends ShellCliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "FILESYSTEM_ERROR", exitCode: 1, hint, cause });
    this.name = "FileSystemError";
  }
}

export class NetworkError extends ShellCliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "NETWORK_ERROR", exitCode: 1, hint, cause });
    this.name = "NetworkError";
  }
}

/** Thrown when a plugin fails to load or returns a metadata shape that fails validation. */
export class PluginError extends ShellCliError {
  constructor(message: string, hint?: string, cause?: unknown) {
    super(message, { code: "PLUGIN_ERROR", exitCode: 1, hint, cause });
    this.name = "PluginError";
  }
}

/** Thrown when a user cancels an interactive prompt (e.g. Ctrl+C). Exit code 130 matches the SIGINT convention. */
export class UserCancelledError extends ShellCliError {
  constructor(message = "Cancelled.") {
    super(message, { code: "USER_CANCELLED", exitCode: 130 });
    this.name = "UserCancelledError";
  }
}

export function isShellCliError(error: unknown): error is ShellCliError {
  return error instanceof ShellCliError;
}
