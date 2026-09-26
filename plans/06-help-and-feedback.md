# Help & Feedback entry in Settings

## Goal

One place in the app to report a bug, request a feature, join the community, or email support,
with the app version and device details pre-filled so reports are useful.

## What already exists

- [app/app/settings.tsx](../app/app/settings.tsx) is a list of `SettingsCard`s that ends with
  [components/cards/LegalLinksCard.tsx](../components/cards/LegalLinksCard.tsx). That card already
  computes the build number (`Constants.expoConfig…`) and version (`package.json`), and knows the
  install source.
- An "anonymous bug report" toggle (Sentry) exists in Advanced settings; it's passive and doesn't
  let the user write anything.
- Project URLs are hardcoded in several places on the website:
  `https://github.com/blopa/musclog-app` in `components/website/WebsiteWrapper.web.tsx`,
  `WebsiteStructuredData.tsx` and `app/(website)/contact.web.tsx`, plus
  `mailto:support@musclog.app` in `faq.web.tsx`, `terms.web.tsx` and `contact.web.tsx`.
- The website's contact page already has a **Discord** card, but its `href` is `'#'`: there is no
  invite URL yet.
- `constants/misc.ts` holds `SUPPORT_PROJECT_DONATION_URL`, which is the natural home for the other
  project URLs.
- There is no `.github/ISSUE_TEMPLATE/` directory.

## Design

1. **Constants**: add `GITHUB_REPO_URL`, `SUPPORT_EMAIL` and `DISCORD_INVITE_URL` (nullable until
   one exists) to `constants/misc.ts`. Replace the hardcoded website copies with them, so the
   project URL lives in one place.
2. **Issue templates**: add `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml` with
   fields for app version, platform/OS, and language. Also add `config.yml` linking Discord/email.
3. **URL builder** (pure, testable): `utils/feedbackLinks.ts`:
   - `buildIssueUrl(kind: 'bug' | 'feature', env)` →
     `${GITHUB_REPO_URL}/issues/new?template=bug_report.yml&title=…&version=…&platform=…&locale=…`.
     GitHub issue forms pre-fill fields from query parameters whose names match the field `id`s.
   - `buildSupportMailto(env)` → `mailto:` with a subject and a short environment block in the
     body.
   - `env` = `{ appVersion, buildNumber, platform, osVersion, locale }`. **No user data, no email,
     no ids.** The link opens in the user's browser, and the user decides what to submit.
   - Share the version/build lookup with `LegalLinksCard` via a small `utils/appBuildInfo.ts`
     instead of copying it.
4. **UI**: a new `SettingsCard` "Help & feedback" in `settings.tsx` (above `LegalLinksCard`) that
   opens a `BottomPopUpMenu` with:
   - Report a bug → GitHub issue (bug template)
   - Request a feature → GitHub issue (feature template)
   - Join the community → Discord (item hidden while `DISCORD_INVITE_URL` is null)
   - Email support → mailto

   Each item closes the menu, then calls `Linking.openURL`. The menu closes first, so these are not
   modal-on-modal cases.

5. Optional: mention that the GitHub route needs an account and that email doesn't, in the item
   subtitles.

## Tests

- `utils/__tests__/feedbackLinks.test.ts`: correct template param per kind, URL-encoding of
  version/locale, mailto body contains version and platform and nothing else.
- Update `components/website/__tests__/WebsiteWrapper.test.ts` expectations if they now read from
  the constant (the values stay the same).

## Docs and translations

- Card title/subtitle and four menu item labels in all five locales.
- `CURRENT_FEATURES.md` → Profile & Settings.

## Open question

- **Discord invite URL.** The website's Discord card is still a placeholder. Create the server or
  invite link first, or ship without the Discord item.
