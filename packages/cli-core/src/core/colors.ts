import pc from "picocolors";

/**
 * picocolors decides color support once, at import time, based on TTY/env — too
 * early to react to our own `--no-color` flag. This wraps each function behind a
 * mutable flag checked at call time instead, so `setColorEnabled` can flip it after
 * argument parsing.
 */
let colorEnabled = pc.isColorSupported;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

function wrap(fn: (input: string) => string): (input: string) => string {
  return (input: string) => (colorEnabled ? fn(input) : input);
}

export const colors = {
  red: wrap(pc.red),
  green: wrap(pc.green),
  yellow: wrap(pc.yellow),
  blue: wrap(pc.blue),
  cyan: wrap(pc.cyan),
  gray: wrap(pc.gray),
  bold: wrap(pc.bold),
  dim: wrap(pc.dim),
};
