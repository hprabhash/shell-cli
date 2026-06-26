import { performance } from "node:perf_hooks";

import * as clack from "@clack/prompts";

import { colors, setColorEnabled } from "./colors";

export type LogLevel = "silent" | "normal" | "verbose" | "debug";

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  normal: 1,
  verbose: 2,
  debug: 3,
};

export interface LoggerConfigureOptions {
  level?: LogLevel | undefined;
  color?: boolean | undefined;
}

/**
 * Single logging surface for the whole CLI. Configured once (from global flags) in
 * `cli.ts` before any command runs; every command imports the shared `logger`
 * instance rather than constructing its own.
 */
export class Logger {
  private level: LogLevel = "normal";

  configure(options: LoggerConfigureOptions): void {
    if (options.level !== undefined) {
      this.level = options.level;
    }
    if (options.color !== undefined) {
      setColorEnabled(options.color);
    }
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private isEnabled(min: LogLevel): boolean {
    return LEVEL_RANK[this.level] >= LEVEL_RANK[min];
  }

  info(message: string): void {
    if (this.isEnabled("normal")) console.log(message);
  }

  success(message: string): void {
    if (this.isEnabled("normal")) console.log(`${colors.green("✔")} ${message}`);
  }

  warn(message: string): void {
    if (this.isEnabled("normal")) console.warn(`${colors.yellow("⚠")} ${message}`);
  }

  /** Always prints, even in silent mode — `--silent` suppresses non-error output, not errors. */
  error(message: string): void {
    console.error(`${colors.red("✖")} ${message}`);
  }

  verbose(message: string): void {
    if (this.isEnabled("verbose")) console.log(`${colors.cyan("›")} ${message}`);
  }

  debug(message: string): void {
    if (this.isEnabled("debug")) console.log(`${colors.gray("[debug]")} ${message}`);
  }

  /** Runs `fn`, logging its duration at the verbose level regardless of success/failure. */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.verbose(`${label} (${Math.round(performance.now() - start)}ms)`);
      return result;
    } catch (error) {
      this.verbose(`${label} failed after ${Math.round(performance.now() - start)}ms`);
      throw error;
    }
  }

  /** Wraps a `@clack/prompts` spinner; fully suppressed in silent mode. */
  async spinner<T>(startMessage: string, fn: () => Promise<T>, stopMessage?: string): Promise<T> {
    if (this.level === "silent") {
      return fn();
    }
    const s = clack.spinner();
    s.start(startMessage);
    try {
      const result = await fn();
      s.stop(stopMessage ?? startMessage);
      return result;
    } catch (error) {
      s.error(startMessage);
      throw error;
    }
  }
}

export const logger = new Logger();
