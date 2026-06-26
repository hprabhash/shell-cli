import { raw, type RawCode } from "./codegen/serialize-object";

export interface DatabaseAdapterSpec {
  imports: string[];
  configValue: RawCode;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Packages Next.js's bundler can't resolve statically and must leave to plain Node at runtime. */
  serverExternalPackages: string[];
  /** Native packages whose install/build script pnpm blocks by default — see `mergePackageJsonFragment`. */
  onlyBuiltDependencies: string[];
}

/**
 * Resolves which database Better Auth should actually talk to. When no ORM is
 * selected this is exactly Phase 5's original `better-sqlite3` behavior,
 * unchanged — Phase 6 only adds the other two branches, it doesn't touch this
 * default. `lib/prisma.ts`/`lib/db/index.ts` are written by the Prisma/Drizzle
 * plugins themselves (each owns its own ecosystem's dependencies); this only
 * owns the Better-Auth-specific adapter package that glues them together.
 */
export function resolveDatabaseAdapter(orm: string | null): DatabaseAdapterSpec {
  if (orm === "prisma") {
    return {
      // Imports directly from the adapter package rather than through
      // `better-auth/adapters/prisma` (a re-export of the same package) —
      // Next.js's Turbopack bundler fails to statically resolve that
      // wildcard re-export through pnpm's peer-hashed package layout, even
      // though plain Node resolves it fine. Same direct-import shape as the
      // Drizzle branch below.
      imports: [
        'import { prismaAdapter } from "@better-auth/prisma-adapter";',
        'import { prisma } from "./prisma";',
      ],
      configValue: raw('prismaAdapter(prisma, { provider: "postgresql" })'),
      dependencies: { "@better-auth/prisma-adapter": "^1.6.22" },
      devDependencies: {},
      // Already contributed by plugin-prisma's own next.config.ts patch —
      // listed here too since merging is append-if-missing/idempotent, and
      // Better Auth could in principle run before or without that plugin.
      serverExternalPackages: ["@prisma/client", "pg"],
      onlyBuiltDependencies: [],
    };
  }

  if (orm === "drizzle") {
    return {
      imports: [
        'import { drizzleAdapter } from "@better-auth/drizzle-adapter";',
        'import { db } from "./db";',
      ],
      configValue: raw('drizzleAdapter(db, { provider: "pg" })'),
      dependencies: { "@better-auth/drizzle-adapter": "^1.6.22" },
      devDependencies: {},
      serverExternalPackages: [],
      onlyBuiltDependencies: [],
    };
  }

  return {
    imports: ['import Database from "better-sqlite3";'],
    configValue: raw('new Database("./sqlite.db")'),
    dependencies: { "better-sqlite3": "^12.11.1" },
    devDependencies: { "@types/better-sqlite3": "^7.6.13" },
    // better-sqlite3 is a native addon — Next.js's bundler can't trace its
    // compiled .node binary and must leave it to plain Node `require` instead.
    serverExternalPackages: ["better-sqlite3"],
    // pnpm blocks better-sqlite3's own install script (which compiles/fetches
    // its native binary) by default — without this, `pnpm install` succeeds
    // but the binary is simply missing, only failing later at runtime.
    onlyBuiltDependencies: ["better-sqlite3"],
  };
}
