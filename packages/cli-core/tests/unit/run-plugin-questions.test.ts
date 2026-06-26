import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/prompts", () => ({
  promptText: vi.fn().mockResolvedValue("text-answer"),
  promptSelect: vi.fn().mockResolvedValue("select-answer"),
  promptMultiselect: vi.fn().mockResolvedValue(["a", "b"]),
  promptConfirm: vi.fn().mockResolvedValue(true),
}));

import { promptConfirm, promptMultiselect, promptSelect, promptText } from "../../src/core/prompts";
import { runPluginQuestions } from "../../src/core/run-plugin-questions";

describe("runPluginQuestions", () => {
  it("dispatches each question type and keys answers by question.key", async () => {
    const answers = await runPluginQuestions([
      { type: "text", key: "name", message: "Name?" },
      { type: "select", key: "choice", message: "Pick one", options: [{ value: "x", label: "X" }] },
      {
        type: "multiselect",
        key: "features",
        message: "Pick some",
        options: [{ value: "a", label: "A" }],
      },
      { type: "confirm", key: "ok", message: "OK?" },
    ]);

    expect(answers).toEqual({
      name: "text-answer",
      choice: "select-answer",
      features: ["a", "b"],
      ok: true,
    });
    expect(promptText).toHaveBeenCalledWith({ message: "Name?" });
    expect(promptSelect).toHaveBeenCalledWith({
      message: "Pick one",
      options: [{ value: "x", label: "X" }],
    });
    expect(promptMultiselect).toHaveBeenCalledWith({
      message: "Pick some",
      options: [{ value: "a", label: "A" }],
    });
    expect(promptConfirm).toHaveBeenCalledWith({ message: "OK?" });
  });

  it("returns an empty object for no questions", async () => {
    expect(await runPluginQuestions([])).toEqual({});
  });
});
