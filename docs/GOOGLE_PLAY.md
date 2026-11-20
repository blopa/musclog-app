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
npm run bump-app-version        # you bump; the scripts never do
scripts/release-android.sh build [--local]
scripts/release-android.sh check
scripts/release-android.sh upload --track internal [--notes FILE] [--dry-run]
scripts/release-android.sh promote internal beta
scripts/release-android.sh upload --track production --rollout 0.1
scripts/release-android.sh rollout update 0.5 | halt | resume | complete
```

`upload` defaults to the internal track; production refuses without `--rollout`. Before uploading it runs
`gplay preflight --fail-on warning` and refuses unless the local versionCode is above every code on Play
(Play spends a code even on a rejected upload). `--notes FILE` is plain en-US text or a JSON array of
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

Every text change covers all ten listing locales and must match what the app does. Five match the languages
the released app ships (`en-US`, `es-ES`, `nl-NL`, `pt-BR`, `ru-RU`). Five (`de-DE`, `fr-FR`, `it-IT`, `pl-PL`,
`tr-TR`) are translated and bundled in the app but not in a released build yet, so each listing still states, on
its own line right after the opening paragraph, which languages the app is in. When the release that ships them
goes out, update that line in all ten listings and add the five locales to the screenshot and banner scripts.
The five newer locales have no `images/` folder, so Play shows the default language's graphics. They don't
exist on Play yet: create each once with `gplay listings update --locale <locale> ...` in an edit (see
above), or `plan` fails with a 404.

Play's metadata policy shapes the copy: never compare with or name another app (the factual "import your
history from Strong, Hevy or FitNotes" line is the one exception), no "best"/"#1", no keyword lists, and no
"free" in the title or short description. The short description must not reappear word for word in the
full description. Comparisons belong on the website's `/alternatives` page. The "Nothing locked away"
section (unlimited routines, the barcode scanner for everyone, no subscription) is how the listing
positions against paywalled apps without naming them. Cycle copy never promises phase-based training advice.

## What the API cannot do

Content rating, target audience, the Data safety form, category, countries and pricing stay in Play
Console. The app collects anonymous crash reports (Sentry, on by default, user can turn them off) and sends
food lookups and AI requests to the services the user picks; keep the Data safety form consistent with that.

## The Premium identity harness build

`eas build --profile premium-harness` (extends `production`, sets `EXPO_PUBLIC_PREMIUM_HARNESS=1`) makes the build that runs the RevenueCat sandbox matrix (`docs/PREMIUM_WORKER.md` → Running G2 and G9). Upload it to a Play **internal testing** track only: never to production, and never `release-android.sh upload --track production` or a `promote` of it. The app links `react-native-purchases` (the Play Billing library and the `BILLING` permission come with it), so the Data safety form must disclose the RevenueCat SDK before a production release that contains it.
