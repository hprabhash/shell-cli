/**
 * Marks a leaf value that must be emitted as literal source code (e.g.
 * `process.env.GOOGLE_CLIENT_ID as string`, `new Database("./sqlite.db")`)
 * rather than a JSON-quoted string, when passed through `serializeObjectLiteral`.
 */
export class RawCode {
  constructor(public readonly code: string) {}
}

export function raw(code: string): RawCode {
  return new RawCode(code);
}

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function serializeKey(key: string): string {
  return IDENTIFIER_PATTERN.test(key) ? key : JSON.stringify(key);
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function serializeValue(value: unknown, level: number): string {
  if (value instanceof RawCode) {
    return value.code;
  }
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((item) => `${indent(level + 1)}${serializeValue(item, level + 1)}`);
    return `[\n${items.join(",\n")},\n${indent(level)}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(
      ([key, val]) => `${indent(level + 1)}${serializeKey(key)}: ${serializeValue(val, level + 1)}`,
    );
    return `{\n${lines.join(",\n")},\n${indent(level)}}`;
  }
  throw new Error(`Cannot serialize a value of type "${typeof value}" into an object literal.`);
}

/** Serializes a plain object tree (with optional `RawCode` leaves) into a pretty-printed TS object literal. */
export function serializeObjectLiteral(value: Record<string, unknown>): string {
  return serializeValue(value, 0);
}
