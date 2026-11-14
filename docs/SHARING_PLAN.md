# Sharing plan: workouts and meals as links and images

Status: not started (written 2026-11-14). An active plan like `NEW_LEARNINGS_PLAN.md`: update the status
table as phases ship, fold lasting rules into `AGENTS.md` (open links, optical transfer) and
`docs/CURRENT_FEATURES.md`, and delete this file when it is done.

## Why

Sharing today doesn't help anyone discover Musclog:

| What                                   | Today                                                                      | Problem                                         |
| -------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| A routine (workout library card menu)  | Plain text from `WorkoutTemplateService.getShareMessage`                   | No link; a friend has to retype it              |
| A finished workout (`workout-summary`) | Plain text (`handleShareSummary`): duration, volume, kcal, PR count        | No image, no link, nothing to try               |
| A saved meal (`MyMealsModal`)          | Plain-text recipe, or a phone-to-phone QR stream (`ShareOpticalSendModal`) | QR only works with both phones in the same room |
| A food, a diary day                    | QR stream only                                                             | Same                                            |

Hevy grew mostly through sharing: every shared workout is a free ad. Musclog can do the same **with no
server**, because the pieces already exist:

- `https://musclog.app/open#<kind>=<payload>` links (`utils/openLink.ts`). The payload lives in the URL
  **fragment**, which browsers never send to a server (GitHub Pages and analytics never see it).
- The `/open` bridge page (`app/(website)/open.web.tsx`) on the static website.
- The `musclog-workout-plan` contract (`utils/aiWorkoutPlan/`), which already turns a document into
  workouts through `createWorkoutsFromJsonTemplate`, with a review screen (`ExternalWorkoutPlanModal`).
- The share envelope used by the QR transfer (`utils/share/`, `database/share/`): meal, food and day
  shares with column allowlists, dedupe, a preview and a non-destructive import (`importShareEnvelope`).
- fflate gzip (`utils/optical/gzip.ts`, inflate size cap included) and on-device image capture
  (`hooks/useChartCapture`, used by the year story's share image).

The phone builds the link or image and hands it to the OS share sheet (WhatsApp, Instagram, Messages…).
Nothing is uploaded anywhere.

## Decisions

1. **A routine travels as a `musclog-workout-plan` document on the existing `workout` link kind.**
   Exporting a template into the contract the AI flow already reads means the receiver gets the same
   review screen, the same exercise matching by catalogue slug, and loads suggested from THEIR profile.
   The sender's weights are never sent: they're personal, and a beginner shouldn't start on someone
   else's 120 kg squat. A plan (up to `MAX_WORKOUTS` = 7) shares as one document with its weekdays.
2. **Meals and foods travel as a share envelope on a new `share` link kind.** The envelope already
   preserves what a recipe needs (ingredients, portions, nutrients, dedupe identity) and imports
   non-destructively into My Meals. A new kind keeps it apart from `food`, which is the AI food-log
   contract and logs into the diary rather than saving a recipe.
3. **Links Musclog makes are compressed; links an assistant makes stay plain JSON.** A Musclog-made
   payload is `z1.<base64url of gzip(json)>`. The parser accepts both forms; the `z1.` prefix leaves room
   for a later `z2.`. Percent-encoded JSON grows about 2–3×, so compression keeps a 5-day plan around
   2–4 KB, short enough for any chat app and for a printed QR code.
4. **No photos inside links.** An embedded meal photo is tens of KB. A link carries either no photo or a
   remote URL the food already has (Open Food Facts), the `linked` outcome of `prepareShareImage`. The
   send sheet states which, in words, as `SHARE_PHOTO_NOTICE` already does for QR.
5. **Share images are drawn on the phone** (capture a view, share the file), always with `musclog.app`
   on them, and carry the link in the accompanying text. Body data (weight, body fat) is off by default
   behind toggles, as in the year story's share sheet, and the toggles are never stored.
6. **Text stays as the fallback.** Every shared message is readable text plus the link at the end, so
   it still makes sense to someone who never taps it.

## Phase 0: make links open the app (prerequisite, no code)

- [ ] Fill `public/.well-known/assetlinks.json` with the real SHA-256 fingerprints: the Play App Signing
      key (Play Console → Test and release → App integrity → App signing) and the EAS upload key
      (`eas credentials -p android`). Until then Android never verifies the link, so every tap lands on
      the bridge page instead of the app (`AGENTS.md`, open links).
- [ ] Check that both `.well-known` files are served with 200, JSON and no redirect after deploy.
- [ ] On a real device, open a hand-built `workout` link from WhatsApp and Gmail: app installed, app not
      installed, app locked.

## Phase 1: share a routine or a plan as a link

- **Export:** a pure `templateToPlanDocument(template, exercises, sets)` in `utils/aiWorkoutPlan/` (the
  inverse of `toTemplate.ts`), plus `planToPlanDocument` for a whole plan. Rules:
  - Catalogue exercises go by `exerciseSlug`. Exercises migrated from the legacy catalogue map through
    their slug where one exists.
  - Sets × reps comes from the working sets. A pyramid or back-off block, warm-ups, set types,
    progression rules and loads don't fit the contract, so they're **reported** to the sender before
    sharing ("2 exercises will be simplified"), never silently dropped.
  - Supersets map to `supersetGroup`, rest to `restSeconds`, a rep range to `minReps`/`reps`, and the
    template note to `notes` (capped at `NOTES_MAX`).
  - A custom exercise with no catalogue slug can't be matched by the receiver: Phase 3 adds it to the
    contract. Until then it's listed in the report and left out.
- **Link:** `buildCompressedOpenUrl('workout', document)` next to `buildOpenHttpsUrl` (`utils/openLink.ts`).
  The decode side (`parseOpenFragment` → `decodePayload`) recognises `z1.` and inflates with the same
  inflate cap as the QR path. A payload that won't inflate is "this link is damaged", never a crash.
- **Entry points:** the library card menu's Share opens a small sheet: "Send link" (default) and "Send as
  text" (today's message). Plans get the same in the plan menu. The message is the readable routine plus
  the link.
- **Receive:** already wired. `useOpenLinkHandler('workout', …)` → `ExternalWorkoutPlanModal`'s review. Its
  copy says "Shared routine" when the document came from a link with no assistant involved (add a
  `source` hint to the document, an optional field, as a minor revision).
- **Tests:** export ↔ `normalizeWorkoutPlan` round trip for every bundled template (each one survives
  intact); compressed encode ↔ decode; a size budget (the 5-day split link under 4,000 characters);
  damaged and oversized payloads; `openLinkWiring.test.ts` still passes.

## Phase 2: share a meal or a food as a link

- New `OPEN_LINK_KINDS` entry `share`, routed by `app/+native-intent.tsx` to the food screen
  (`OPEN_LINK_ROUTES`). Every share-envelope kind shipping today (`meal`, `food`, `nutritionDay`) lands
  in nutrition.
- **Sender:** the builders that exist (`buildMealShare`, `buildFoodShare`, `buildLoggedMealShare` for a
  diary section) with photos limited to `linked`/none, then gzip → `z1.` → link. Entry points:
  - My Meals → a meal's menu: "Share link", beside the QR option and the text recipe.
  - The food diary → a grouped meal's menu: share as a recipe (`buildLoggedMealShare`).
  - Custom food details → share.
  - Diary days stay QR-only: a day is personal and has its own add/replace decision.
- **Receiver:** the decoded text goes through `parseIncomingShare` → `parseShareEnvelope`, the same
  boundary as a camera frame: column allowlists, `sanitizeRow`, and refusing `payloadKind` other than a
  share. The UI is the existing `ShareImportPanel` inside a modal on the food screen (preview, then
  save), so the link path and the QR path show the same thing. A `nutritionDay` envelope arriving by link
  is refused with a clear message (Phase 2 keeps days on QR).
- **Rules that carry over:** an optional field is absent, never `null` (`optionalNumber`, `readOptional`);
  `MusclogShareError` codes decide "update the app" vs "this link is damaged"; `nutrition_logs.external_id`
  is never shared.
- **Tests:** builder → link → parser → import plan for meal and food; a meal with an Open Food Facts photo
  becomes `linked`; a hostile envelope with extra columns is reduced to the allowlist; size budget (a
  12-ingredient meal under 3,000 characters).

## Phase 3: contract revision for custom exercises

A minor revision of `musclog-workout-plan` (a fractional `version`, read by `readEnvelope` as a minor of
its integer part), all optional:

- `customExercise: { name, muscleGroup, equipmentType }` on an exercise with no `exerciseSlug`: the
  receiver's review offers "create it" or "pick an existing one", like the import review
  (`utils/workoutImport/`). Never a silent guess.
- `targetRir` per exercise: the planned reps in reserve.
- `warmup: true` sets, still without loads.

Update the assistant prompt (`instructions.ts`) only if the assistant should write these too. Otherwise
they stay "Musclog-to-Musclog" fields, documented in the schema.

## Phase 4: share images

- **Workout summary card:** workout name, duration, sets, volume (in the sharer's unit), PRs, Loggy
  optional (`appearance="classic"` on a fixed ground, like `YearShareCard`), `musclog.app`. The text
  beside it holds "Try this workout" plus the routine link from Phase 1. Replaces the text-only
  `handleShareSummary`; text remains a menu choice.
- **Meal card:** meal name, photo if local, macros per portion, the Phase 2 link in the text.
- **Rules:** cards are captured off-screen at a fixed size (1080×1350 portrait); every figure is formatted
  with `useFormatAppNumber` and the energy/weight helpers; no body data unless a toggle is on; reduced
  motion and `show_loggy` are respected; the capture path is `useChartCapture` (and its `.web.ts`). Add
  each card to the layout audit (`MODAL_COVERAGE`) and the `/app/test/modals` fixture.

## Phase 5: the bridge page as a landing page

When the app isn't installed, the `/open` page is the first thing a friend sees. Make it worth it, with
no server:

- Decode the fragment in the browser (same `utils/openLink.ts` + parsers, which are pure) and **show what
  was shared**: the routine's days, exercises (names from the catalogue, linked to `/exercises`), sets ×
  reps; or the meal's ingredients and macros. Then the store buttons, and only then the countdown to the
  app.
- The store buttons carry `utm_source=share&utm_medium=<workout|meal>` through `withPlayReferrer`, so the
  Play Console acquisition report shows installs that came from shares. That's the only measurement, and
  it needs no server.
- Keep removing the fragment from the address bar before analytics runs (existing behaviour), and keep
  `noindex` on `/open`.
- Tests: extend `components/website/__tests__/openPage.test.ts` for both preview kinds and a damaged link.

## Out of scope

- Any upload, short-link service or account: a share is the link itself.
- Sharing a diary day by link, body metrics, cycle data, or anything from a locked area. Sharing from a
  screen behind `AreaLockGate` only works while it's unlocked, and nothing locked is ever put in a link.
- Social feeds, followers, likes.

## Status

| Phase                                    | Status      |
| ---------------------------------------- | ----------- |
| 0. assetlinks fingerprints, device tests | not started |
| 1. Routine and plan links                | not started |
| 2. Meal and food links                   | not started |
| 3. Contract: custom exercises, RIR       | not started |
| 4. Share images                          | not started |
| 5. Bridge page preview                   | not started |
