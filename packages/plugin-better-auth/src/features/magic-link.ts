import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

const SEND_MAGIC_LINK_CALLBACK = [
  "async ({ email, url }) => {",
  "      // TODO: send this via your email provider.",
  "      console.log(`Magic link for ${email}: ${url}`);",
  "    }",
].join("\n");

export const magicLinkFeature: BetterAuthFeature = {
  id: "magic-link",
  label: "Magic Link",
  getContribution(): BetterAuthContribution {
    return {
      serverImports: ['import { magicLink } from "better-auth/plugins";'],
      pluginCalls: [
        ["magicLink({", `    sendMagicLink: ${SEND_MAGIC_LINK_CALLBACK},`, "  })"].join("\n"),
      ],
      clientImports: ['import { magicLinkClient } from "better-auth/client/plugins";'],
      clientPluginCalls: ["magicLinkClient()"],
    };
  },
};
