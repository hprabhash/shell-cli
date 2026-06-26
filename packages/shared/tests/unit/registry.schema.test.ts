import { describe, expect, it } from "vitest";

import {
  registryManifestSchema,
  registryTemplateEntrySchema,
  templateVersionManifestSchema,
} from "../../src/schemas/registry.schema";

describe("registryTemplateEntrySchema", () => {
  it("accepts a well-formed entry", () => {
    const result = registryTemplateEntrySchema.safeParse({
      id: "next-app",
      name: "Next.js 16 (App Router)",
      description: "Next.js 16, App Router, TypeScript, Tailwind v4.",
      latest: "1.0.0",
      versions: ["1.0.0"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-kebab-case id", () => {
    const result = registryTemplateEntrySchema.safeParse({
      id: "NextApp",
      name: "x",
      description: "x",
      latest: "1.0.0",
      versions: ["1.0.0"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty versions array", () => {
    const result = registryTemplateEntrySchema.safeParse({
      id: "next-app",
      name: "x",
      description: "x",
      latest: "1.0.0",
      versions: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("registryManifestSchema", () => {
  it("accepts a manifest with multiple templates", () => {
    const result = registryManifestSchema.safeParse({
      templates: [
        {
          id: "next-app",
          name: "Next.js",
          description: "x",
          latest: "1.0.0",
          versions: ["1.0.0"],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty templates array", () => {
    expect(registryManifestSchema.safeParse({ templates: [] }).success).toBe(true);
  });

  it("rejects a missing templates field", () => {
    expect(registryManifestSchema.safeParse({}).success).toBe(false);
  });
});

describe("templateVersionManifestSchema", () => {
  it("accepts a files map keyed by sha256 hex digests", () => {
    const result = templateVersionManifestSchema.safeParse({
      files: { "package.json": "a".repeat(64) },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a checksum that isn't a 64-char hex digest", () => {
    const result = templateVersionManifestSchema.safeParse({
      files: { "package.json": "not-a-checksum" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an uppercase checksum (hex digest must be lowercase)", () => {
    const result = templateVersionManifestSchema.safeParse({
      files: { "package.json": "A".repeat(64) },
    });
    expect(result.success).toBe(false);
  });
});
