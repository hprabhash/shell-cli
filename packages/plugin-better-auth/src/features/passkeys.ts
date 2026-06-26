import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

/** Covers the spec's separate "WebAuthn" item too — same underlying feature in Better Auth, no separate plugin. */
export const passkeysFeature: BetterAuthFeature = {
  id: "passkeys",
  label: "Passkeys (WebAuthn)",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { passkey } from "@better-auth/passkey";'],
      pluginCalls: ["passkey()"],
      clientImports: ['import { passkeyClient } from "@better-auth/passkey/client";'],
      clientPluginCalls: ["passkeyClient()"],
      dependencies: { "@better-auth/passkey": "^1.6.22" },
    };
  },
};
