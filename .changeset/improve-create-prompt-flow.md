---
"@hprabhash/shell-cli": minor
---

Improve the `shell create` prompt flow:

- Better Auth's feature multiselect now runs immediately after choosing
  Better Auth, instead of being deferred until after package
  manager/git/install — it's a direct continuation of that choice, not a
  separate, later one.
- Selected Better Auth features are shown in a nicely formatted list right
  after picking them, instead of only appearing in the final plan dump.
- Before any file is written, a "Review your stack" summary now shows every
  resolved choice (framework, ORM, database, auth + features, package
  manager, git/install) and asks for confirmation — skipped automatically
  under `--yes`.
- Framework and database pickers now also list roadmap items with no plugin
  yet (React, Vue, Nuxt; MySQL) as visible but disabled "Coming soon"
  options, instead of only ever showing what's already implemented.
