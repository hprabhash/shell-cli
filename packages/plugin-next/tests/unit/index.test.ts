import { describe, expect, it } from "vitest";

import nextPlugin from "../../src/index";

describe("plugin-next", () => {
  it("registers expected metadata", () => {
    const metadata = nextPlugin.register();
    expect(metadata.id).toBe("next");
    expect(metadata.category).toBe("framework");
  });

  it("has no extra questions", () => {
    expect(nextPlugin.questions()).toEqual([]);
  });

  it("always validates", () => {
    expect(nextPlugin.validate({})).toEqual({ valid: true, problems: [] });
  });

  it("reports no doctor checks yet", async () => {
    await expect(nextPlugin.doctor()).resolves.toEqual([]);
  });

  it("does not implement install/generate/postInstall yet", () => {
    expect("install" in nextPlugin).toBe(false);
    expect("generate" in nextPlugin).toBe(false);
    expect("postInstall" in nextPlugin).toBe(false);
  });
});
