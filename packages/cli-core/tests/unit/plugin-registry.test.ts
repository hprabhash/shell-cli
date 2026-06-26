import { describe, expect, it } from "vitest";

import type { Plugin } from "@shell-cli/shared";

import {
  collectPluginDoctorResults,
  findPluginById,
  getAllPlugins,
  getPluginMetadata,
  getPluginsByCategory,
} from "../../src/core/plugin-registry";

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    register: () => ({ id: "fixture", name: "Fixture", category: "auth", version: "1.0.0" }),
    questions: () => [],
    validate: () => ({ valid: true, problems: [] }),
    doctor: () => Promise.resolve([]),
    ...overrides,
  };
}

describe("getAllPlugins / getPluginsByCategory / findPluginById", () => {
  it("includes the real built-in plugins by default", () => {
    expect(getAllPlugins().length).toBeGreaterThan(0);
    expect(findPluginById("next")).toBeDefined();
    expect(findPluginById("prisma")).toBeDefined();
    expect(findPluginById("drizzle")).toBeDefined();
    expect(findPluginById("postgresql")).toBeDefined();
    expect(findPluginById("better-auth")).toBeDefined();
  });

  it("categorizes the new Phase 6 plugins correctly", () => {
    expect(getPluginsByCategory("orm").map((p) => getPluginMetadata(p).id)).toEqual(
      expect.arrayContaining(["prisma", "drizzle"]),
    );
    expect(getPluginsByCategory("database").map((p) => getPluginMetadata(p).id)).toEqual(
      expect.arrayContaining(["postgresql"]),
    );
  });

  it("filters by category against an injected plugin list", () => {
    const auth = makePlugin();
    const framework = makePlugin({
      register: () => ({
        id: "fake-framework",
        name: "Fake",
        category: "framework",
        version: "1.0.0",
      }),
    });
    const plugins = [auth, framework];

    expect(getPluginsByCategory("auth", plugins)).toEqual([auth]);
    expect(getPluginsByCategory("framework", plugins)).toEqual([framework]);
    expect(getPluginsByCategory("orm", plugins)).toEqual([]);
  });

  it("finds a plugin by id against an injected plugin list", () => {
    const plugin = makePlugin();
    expect(findPluginById("fixture", [plugin])).toBe(plugin);
    expect(findPluginById("missing", [plugin])).toBeUndefined();
  });

  it("throws PluginError for a plugin with invalid metadata", () => {
    const broken = makePlugin({
      register: () => ({ id: "NOT-KEBAB-CASE", name: "Bad", category: "auth", version: "1.0.0" }),
    });
    expect(() => getPluginMetadata(broken)).toThrow(/invalid metadata/);
  });
});

describe("collectPluginDoctorResults", () => {
  it("prefixes each result's label with the plugin id", async () => {
    const plugin = makePlugin({
      doctor: () =>
        Promise.resolve([
          { id: "check", label: "Some check", status: "warn" as const, message: "hmm" },
        ]),
    });
    const results = await collectPluginDoctorResults([plugin]);
    expect(results).toEqual([
      { id: "check", label: "[fixture] Some check", status: "warn", message: "hmm" },
    ]);
  });

  it("returns an empty array when no plugins contribute checks", async () => {
    const results = await collectPluginDoctorResults([makePlugin()]);
    expect(results).toEqual([]);
  });
});
