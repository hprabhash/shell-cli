import type { BetterAuthFeature } from "../contribution";
import { accountLinkingFeature } from "./account-linking";
import { adminFeature } from "./admin";
import { apiKeysFeature } from "./api-keys";
import { appleFeature } from "./apple";
import { discordFeature } from "./discord";
import { emailPasswordFeature } from "./email-password";
import { emailVerificationFeature } from "./email-verification";
import { githubFeature } from "./github";
import { googleFeature } from "./google";
import { magicLinkFeature } from "./magic-link";
import { microsoftFeature } from "./microsoft";
import { multiSessionFeature } from "./multi-session";
import { organizationFeature } from "./organization";
import { passkeysFeature } from "./passkeys";
import { passwordResetFeature } from "./password-reset";
import { rateLimitingFeature } from "./rate-limiting";
import { sessionManagementFeature } from "./session-management";
import { teamsFeature } from "./teams";
import { twoFactorFeature } from "./two-factor";

/** All 19 selectable Better Auth features (the spec's 20-item list minus the WebAuthn/Passkeys dedup — see `passkeys.ts`). */
export const ALL_FEATURES: readonly BetterAuthFeature[] = [
  emailPasswordFeature,
  emailVerificationFeature,
  passwordResetFeature,
  rateLimitingFeature,
  sessionManagementFeature,
  accountLinkingFeature,
  googleFeature,
  githubFeature,
  discordFeature,
  microsoftFeature,
  appleFeature,
  magicLinkFeature,
  twoFactorFeature,
  organizationFeature,
  teamsFeature,
  multiSessionFeature,
  adminFeature,
  passkeysFeature,
  apiKeysFeature,
];

export function getFeatureById(id: string): BetterAuthFeature | undefined {
  return ALL_FEATURES.find((feature) => feature.id === id);
}

export interface FeatureValidationResult {
  valid: boolean;
  problems: string[];
}

/** Checks every selected feature's `requires` are also selected (covers teams->organization, password-reset->email-password, etc. generically). */
export function validateFeatureSelection(selectedIds: readonly string[]): FeatureValidationResult {
  const selectedSet = new Set(selectedIds);
  const problems: string[] = [];

  for (const id of selectedIds) {
    const feature = getFeatureById(id);
    if (!feature) {
      problems.push(`Unknown Better Auth feature "${id}".`);
      continue;
    }
    for (const requiredId of feature.requires ?? []) {
      if (!selectedSet.has(requiredId)) {
        const requiredLabel = getFeatureById(requiredId)?.label ?? requiredId;
        problems.push(`"${feature.label}" requires "${requiredLabel}" to also be selected.`);
      }
    }
  }

  return { valid: problems.length === 0, problems };
}
