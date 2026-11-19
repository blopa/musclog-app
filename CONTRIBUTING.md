# Contributing to Musclog

Thanks for helping. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Open an issue first for larger changes** (new features, refactors, anything touching the database schema or several screens) so we can agree on the approach. Small fixes can go straight to a pull request.
- Bugs and feature requests use the [issue templates](https://github.com/blopa/musclog-app/issues/new/choose). Questions and ideas belong in [Discussions](https://github.com/blopa/musclog-app/discussions).
- Security problems: see [SECURITY.md](SECURITY.md), not a public issue.

## Setup

Prerequisites: Node.js, npm, the [Expo CLI](https://docs.expo.dev/get-started/installation/), Android Studio for Android, macOS with Xcode for iOS.

```bash
git clone https://github.com/blopa/musclog-app.git
cd musclog-app
npm install
cp .env.example .env   # every variable is optional (USDA food search key, Sentry)
npm start
```

Run on a platform with `npm run android`, `npm run ios` or `npm run web`. AI keys are entered in the app (AI settings), not in `.env`.

## Before opening a pull request

```bash
npm run lint:all                  # ESLint fixes, Prettier, prebuild and typecheck
npm test                          # Jest (watch mode; use `npx jest` for a single run)
npm run check-translations        # every used i18n key exists
npm run check-locale-consistency  # every locale has the same keys
```

Notes:

- `npm run lint:all` starts with `git add .`, so it stages everything in your working tree and prebuild can modify `app.json` and `ios/`. Commit or stash unrelated work first and review `git status` afterwards. `npm run typecheck` and `npm run lint:eslint` run those checks alone.
- Behavior changes need tests. Do not weaken or skip a valid test to make a change pass.
- New user-facing text needs translation keys in every locale under `lang/locales/`.
- UI changes: attach screenshots to the pull request.
- If a change alters behavior, architecture or an invariant, update the matching document in `docs/` in the same pull request.

## Conventions

Read [AGENTS.md](AGENTS.md) for the implementation rules and repository invariants (database layering, encryption, units, translations, platform files). UI standards are in [docs/DESIGN.md](docs/DESIGN.md).

## License

Musclog is licensed under the [GNU General Public License v3.0 or later](LICENSE). By contributing you agree that your contribution is released under GPL-3.0-or-later.
