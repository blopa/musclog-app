# App Store publishing

The App Store side of [GOOGLE_PLAY.md](GOOGLE_PLAY.md), with the same shape: a setup script, a release script
with a gate before every upload, and the listing as files. It uses
[`asc`](https://github.com/rorkai/App-Store-Connect-CLI) (rorkai/App-Store-Connect-CLI, pinned at 6.3.0), a
command-line client for the App Store Connect API. **It runs on Linux.** Builds stay on EAS (cloud, profile
`production`), so no Mac and no Xcode are needed; there is no Xcode Cloud.

| Script                      | Google Play counterpart      | Does                                                                                                  |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `scripts/setup-asc.sh`      | `setup-gplay.sh`             | Installs asc (pinned, SHA-256 checked), signs in, checks the app and group.                           |
| `scripts/release-ios.sh`    | `release-android.sh`         | `check`, `build`, `testflight`, `submit`, `status`, `review`.                                         |
| `scripts/appstore.sh`       | `play.sh`                    | The listing as files: `pull`, `plan`, `up`, `validate`, `audit`, `from-listing`.                      |
| `scripts/appstore-guard.sh` | `gplay preflight` + its gate | The compliance gate (`appstore_guard_gate.py`); known false positives in `appstore-guard-known.json`. |
| `scripts/lib/asc-common.sh` | `gplay-common.sh`            | Shared helpers: the `musclog` profile, app id from `eas.json`, versions from `app.json`.              |

## Setup (new machine)

One-time, in App Store Connect (only you can do these):

1. **An API key**: Users and Access → Integrations → App Store Connect API → Team Keys → (+), name
   "Musclog CLI", access **App Manager** (TestFlight, metadata, submissions). Download the `.p8` straight away
   (Apple offers it once) to `~/keys/musclog-asc-AuthKey.p8` (or keep Apple's `~/keys/AuthKey_<KEYID>.p8`
   name), outside the repo, and note the **Key ID** and the **Issuer ID** (shown above the table).
2. **A TestFlight group** for new builds (TestFlight → Internal Testing → (+)), if the app has none. Or:
   `asc testflight groups create --app 6761317034 --name "Internal Testers" --internal --access-all-builds`.

Then, on each machine:

```
scripts/setup-asc.sh --key-id KEYID --issuer-id ISSUER_ID      # later runs need no options
scripts/setup-asc.sh --group "Internal Testers"                 # when there is more than one group
scripts/setup-asc.sh --bypass-keychain ...                      # a machine without a system keychain
```

It is safe to run again. It installs asc into `~/.local/bin` (downloaded to a temp folder and checked against
the SHA-256 recorded in `lib/asc-common.sh`, never piped to a shell), signs in under the profile **`musclog`**
(`MUSCLOG_ASC_PROFILE` overrides; a plain `ASC_PROFILE` in your shell is ignored on purpose, so this repo never
acts as another app) and puts back whichever profile was the machine's default. It checks that the app with
bundle id `com.werules.logger` is the `ascAppId` in `eas.json` (the one place the app id lives), that the
TestFlight group exists (its name goes to `ios/appstore/app.json`, committed, nothing secret) and prints what
is still **MISSING**. With `--bypass-keychain` the profile is stored in `~/.asc/config.json`; then export
`MUSCLOG_ASC_BYPASS_KEYCHAIN=1` in your shell profile. Every script exports `ASC_PROFILE=musclog`,
`ASC_STRICT_AUTH=true`, `ASC_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1`. For an ad hoc command:
`ASC_PROFILE=musclog ASC_STRICT_AUTH=true asc ...`.

## Releasing

Like the Android scripts, nothing here bumps the version: `npm run bump-app-version` does (it keeps
`app.json`, the Android and the iOS native files in step; `expo.ios.buildNumber` must rise with every upload of
one version).

```
npm run bump-app-version                              # you bump; the scripts never do
scripts/release-ios.sh check                          # offline: versions, the compliance gate, a signed-in profile
scripts/release-ios.sh check --online                 # also: the key is valid, the build number is above App Store Connect's
scripts/release-ios.sh build                          # check, then an EAS production build; writes .release/musclog-<v>-<build>.ipa
scripts/release-ios.sh testflight --dry-run           # prints what would run, builds and uploads nothing
scripts/release-ios.sh testflight [--group NAME]      # check --online, build, upload, wait for processing, add to the group
scripts/release-ios.sh testflight --skip-build [--ipa FILE]
scripts/release-ios.sh submit --latest --dry-run      # what staging would change, and asc validate's verdict
scripts/release-ios.sh submit --latest                # stage the version, validate, send to App Review (asks first)
scripts/release-ios.sh status                         # builds, TestFlight, review and release in one table
scripts/release-ios.sh review                         # App Review's state and the next step
```

- **`build`** runs `eas build --platform ios --profile production --non-interactive --wait --json` on the
  committed `project.pbxproj`. It deliberately does not run `scripts/prepare-for-eas.js` (which `npm run
build-ios` does): that script is stale, strips the `ExpoWidgetsTarget` dependency out of the project and makes
  EAS fail with "Cannot read properties of undefined (reading '<id>')". If that error ever shows up, `git status`
  will show a modified `project.pbxproj`; `git checkout` it. EAS builds iOS locally only on a Mac, so there is
  no `--local`. It needs EAS credentials set up once (`npm run eas-login`; the first build may have to be
  interactive).
- **`testflight`** uploads the `.ipa` with `asc builds upload` (EAS's `submit` asks for an Apple login unless EAS
  holds an API key; `--eas-submit` uses it anyway), waits for Apple to process it, then adds the build to the
  group(s). `--group` and `testflightGroup` in `ios/appstore/app.json` take a comma-separated list
  (`"Main Testers,Main External Testers"`). Internal groups need no review. **External groups need Beta App
  Review**: add `--beta-review` and the script submits the build for it (`asc builds add-groups --submit
--confirm`). App Store Connect must have the beta app information (description, feedback email, contact) and
  "What to test" filled in once, or `asc` stops before submitting. Later builds of an approved version usually
  reach external testers without a new review.
- **`submit`** stages the version (creates it if needed, applies `ios/appstore/metadata`, attaches the build),
  runs `asc validate`, which must pass (age rating, privacy policy URL, screenshots, review contact, export
  compliance…), then creates the review submission and sends it. `--dry-run` stops after the validation report.
  After approval the version is released by its release setting in App Store Connect (manual by default).
- `ITSAppUsesNonExemptEncryption` is `false` in `app.json`, so builds do not wait on export compliance.

## The compliance gate

Every `check` (so every `build`, `testflight` and `submit`) runs `scripts/appstore-guard.sh`: the vendored
[app-store-compliance](../.agents/skills/app-store-compliance/VENDORED.md) guard, run standalone (project path
as the argument, stdin closed). It fails on a finding at **high or worse** that is not a known false positive.

- **It scans a snapshot of the app's own sources, not the checkout.** The guard has no exclude option and reads
  every `.json`/`.ts`/… under the root, including the vendored skill's own rule files, whose regexes then match
  themselves (ODR, ATT, donation links, geofencing, dynamic code loading, `QUERY_ALL_PACKAGES`, the removed
  age-rating endpoint). The same files also satisfy its "is the fix present?" checks (`StoreKit`,
  `deleteAccount`, …), which hides real findings. The snapshot is what git lists minus the agent folders, docs,
  dev scripts, the website, tests, mocks, the lockfile and store assets (`EXCLUDED_TOP` / `EXCLUDED_PREFIXES` in
  `appstore_guard_gate.py`), plus `public/.well-known` (the Universal Links proof). `--tree` scans the folder as
  it is, like running the guard by hand; `--raw` prints the guard's own report.
- **Only iOS findings gate.** Ids starting `GOOGLE-`, `ANDROID-` or `WEB-`, and findings in `android/`, are
  printed (marked "other store") but do not fail an App Store release; `--all-platforms` counts them.
- **Known false positives** live in `scripts/appstore-guard-known.json`: guard finding `id`, optional `file`
  prefix, the day it was `checked`, and a `reason`. The gate still prints them, with the reason, and warns when
  an entry is older than 180 days. The guard reports only the **first** file it matches, so a known entry
  cannot hide a second hit by itself: after touching the area run `scripts/appstore-guard.sh --raw`. Add an
  entry only after reading the code; never to make a gate pass.
- Exit codes: 0 clear, 1 a blocking finding, 2 the guard did not scan (missing, `NOT CHECKED`, or its report
  format changed). The gate reads `Summary. critical=N high=N medium=N` and refuses to clear when it parsed a
  different number of findings.
- It does not replace the human checks in the skill's `SKILL.md` (privacy labels that match the app, review
  notes, age rating questionnaire, screenshots).

## Store listing as files

Desired state lives in `ios/appstore/` (committed): `metadata/app-info/<locale>.json` (name, subtitle,
privacyPolicyUrl) and `metadata/version/<X.Y.Z>/<locale>.json` (description, keywords, promotionalText,
supportUrl, marketingUrl, whatsNew), asc's canonical layout. A field left out is not touched on App Store
Connect; nothing is ever deleted (no `--allow-deletes`).

```
scripts/appstore.sh pull            # App Store Connect -> repo; replaces ios/appstore/metadata (pulled aside first)
scripts/appstore.sh from-listing    # Play listing -> ios/appstore/metadata
scripts/appstore.sh validate        # offline limits and other-platform lint + asc's own validator with --check-urls
scripts/appstore.sh audit           # App Review's metadata rules (vendored metadata-audit.py), offline
scripts/appstore.sh plan            # repo vs App Store Connect (asc metadata push --dry-run); changes nothing
scripts/appstore.sh up              # lint, show the plan, ask, apply (--if-exists update); --yes skips the question
```

`from-listing` (`scripts/appstore-listing-metadata.py`) keeps the Play listing the one place the store text is
written:

| App Store field                                  | Source                                                                                                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name` (30)                                      | `android/play/metadata/<locale>/title.txt`                                                                                                                                                           |
| `promotionalText` (170)                          | `short_description.txt`                                                                                                                                                                              |
| `description` (4000)                             | `full_description.txt`, Play's `<b>` tags removed                                                                                                                                                    |
| `subtitle` (30), `keywords` (100)                | `ios/appstore/listing-extra.json`: `{"<apple locale>": {"subtitle": "…", "keywords": "a,b,c"}}`. Play has neither, so a locale without them leaves the field out and App Store Connect keeps its own |
| `privacyPolicyUrl`, `supportUrl`, `marketingUrl` | the website: `contactWebsite` in `android/play/app.json` plus the `privacy` and `contact` paths in `components/website/websiteRoutes.json`                                                           |

Play locales map to Apple's (`ru-RU`→`ru`, `it-IT`→`it`, `pl-PL`→`pl`, `tr-TR`→`tr`, `zh-CN`→`zh-Hans`,
`zh-TW`→`zh-Hant`, `es-419`→`es-MX`; the table is `LOCALES` in the script and an unknown locale fails). It
refuses anything over Apple's limits and any text that names Android, Google Play, the Play Store or Wear OS
(App Review 2.3.10), and writes nothing unless every locale passes. One term is rewritten instead of refused:
Play's "Health Connect" (Android's health store) becomes "Apple Health", with a note per locale; read the
result. Everything else is copied as is, so **review the iOS text before the first `up`**: the Play copy
describes features by their Android names, and App Store text should describe only what the iOS build does.

`asc metadata` does not manage screenshots, pricing, availability or the App Privacy answers. The category, age
rating and App Review contact are opt-in scopes (`asc metadata pull --include categories,age-rating,review-information`)
that these scripts do not use yet; set them once in App Store Connect. Text edits to a live version reach the
store with the next submitted version, except the promotional text, which is published at once. The iOS
screenshots are not automated: the Play phone project (`screenshots/google-play/phone.osg.json`) takes an
iPhone `deviceType` (add its screen to `SCREEN_SHAPES` in `scripts/google-play-phone-screenshots.js`).

## Troubleshooting

- **`asc profile 'musclog' is not signed in`**: run `scripts/setup-asc.sh`. On a machine without a keychain add
  `--bypass-keychain` and export `MUSCLOG_ASC_BYPASS_KEYCHAIN=1`, or every later call looks in the keychain.
- **`asc` is not the App Store Connect CLI**: another program named `asc` is first on `PATH`.
- **401 / "forbidden"**: the key's role is below App Manager, or it was revoked; `asc auth doctor` and
  `asc auth status --validate`.
- **`build number N is not above the highest uploaded`**: bump (`npm run bump-app-version`) and rebuild.
- **The build stays "Processing" or "Missing compliance"**: `asc status --app 6761317034`; the export
  declaration comes from `ITSAppUsesNonExemptEncryption` in `app.json`.
- **The gate exits 2**: the guard did not scan; read the message (`--raw` shows its output). After upgrading the
  vendored guard, compare `appstore_guard_gate.py --raw` with the parser (`parse()`).
- **A finding you believe is false**: read the code it points at (the guard's `file.` line names only the first
  match), then add it to `appstore-guard-known.json` with the reason.
- **`asc release stage` stops on `asc validate`**: it lists what is missing (age rating, review contact,
  screenshots, privacy policy URL); fix it in App Store Connect and run `submit` again, it resumes.

## What stays in App Store Connect

Screenshots, pricing and availability, the category, the age rating questionnaire, the App Privacy
("nutrition label") answers, the App Review contact and notes, the export compliance questions and the release
setting. The app stores everything on the device and sends food lookups, crash reports (Sentry, can be turned
off) and AI requests to the services the person picks, plus the optional Musclog free tier, which forwards to
Google Gemini; keep the privacy labels consistent with that and with `expo.ios.privacyManifests` in `app.json`.
