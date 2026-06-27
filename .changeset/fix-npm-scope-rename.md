---
"@hprabhash/shell-cli": patch
---

Fix broken dependencies on npm: the published 0.2.0 depended on
`@shell-cli/shared`, `@shell-cli/plugin-better-auth`, and four other
`@shell-cli/*` packages that were never actually published (that scope
was never created as an npm organization), making `0.2.0` uninstallable.
All packages have been renamed to the `@hprabhash` scope, which is a real
org with publish access.
