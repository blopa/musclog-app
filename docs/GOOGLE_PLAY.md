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

Images are not automated yet: `pull` downloads them (the export only writes `*_meta.json`; the files come
from the public url plus `=s0`, hash-checked) so a fresh `pull` then `plan` shows no changes. Wiring in
the Playwright screenshots (`npm run screenshots*`) is a later step.

Every text change covers all locales (`en-US`, `es-ES`, `nl-NL`, `pt-BR`, `ru-RU`, matching the languages
the app ships) and must match what the app does. Cycle copy never promises phase-based training advice.

## What the API cannot do

Content rating, target audience, the Data safety form, category, countries and pricing stay in Play
Console. The app collects anonymous crash reports (Sentry, on by default, user can turn them off) and sends
food lookups and AI requests to the services the user picks; keep the Data safety form consistent with that.
