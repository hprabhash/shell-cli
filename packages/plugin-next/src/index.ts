import type { CheckResult, Plugin, PluginMetadata } from "@shell-cli/shared";

const metadata: PluginMetadata = {
  id: "next",
  name: "Next.js 16 (App Router)",
  category: "framework",
  version: "0.1.0",
  description: "TypeScript + App Router + Tailwind CSS",
};

const nextPlugin: Plugin = {
  register: () => metadata,

  // No extra questions beyond choosing this framework — genuinely nothing more to ask yet.
  questions: () => [],

  validate: () => ({ valid: true, problems: [] }),

  doctor: (): Promise<CheckResult[]> => Promise.resolve([]),

  // install/generate/postInstall intentionally omitted (optional in the contract) —
  // real implementations land in Phase 4 once the template engine exists.
};

export default nextPlugin;
