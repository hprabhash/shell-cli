---
"@hprabhash/plugin-next": patch
"@hprabhash/template-engine": patch
---

Fix `shell create` failing with `ENOENT ... .gitignore` for every ORM plugin
(Prisma, Drizzle) that patches the generated project's `.gitignore`. The
Next.js template's `.gitignore` file never made it into the published npm
tarball — `npm publish` treats a `.gitignore` file as packing-control input
and silently strips it, even nested deep inside template content meant to be
copied verbatim. The template now ships the dotless `gitignore`, and
`renderTemplateTree` restores the leading dot when writing it into the
generated project.
