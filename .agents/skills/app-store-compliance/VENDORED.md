# Vendored: app-store-compliance

A copy of <https://github.com/mjmirza/app-store-compliance>, kept here so the audit works offline and
the same version runs every time. The same copy is in the Pixel Rewind repository
(`godot-genesis-zero/rg/native-port/.agents/skills/app-store-compliance`).

| | |
|---|---|
| Upstream commit | `d2156bab9d7189835631c0a99adcc2479d32138d` (2026-11-15), `VERSION` 2.4.0 |
| Copied on | 2026-11-18 |
| Licence | OpenRoots Agent License 2.3 (`LICENSE`, `NOTICE`): free for individuals and for companies under USD 20M revenue. It does **not** grant AI training. |

What was copied: every tracked file except `.github/` (upstream's own CI). **One local change:**
`SKILL.md` at the root is upstream's `agent-os/skill/SKILL.md` plus a "Using it in Musclog" section at
the end. Claude Code finds it through the symlink `.claude/skills/app-store-compliance`. Upstream's
installer (`scripts/install.sh`) was **not** run: nothing is installed in `~/.claude`, and no hook blocks
`eas submit` or other submit commands. The guard runs only when you or an agent call it.

To update, from the repository root:

```bash
git clone https://github.com/mjmirza/app-store-compliance /tmp/asc-up
git -C /tmp/asc-up log -1 --format='%H %cs'          # the new commit, for the table above
rm -rf .agents/skills/app-store-compliance.new && mkdir .agents/skills/app-store-compliance.new
(cd /tmp/asc-up && git ls-files -z | grep -zv '^\.github/' | xargs -0 cp --parents -t "$OLDPWD/.agents/skills/app-store-compliance.new")
# carry over this file and the local section of SKILL.md, then swap the folders
```

Read the diff of `agent-os/hooks/app-store-compliance-guard.sh` before trusting a new version: it is a
1,700-line bash script that runs on the project. The copied 2.4.0 makes no network calls and deletes only
its own temporary files (checked 2026-11-18).
