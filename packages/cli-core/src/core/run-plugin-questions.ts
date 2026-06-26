import type { PluginQuestionDefinition } from "@shell-cli/shared";

import { promptConfirm, promptMultiselect, promptSelect, promptText } from "./prompts";

/**
 * Turns a plugin's declarative `questions()` into a live interactive flow, keyed
 * by each question's `key`. Deferred since Phase 2 ("once a plugin with real
 * multi-question needs exists to design it against") — Better Auth's feature
 * picker is that plugin.
 */
export async function runPluginQuestions(
  questions: readonly PluginQuestionDefinition[],
): Promise<Record<string, unknown>> {
  const answers: Record<string, unknown> = {};
  for (const question of questions) {
    switch (question.type) {
      case "text":
        answers[question.key] = await promptText({
          message: question.message,
          ...(question.placeholder !== undefined && { placeholder: question.placeholder }),
        });
        break;
      case "select":
        answers[question.key] = await promptSelect({
          message: question.message,
          options: question.options,
        });
        break;
      case "multiselect":
        answers[question.key] = await promptMultiselect({
          message: question.message,
          options: question.options,
          ...(question.required !== undefined && { required: question.required }),
        });
        break;
      case "confirm":
        answers[question.key] = await promptConfirm({
          message: question.message,
          ...(question.initialValue !== undefined && { initialValue: question.initialValue }),
        });
        break;
    }
  }
  return answers;
}
