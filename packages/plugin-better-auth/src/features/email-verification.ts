import { raw } from "../codegen/serialize-object";
import type { BetterAuthContribution, BetterAuthFeature } from "../contribution";

const SEND_VERIFICATION_EMAIL = raw(
  [
    "async ({ user, url }) => {",
    "      // TODO: send this via your email provider.",
    "      console.log(`Verification link for ${user.email}: ${url}`);",
    "    }",
  ].join("\n"),
);

export const emailVerificationFeature: BetterAuthFeature = {
  id: "email-verification",
  label: "Email Verification",
  getContribution(): BetterAuthContribution {
    return {
      config: {
        emailVerification: {
          sendVerificationEmail: SEND_VERIFICATION_EMAIL,
        },
      },
    };
  },
};
