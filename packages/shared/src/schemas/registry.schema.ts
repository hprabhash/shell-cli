import { z } from "zod";

export const registryTemplateEntrySchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, "must be lowercase kebab-case"),
  name: z.string().min(1),
  description: z.string().min(1),
  latest: z.string().min(1),
  versions: z.array(z.string().min(1)).min(1),
});

export const registryManifestSchema = z.object({
  templates: z.array(registryTemplateEntrySchema),
});

/** Maps a template version's file paths (relative, forward-slash) to their sha256 hex digest. */
export const templateVersionManifestSchema = z.object({
  files: z.record(
    z.string().min(1),
    z.string().regex(/^[a-f0-9]{64}$/, "must be a sha256 hex digest"),
  ),
});

export type RegistryTemplateEntry = z.infer<typeof registryTemplateEntrySchema>;
export type RegistryManifest = z.infer<typeof registryManifestSchema>;
export type TemplateVersionManifest = z.infer<typeof templateVersionManifestSchema>;
