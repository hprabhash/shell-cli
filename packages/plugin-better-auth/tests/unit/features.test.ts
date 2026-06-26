import { describe, expect, it } from "vitest";

import type { RawCode } from "../../src/codegen/serialize-object";
import { ALL_FEATURES, getFeatureById, validateFeatureSelection } from "../../src/features";

interface SocialProvidersConfig {
  socialProviders: Record<string, { clientId: RawCode; clientSecret: RawCode }>;
}

describe("ALL_FEATURES", () => {
  it("has 19 selectable features, each with valid metadata", () => {
    expect(ALL_FEATURES).toHaveLength(19);
    for (const feature of ALL_FEATURES) {
      expect(feature.id).toMatch(/^[a-z][a-z-]*$/);
      expect(feature.label.length).toBeGreaterThan(0);
      expect(typeof feature.getContribution).toBe("function");
    }
  });

  it("has no duplicate ids", () => {
    const ids = ALL_FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every getContribution call succeeds for an empty selection", () => {
    for (const feature of ALL_FEATURES) {
      expect(() => feature.getContribution(new Set())).not.toThrow();
    }
  });
});

describe("social provider factory output (google)", () => {
  it("contributes a uniform clientId/clientSecret config and matching env vars", () => {
    const google = getFeatureById("google");
    expect(google).toBeDefined();
    const contribution = google?.getContribution(new Set());
    const config = contribution?.config as SocialProvidersConfig | undefined;
    expect(config?.socialProviders.google?.clientId.code).toBe(
      "process.env.GOOGLE_CLIENT_ID as string",
    );
    expect(config?.socialProviders.google?.clientSecret.code).toBe(
      "process.env.GOOGLE_CLIENT_SECRET as string",
    );
    expect(contribution?.envVars?.map((envVar) => envVar.key)).toEqual([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]);
  });
});

describe("apple's bespoke contribution", () => {
  it("includes the JWT signing helper, jose dependency, and trustedOrigins", () => {
    const apple = getFeatureById("apple");
    const contribution = apple?.getContribution(new Set());
    expect(contribution?.helperCode?.[0]).toContain("getAppleClientSecret");
    expect(contribution?.dependencies).toEqual({ jose: "^6.2.3" });
    expect(contribution?.trustedOrigins).toEqual(["https://appleid.apple.com"]);
    expect(contribution?.envVars?.map((envVar) => envVar.key)).toEqual([
      "APPLE_CLIENT_ID",
      "APPLE_TEAM_ID",
      "APPLE_KEY_ID",
      "APPLE_PRIVATE_KEY",
    ]);
  });
});

describe("organization + teams coupling", () => {
  it("organization's call has no options when teams isn't selected", () => {
    const organization = getFeatureById("organization");
    const contribution = organization?.getContribution(new Set(["organization"]));
    expect(contribution?.pluginCalls).toEqual(["organization()"]);
  });

  it("organization's call enables teams when teams is also selected", () => {
    const organization = getFeatureById("organization");
    const contribution = organization?.getContribution(new Set(["organization", "teams"]));
    expect(contribution?.pluginCalls?.[0]).toContain("teams: { enabled: true }");
  });
});

describe("validateFeatureSelection", () => {
  it("rejects teams without organization", () => {
    const result = validateFeatureSelection(["teams"]);
    expect(result.valid).toBe(false);
    expect(result.problems[0]).toContain("Organization");
  });

  it("rejects password-reset without email-password", () => {
    const result = validateFeatureSelection(["password-reset"]);
    expect(result.valid).toBe(false);
    expect(result.problems[0]).toContain("Email Password");
  });

  it("accepts teams+organization and password-reset+email-password together", () => {
    const result = validateFeatureSelection([
      "organization",
      "teams",
      "email-password",
      "password-reset",
    ]);
    expect(result).toEqual({ valid: true, problems: [] });
  });

  it("accepts an empty selection", () => {
    expect(validateFeatureSelection([])).toEqual({ valid: true, problems: [] });
  });

  it("rejects an unknown feature id", () => {
    const result = validateFeatureSelection(["not-a-real-feature"]);
    expect(result.valid).toBe(false);
    expect(result.problems[0]).toContain("Unknown");
  });
});
