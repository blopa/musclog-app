# mobile-design — agent notes

Published as an Agent Skill; the canonical content is `SKILL.md` plus `references/`.

## Release

Distributed from GitHub `main` via `npx skills add RubenGlez/mobile-design`; there is no build or deploy pipeline. To ship: bump `metadata.version` in `SKILL.md`, prepend the matching entry to `CHANGELOG.md`, commit, then create and push an annotated tag `vX.Y.Z` on `main`. The tag is the release reference point; installers pull the current `main` tree. Licensed MIT.
