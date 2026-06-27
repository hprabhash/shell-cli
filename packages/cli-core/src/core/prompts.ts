import * as clack from "@clack/prompts";

import { UserCancelledError } from "@hprabhash/shared";

/**
 * `@clack/prompts` signals cancellation (Ctrl+C) by resolving with a special symbol
 * rather than rejecting. Centralizing the `isCancel` check here means every call
 * site gets the same behavior — throw `UserCancelledError` — instead of each
 * command having to remember to check.
 */
function unwrapOrThrow<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    throw new UserCancelledError();
  }
  return value;
}

export interface TextPromptOptions {
  message: string;
  placeholder?: string | undefined;
  defaultValue?: string | undefined;
  initialValue?: string | undefined;
  /** Matches clack's `Validate<string>` shape — called with `undefined` for empty input. */
  validate?: ((value: string | undefined) => string | undefined) | undefined;
}

export async function promptText(options: TextPromptOptions): Promise<string> {
  const result = await clack.text({
    message: options.message,
    ...(options.placeholder !== undefined && { placeholder: options.placeholder }),
    ...(options.defaultValue !== undefined && { defaultValue: options.defaultValue }),
    ...(options.initialValue !== undefined && { initialValue: options.initialValue }),
    ...(options.validate !== undefined && { validate: options.validate }),
  });
  return unwrapOrThrow(result);
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string | undefined;
  /** Visible but not selectable — clack rejects Enter on it. Used for roadmap items that aren't built yet. */
  disabled?: boolean | undefined;
}

// `clack.Option<T>` is a conditional type keyed on a generic `T`, which TypeScript can't
// fully resolve until `T` is a concrete literal — the cast below is a narrow, deliberate
// escape from that inference limitation, not a loosening of our own option shape.
function toClackOptions<T extends string>(options: SelectOption<T>[]): clack.Option<T>[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    ...(option.hint !== undefined && { hint: option.hint }),
    ...(option.disabled !== undefined && { disabled: option.disabled }),
  })) as clack.Option<T>[];
}

export interface SelectPromptOptions<T extends string> {
  message: string;
  options: SelectOption<T>[];
  initialValue?: T | undefined;
}

export async function promptSelect<T extends string>(options: SelectPromptOptions<T>): Promise<T> {
  const result = await clack.select<T>({
    message: options.message,
    options: toClackOptions(options.options),
    ...(options.initialValue !== undefined && { initialValue: options.initialValue }),
  });
  return unwrapOrThrow(result);
}

export interface MultiselectPromptOptions<T extends string> {
  message: string;
  options: SelectOption<T>[];
  initialValues?: T[] | undefined;
  required?: boolean | undefined;
}

export async function promptMultiselect<T extends string>(
  options: MultiselectPromptOptions<T>,
): Promise<T[]> {
  const result = await clack.multiselect<T>({
    message: options.message,
    options: toClackOptions(options.options),
    required: options.required ?? false,
    ...(options.initialValues !== undefined && { initialValues: options.initialValues }),
  });
  return unwrapOrThrow(result);
}

export interface ConfirmPromptOptions {
  message: string;
  initialValue?: boolean | undefined;
}

export async function promptConfirm(options: ConfirmPromptOptions): Promise<boolean> {
  const result = await clack.confirm({
    message: options.message,
    ...(options.initialValue !== undefined && { initialValue: options.initialValue }),
  });
  return unwrapOrThrow(result);
}

export function intro(message: string): void {
  clack.intro(message);
}

export function outro(message: string): void {
  clack.outro(message);
}

export function note(message: string, title?: string): void {
  clack.note(message, title);
}

export function cancelMessage(message: string): void {
  clack.cancel(message);
}
