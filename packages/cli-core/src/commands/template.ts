import type { Command } from "commander";

import { notImplementedYet } from "./_shared";

export function registerTemplateCommand(program: Command): void {
  const template = program
    .command("template")
    .description("Manage the remote template registry. (Lands in Phase 7.)");

  template
    .command("list")
    .description("List available templates.")
    .action(() => {
      notImplementedYet("The template registry", 7, "Template registry");
    });

  template
    .command("update")
    .description("Update cached templates from the remote registry.")
    .action(() => {
      notImplementedYet("The template registry", 7, "Template registry");
    });
}
