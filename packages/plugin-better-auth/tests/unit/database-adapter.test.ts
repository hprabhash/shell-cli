import { describe, expect, it } from "vitest";

import { resolveDatabaseAdapter } from "../../src/database-adapter";

describe("resolveDatabaseAdapter", () => {
  it("defaults to better-sqlite3 when no ORM is selected", () => {
    const adapter = resolveDatabaseAdapter(null);
    expect(adapter.imports).toEqual(['import Database from "better-sqlite3";']);
    expect(adapter.configValue.code).toBe('new Database("./sqlite.db")');
    expect(adapter.dependencies).toEqual({ "better-sqlite3": "^12.11.1" });
    expect(adapter.devDependencies).toEqual({ "@types/better-sqlite3": "^7.6.13" });
    expect(adapter.serverExternalPackages).toEqual(["better-sqlite3"]);
    expect(adapter.onlyBuiltDependencies).toEqual(["better-sqlite3"]);
  });

  it("returns the Prisma adapter wiring when orm is prisma", () => {
    const adapter = resolveDatabaseAdapter("prisma");
    expect(adapter.imports).toEqual([
      'import { prismaAdapter } from "@better-auth/prisma-adapter";',
      'import { prisma } from "./prisma";',
    ]);
    expect(adapter.configValue.code).toBe('prismaAdapter(prisma, { provider: "postgresql" })');
    expect(adapter.dependencies).toEqual({ "@better-auth/prisma-adapter": "^1.6.22" });
    expect(adapter.devDependencies).toEqual({});
    expect(adapter.serverExternalPackages).toEqual(["@prisma/client", "pg"]);
    expect(adapter.onlyBuiltDependencies).toEqual([]);
  });

  it("returns the Drizzle adapter wiring when orm is drizzle", () => {
    const adapter = resolveDatabaseAdapter("drizzle");
    expect(adapter.imports).toEqual([
      'import { drizzleAdapter } from "@better-auth/drizzle-adapter";',
      'import { db } from "./db";',
    ]);
    expect(adapter.configValue.code).toBe('drizzleAdapter(db, { provider: "pg" })');
    expect(adapter.dependencies).toEqual({ "@better-auth/drizzle-adapter": "^1.6.22" });
    expect(adapter.devDependencies).toEqual({});
    expect(adapter.serverExternalPackages).toEqual([]);
    expect(adapter.onlyBuiltDependencies).toEqual([]);
  });

  it("falls back to better-sqlite3 for an unrecognized ORM id", () => {
    const adapter = resolveDatabaseAdapter("typeorm");
    expect(adapter.configValue.code).toBe('new Database("./sqlite.db")');
  });
});
