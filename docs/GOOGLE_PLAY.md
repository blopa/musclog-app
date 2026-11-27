# Google Play publishing

Releases and store-listing changes go through three scripts built on
[`gplay`](https://github.com/tamtom/play-console-cli) (tamtom/play-console-cli). Nothing here needs
the Play Console UI except the one-time items at the end.

| Script                        | Does                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `scripts/setup-gplay.sh`      | Installs gplay, signs in, checks the toolchain. Idempotent.       |
| `scripts/release-android.sh`  | `build`, `check`, `upload`, `promote`, `rollout`, `status`.       |
| `scripts/play.sh`             | The store listing as files: `pull`, `plan`, `check`, `up`, `fmt`. |
| `scripts/lib/gplay-common.sh` | Shared helpers (auth check, edit lifecycle, versionCode lookups). |

## Setup (new machine)

```
scripts/setup-gplay.sh                         # key at ~/keys/musclog-play-service-account.json
scripts/setup-gplay.sh --key PATH
scripts/setup-gplay.sh --project <gcp-project>  # no key yet: create a service account (gplay setup --auto)
```

gplay uses its own profile, `musclog` (`GPLAY_PROFILE` overrides), so another app's profile on the same
machine is never touched. Auth is checked by reading `gplay auth status` and the key file, because
`gplay auth doctor` exits 0 with no profile configured and a failed `gcloud ... keys create` leaves an
empty key file.

The service account must be invited in Play Console → Users and permissions (its `client_email`, access to
Musclog, release permissions and Manage store presence). Until then `edits create` returns 403. Test with
`scripts/release-android.sh status`: `tracks` must be `ok` (the `vitals` error only means the Play
Developer Reporting API is off in that GCP project; ignore it).

Creating the key in a Google Workspace organization is blocked by `iam.disableServiceAccountKeyCreation`.
Fix it for the one project only:
`gcloud services enable orgpolicy.googleapis.com --project P`, then `gcloud org-policies set-policy` with
`name: projects/P/policies/iam.disableServiceAccountKeyCreation` and `spec.rules: [{enforce: false}]`
(this needs `roles/orgpolicy.policyAdmin` on the organization), wait about 90 s and retry. Right after
creating the account, NOT_FOUND on key creation is propagation lag. `gplay setup --auto` installs gcloud to
`~/google-cloud-sdk` without putting it on PATH; the scripts add it.

## Releasing

Release signing is EAS-managed: `android/app/build.gradle` signs the `release` type with the debug
keystore, so a plain `gradlew bundleRelease` is never upload-ready. `build` therefore runs the EAS
`production` profile (cloud by default, `--local` for `run-eas-local-android-build.sh`) and then refuses a
bundle signed by the Android debug key. Uploads use `gplay release` rather than `eas submit`: `eas.json`
has no Android submit config, `appVersionSource` is `local` (EAS `autoIncrement` would not apply), and gplay
adds preflight, staged rollouts and promotion in one tool.

```
npm run bump-app-version        # you bump; the scripts never do (also bump-minor, bump-major, bump-specific <x.y.z>)
scripts/release-android.sh build [--local]
scripts/release-android.sh check
scripts/release-android.sh upload --track internal [--notes FILE] [--dry-run]
scripts/release-android.sh promote internal beta
scripts/release-android.sh upload --track production --rollout 0.1
scripts/release-android.sh rollout update 0.5 | halt | resume | complete
```

**No EAS cloud minutes, no computer needed:** `.github/workflows/build-android-aab.yml` ("Build Android AAB",
manual `workflow_dispatch` only) runs `eas build --local` with the `production` profile on a GitHub runner,
refuses a debug-signed bundle and attaches `musclog-<version>-<code>.aab` to the run as an artifact (14 days).
It needs the repository secret `EXPO_TOKEN` (signing credentials and the plain-text/sensitive EAS environment
variables come from EAS; a variable with visibility "Secret" does not reach a local build, so
`SENTRY_AUTH_TOKEN` can be added as a repository secret too). By default it never uploads to Play: download the
artifact and use `scripts/release-android.sh upload --file <aab>` when you decide to. Ticking "Also submit to Play
internal testing" adds a step that runs that same script against the internal track (the track is written in the
workflow, so it cannot reach production) and needs the repository secret `PLAY_SERVICE_ACCOUNT_JSON` (the whole
service-account key). The AAB is uploaded as an artifact before that step, so a failed submission never loses the build.

**APK on GitHub Releases:** `.github/workflows/release-android-apk.yml` ("Release Android APK", manual only, `main` only)
reads the version from `package.json`. If the tag with that name (bare, e.g. `2.18.10`) exists, the run ends without
building. Otherwise it builds the `production-apk` profile with `eas build --local` (same secrets as above), refuses a
debug-signed APK and publishes a release for the new tag with `musclog-<version>-<code>.apk` attached, with generated
notes and the build-version footer. The tag is created only when the release is published, so a failed build leaves
nothing behind and running it again retries; if only the publishing job failed, "Re-run failed jobs" reuses the built
APK. It never bumps the version and never touches Google Play. The APK is signed with the EAS upload key, not whatever
key Play App Signing signs store installs with (compare in Play Console → App signing): where they differ, one cannot
update the other.

`upload` defaults to the internal track; production refuses without `--rollout`. Before uploading it runs
the offline `gplay preflight` and refuses unless the local versionCode is above every code on Play
(Play spends a code even on a rejected upload). Preflight blocks on errors only: its warnings (exact alarms, bundle
size, exported receivers) are printed, and the one known false positive, Expo's public `expo-root.pem`, is listed in
`PREFLIGHT_KNOWN_FALSE_POSITIVES` in the script (exact scanner, check and file; anything else still fails). `--notes FILE` is plain en-US text or a JSON array of
`{language, text}`. Bundles are written to `.release/` (git-ignored).

## Store listing as files

Desired state lives in `android/play/` (committed):
`metadata/<locale>/{title,short_description,full_description,video}.txt` (Fastlane layout), screenshots and
graphics under `metadata/<locale>/images/`, and `app.json` (`contactEmail`, `contactPhone`,
`contactWebsite`, `defaultLanguage`).

```
scripts/play.sh pull     # Play -> repo; mirrors Play, wipes metadata/ first
scripts/play.sh plan     # diff only
scripts/play.sh check    # rehearsal: open an edit, apply, validate, delete it
scripts/play.sh up       # show the plan, confirm, apply, commit (listing changes go to review)
```

Rules the script enforces: text files carry no trailing newline (Play stores none; `fmt` fixes it); limits
are title 30, short 80, full 4000 characters; `check` and `up` refuse any non-`listing.*` effect (images)
without `--with-images`, and a destructive plan without `--allow-destructive`. Each command opens its own
edit and deletes it on exit unless committed, since Play allows one open edit per app. `--no-review` adds
`--changes-not-sent-for-review` and is only for managed publishing.

With `--with-images`, each screenshot type the plan uploads is first emptied on Play inside the open edit (`clear_screenshot_types_before_upload`): Play allows 8 per type and `gplay sync` uploads a changed image before removing the old one, so replacing a full set failed with "403: more than 8 screenshots". Nothing is public until commit. A locale that exists in `metadata/` but not on Play makes `plan` fail with "Listing for language 'X' not found" (404): create it first with `gplay listings update --locale X --title ... --short-description ... --full-description ...` in an edit.

Images are not automated yet: `pull` downloads them (the export only writes `*_meta.json`; the files come
from the public url plus `=s0`, hash-checked) so a fresh `pull` then `plan` shows no changes.

`npm run screenshots:google-play` regenerates all eight tablet images in the repo: the home, food, Goals management and live-workout frames of `sevenInchScreenshots/01-04` (food, home, workout, goals) and `tenInchScreenshots/01-04` (home, goals, workout, food); the mapping is `TARGETS` in `scripts/sync-google-play-screenshots.js`. The sync owns every numbered `NN.png` of those two folders: it replaces the targeted ones and removes any other, so they hold exactly what the command produced. (The two hand-placed "Introducing Musclog" frames that used to be `sevenInchScreenshots/05` and `tenInchScreenshots/01` were AI-generated images with a Gemini watermark and garbled UI text that no script could remake; they were removed, and are in git history if they are ever wanted back.) It only rewrites files under `android/play/`; publishing them stays `scripts/play.sh up --with-images`, run on request. Captures land in `screenshots/google-play/<tablet-7|tablet-10>/` first. Play needs at least two screenshots per tablet type; each set has four.

`npm run screenshots:google-play-phone` regenerates the eight phone screenshots of every locale (`metadata/<locale>/images/phoneScreenshots/01-08.png`, 1080×1920). It captures the real app in each language, then composes each capture into a 3D Pixel 10 Pro with a caption using the [Open Screenshot Generator](https://github.com/dotnetdreamer/open-screenshot-generator) CLI. The layout, captions in all five languages, phone angles and backdrop live in `screenshots/google-play/phone.osg.json`, an Open Screenshot Generator project; edit it visually with `npm run screenshots:google-play-phone:studio` (the editor opens on the file and saves every change back), then `npm run screenshots:google-play-phone:render`. The CLI comes from the checkout in `OSG_DIR` (default `../open-screenshot-generator`; build it once with `npm install && npm run cli:build`), or, without a build, from npm as `open-screenshot-generator@OSG_VERSION` (default `1.0.8`). Point `MUSCLOG_CHROMIUM_PATH` at a Chromium when Playwright's own build is missing. A full render takes about 9 minutes, one CLI run per language, and a translation too long for its box is clipped rather than shrunk, so look at the Russian set after changing copy. The App Store's iPhone set is the same script with `--target appstore` (`npm run screenshots:app-store-iphone`, see `docs/APP_STORE.md` → Screenshots): the same eight screens and captions on a 3D iPhone 17 Pro Max, from `screenshots/app-store-listing/iphone.osg.json`. Caption 06 ("See the muscles you train") sits over a past workout's muscle map; it used to read "How strong are you?" over the same screen, which promised the strength levels card. Both designs are rendered by one script, so a caption change goes in both files (a test pins they match). Rendering needs WebGL: on a machine whose Chromium starts without a GL backend (`osg doctor`: "webgl: no context"), point `MUSCLOG_CHROMIUM_PATH` at a wrapper that execs it with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`; `OSG_VERBOSE=1` shows the editor's console, `--locales en-US,ru` renders only some languages.

`npm run generate-banners` renders the promotional banner of every locale (`screenshots/banner/<locale>/banner.png`, 1920×905), and `npm run generate-banners:sync` writes each one as that locale's Play feature graphic, `metadata/<locale>/images/featureGraphic.png` (1024×500, no alpha; the banner is scaled to height and trimmed evenly at the sides, not stretched). Play keeps one feature graphic per language, so `scripts/play.sh plan` then shows an `image.upload` per locale and `up --with-images` publishes them; single images replace in place, so no clearing step is needed. Run `plan` or `check --with-images` first.

Every text change covers all ten listing locales and must match what the app does. The app ships ten languages: `en-US`, `es-ES`, `nl-NL`, `pt-BR`, `ru-RU` (released) and `de-DE`, `fr-FR`, `it-IT`, `pl-PL`, `tr-TR` (new in 2.17.5). **Since 2026-11-22 every listing names all ten**: the five newer listings state them on their own line right after the opening paragraph, the other five in the widgets bullet (a language list too long for a listing's 4000 characters is cut from that bullet's neighbours, never from the list; `nl-NL` is exactly 4000). That text describes the 2.17.5 build, so run `scripts/play.sh up` only once 2.17.5 is on the production track. The ten listings exist on Play (`plan` shows `listing.update` for each); the five newer ones have no `images/` folder, so Play shows the default language's graphics, and adding them to the screenshot and banner scripts is still open. A locale missing from Play makes `plan` fail with a 404: create it once with `gplay listings update --locale <locale> ...` in an edit (see above). Release notes for 2.17.5 are in `.release/release-notes-2.17.5.json` (git-ignored, ten languages, under Play's 500 characters): `scripts/release-android.sh upload --track internal --notes .release/release-notes-2.17.5.json`; the iOS copy is `whatsNew` in `ios/appstore/listing-extra.json`.

Play's metadata policy shapes the copy: never compare with or name another app (the factual "import your
history from Strong, Hevy or FitNotes" line is the one exception), no "best"/"#1", no keyword lists, and no
"free" in the title or short description. The short description must not reappear word for word in the
full description. Comparisons belong on the website's `/alternatives` page. The "Nothing locked away"
section (unlimited routines, the barcode scanner for everyone, every chart, export and backup free) is how the listing
positions against paywalled apps without naming them. Since the Musclog Iron decisions of 2026-11-20 the listing never says "no subscription" or "no paywall": it says everything except the optional hosted AI allowance is free, adds a short "Musclog Iron (optional)" section (formerly Musclog Premium) (monthly, auto-renews until cancelled at least 24 hours before renewal in the store account, terms link, no price and no currency), and never names Google Play or Android in that section because the App Store text is generated from this file. Hold the Musclog Iron paragraph back from a published listing until the release that ships Musclog Iron (`play.sh up` is the maintainer's call). Data safety, when Musclog Iron ships: add purchase history and a device or other ID (`rc_id`) as collected and name RevenueCat, Cloudflare, OpenRouter and Otari (Mozilla.ai) as processors; the AI section names the Musclog Iron route and the free Gateway route separately. Cycle copy never promises phase-based training advice.

## What the API cannot do

Content rating, target audience, the Data safety form, category, countries and pricing stay in Play
Console. The app collects anonymous crash reports (Sentry, on by default, user can turn them off) and sends
food lookups and AI requests to the services the user picks; keep the Data safety form consistent with that.

## On-device AI and the listing (2026-11-23)

The on-device AI (Apple Intelligence on iOS, a downloaded model everywhere) collects nothing: what the person asks never leaves the phone. The only network contact is the one-off model download from Hugging Face, which sees the device's IP address like any file download. Data safety: no new data type; do not declare the download as sharing. Listing text may say the AI can run on the phone, offline and without a key, but only once a build containing it is released, and must say it needs a download and a phone with enough room. Do not claim speeds, accuracy or photo quality until the P7 bench has been run on phones. Update all ten listing locales together.

## Musclog Iron: Data safety draft (revised 2026-11-22; the form is entered by hand, never through gplay)

Draft for the maintainer to enter in Play Console when the release that ships Musclog Iron goes out. **`gplay` can push it, but only whole**: `gplay data-safety update` replaces the entire declaration from a CSV (the REST body is `{"safetyLabels": "<csv text>"}`) and has no way to read what is there today. So the desired declaration is a file, `android/play/data-safety.csv`: Google's full question list (782 rows, taken from the question IDs the Fastlane `google_data_safety` plugin ships, since Google's own template needs the Console) with the answers below filled in. Push it with `f=$(mktemp) && jq -Rs '{safetyLabels: .}' android/play/data-safety.csv > "$f" && GPLAY_PROFILE=musclog gplay data-safety update --package com.werules.logger --json @"$f"; rm -f "$f"` (the payload is about 180 KB, too big for an argument, hence the file). If Google changes the question list the API rejects the file: export the current CSV from the Console once and merge. Change the answers in the CSV, never push a part. The 2026-11-21 pass saved only Purchase history and Device or other IDs and did not send the form for review.

**State read in the Console on 2026-11-22** (browser agent, read only): eight types are ticked, all "collected" and none sold. Purchase history (optional, App functionality), Device or other IDs (**required**, App functionality and Analytics), Crash logs and Diagnostics (optional, Analytics) are collected only; Other in-app messages, Photos, Health info and Fitness info are **collected and shared, processed ephemerally, optional, App functionality**, which already matches the free route sending data to Google. "Data deletion" is **No** with no URL, which contradicts the privacy policy (deletion and rights by email): set it to Yes, with `https://musclog.app/en/privacy`. Device or other IDs should be optional (the id exists only for Musclog Iron). The form is "Ready to send for review", edited 2026-11-21, not sent; send it with the release (Publishing overview). The privacy policy and trader terms URLs in Play Console are the unprefixed `https://musclog.app/privacy` and `/terms`: use the `/en/` addresses. Licence testing holds one list ("Musclog Internals", one address); a purchase from an address in a licence-testing list is a sandbox purchase and the production Worker refuses it.

The AI classification was the maintainer's choice: Musclog Iron is **collected, not shared**, because Cloudflare (Worker, D1) and the AI gateway (OpenRouter or Otari) act as service providers processing the request on Musclog's behalf (Play's definition excludes "service provider" transfers from "sharing"), and because the Worker stores no content and the providers are zero-retention, so tick "processed ephemerally" for the content types below.

| Play data type                                         | Collected | Shared | Optional | Purpose                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | --------- | ------ | -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial info → Purchase history                      | Yes       | No     | Yes      | App functionality             | RevenueCat reads the store's subscription state; the Worker asks RevenueCat whether the subscription is active. RevenueCat's own Play guide lists purchase history as its default collection. No card or payment details ever reach Musclog.                                                                                                                                                                                      |
| Device or other IDs                                    | Yes       | No     | Yes      | App functionality             | `rc_id`, a hash of a key made on the device; also the RevenueCat app user id. Not an advertising id; no tracking.                                                                                                                                                                                                                                                                                                                 |
| Messages → Other in-app messages                       | Yes       | No     | Yes      | App functionality             | Chat text sent to the Worker, forwarded to OpenRouter or Otari (zero-retention providers only). The Worker stores no content; only usage counts and a request hash for retries. Processed ephemerally.                                                                                                                                                                                                                            |
| Health and fitness → Health info, Fitness info         | Yes       | No     | Yes      | App functionality             | Chat and AI requests carry the workout, nutrition and body details a feature needs. Same route, same ephemeral processing.                                                                                                                                                                                                                                                                                                        |
| Photos and videos                                      | Yes       | No     | Yes      | App functionality             | Meal photos sent to the Worker and forwarded to OpenRouter or Otari (zero-retention providers only) while Musclog Iron is on: hosted vision has been on since 2026-11-23 (`vision_enabled: true`). The Worker stores no image. The existing form already ticks Photos as collected (and shared, for the free route), so the Console needs no new data type: confirm the Photos answers still read optional and App functionality. |
| App info and performance → Crash logs (existing)       | Yes       | No     | Yes      | Analytics / app functionality | Unchanged: Sentry, on by default, can be turned off. The Worker also reports content-free errors to Sentry (no request, no identifiers; `services/premium-worker/src/sentry.ts`).                                                                                                                                                                                                                                                 |
| Health and fitness, messages, photos on the free route | -         | Yes    | Yes      | App functionality             | The free route is OpenRouter to Gemini on free Google quota, where Google may keep, review and train on the data for its own purposes: that is **shared** with Google, not a service provider. Check the existing form says so (the earlier Cloudflare AI Gateway route sent the same data to Google). Own-key providers are the person's own choice, unchanged.                                                                  |

Hosted AI requests are "processed ephemerally" in the sense that Musclog's Worker stores no content and the zero-retention providers keep none; OpenRouter's screening for child sexual abuse material may keep a request it flags, which the privacy policy and the in-app consent disclose (`PREMIUM_CONSENT_VERSION` 4, which names meal photos and both gateways, OpenRouter and Otari).

Other answers: data is encrypted in transit (HTTPS) yes; the "request data deletion" answer is yes, by email (support@musclog.app; the Worker keeps a device identifier until it is removed on request, `docs/PREMIUM_WORKER.md` → Retention and removing a device identifier on request); no data is sold; the privacy policy URL is the website `/en/privacy` page (it names RevenueCat, Cloudflare, OpenRouter and Otari, the controller and the person's rights). Account creation: the app has none, so the account-deletion questions answer "no account creation in the app". If the maintainer later answers "shared" for OpenRouter, add "Shared: Yes" on the Messages and Health and fitness rows and nothing else changes.

**Also declared outside the form:** EU trader status (Play Console → Settings → Developer account; Jubinganga Supply, KVK 72255145, with a verified address and phone) is required once the app sells a subscription in the EU.

**Subscription setup in Play Console (maintainer, after a billing-enabled build is on an internal track):** one monthly base plan (auto-renewing, no free trial or offers), license testers, a service account for RevenueCat and the real-time developer notifications topic; the price is whatever the Play product says, no number appears in the listing.

**The subscription product is read and edited with gplay** (`gplay subscriptions get|update`, `baseplans`, `offers`; read-only `gplay validate`). Its title is **Musclog Iron** (renamed from "Musclog Premium" on 2026-11-22: `gplay subscriptions update --package com.werules.logger --product-id musclog_premium_monthly --update-mask listings --regions-version <pricing regions-version> --json '{"listings":[...]}'`; the call needs `--regions-version`, found with `gplay pricing regions-version --price-json ...`, and only the listed fields change, so the base plan and prices stay). The product id `musclog_premium_monthly` and the base plan id `monthly` never change. To test with real money the owner's Google account must **not** be a license tester: a test purchase is a sandbox purchase and the production Worker accepts only `production` ones. Refund a test purchase from Play Console → Order management (or `gplay orders`).

## The Premium identity harness build

`eas build --profile premium-harness` (extends `production`, sets `EXPO_PUBLIC_PREMIUM_HARNESS=1`) makes the build that runs the RevenueCat sandbox matrix (`docs/PREMIUM_WORKER.md` → Running G2 and G9). Upload it to a Play **internal testing** track only: never to production, and never `release-android.sh upload --track production` or a `promote` of it. The app links `react-native-purchases` (the Play Billing library and the `BILLING` permission come with it), so the Data safety form must disclose the RevenueCat SDK before a production release that contains it.
