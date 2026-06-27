import crypto from "node:crypto";

import type { EnvFileEntry } from "@hprabhash/template-engine";

import { raw, serializeObjectLiteral } from "./codegen/serialize-object";
import type { MergedBetterAuthContribution } from "./contribution";
import type { DatabaseAdapterSpec } from "./database-adapter";

export function buildAuthFileSource(
  merged: MergedBetterAuthContribution,
  databaseAdapter: DatabaseAdapterSpec,
): string {
  const lines: string[] = [
    'import { betterAuth } from "better-auth";',
    ...databaseAdapter.imports,
    ...merged.serverImports,
    "",
  ];
  if (merged.helperCode.length > 0) {
    lines.push(...merged.helperCode, "");
  }

  const configObject: Record<string, unknown> = {
    database: databaseAdapter.configValue,
    ...merged.config,
  };
  if (merged.trustedOrigins.length > 0) {
    configObject.trustedOrigins = merged.trustedOrigins;
  }
  if (merged.pluginCalls.length > 0) {
    configObject.plugins = merged.pluginCalls.map((call) => raw(call));
  }

  lines.push(`export const auth = betterAuth(${serializeObjectLiteral(configObject)});`, "");
  return lines.join("\n");
}

export function buildAuthClientFileSource(merged: MergedBetterAuthContribution): string {
  const lines: string[] = [
    'import { createAuthClient } from "better-auth/react";',
    ...merged.clientImports,
    "",
  ];

  const configObject: Record<string, unknown> = {
    baseURL: raw("process.env.BETTER_AUTH_URL"),
  };
  if (merged.clientPluginCalls.length > 0) {
    configObject.plugins = merged.clientPluginCalls.map((call) => raw(call));
  }

  lines.push(
    `export const authClient = createAuthClient(${serializeObjectLiteral(configObject)});`,
    "",
  );
  return lines.join("\n");
}

/** Static regardless of which features are selected — `toNextJsHandler` covers everything. */
export const AUTH_ROUTE_SOURCE = [
  'import { auth } from "@/lib/auth";',
  'import { toNextJsHandler } from "better-auth/next-js";',
  "",
  "export const { POST, GET } = toNextJsHandler(auth);",
  "",
].join("\n");

export function generateBetterAuthSecret(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * `betterAuthSecret` is `undefined` for `.env.example` (committed safely, no real
 * secret) and a freshly-generated value for `.env` (gitignored, app works
 * immediately without the user having to run `openssl rand -base64 32` themselves).
 * Returns entries (not file text) — Phase 6 onward, more than one plugin may
 * write into the same `.env` (e.g. a database plugin's `DATABASE_URL`), so the
 * caller merges these via `mergeEnvFile` instead of overwriting the file.
 */
export function buildBetterAuthEnvEntries(
  merged: MergedBetterAuthContribution,
  betterAuthSecret: string | undefined,
): EnvFileEntry[] {
  return [
    { key: "BETTER_AUTH_SECRET", value: betterAuthSecret ?? "" },
    { key: "BETTER_AUTH_URL", value: "http://localhost:3000" },
    ...merged.envVars,
  ];
}
