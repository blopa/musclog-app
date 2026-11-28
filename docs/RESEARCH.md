# Musclog — Research Notes

This file consolidates the research that still informs the product or implementation. Historical
code dumps, speculative week-by-week plans, repeated setup instructions, and conclusions superseded
by the current code have been removed. For implementation rules use `AGENTS.md`; for incident
history use `docs/FIXES.md`.

## Nutrition and energy balance

### Current calculation model

`utils/nutritionCalculator.ts` is the implementation source of truth.

For a new user, BMR is calculated with Mifflin–St Jeor unless a body-fat value between 5% and 60%
is available. With body fat, the app uses Katch–McArdle:

```text
Mifflin–St Jeor base = 10 × weightKg + 6.25 × heightCm − 5 × age
male                 = base + 5
female               = base − 161
other                = base − 78

leanBodyMassKg       = weightKg × (1 − bodyFatPercent / 100)
Katch–McArdle BMR    = 370 + 21.6 × leanBodyMassKg
```

The population fallback multiplies BMR by the selected activity factor. When sufficient intake and
weight history exists, the app instead estimates observed TDEE from energy intake and the energy
stored or released by changing fat and lean mass. If body-composition endpoints are missing, the
Forbes/experience model estimates the split. The result is adjusted from the period average toward
the terminal state using tissue-specific resting costs, activity scaling, and adaptive
thermogenesis.

The current constants are 13 kcal/kg/day for lean tissue, 4.5 kcal/kg/day for fat tissue, and
20 kcal/day per kg for the adaptive component. Older notes used 15 for the last value; the current
code and its tests win. Likewise, the implementation no longer treats every kilogram as a flat
7,700 kcal when body composition is available: fat and lean tissue have different energy densities
and gain/loss costs.

Body-fat measurements are treated as uncertain. The onboarding projection computes a ±4 percentage
point band around the entered value and surfaces a range rather than false precision.

### Trend weight

`utils/trendWeight.ts` produces the canonical daily series:

- Multiple readings on one calendar day are averaged.
- Missing days between observations are linearly interpolated; the series is never extrapolated
  beyond the first or last reading.
- An EWMA with alpha 0.10 smooths the daily sequence.
- Bounded chart and analysis reads include a 28-day warm-up so overlapping date windows agree.
- Non-finite and non-positive readings are excluded from the smoothing input.

Progress charts, nutrition charts, check-ins, and empirical-TDEE endpoints share this series. The
remaining limitation is that empirical TDEE uses its start/end values rather than a fit over every
point; whole-series regression is tracked in `docs/FUTURE_FEATURES.md`.

### Macronutrients and label conventions

There are intentionally two carbohydrate meanings:

- Stored foods and nutrition logs use **total carbohydrate including fiber**.
- Nutrition goals use **digestible/net carbohydrate**, with fiber as a separate energy-bearing
  target.

Provider data is normalized once at ingestion through `utils/carbsConvention.ts`:

| Source                  | Source convention                     | Ingestion rule                                                                                                     |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| USDA                    | Total carbohydrate includes fiber     | Keep the value, through the common helper.                                                                         |
| US/Canadian labels      | “Total Carbohydrate” includes fiber   | Keep as total.                                                                                                     |
| EU labels               | Available carbohydrate excludes fiber | Add fiber to form stored total.                                                                                    |
| Musclog supermarket API | EU/net                                | Add fiber.                                                                                                         |
| AI estimates            | Prompt defines net carbs              | Add fiber.                                                                                                         |
| Open Food Facts         | Mixed and not explicitly tagged       | Prefer `carbohydrates-total`; otherwise compare stated kcal against both interpretations; otherwise assume EU/net. |
| Manual entry            | User setting                          | Convert according to whether the user says the label includes fiber.                                               |

Energy and progress calculations use `digestibleCarbs(carbs, fiber)` rather than reimplementing the
subtraction. Goal energy is `4 × protein + 4 × netCarbs + 9 × fat + 2 × fiber`.

Open Food Facts exposes raw nutriments, attribute evaluations, and generated knowledge panels. The
app should not couple UI to those provider-specific structures. Each provider mapper produces the
app's canonical nutrition shape and `FoodDisplayQuality` once; UI reads the normalized object.
Nutri-Score, Eco-Score, NOVA, and labels are provider quality metadata, while USDA deliberately
provides none.

### Evidence retained

- Mifflin et al., “A new predictive equation for resting energy expenditure in healthy
  individuals” (1990): <https://pubmed.ncbi.nlm.nih.gov/2305711/>
- Institute of Medicine, Dietary Reference Intakes and AMDR (2005):
  <https://doi.org/10.17226/10490>
- Jäger et al., ISSN protein position stand (2017):
  <https://pubmed.ncbi.nlm.nih.gov/28642676/>
- Thomas, Erdman, and Burke, Nutrition and Athletic Performance (2016):
  <https://pubmed.ncbi.nlm.nih.gov/26920240/>
- Helms, Aragon, and Fitschen, natural bodybuilding recommendations (2014):
  <https://pubmed.ncbi.nlm.nih.gov/25000063/>
- Hall, “What is the required energy deficit per unit weight loss?” (2008):
  <https://pubmed.ncbi.nlm.nih.gov/17848938/>
- Müller et al., tissue loss and metabolic adaptation (2022):
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC9151388/>
- FDA carbohydrate labeling, 21 CFR 101.9(c)(6):
  <https://www.ecfr.gov/current/title-21/section-101.9>
- EU food information regulation 1169/2011: <https://eur-lex.europa.eu/eli/reg/2011/1169/oj>
- Open Food Facts mixed-carbohydrate discussion:
  <https://github.com/openfoodfacts/openfoodfacts-server/issues/5675>

### Product research conclusions

Research across large calorie databases, micronutrient-focused trackers, adaptive nutrition apps,
weight-smoothing tools, and resistance-training products produced a consistent pattern:

- Database scale is useful, but inaccurate public entries erode trust. Local correction and strong
  normalization are more realistic for Musclog than owning a proprietary database.
- Deep micronutrient data needs a calm default surface and progressive disclosure.
- Trend weight reduces the emotional noise of daily scale changes; it now ships.
- Protein, resistance training, and energy expenditure should be more prominent because they match
  the app's strongest data and positioning.
- The most praised experiences usually provide one glanceable result with a transparent drill-down.
- Logging speed—recent/frequent meals, remembered servings, and quick add—matters more in daily use
  than another analytics screen.
- Notifications and streaks should be configurable and non-punitive.
- Progress photos are motivating but require a private, local-first comparison flow.

Those conclusions are translated into the prioritized backlog in `docs/FUTURE_FEATURES.md`.

## OCR and barcode scanning

### OCR decision

The 2026 Apple Silicon investigation compared Apple Vision wrappers, Guten OCR/ONNX, ML Kit,
Tesseract.js, cloud vision APIs, and commercial SDKs. Early notes proposed cloud OCR as a temporary
simulator escape hatch, but that is not the architecture that shipped.

Current platform split:

| Platform | OCR implementation                                          | Reason                                                                               |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| iOS      | `@gutenye/ocr-react-native` in `services/OcrService.ios.ts` | On-device and compatible with arm64 simulator/device builds after the local pod fix. |
| Android  | `rn-mlkit-ocr` in `services/OcrService.android.ts`          | Native ML Kit path used by the Android build.                                        |
| Web      | `tesseract.js` in `services/OcrService.web.ts`              | Browser-local implementation.                                                        |

The useful conclusion from the earlier comparison remains: simulator compatibility is a native
binary-distribution problem, not an OCR-accuracy problem. A cloud service avoids native linkage but
changes privacy, cost, offline behavior, and key management, so it should not be introduced merely
as a development workaround. The Apple Silicon compatibility patch is documented in `docs/FIXES.md`.

### Barcode decision

Live scanning uses `react-native-vision-camera` on native and `react-zxing` on web. Static image
scanning is a separate abstraction:

- iOS uses `@react-native-ml-kit/barcode-scanning` and filters EAN-13, EAN-8, UPC-A, and UPC-E.
- Android uses `react-native-barcodes-detector`.
- Web image processing lives in the web file utilities.

`@react-native-ml-kit/barcode-scanning` is a standard autolinked React Native native module; it
does not need a custom Expo manifest plugin. The previously proposed
`GmsBarcodeScanningDelegateActivity` plugin targeted Google's separate Code Scanner activity, not
ML Kit processing of an existing image, and was rejected.

References:

- <https://github.com/a7medev/react-native-ml-kit/tree/main/barcode-scanning>
- <https://docs.expo.dev/modules/autolinking/>
- <https://developers.google.com/android/reference/com/google/mlkit/vision/barcode/BarcodeScanning>
- <https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner>

## Reactive WatermelonDB data

The default pattern is a service-owned query observed by a focused hook. WatermelonDB broadcasts
writes to every active observer, so multiple components stay synchronized without duplicating the
record into another global store. Always unsubscribe in effect cleanup.

Use context only for genuinely app-wide coordination or to share one expensive subscription. Do
not add Redux/Zustand solely to mirror WatermelonDB records.

### Sorted and paged query trap

Queries containing `Q.sortBy`, `Q.take`, or `Q.skip` use WatermelonDB's reloading observer. An
in-place update reuses the same `Model` instance, so an identity comparison can suppress the
emission even though displayed fields changed. For such lists, use `observeWithColumns([...])` and
list every mutable column the UI reads.

Keep the query shape in one service method and let the hook choose observation behavior. For “load
more,” prefer one growing `Q.take(limit + 1)` window, where the extra row is the `hasMore` probe.
Observing a sentinel query and calling a reset-style `loadInitial()` on every edit collapses the
user's pagination state.

Current reference: `NoteService.notesQuery` with `hooks/useNotes.ts`.

## Exercise search

Product research (see `docs/FUTURE_FEATURES.md`) found that logger users lose time to literal search: a
long-term Strong user could not find "fly" by typing "flys", and gyms call identical movements by
different names. Musclog's search used to be `LIKE '%term%'` on `exercises.name`, with three
compounding problems: no plural or abbreviation handling, SQLite `LIKE` folding case for ASCII only
(Cyrillic and accented names were case-sensitive), and — less obviously — `name` frozen in whichever
language the device used on first boot, so changing the app language never changed what search saw.

Decision: precompute a normalized word set per exercise (`exercises.search_text`) and match query
words against it by substring. This keeps pagination and filtering in SQL (every list in the app is
paged), works unchanged on LokiJS (web), and needs no new dependency. A fuzzy library (Fuse-style)
would have required loading all 873+ exercises into memory on each keystroke and would not have
helped the language problem. Edit-distance tolerance is deferred until real queries show a need.

Why the stemmer is crude on purpose: it only has to be consistent, because the same function
produces the index and the query. Over-stemming therefore costs nothing, while an inconsistent
"smart" stemmer would silently lose matches.

## Gym profiles, plates and substitutions

The same product research that motivated forgiving exercise search found that "smart" workout apps
lose trust when personalization ignores real constraints: a user who marks an exercise as painful
and keeps seeing it, or whose gym has no cable stack and is offered cable work. Two distinctions
drive the design:

- **Constraint versus preference.** "I can't do overhead pressing because of my shoulder" must
  outrank "I like dumbbell presses", so the order is fixed: never and injury (hard exclusions), then
  equipment the gym lacks, then dislike (a demotion, not a removal), then any score. An injury can
  heal, so it carries an end date; a dislike never expires and a "never" has nothing to end.
- **Session versus plan.** The cable station being occupied once must not rewrite a program.
  Swaps therefore only touch the session, and the choices that would outlive it (stop suggesting,
  remove equipment from the gym) are offered as switches rather than inferred. "Just today" exists
  precisely so the common case persists nothing.

Plates are loaded in pairs and gyms own finite inventories, which makes "round to a loadable
weight" a bounded subset-sum, not a greedy fill. The problem is tiny (a few thousand hundredths of a
kilogram, under ten plate sizes), so an exact table is both correct and instant; there is nothing to
approximate. Without a configured gym every rounding and step stays exactly what it was, so the
feature costs nobody anything until they describe their gym.

## Warm-ups and how much the app decides

Two product-research findings shaped this: logging apps accumulate "planning debt" (a template's
numbers go stale, and the user becomes the programmer), while apps that decide for the user lose
trust when the user cannot see or override what changed. The compromise is an **autonomy dial**,
not a separate mode: the same workout model runs Manual (copy the plan), Suggest (start from how
last time went, say why, one tap back) and, later, Adaptive (update the plan itself). Suggest is
the default because a suggestion the user can see and undo costs one tap, while a stale plan costs
the planning work every week.

Warm-ups are excluded from every working-set metric because they are light on purpose: counted,
they drag averages down, make a warm-up single look like a PR attempt, and — worst — would be read
as the "previous set" the next working set is re-targeted from. They are NOT excluded from calories
or Health Connect, because they are real work; the two axes (what happened, what kind of set it
was) are deliberately kept separate so each reader chooses.

## Per-exercise units, scoped notes and cardio logs

**Units resolve most-specific first**: the exercise's own override, then the active gym's, then the
account's (`resolveWeightUnits`). Storage stays metric whichever is shown, so changing an override
never rewrites a weight. The override applies where an exercise's weights are shown or typed — the
session, its set-history, the past-workout detail and its set editor. Session totals (volume) sum
exercises with different units and therefore stay in the account's; the template editor also keeps
the account's unit.

**Three scopes of note, three owners**: the exercise-wide note (`exercise_user_settings.note`) is the
user's own cue and follows the exercise everywhere; a session note lives on that workout's exercise
block (`workout_log_exercises.notes`) and can be copied onto the template exercise it was made
from, in the same batch; the workout note (`workout_logs.notes`) is how the whole session went.
Keeping user preferences in their own table means a catalogue sync never has to know they exist.

**Cardio energy is gross, from ACSM.** Walking VO2 = 0.1·speed + 3.5, running 0.2·speed + 3.5
(ml/kg/min, speed in m/min, level ground), × body mass × minutes, 5 kcal per litre of O2. The 3.5
term is resting metabolism, so the figure includes what the body would spend anyway — the number a
watch reports and the one Health Connect stores. It is never added to the daily energy balance
(which is TDEE-based), so nothing is double-counted. A calorie figure typed from a watch wins over
the estimate. A logged walk/run is a `workout_logs` row with no sets by design: a set is a rep with
a load, and inventing one would put a fabricated performed set into volume and PRs.

**Health Connect keeps distance as a record of its own** (it is not a field of the exercise
session) and needs its own `WRITE_DISTANCE` permission, so the distance write is best effort and
skipped without the grant; the session is still saved. HealthKit takes distance as a total on the
workout, with no extra authorization.

## Watch companion

Not built; this records the intended sequence. Step one is read-only: a watchOS app over
WatchConnectivity and a Wear OS tile that show today's workout, the current set and the rest timer
from a versioned snapshot the phone pushes (never direct database access). Step two adds writes
from the watch, and only once there is a conflict policy: the phone is authoritative for the plan
and the in-progress session's structure, the watch may append performed sets and rest events, and
when both edit the same set the later `updated_at` wins and the loser is kept as a note rather than
discarded. A watch must keep working with no phone in range, so its writes queue and replay in
order.

## AI error handling and Gemini thinking

**A wrong Gemini key is HTTP 400, not 401** (`INVALID_ARGUMENT`, reason `API_KEY_INVALID`, "API key
not valid"), so the key signal is read from the payload and a bare 400 is never blamed on the key.
OpenAI uses 401 / `invalid_api_key`. Recorded fixtures live in `utils/__tests__/aiErrors.test.ts`.
`local` always has a key (`'ollama'` is the default) and gateway/on-device keys are not the user's,
so only `gemini` and `openai` can become `AiInvalidKeyError`.

**Timeouts are 60 s, not the 30/45 s first sketched.** Structured plan generation on a thinking
model can legitimately run past 40 s, and a timeout that fires on a working request is worse than a
slow one. A timeout is retried once (a stalled request usually stays stalled); an auth error never.

**Thinking parameters** (checked against https://ai.google.dev/gemini-api/docs/thinking, which now
documents `thinking_level` for both families and does not mention `thinkingBudget` at all): the table
in `GEMINI_MODEL_CAPABILITIES` still sends `thinkingBudget` to 2.5 models and `thinkingLevel` to
Gemini 3, never both, because that is what the installed SDK types and earlier docs specify. If a
2.5 model starts rejecting the budget, switch that family to `kind: 'level'` — it is one table
entry. Pro models cannot disable thinking, so structured calls ask them for the lowest allowed
value (Gemini 3 Pro `LOW`, 2.5 Pro budget 128) rather than zero.

**Cold-start scan latency** has not been measured on a release build. The scan now logs
`[SmartCamera.aiPhoto] image-read=… settings-read=… request=… total=…` (`adb logcat`), and
`AiService.getAiConfig` no longer awaits up to a dozen settings reads in sequence. If the log shows a
slow `settings-read` or `image-read` on the first scan after boot, record the cause in `docs/FIXES.md`.

## Reasoning effort per job

Source: a competitive review of how Claude, ChatGPT/OpenAI, Gemini, Copilot and Cursor handle
"thinking" (2026-11-23). What we took, and what we deliberately did not.

**Taken.** (1) "Thinking" was three different things behind one boolean: provider effort (Claude,
structured Gemini), a different workflow (meal tracking) and nothing (Gemini chat, OpenAI). Effort is
now a per-job table (`utils/aiEffort.ts`), and the setting only lifts jobs to `high` (reading jobs to `medium`, see "Reading tasks never get the maximum" below). The
numbers (extraction `minimal`, chat `low`, insight and planning `medium`) are product choices: fast
replies matter more than depth for a meal scan or a chat turn, and an analysis of weeks of data or a
plan built from several constraints earns more. (2) The multi-step meal path was the strongest part
of the old behaviour; its core (confirm each claimed food id against the database, estimate the
rest) now runs on every path, because an invented id logged at 0 kcal was a bug, not a mode. (3)
Checks that code can do beat a second model: `utils/mealPlausibility.ts` flags numbers that cannot
all be true and re-estimates only those, once. Alcohol (7 kcal/g, mostly no macros) is the known
false positive: it costs one extra request and the original is kept when the estimate does not improve. (4)
Progress is shown from steps the code really takes, with counts it has (`food.aiProgress.*`), never
a paraphrase of model reasoning (a model's stated reasoning is not a faithful account of why it
answered, and a wrong rationale lowers trust more than none).

**Not taken**, on purpose: a classifier that scores each message's difficulty (one more request of
latency on every chat turn; the job kind is already known to the caller); multi-agent and
parallel-analysis workflows and Gemini thought signatures (they pay off in multi-turn tool loops,
and the coach has no tools); an AI reviewer pass over chat replies below Tokenmaxxing (doubles cost and wait of the
commonest action, no evidence it helps coaching); product A/B tests on "corrected within five
minutes" (the app has no product analytics, by design); sending `thinking: {type: 'adaptive'}` to
Claude (already the default, and the request sends only `max_tokens`, `system`, `messages` and
`output_config`); switching the OpenAI path to the Responses API (the same function serves local
servers, the free tier and Iron, which speak Chat Completions).

**Thinking levels (2026-11-24).** The boolean became four levels at the maintainer's request: Off (the per-job table), Medium (what the switch did: `high` effort plus the verified meal path), High and Tokenmaxxing. Above Medium the extra work is more requests, not only more effort, because two of the providers (on-device, a local server) have no effort knob and the third-party ones top out at `high` or `max`: High adds one review round to meals, plans and insights and reads an extraction twice; Tokenmaxxing makes three independent answers combined by code (a meal makes four from two independent first looks, see below) (median and majority, `utils/mealConsensus.ts`, `utils/extractionConsensus.ts`), two review rounds, and a reviewed chat reply. Two rules carry over from the meal refinement: code, not the model, decides whether a revision is kept (plausibility, plan findings, figures the data does not hold), and an extra request can only make an answer better, never fail it. Self-consistency and self-critique are known to help most where answers vary from run to run, which is the small on-device model's case; nothing here was measured (the evaluation plan covers the levels too). **Seeing before estimating, for meals at Tokenmaxxing.** A meal first gets a structured look (the scene in a sentence or two, the setting, the container and how big it is, what shows the scale, each food with how much of the container it fills, added fats, sauces and drinks, what is uncertain; no calories and no weight of any food: grams are only as good as the sense of scale behind them), and the recipe extraction then reads that look as notes beside the photo or description, which still win where they disagree. The two looks are separate requests, each feeding two samples, because one shared look would put the same perception mistake into every sample and the vote would hide it; an ingredient must be seen under both looks to stay. Like the rest of the levels this is a product choice that has not been measured. **Reversed, for the opt-in top level only:** the "no reviewer pass over chat replies" choice below still holds for Off to High; Tokenmaxxing is a person explicitly asking to trade wait and cost for care. **The free tier never thinks**: it runs on one key whose daily budget every free user shares, so a few people at Tokenmaxxing would use up everyone's quota. On Musclog Iron each extra request counts against the monthly allowance, so moving up to High explains that and Tokenmaxxing also asks the device to confirm it is the person.

**Reading tasks never get the maximum (2026-11-24).** The `extraction` row was `high` at Medium and High and `max` at Tokenmaxxing. It is now `medium`, `medium` and `high`: reading a meal, a label or an import is a lookup of what is on the page or the plate, not a reasoning problem, so more thinking mostly adds latency and tokens (and, on Musclog Iron, allowance) without a reason to expect a better reading, and Tokenmaxxing already spends its extra on independent readings that code compares. Chat, insight and planning keep `high` and `max`. This is a product choice, not a measurement; the plan for measuring it is `docs/AI_EFFORT_EVALUATION.md`.

**Musclog Iron.** The Worker used to force one `reasoning` per feature, so the table could not reach it. It now accepts the app's per-request ask, clamps it to a per-feature ceiling (`reasoning_max`, shipped as `high`) and gives a higher effort more `max_tokens` (`max_tokens_by_effort`, because reasoning tokens count inside the limit and a long answer could otherwise be cut off by its own thinking); the app asks only when `/v1/config` says the deployed Worker takes the field. The token numbers are estimates: none was run against the live model, so the first staging run should look for `finish_reason: length` and for the real cost at `high`.

**Open.** `reasoning_effort` is sent as `low`/`medium`/`high` because every OpenAI reasoning model
takes those; whether each model in `OPENAI_MODELS` accepts it has not been run against the live API
(re-check when the list changes). Nothing measures whether the effort table improves answers: the
plan for doing it (variants, cases, metrics, how to read the result) is
`docs/AI_EFFORT_EVALUATION.md`.

## Photo viewer, saving and feedback links

**Why "save" is the share sheet.** Saving straight to the gallery needs `expo-media-library`, which
declares read permissions of its own (`READ_MEDIA_*` on Android) that the committed manifest would
have to be diffed and stripped of, and an iOS add-only usage string; the app's rule is that photo
picking needs no media permission at all. The share sheet reaches the same place ("Save image" / "Save
to Photos") with no permission, so the manual save shipped on it and the automatic save-after-logging
setting is parked in `docs/FUTURE_FEATURES.md` until someone can run a prebuild and read the manifest.

**Zoom math is focal-point based.** The image point under the focal is `(focal − t) / s`; holding it
fixed while the scale changes gives `t' = focal − (focal − t) · s'/s`, clamped to the scaled image's
edge. That single formula serves pinch, double-tap and wheel zoom alike and is why a double-tap
zooms toward the tapped spot instead of the center.

**Feedback links never carry user data.** A GitHub issue form is pre-filled from query parameters
named after the form's field ids, so the version, platform and language are in the URL and nothing
else; the link only opens a page, and the user decides what to submit. The support email's body has
the same three lines in plain text so the user can read (and delete) them before sending.

## Encryption and App Store characterization

Musclog uses standard AES through `crypto-js` for selected local fields and optional passphrase
exports. Random application key material is kept through `expo-secure-store`; field helpers live in
`database/encryptionHelpers.ts`. Encrypted categories include nutrition log snapshots, sensitive
user metrics, selected saved-for-later values, API keys, and optionally complete exports.

The app does not implement a proprietary cipher, but it does use standard encryption in addition to
operating-system security. For App Store Connect, that is the technically accurate characterization;
Apple may still require jurisdiction-specific export documentation. The Android SecureStore queue
patch changes scheduling only, not algorithms, aliases, or stored formats.

Primary implementation references:

- `utils/encryption.ts`
- `utils/encryptionKeyStorage.ts`
- `database/encryptionHelpers.ts`
- `database/exportDbCore.ts`
- `database/importDb.ts`

## Health platform integration

Android uses `react-native-health-connect`; iOS uses
`@kingstinct/react-native-healthkit`. Platform-specific service files present a shared app-facing
shape for permissions, workouts, nutrition, weight, and body-composition data. Do not infer that a
native package was ignored merely because Prebuild did not add obvious handwritten Gradle or
Podfile lines—React Native and Expo autolinking resolve the installed modules.

Health data needs four safeguards:

- Gate every operation on platform availability and explicit permissions.
- Normalize external samples into metric database units before persistence.
- Use stable external IDs/deduplication metadata so bidirectional sync is idempotent.
- Keep local-only records and provider-written records distinguishable; an imported optical share
  must not inherit another device's Health Connect external ID.

The duplicate Health Connect package failure is documented in `docs/FIXES.md`.

## Optical transfer

### Why a fountain stream

A display-to-camera link is an erasure channel with no back-channel. Ordered chunks force a receiver
that misses one frame to wait for a complete loop. Musclog instead uses an LT fountain code: each
sequence number deterministically selects a pseudorandom subset of source blocks, and a receiver
can reconstruct the payload from roughly `1.25 × K` distinct frames in any order.

The app-to-app pipeline is:

```text
database/share JSON
→ UTF-8 + SHA-256
→ gzip
→ optional AES-256-CBC
→ versioned MLOG container
→ LT fountain frames with a fixed 20-byte header
→ base44 text
→ QR alphanumeric symbols
→ camera decode
→ frame/FNV checks + LT reconstruction
→ decrypt + gunzip + SHA-256 verification
→ validated restore or non-destructive share import
```

Compression must happen before encryption. Full-database containers and share containers use
different payload kinds; only the former can reach destructive restore.

The fountain and frame protocol were ported from the MIT releases of
[decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer) v0.3.0 and
earlier. Upstream changed to AGPL-3.0-or-later at v0.4.0 on 2026-08-09, so later upstream code must
not be copied into this project without a deliberate licensing decision. The Game Boy QR encoder
also retains MIT notices from Project Nayuki and `bbbbbr/gameboy_qrcode` /
`bbbbbr/gameboy_qr_paint`.

### Why base44

Vision Camera and ML Kit expose decoded QR text, not arbitrary bytes; invalid UTF-8 binary frames
can arrive with no value. `utils/optical/base44.ts` uses the QR alphanumeric alphabet without space,
packing two bytes into three characters. It keeps QR alphanumeric mode and costs about 3.1%, while
base64 would force byte mode and cost roughly 25%. Space is excluded so trimming cannot corrupt a
frame.

### Camera and density constraints

The Android vision-camera code-scanner analyzer uses CameraX's default analysis resolution. It was
measured at 640×480 and the sender cannot raise it. The sender also cannot observe the receiving
camera's autofocus, sensor, lighting, or missed frames, so sender-side calibration cannot choose an
aggressive density reliably.

Automatic choice is therefore capped at the conservative `tiny` preset, with user-controlled speed
and density available while streaming. Changing speed is live; changing density starts a new stream
identity and resets receiver progress while reusing the already packed container.

Approximate preset capacity at a 480 px short edge:

| Preset   | QR version | Pixels/module at ~90% fill | Payload bytes/frame |
| -------- | ---------: | -------------------------: | ------------------: |
| micro    |         13 |                       5.61 |                 412 |
| tiny     |         16 |                       4.85 |                 568 |
| compact  |         20 |                       4.11 |                 832 |
| standard |         24 |                       3.57 |               1,136 |
| dense    |         27 |                       3.25 |               1,420 |
| max      |         33 |                       2.75 |               2,006 |

QR version 40 was rejected for the native receiver. Higher density also brought little benefit on a
slow sender because encode work grows with symbol area.

### Measurements

On a Moto Z3 Play release build, QR encode p90 ranged from 81 ms (`tiny`, 548 payload bytes in the
measured configuration) to 321 ms (`max`, 1,986 bytes). Effective encode-bound throughput remained
about 6.1–6.7 KB/s across presets, while decode tolerance worsened with density. Rasterization was
only 0.5–1.8 ms; Reed–Solomon/QR encoding dominated.

A real 649 KB JSON export compressed with gzip level 6 to 70.2 KB in 802 ms (9.2×). Level 1 was
75.4 KB and level 9 was 69.7 KB, so level 6 is the useful tradeoff.

Pixel 6 → Moto Z3 Play tests at `dense` recovered 100 KB in 34.5 seconds and 385 KB in 99.8 seconds,
both with exact FNV/SHA verification. A typical 70 KB compressed export extrapolated to roughly
20–25 seconds.

The deterministic-logarithm sweep hashed to `0x27b0f3cc` on Hermes, matching V8 and the upstream
golden vector. Re-run the on-device bench after Hermes or Expo changes; one arithmetic disagreement
would silently make sender and receiver choose different fountain blocks.

### Frozen compatibility contracts

`utils/optical/fountain.ts` and `utils/optical/frameProtocol.ts` are frozen across app releases. Do
not change `dlog`, soliton selection, seeds, indices, the little-endian 20-byte header, or its magic
without a new wire version. Evolve the reassembled container instead, where the receiver can report
an intelligible version mismatch. Golden tests are compatibility tests, not snapshots to update.

The frame loop lives once in `hooks/useQrFrameLoop.ts` and is shared by production and the bench.
It self-schedules, disposes native images, and builds only a cache large enough to loop safely.
Receiver progress is based on collected frames because LT peeling solves blocks late.

### Game Boy sender

Musclog GB is sender-only. It can send its whole database or one nutrition day. Scarce memory means
it streams a compact JSON schema from SRAM/ROM rather than constructing the payload in one buffer.
It uses 292-byte fountain blocks, base44, and fixed QR version 11-L/mask 0.

`data/gameBoyOpticalProtocol.json` is the shared TypeScript/C contract for export versions, enums,
and append-only food/exercise identity tables. Positions are stable identities in cartridge saves
and optical payloads; never sort or regenerate them from a changing popularity subset. Unknown
newer indices fall back to the tuple shipped by the cartridge instead of rejecting the transfer.

Whole-database transfer is a confirmed destructive replacement after backup. A day transfer expands
into the same rootless `nutritionDay` share envelope used by app senders and asks the receiver to add
or replace. Because the cartridge stores no meal time/type, imported Game Boy entries use local noon
and `other`, and the preview says that times are unknown.

### Web receiver

Web draws with DOM canvas and reads `getUserMedia`. It tries the browser's `BarcodeDetector` only
after confirming QR support, then falls back to self-hosted `zxing-wasm` (zxing-cpp). In the local
simulated-camera harness, the older pure-JS ZXing decoder read 5/18 stressed frames at 10–280 ms;
zxing-cpp read 18/18 at 2–12 ms, including the densest 2.6 px/module case.

The wasm is copied into `public/` by `scripts/sync-web-wasm.js` and loaded from the app's own origin.
There is intentionally no CDN fallback because offline transfer must not depend on or notify a third
party.

## Integrating progression and weekly reviews

The everyday loop is plan → train → understand changes → review the week. MacroFactor’s [inline logging and nearby timers](https://macrofactor.com/wp-content/uploads/2026/01/Workouts-Quick-Start-Guide.pdf), [contextual progression explanations](https://help.macrofactorapp.com/en/articles/391-what-does-the-smart-progression-wand-mean), and [declinable weekly nutrition decisions](https://help.macrofactorapp.com/en/articles/247-introduction-to-check-ins-and-coaching-modules) inform presentation. They do not supply Musclog’s algorithms. Musclog retains deterministic local calculations and optional AI.

Workout progression runs immediately at session start and between applicable sets, with read-only future projections after training. Weekly training acknowledgement summarizes it and never approves or delays it. Nutrition targets can instead use weekly approval: dated stable targets start tomorrow, keeping a clear historical record. The weekly recommendation includes available expenditure history before solving the existing goal trajectory; the daily resolver preserves its legacy trajectory branch. Formula baselines and empirical estimates are labeled separately, with existing evidence thresholds rather than invented confidence scores. Periodization, watches, social features and reproducing proprietary algorithms remain outside this implementation.

## Cycle tracking: prediction thresholds and evidence

**Prediction is a range with a confidence level.** `utils/cycle/cycleStats.ts` centres the prediction on a recency-weighted median of up to the last 12 usable cycles (`predictedLength`; a cycle six back counts half), and the range includes the shortest to longest of them, padded to at least seven days either side of the predicted length below three usable cycles, three below five, and one thereafter. The plain median (`medianLength`) and the true shortest/longest (`rangeLow`/`rangeHigh`) are what the user, the reminder explainer and the appointment summary are shown as facts; the details sheet says when the prediction uses a different length. This is a historical heuristic, not a calibrated probability interval. An explicitly unknown fallback length suppresses dates until usable history exists. The prediction inspector reports retrospective next-start coverage, midpoint error and window width using only earlier starts; this is not clinical validation. Confidence is `low` below two usable cycles, `moderate` below four and `high` from four; a spread above 9 days (the ACOG threshold for irregular cycles) lowers it one level, and above 20 days it is `low` and a single date is offered to be hidden. From six usable cycles, the one farthest from the median is left out of that spread, so a single unusual month does not relabel steady cycles for a year.

**The prediction benchmark.** `utils/cycle/__tests__/predictionBenchmark.test.ts` runs the same one-step-ahead check as the inspector over seeded synthetic histories (`syntheticCycles.ts`: regular, typical, variable, drifting, step change, rare outlier; 40 people × 24 cycles each). The profiles are modelling assumptions, not real data; validating against a public tracked-cycle dataset is still open. It reports hit rate, mean error and mean window width together, because a wider window always hits more often. Results that shaped the current model (hit rate / mean error days / window days):

| Profile      | Unweighted median (before) | Recency-weighted (now) |
| ------------ | -------------------------- | ---------------------- |
| regular      | 0.824 / 1.32 / 6.16        | 0.826 / 1.34 / 6.16    |
| typical      | 0.820 / 2.48 / 10.10       | 0.820 / 2.53 / 10.12   |
| variable     | 0.816 / 3.98 / 13.96       | 0.816 / 4.08 / 14.04   |
| drifting     | 0.817 / 2.09 / 7.92        | 0.819 / 1.94 / 7.92    |
| step change  | 0.803 / 3.20 / 9.96        | 0.802 / 2.80 / 9.97    |
| rare outlier | 0.814 / 2.87 / 12.67       | 0.815 / 2.94 / 12.74   |

Recency weighting cuts the error by 12% after a lasting change and 7% under drift, at a cost of 2–3% on noisy cycles; half-lives from 3 to 9 cycles traded these off, and 6 is the middle. Two other ideas were measured and rejected: a window learned from the person's own past prediction errors was no narrower than the shortest-to-longest window at the same hit rate, and leaving the outlier out of the window (rather than only the variability label) narrowed it by about 1.5 days but missed about 10% more starts. Moving the padding thresholds to the confidence thresholds (two and four cycles) narrowed windows by half a day and missed about 2% more starts, so the two sets stay separate. The numbers are named constants in `constants/cycle.ts`. Logged period count is deliberately not the input: four starts 70 days apart are four logs but a poor basis for a date.

**Which cycles count.** A gap under 15 days is treated as a probable mislog, and one at least 1.8 times the median of the others (with at least two others to compare) as a probable missed period. They are shown with the reason rather than dropped, and the person can manually exclude a cycle or confirm that a flagged long interval really happened. Confirmation never bypasses short-interval or physiological-context exclusions. Cycles under a method that usually stops ovulation, and postpartum cycles, are excluded because they are not natural cycles.

**Ovulation is not predicted from cycle length.** Calendar-style estimates identify ovulation poorly ([systematic review of consumer apps](https://pubmed.ncbi.nlm.nih.gov/29749274/)), so the fertile window is opt-in, shown with a not-contraception note, and absent whenever the context makes it meaningless (hormonal methods, postpartum, perimenopause, PCOS, tracking without bleeding). Which methods usually suppress ovulation follows the [NICHD overview](https://www.nichd.nih.gov/health/topics/contraception/conditioninfo/types): combined methods usually do, a hormonal IUD or progestin-only pill often does not, a copper IUD never does.

**No phase prescriptions.** A [meta-analysis of exercise performance across the cycle](https://link.springer.com/article/10.1007/s40279-020-01319-3) found trivial average differences and does not support universal phase-based guidance. The app therefore removed the fixed energy labels and intensity multipliers and instead reports how the person's own logged symptoms, mood and workout volume behaved near the start of their periods, only from three or more cycles and with the evidence listed.

**Residual metadata.** The cycle tables encrypt every personal field in one `payload`, but record ids and `created_at` / `updated_at` stay plaintext, so the device can reveal _when_ something was logged, never _what_. Exports shared outside the app, and local recovery points made before the conversion, can hold plaintext copies; "delete all cycle data" offers to remove the recovery points and says plainly that shared files are out of reach.

**Dates.** Starts and ends are local calendar days. Predicted dates are computed with calendar-day arithmetic (`utils/cycle/dates.ts`), never `start + N * 24h`, which lands an hour off midnight across a daylight-saving change and moves a predicted day at the edge of a range.

### Cycle journal portability and recovery

Cycle-only JSON version 1 identifies itself with `format: "musclog-cycle"` and `version: 1`.
Its arrays are `periods`, `dayLogs`, `contexts` and `moods`; `config` optionally carries usual
lengths, goals, custom symptoms, enabled observation fields and custom field definitions.
Record ids, cycle ids and source timezone offsets do not travel: start/end/day/effective dates
are local `YYYY-MM-DD` calendar dates, converted to local midnight on the receiving device.
Period end kind, exclusions, notes, symptom severity, explicit no-symptoms responses and custom
labels survive. Shared mood history is included explicitly, including days without cycle logs.
Future versions fail validation rather than silently discarding fields.

CSV periods retain their original columns and add `excluded_from_stats`, preserving user exclusions even for an unfinished cycle. Daily CSV adds `mood_0_4`, `observations_json` and
`symptoms_json`; the last two contain JSON inside RFC 4180 escaped cells. The JSON symptom
column avoids ambiguous delimiters in user-created names; older daily CSVs retain support for
`key:severity` pairs separated by semicolons. Context CSV uses `effective_from`, `life_stage`,
`contraception`, `note`. Plain-text notes are defused for spreadsheet formula execution.
JSON is the complete format for recovery, including configuration and field definitions;
individual CSV files are primarily for inspection and selective migration. Future journal/mood entries that older app versions allowed are preserved on import; insights and appointment summaries exclude them until their date. Other trackers'
formats are not accepted yet.

Imports merge without clearing the database. A matching date is kept by default; explicitly
choosing replacement replaces that record, rather than silently combining incompatible
observations. Overlapping periods against existing data are counted and skipped. Duplicates
within a file, future period/context dates, invalid calendar dates, conflicting custom field definitions and invalid
values reject the file. The service repeats validation and reads under its writer before one
batch. New custom definitions are carried even when other preferences are kept, to preserve
readable history. Empty imported day entries do not create observations; an explicitly replaced
empty day clears its existing day record.

Encrypted backups wrap this JSON with `format: "musclog-cycle-encrypted"`, version 1,
algorithm `PBKDF2-SHA256/AES-256-CBC/HMAC-SHA256`, 210,000 iterations, a random 16-byte salt and
IV, base64 ciphertext and a hex HMAC. PBKDF2 derives separate 32-byte encryption/authentication
keys. Authentication covers the format, version, algorithm, work factor, salt, IV and ciphertext,
and is checked before decryption. The password is preserved exactly, confirmed before export,
and never persisted. A lost password cannot be recovered by the app. A backup needs storage
outside the phone; the last-prepared timestamp deliberately makes no claim that the share sheet
completed or that a durable external copy exists. There is no automatic sync.

Cycle symptom comparisons are observational: daily cell values stay missing when unlogged,
explicit no-symptoms is zero, and historic unrated presence has its own marker. The pre-period
view aligns to the next recorded start, never a predicted one. Recurring pre-period symptom
insights inspect seven days and still require at least three observed cycles.

### Completing the cycle journal

Daily-life impact complements numerical pain and flow: disruption, activity limitation and inability to do usual activities are self-reported observations, not severity-based triage. NHS [heavy-period guidance](https://www.nhs.uk/conditions/heavy-periods/) and [period-pain guidance](https://www.nhs.uk/symptoms/period-pain/) support discussing symptoms that affect daily life. The optional PMS diary references [RCOG guidance](https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/) on prospective recording over two cycles; it is explicitly not a validated PMDD instrument. Clinician review and validated condition-specific tools remain future work.

Trends without bleeding dates use calendar time and actual logged values, never inferred menstrual phases. Imported Health Connect/HealthKit bleeding and basal temperature are separate provenance records; skin temperature is not treated as basal temperature. Health exports use each platform's documented types and stable Musclog identifiers and never forward sex, medication, notes or imported values. The user's store permissions can limit the history visible to the app.

Backups remain manual per user preference. The user explicitly prepares a password-protected, authenticated file and chooses where to save it. Last-prepared status is not proof of off-device storage. New-phone recovery requires the retained file and its password; optional reminders only prompt the user. Automatic client-encrypted cloud backup and multi-device synchronization remain future work.

## Cycle reminders: what people keep enabled

A review of period-tracker notifications (Flo, Clue, Period Calendar, Natural Cycles, Stardust, Maya, WomanLog, Clover, Euki, Apple Health; their documentation, store reviews and community threads, plus platform guidance and prediction studies) decided the reminder design:

- **People disable everything to escape one noisy category.** Each reminder is its own switch, there is no engagement, content or promotional notification at all, and the daily check-in is off by default.
- **The lock screen is a public place.** Wording is a separate choice from tone: Private (never says what it is about, the default), Subtle (names the task, never the topic) and Detailed. Settings preview the exact text, built by the same function that schedules it. Android additionally gets a `cycle` channel with PRIVATE lock-screen visibility.
- **A calendar estimate is not a date.** Calendar-based fertile-day classification is frequently wrong, especially with irregular cycles, and generic trackers' period predictions can be days off. Detailed copy therefore states the estimated range and calls it an estimate; fertile-window copy says it is not confirmation of ovulation and not contraception.
- **A longer cycle is not a pregnancy prompt.** The optional "longer than usual" reminder is neutral and names no reason; the explainer says Musclog never assumes one. Recording a pregnancy loss stops every prediction and period reminder (the context suppresses them) and offers — never applies — a quiet period for the rest.
- **Reminders must explain themselves.** Each states when it fires, how often, and whether its date is an estimate or a time the person chose; tapping one opens "why did I get this?" with the cycles behind it.
- **Adherence reminders outrank everything else.** The pill reminder knows the pack (21 + 7, 24 + 4, continuous) instead of nagging through pill-free days, and a pause does not silence it.
- **Ask for permission in context.** Notification permission is requested when a reminder is switched on, and a delivery check shows whether a reminder can arrive at all, with a test send.

- **A button is a second lock-screen surface.** The pill reminder's actions are worded Done / Later / Skip, not "Taken", because the notification text can be set to say nothing about pills and an action row reading "Taken" would give it away. "Done" and "Skip" write the answer straight onto the day (`observations.pill`, shown and correctable in the day sheet); "Later" and "Snooze" re-send the same wording once as a separate `menstrual-cycle-snooze` notification, which an ordinary reschedule must not erase but must re-check — a pause or a context change that removes the prediction cancels a snoozed estimate, and only the pill (pause-exempt) and routines the person scheduled survive it.

Per-category lock-screen levels and wearable sync alerts are recorded in `docs/FUTURE_FEATURES.md`.

## Workout notifications: what is a notification and what is a surface

A review of workout-app notifications (Hevy, MacroFactor Workouts, Strong, Fitbod, trainwell, Keep, Strava, Apple Fitness; their help centres, release notes, store reviews and community threads, plus Apple and Android guidance) decided the design:

- **Four jobs hide behind one permission prompt**: in-workout timing, adherence reminders, coaching/social, and marketing. Musclog sends only the first two, each with its own switch and Android channel, and nothing promotional or social.
- **The rest alert is infrastructure, not engagement.** The complaint that recurs is not "too many" but "too quiet, delayed, indistinguishable or missing". So it is the only `timeSensitive` notification, keeps the loudest channel, can repeat once, and is configurable on three independent axes rather than one "stronger" default: the chime (off moves it to a vibrate-only channel — Android fixes a channel's sound at creation), the haptic firmness, and a "get ready" heads-up (off / 10 / 20 / 30 s) that is both a visual state with a single buzz and, backgrounded, a quiet notification. Users disagree sharply on volume, which is why there is no single right default.
- **A timed set is not a rest.** Strong's threads show lifters repurposing the rest timer for planks and holds. The work timer is a separate primitive that counts a duration down and then hands over to the rest timer — and because logging the set a moment later would start a second rest, the timer remembers the rest it started and the next set completion skips its own.
- **A reminder should say why it exists and offer a narrower exit than "turn everything off".** A tapped workout reminder opens a sheet that names the workout, the planned weekday and time and whether that day came from a plan or the workout's own schedule, and offers a one-week pause, turning workout reminders off, or the notification settings. A per-workout mute and an editable per-plan reminder time are not built (see `docs/FUTURE_FEATURES.md`).
- **Persistent surfaces beat repeated pushes** (a Live Activity or chronometer notification over a stream of banners). That is the largest remaining item and the only one needing native code; it is specified in `docs/FUTURE_FEATURES.md`.

### Cycle phase and training

Cycle-phase effects on strength and performance are small and inconsistent (a trivial reduction in the early follicular phase in pooled data, with low-certainty evidence), and follicular-phase length, hence ovulation day, varies widely between and within people. The app therefore draws no phase-based training conclusions and shows no cycle card in the live workout session, where an observation would read as a prediction about today. The personal "lower volume near a period start" observation compares each session only with the same workout away from period starts, excludes deliberate lighter weeks, and needs four comparable cycles.

## Strength levels: what the numbers are

Levels are thresholds on the same relative strength goal projection uses: estimated 1RM ÷ (body weight × `loadMultiplier` × a sex factor). They are product choices, not published norms. Commercial strength-standard tables were deliberately not used; we can't cite or license them.

**Checked against [OpenPowerlifting](https://www.openpowerlifting.org) data** (public domain; the 2026-10-31 export from [opl-data](https://gitlab.com/openpowerlifting/opl-data)). Method: 4.06M entries, keeping `Raw` and `Wraps`, ages 18 to 39 or unknown, body weight of at least 40 kg, no disqualified or no-show results, and each lifter's single best lift ÷ body weight, leaving 507k lifters.

| Best lift ÷ body weight | p10  | p25  | p50  | p75  | p90  | p99  | Lifters |
| ----------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ------- |
| Men, squat              | 1.62 | 1.91 | 2.22 | 2.52 | 2.81 | 3.36 | 271,617 |
| Men, bench              | 1.09 | 1.29 | 1.50 | 1.72 | 1.92 | 2.32 | 351,270 |
| Men, deadlift           | 1.91 | 2.22 | 2.55 | 2.87 | 3.18 | 3.76 | 297,534 |
| Women, squat            | 1.11 | 1.35 | 1.64 | 1.93 | 2.21 | 2.78 | 121,265 |
| Women, bench            | 0.60 | 0.73 | 0.89 | 1.07 | 1.26 | 1.67 | 137,696 |
| Women, deadlift         | 1.37 | 1.64 | 1.95 | 2.27 | 2.58 | 3.15 | 130,092 |

**`loadMultiplier` anchors stay as they are.** The men's medians run squat : bench : deadlift at 1.48 : 1 : 1.70; the anchors (1.4, 1.0, 1.8) run 1.40 : 1 : 1.80. That is within about 6%, under the noise of the model, and the anchors also drive the energy estimate, so moving them would change calories for no real gain. The data only covers these three lifts; every other multiplier is derived from them.

**The flat 0.7 sex factor did not hold up, so it is now split by region.** The women's-to-men's ratio of medians is 0.74 for squat, 0.76 for deadlift and 0.59 for bench. A single 0.7 graded women's bench about 15% too harshly. `strengthGenderFactor` uses 0.75 for legs and 0.6 for torso and arms, keeping 0.7 where the data says nothing (core, unknown).

**Boundaries.** Intermediate 1.0, advanced 1.5 and elite 1.8 are the tiers goal projection already used, so the two features can't disagree; novice 0.6 is new. On the men's data a normalized 1.5 sits near the competitor median (squat 1.59, bench 1.50, deadlift 1.42) and 1.0 sits just below the 10th percentile (1.16, 1.09, 1.06).

**What this sample can't say.** Competitors are a strong, self-selected group, so no percentile is ever shown to the user, and "advanced" means roughly "a typical raw competitor", not "top X% of gym-goers". Federation mix and weigh-in timing also shift these figures. The age adjustment was left out: it was allowed only with a primary source for the McCulloch coefficients, and a search found only secondary pages that disagree on who made the table, where it starts and how it is applied.

## Recent training load and weekly sets

The body map on Progress describes what was trained recently. It does not say a muscle has recovered or is ready, because a set count can't know that.

**Sourced:** 10 to 20 sets per muscle per week, and diminishing value past about 10 sets per muscle in one session, both from Schoenfeld, _Science and Development of Muscle Hypertrophy_, 2nd ed.

**Product choices, not research results:**

- A secondary mover counts as half a set. The other choices are 0 (ignores real work) and 1 (double-counts every press as a triceps session); half is the simple middle.
- One 48-hour half-life for every muscle, and a 7-day window. A per-muscle table of half-lives would look more precise without any data behind it.
- Shading edges of 0.5, 3 and 6 decayed sets.
- Rated and unrated sets count the same. Effort ratings are too sparse to weight by, and an unrated set is not an easy one.

**Deliberately not done:** lift-ratio "structural balance" tables (weak source). The push/pull and quad/hamstring lines state the person's own weekly sets and assert no ideal ratio. Sets are counted per body-map region, so a set listing two deltoid heads is one shoulder set.

## Importing history from other apps

Column layouts were checked against real exports, not only documented headers: [openweight](https://github.com/radupana/openweight) (Apache-2.0) ships real Strong and Hevy files plus hostile variants, [workout-data-sync](https://github.com/matanabudy/workout-data-sync) a Hevy sample, and [gymruntohevy](https://github.com/aimarchirico/gymruntohevy) Strong's current semicolon format. FitNotes (Android) is confirmed only by the columns [fitnotes2fit](https://github.com/tihawk/fitnotes2fit) binds, and FitNotes 2 (iOS) by no public file at all. None of these files are in this repository; our fixtures are hand-written.

Sanity limits (1000 kg, 1000 reps, 1000 km, 24 h per set) are product limits for spotting a broken cell, not physiological claims. A day-only date is stored at local noon, the same rule as Game Boy imports, so it stays on its day in every timezone. A timed set has no column of its own, so it keeps zero reps with the time in the exercise note rather than inventing reps.

## Comeback mode: what the research says and which numbers are our choices

The brief (`get-the-routine-back-research.md`, a literature and practitioner synthesis on restarting training and eating after a long break) agrees on the shape, not on numbers: there is no single right plan; start deliberately small; progress by how recovery feels rather than a fixed percentage; make a minimum viable day count; never double up after a miss; judge progress against week 1, not the old peak; plan with if-then cues; check in at weeks 2, 4, 8 and 12; ease into nutrition (maintenance, then a modest deficit, protein first); and use self-compassion, not guilt.

**Taken from the brief:** 1 to 3 working sets and about 3 to 4 reps in reserve early, two strength days plus easy cardio, the 10-minute minimum day, the if-then cue sentence, the miss rule ("do the next one, never double up"), the checkpoint weeks, and the 300 to 500 kcal deficit range after a maintenance start.

**Product choices (the brief gives sets and effort, not loads or schedules):**

- Load factor against the pre-break load by break length: 0.9 (under a month), 0.8 (1 to 3 months), 0.7 (3 to 6 months), 0.6 (over 6 months), plus 0.1 per week, capped at 0.95. Detraining is faster for strength endurance than for maximal strength and varies widely, so these are conservative defaults the lifter's own sets override: the floor is any load already performed during the comeback.
- Reps in reserve 4, 3, 3, 2 and working-set caps 2, 2, 3, plan across weeks 1 to 4 (1 in week 1 when energy is low).
- Deficit size: 300 kcal, or 500 when the person reports plenty of energy; offered at week 2, clamped to the minimum-calorie floor.
- The 14-day lapse threshold, the 30-day re-offer, and 10 days of silence as "stalled".

**Deliberately not done:** phase- or mood-based prescriptions, a guilt-framed streak (the card counts active days instead), automatic deficits, and any clinical screening beyond a one-line see-a-doctor note for long breaks and a quiet support link. Wellbeing is a light touch: one optional energy question that makes the start gentler.

## Your year in Musclog: the food posters

The protein poster states a total, in the person's own units, and one comparison. Which numbers are
ours: a medium cooked chicken breast is counted as 40 g of protein (USDA FoodData Central lists
roasted chicken breast at about 31 g per 100 g; a medium breast is roughly 130 g), and the weighed
objects are everyday sizes (a 1 kg bag of whey at about 80% protein, a cat 4.5 kg, a bowling ball
7.3 kg, an Olympic barbell 20 kg). A comparison appears only from about two of the object (ratio
1.75), so the rounded count is never more than a seventh off. Calories are deliberately never
compared with food: "that is 300 pizzas" reads as a verdict on eating. The jokes borrow shared gym
and diary culture (the chicken, rice and broccoli meal that [Mel Magazine](https://melmagazine.com/en-us/story/chicken-broccoli-rice-bodybuilding-meme)
traces to bodybuilding, and "I'll log it later", the usual way diary tracking lapses) and stay on the food, never the person.

## Coach conversation quality: what the chats showed and what we changed

**Why this exists.** A maintainer export of real coach chats (2024-07 to 2026-08; 370 messages, 35 from the person, the rest daily insights) showed four repeatable failures, all on the request side rather than the model: (1) after "as you know I'm cutting at 1700 kcal" the coach suggested HIIT to someone who then said hunger was the problem, because it only ever saw one-sentence summaries of its own earlier replies; (2) "Top" and "Hehe ok thank you" were answered with "Awesome! … I'm here to help you achieve your goals!"; (3) one finished workout was described as two sessions with 7 personal records (the same session was in the system prompt's workout list and again in the history); (4) nothing told the model that three weeks had passed. The free tier is Gemma 4 31B and Premium is `openai/gpt-6-luna` at low reasoning, so both are small models that follow a long, list-shaped prompt literally.

**What we changed and what each rests on.**

- _Verbatim recent turns, local shortening of older ones, no model-written summaries._ Matches OpenAI's trimming-versus-summarising guidance (keep the recent turns raw; summaries drop and misweight detail). The 12/30 numbers are our choice, not a research figure.
- _Timestamps on user turns only._ A model imitates its own earlier turns, so coach turns are never tagged. The pause note (12 h) is our threshold.
- _No clock in the system prompt._ Providers cache a matching prompt prefix (Gemini implicit caching from 2,048 to 4,096 tokens depending on the model; Claude automatic caching through one top-level `cache_control`; OpenAI-compatible from 1,024). A per-minute clock at the top defeats all three. Minimum sizes change: check the providers' caching pages before relying on a number.
- _`msg4User` first, then `remember_me`, no `sumMsg`._ Tam et al. (EMNLP 2024, "Let Me Speak Freely?") found strict output formats hurt reasoning mainly when the answer key comes before the reasoning; for chat prose the effect is small, and what the JSON still carries is only the memory field.
- _Prompt shaped around conversation, not capabilities._ The old base prompt was a capability list with "provide specific exercises, sets and reps", "offer 2-3 alternatives", a hard 100-word cap and "use emojis", which produced prescriptive, list-shaped, padded replies. The new one asks for answering first, at most one question, matching the message's length, no unearned praise, using only figures that appear in the data, and acknowledging worry before advising.
- _Memories shared across threads, deduplicated, dated._ A memory store that decouples what is kept from what is eligible (the CALM idea in the maintainer's research note) needs a validity flag; we chose recency instead of a schema change, so "newer wins" is stated in the prompt and a near-duplicate replaces the older one.
- _Not done on purpose:_ a server-side memory service, vector retrieval and an agent framework (the app is local-first and bring-your-own-key), and tool calls for history (`get_workouts(range)`): the right end state, but seven providers, on-device AI and streaming make it a project of its own.

**How to judge a change.** `utils/__tests__/fixtures/coachReplay/scenarios.json` holds 20 scenarios with a `replyRubric`: the four failures above, plus 16 synthetic ones written for named failure modes (remaining calories today, a stalled lift, venting, a return after weeks, pain, a full plan, one-word and thank-you replies, off-topic requests, a needed clarifying question, a new injury, a changed goal, data the app does not hold, a lighter week in the Weekly Review, hunger on a deficit day, a recipe). Those with a `snapshot` carry the "Right now, read from the app" lines the coach would see; five are in Portuguese, Spanish or Russian. `coachChatRequest.test.ts` enforces the shape and the request side offline. To judge replies, run each scenario's history, snapshot and message through the app against the provider you care about (free tier and Premium separately) and read the reply against the rubric. Nobody has done that run yet: until it is done, the prompt rewrite is reasoned, not measured. `getRecentLlmUsage()` shows tokens and cache hits per call in a debug session.

## Agent orchestration: what each tool enforces

The policy is the "Orchestration" section at the top of `AGENTS.md`; the tool files only pin models
and limits. It must stay first: Codex reads `AGENTS.md` up to `project_doc_max_bytes` (32 KiB by
default) and Antigravity truncates a rule file at 24,000 bytes, while this file is about 268 KB, so a
section added at the end is invisible to both (measured with `codex debug prompt-input`: the block
Codex receives is 32,829 characters). The same cap hides the rest of the project rules from Codex.
Raising it for this repo is one line in `.codex/config.toml` (`project_doc_max_bytes = 400000`, honoured
in a trusted project; it costs about 60k extra tokens per Codex agent thread), left unset on purpose.

| Tool        | Worker models                                 | Enforced by the tool                                                                                    | Only asked for in `AGENTS.md`                                              |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Claude Code | `.claude/agents/*.md` `model:` (aliases)      | Pinned worker models; `worker-lite` has no `Agent` tool; nesting depth and concurrent-subagent ceilings | Which worker the session model may spawn; no forks or general-purpose      |
| Codex       | `.codex/agents/*.toml` `model` (pinned slugs) | Pinned worker models and effort; concurrent-thread ceiling                                              | Which worker the session model may spawn; nesting depth; lite not spawning |
| Antigravity | `.agents/agents/worker.md` `model: flash`     | Pinned worker tier; `tools` allow-list leaves out the subagent tools (untested, tool not installed)     | Which model may spawn; nesting depth (fixed at 10 by the tool)             |

Notes that explain the choices:

- **Claude Code reads `AGENTS.md` only when no `CLAUDE.md` exists** (v2.1.277+), so there is no
  `CLAUDE.md`; adding one without `@AGENTS.md` silently drops every project rule
  (`utils/__tests__/agentOrchestration.test.ts` fails on that).
- **Under-delegation was observed and is why the policy is a split, not a judgment call.** A Sonnet
  orchestrator was told to delegate, announced that it would hand the mechanical items to
  `worker-lite`, and then did almost all of them itself under the old escape hatch "anything cheaper to
  do than to brief", leaving one task with Haiku in a 40-item change. Two things were unclear: that a
  session whose only allowed worker is `worker-lite` has one tier, not none (the table's "Sonnet:
  `worker-lite`" reads like a limit and is a to-do), and what counts as trivial. The section now lists
  what the orchestrator keeps (design decisions, edits shorter than their brief, lookups, integration
  and validation), sends everything else to a worker, and asks for a `delegated`/`kept` line per subtask
  in the report, so a thin delegation shows up in the result instead of when the user asks. In the same
  session the agent's files appeared staged, could not be explained from the repo's scripts or
  `.claude/settings.json`, and were unstaged by the agent; they were the user's own staging from their
  editor, committed minutes later. So the validation step looks at `git status --short` and reports
  what is staged, but never unstages it.
- **The orchestrator's tier is not known to the tool**, so "who may spawn what" is a rule the
  orchestrator applies to itself. The only native control that depends on the parent is the per-call
  `model` parameter, which is not used: workers are chosen by name so the pinned model applies.
- **`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` in
  `.claude/settings.json` `env` work** (depth 1, 2 and 3 gave exactly 1, 2 and 3 layers in a live run;
  a concurrency limit of 1 ran one subagent and rejected the other two). `worker-lite`'s
  `disallowedTools: Agent` also holds with depth to spare. Judge such tests from the session transcripts, not from a model's description of its
  own tools: a middle worker collapsed a two-step chain and models misreport their tool lists.
- **Codex (0.163.0, multi-agent V2), measured from the session logs in `~/.codex/sessions`:** the
  project `.codex/agents` files are found and their `model`/`model_reasoning_effort` win over the
  parent's (root `gpt-6.1-sol` spawned `worker` on `gpt-6.1-terra` and `worker-lite` on
  `gpt-6-luna`). `[agents] max_concurrent_threads_per_session` is enforced (a limit of 1 allowed one
  child, the rest failed with "agent thread limit reached"); the separate
  `features.multi_agent_v2.max_concurrent_threads_per_session` counts the root thread too and is
  not set. `agents.max_depth` is **not** enforced (a depth-3 thread appeared with it at 2), and
  `[features] multi_agent = false` inside an agent file does not remove its ability to spawn, so
  nesting depth and a leaf `worker-lite` are instructions only, and a task that explicitly asks a
  worker to spawn can override them. Codex only delegates when the user or `AGENTS.md` explicitly
  asks, which is why the section says "explicit instruction to delegate". Test with
  `codex exec ... < /dev/null`: it waits on an open stdin.
- **Cross-provider delegation is not supported by any of these tools' subagent files**: Claude `model`
  takes Claude aliases or IDs, Codex a Codex model slug, Antigravity `inherit`, `flash` or `pro`.
- **Tier order used** (list prices from third-party summaries, consistent with the model catalogue
  descriptions): Codex Astra ($10/$50 per million tokens) above Sol ($2/$10), Terra ($1/$5) and Luna
  ($0.10/$0.50). Re-check when a catalogue changes: `codex debug models` prints the descriptions.
- **Cheap Agent was evaluated and not adopted; some of its techniques were.**
  [`cheap-agent`](https://github.com/muaaz9329/cheap-ag) (MIT) sends work to a non-Claude model
  through OpenCode, which needs a paid provider key or a local model that is good at tool calls. With
  subscription-only use that adds a backend and hooks but no saving over `worker` and `worker-lite`,
  and the repo no longer references it. Nothing of it was run end to end. Read from its source, what
  carries over to native subagents became the "Brief and result protocol" bullet: the `source:` line
  and one backticked check in a brief, a failing test before a bug fix, a status word first in the
  reply with `found`/`missing`/`tried`, no re-running a verified `OK`, one retry then ask, and
  research handed to a cheap read-only worker. Not adopted: its server instructions ("send every code
  change to delegate", "don't open source files before delegating") contradict keeping judgment work
  with the orchestrator; its edit guard and failure-takeover hooks (they need the server); worktree
  isolation (workers here edit disjoint files in the shared tree, and a worktree has no
  `node_modules`); and per-job turn, minute and cost caps (no native equivalent was verified).
- **Changing a tier**: edit that tool's agent-file `model` line and its row in the `AGENTS.md` table;
  the test fails if they disagree. Claude aliases follow new releases without any edit.
- Other tools read `AGENTS.md` natively (Copilot, Cursor, Windsurf, Roo Code, Kilo Code, Cline) and
  get the policy as instructions only; none of them has a documented file-based way to bind a worker
  to a cheaper model that this repo could configure without per-user settings. Gemini CLI reads
  `GEMINI.md` unless `context.fileName` lists `AGENTS.md`; it is not configured here.

## On-device AI (2026-11-23)

- **Why one model.** Maintainer decision D2: a single downloadable model, LFM2.5-VL-450M (text and vision), run by llama.rn 0.12.9 (pinned exactly, with the bundled llama.cpp), plus Apple Intelligence on iOS through `@react-native-ai/apple` 0.12. The sizes, speeds and benchmarks in `docs/ON_DEVICE_AI_PLAN.md` are vendor figures read on 2026-11-23; **none is a measurement of ours** until the P0 spike and P7 bench (`app/app/test/local-ai-bench.tsx`, pass bars in plan section 12: 98% valid structured output, 80% correct food names, text TTFT 2 s on a 6 GB Android, photo identify 10 s, no OOM in 50 runs) are run on phones.
- **Structured output is checked, not trusted.** The gguf engine is grammar-constrained by llama.cpp, then parsed and checked against the schema by `utils/aiSchemaValidate.ts`. Apple's guided generation is OS-enforced and cloud providers are server-enforced, so only the downloaded engine is validated here.
- **License.** LFM Open License v1.0 permits commercial use below a revenue threshold of US$10M a year. **Review trigger: re-read the license and talk to Liquid AI before Musclog's annual revenue approaches US$10M**, or earlier if the license text changes (the pinned revision does not, but a model update does). The app links the license text instead of copying it. llama.rn and llama.cpp are MIT.
- **Fallback if llama.rn or LFM stops working on a platform**: MNN (the "Pocket" style runtime) is the researched alternative runtime; it would replace `services/localModels/llamaRuntime.ts` only, because every caller goes through `generateWithLocalModel`.
- **Network.** The download tells Hugging Face the device's IP address, like any file download, and nothing else about the person. The privacy policy says so (all ten locales). Everything after the download is offline.
- **Open items needing devices**: whether llama.rn 0.12.9's llama.cpp loads LFM2.5-VL (else move to `0.13.0-rc.*`), size delta of the release build, iOS 17 and armeabi-v7a behaviour, peak RAM, and that the Swift availability module compiles and maps `SystemLanguageModel.Availability` correctly.
- **Small-model chat quality (benchmark, 2026-11-25).** The phone answered "thanks" with "I'm Loggy." and "That's all you can say?" with an answer pasted from five messages earlier. Causes: (1) the Tokenmaxxing chat review: a 450M model turned good drafts into "I'm Loggy.", a copy of an earlier reply or the checklist itself (81% bad replies against 23% for one request, 125 replies each on llama.cpp b10256, the build inside llama.rn 0.12.9), now skipped on-device; (2) a quoted "If they ask your name, say: ..." line in the prompt, which it gave as the answer to anything, now removed; (3) copying its own earlier turns, which no sampler setting prevents on the phone (llama.rn does not feed prompt tokens into the penalties, while the benchmark's `llama-completion` does, so the bench cannot judge penalties or DRY). What helped: the vendor sampling from the model card ("temperature=0.1, min_p=0.15, repetition_penalty=1.05"), 12% bad against 20% for our old temperature 0.2 with 0.4 penalties, 22% with the penalties added to the vendor settings and 25% with temperature 0.2 and no penalties; and a copy guard (a reply whose first 12 words repeat a sent coach turn is regenerated from the person's own messages: 2% bad, judging 8 words 3%, the whole reply 2%; a user-messages-only history without the guard 5%, but 72-word replies and lost context). The insight fact-check round turned out unusable on this model (11 of 20 probes replaced the answer outright). **LFM2.5-1.2B-Instruct (Q4_0, 696 MB, text only) scored 0% bad with no prompt or history change**: a bigger model is the lever left. Decided 2026-11-27 after the tier benchmark (`musclog-benchmarks/2026-11-27-model-tiers/`): it is offered as an optional second download in AI settings (never in onboarding), on phones reporting at least `LOCAL_TEXT_MODEL_MIN_RAM_BYTES` (7.0e9, about 8 GB) until it is measured on a phone; every request without a photo goes to it. It gave 36 good chat replies of 61 against the 450M's 20 (17 against 10 of 25 in English, 19 against 10 of 36 in the other nine languages; hand-graded, one seed, not blind), 26 against 27 voice commands of 37, and a median meal calorie error of 78% against 86% when it did the meal's text steps. Rejected in the same run: MNN-Pocket-0.3B (no tool format the engine reads, 0 good replies of 36 outside English), VisionPsy-Nano-460M (a patched llama.cpp, English-only training, "500 g" for half the foods), Qwen3-0.6B (1 good reply of 36 outside English, says it is human 2 times in 5), and LFM2.5-VL-1.6B for now (147% calorie error with today's model-chosen grams, 2.0 GB peak, photos about 9 times slower; worth another look once grams come from code). The makers describe the 450M model as made for "general vision-language workloads, captioning and object detection" and "not well-suited for knowledge-intensive tasks", and list English, Arabic, Chinese, French, German, Japanese, Korean, Portuguese and Spanish, so Dutch, Russian, Italian, Polish and Turkish (app languages) are outside what it was trained for.

- **Pain and injury safeguard (benchmark, 2026-11-27).** Seven English pain questions (a hurt knee before squats, a sore back on deadlifts, a sprained ankle before a run, an elbow, a shoulder, a wrist), five seeds each, plus the knee question in the nine other app languages, two seeds, on llama.cpp b10256 with the shipped on-device chat setup; hand-graded by one reader. Of 35 English replies, the 450M told people to train through the pain 8 times with the shipped prompt and 10 times with a safety line in its closing reminder (and the same line placed after the person's message made it erratic: refusals, "you can still go for a run"); outside English it mostly wrote nonsense either way. The 1.2B never did (0 of 35 with and without), and the line took its "stop that movement / see a professional" answers from 9 to 17 of 35, the rest still suggesting a lighter version of the movement. Hence `ProviderPolicy.answersPainWithFixedReply`: the 450M gets a fixed, translated reply and is not asked; the 1.2B and Apple's engine (not measured) get the line. The raw replies and grades are in `musclog-benchmarks/2026-11-27-model-tiers/raw/pain/`. Detection is a word list (`utils/painMention.ts`), which does not fold accents because Polish "ból" folded is Turkish "bol" ("plenty").

### Voice commands on the downloaded model (2026-11-26)

"Hello my name is Pablo", said through hold-to-talk, opened the copy review for yesterday's breakfast. Replayed on a desktop llama-server with the phone's file (LFM2.5-VL-450M Q4_0, greedy, the app's prompt and grammar), the model answered nearly every sentence with the voice prompt's first example word for word (`copy_meal`, breakfast, from yesterday) and "What did I eat yesterday?" with the fifth one (search "banana"), although that very sentence is an example answering `none`. Reordering the examples, putting `none` first in the enum or quoting the sentence did not help (5 to 7 of 21 right). A yes/no "is this a request to log food?" pass before routing said no to nearly everything, copies included.

The model card lists function calling for text input (BFCLv4 21.08, vendor figure). Its format is the chat template's tool list (`List of tools: [...]`) with calls written as `<|tool_call_start|>[name(arg="value")]<|tool_call_end|>`, and a plain-text reply when no tool applies; llama.cpp detects the LFM2.5 template and parses the calls, but **the build inside llama.rn 0.12.9 (b10256) does not detect the 450M's template without help** (found 2026-11-27: the figures below were measured on a newer build; `docs/FIXES.md`). With `toolTemplateOverride` the same 37 sentences score 27 on b10256; without it every one failed. Scored on 37 sentences (16 not requests, 10 copies, 11 foods, in English, Spanish, Portuguese, Dutch, German, French and Russian), counting arguments as well as the tool, with the app's checks applied (a slot outside its choices drops the command; a food the person did not say is rejected):

| Setup                                                           | Right    | Wrong action | Missed |
| --------------------------------------------------------------- | -------- | ------------ | ------ |
| Native tools, `copy_meal` listed first                          | 18       | 12           | 7      |
| Native tools, `copy_meal` first, four example turns             | 20       | 4            | 13     |
| Native tools, `search_food` first, four example turns (shipped) | 26 to 27 | 3 to 4       | 7      |
| Same, fewer slots (`copy_meal`: meal, from_day)                 | 26 to 28 | 5 to 7       | 4 to 5 |
| Same, tools renamed `log_food`/`repeat_meal`                    | 22 to 26 | 4 to 9       | 6 to 7 |

Per class, the shipped setup gets 15 of 16 non-requests, 8 or 9 of 11 foods and only 3 of 10 copies right. It leans to the first tool it is offered (with `copy_meal` first it called `copy_meal` for most foods), and it fills slots it has nothing for with filler, mostly `from_day: "tomorrow"` (not an allowed value, so the command is dropped and the person sees "couldn't tell"). The wrong actions left are mild: a search for "breakfast" or "gisteren", a copy with the wrong meal shown on the review screen, a search with no meal. The app's replay of its own payload (`buildNativeVoiceTools`, `NATIVE_VOICE_EXAMPLES` through `toEngineMessages`) reproduced the 26 of 37 exactly. Copies remain weak because the model does not map "last night", "Friday", "lunes" or "gisteren" to the day values; a LoRA fine-tune on synthetic Musclog commands, or the 1.2B model above, are the levers left. Cloud providers keep the schema path and were not measured here.

**Meal-name searches and copy sentences (2026-11-27).** "Today, I had the same breakfast as yesterday." opened a food search for "breakfast". Measured on llama.cpp b10256 over 100 sentences (the 37 above, the same 37 with punctuation, and 26 new copy, "today" and control sentences), counting a right action with right arguments (a copy review that asks for the day is counted apart):

| Step, cumulative                                   | Right | Asks the day | Missed | Wrong |
| -------------------------------------------------- | ----- | ------------ | ------ | ----- |
| Before                                             | 61    | 0            | 20     | 19    |
| Meal name as food opens the copy review            | 61    | 4            | 20     | 15    |
| Repeated keys read, first valid value              | 62    | 4            | 16     | 18    |
| Second copy example with "today", last valid value | 72    | 2            | 11     | 15    |

Copy sentences went from 10 to 17 right of 38, foods from 21 to 26 of 27, non-requests from 30 to 29 of 35 ("Don't repeat yesterday's breakfast" now opens a review: the old reading dropped it only because of the repeated key). Stripping punctuation did not help (68 right and 17 wrong against 70 and 15 with the chosen examples), so the transcript is sent as heard. The example set is the best of nine tried, each with and without stripping, on these same sentences, so expect less on new wording. "I had the same breakfast as yesterday." is still missed, and non-English copies remain mostly wrong or missed. Measured on a desktop, not on a phone.

**Retry with the tool the person picked.** Offering only that tool, with the same example turns: 38 of 38 copy sentences call `copy_meal`, 30 name the right meal, 36 the right source day and 28 both (17 right when the model also had to choose). Foods: 24 of 27 call `search_food`, 20 with the right food; the other cases open an empty search. `tool_choice: 'required'` gave the same replies as `auto`, so the runtime was not changed. Without the example turns the source day fell from 33 or more to 11 of 38.

### Voice commands with more tools (2026-11-28)

Four tools were added (`log_weight`, `log_meal`, `add_note`, `go_to`), so the downloaded models were measured again, on llama.cpp b10256 (the build inside llama.rn 0.12.9), through the app's own payload builder, parser and resolver, on a desktop CPU (no phone). 83 sentences: the 37 above, plus 46 new ones (weigh-ins, meals, notes, screens, and sentences that mention weight or notes without asking for anything), in seven languages. A tool that is not offered counts as right when nothing runs. Harness, cases and raw replies: `musclog-benchmarks/2026-11-27-voice-tools/`. Apple's model, custom local servers and cloud providers were not measured.

| Model | Tools offered                    | Old 37 | Food searches | Copies | Weigh-ins | All 83 | Wrong actions |
| ----- | -------------------------------- | ------ | ------------- | ------ | --------- | ------ | ------------- |
| 450M  | search, copy                     | 29     | 11/11         | 4/10   | none      | 58     | 22            |
| 450M  | search, copy, weigh-in (shipped) | 27     | 9/11          | 5/10   | 10/10     | 61     | 18            |
| 1.2B  | search, copy                     | 25     | 8/11          | 1/10   | none      | 65     | 6             |
| 1.2B  | search, copy, weigh-in (shipped) | 24     | 7/11          | 1/10   | 2/10      | 57     | 5             |

- **More tools cost accuracy fast.** With five tools (search, copy, weigh-in, meal, note) the 450M got 36 of 83 (food searches 3/11, notes 0/8, most of them sent to `log_meal`). Hence the 450M is offered three.
- **The 1.2B rows above are wrong.** Its template dropped the example calls, so it was shown empty replies. See the next section.
- **The order of the example turns matters.** With the weigh-in turn last the 450M got 7 of 11 food searches with 4 wrong actions and 8 of 10 weigh-ins; with it first, 9 of 11 with none wrong and 10 of 10. Leaving out the preamble, the closing "Done." turns or all but one turn per tool, reversing the order and adding a second search turn all dropped food searches to 3 of 11 or fewer.
- **A JSON schema instead of the tool-call format was worse on the 1.2B** with two or three tools: 8 to 10 of 10 copies and 10 of 10 weigh-ins, but 2 of 11 food searches and 20 to 28 wrong actions, mostly the first example copied for a greeting (the 2026-11-26 failure).
- **A weigh-in needs weight words.** The 450M routed "I'm Maria and I'm 30" to the weigh-in, so code requires a unit next to the number or a word for weighing.
- The three-tool figures hold for the default tools only. A person who picks other tools gets an unmeasured set.

### The 1.2B's own voice payload (2026-11-28)

**The bug.** LFM2.5-1.2B-Instruct's chat template renders a message's `content` and never reads `tool_calls`, so every example call the app sent reached it as an empty assistant turn followed by "Done.": it learned to answer a command with nothing. The 450M's template renders the calls, so only the 1.2B was affected. It was seen with llama-server's `/apply-template`; the LFM2.5-VL-1.6B template saved on 2026-11-27 does not mention `tool_calls` either. `toEngineMessages` now writes the calls into `content` for such a template (llama.rn tokenizes with special tokens parsed, so they are the same tokens the model writes).

**The fix alone is not enough.** Shown its calls, the model got 10 of 10 weigh-ins but acted on sentences that were no request (21 wrong of 83 at three tools). So it was tuned separately, on llama.cpp b10256, desktop CPU: 83 sentences from above, 10 new copies naming two meals or a target day, and 67 held-out sentences written before any tuning. About 40 payloads were tried. Harness, cases, variants and replies: `musclog-benchmarks/2026-11-27-voice-tools/`.

| 1.2B, right (wrong actions)      | Tools | 83 sentences | 67 held out | 10 two-meal copies |
| -------------------------------- | ----- | ------------ | ----------- | ------------------ |
| Before (calls dropped)           | 2     | 65 (6)       | 45 (6)      | 0 (1)              |
| Calls in `content`, nothing else | 2     | 55 (21)      | 45 (17)     | 1 (4)              |
| Own payload (shipped)            | 2     | 69 (10)      | 54 (11)     | 5 (5)              |
| Before (calls dropped)           | 3     | 56 (6)       | 40 (5)      | 1 (2)              |
| Calls in `content`, nothing else | 3     | 54 (21)      | 47 (15)     | 1 (5)              |
| Own payload (shipped)            | 3     | 72 (8)       | 51 (10)     | 4 (6)              |
| Before (calls dropped)           | 5     | 38 (6)       | 30 (2)      | 1 (1)              |
| Calls in `content`, nothing else | 5     | 57 (21)      | 47 (13)     | 1 (7)              |
| Own payload (shipped)            | 5     | 66 (10)      | 48 (11)     | 3 (7)              |

Of the 83, by tool (own payload): at three tools 10 of 11 food searches, 9 of 10 copies and 9 of 10 weigh-ins (before: 7, 1 and 2); at five, 7 of 11 searches, 8 of 10 copies, 8 of 10 weigh-ins, 7 of 10 meals and 7 of 8 notes.

- **What is sent.** No example turns on a first try: one system line ("Call a tool only when the sentence asks the app to log, copy, open or write something. Otherwise reply "Okay." and call no tool. A greeting, thanks or a question is not a request.") and the tools. `copy_meal` has its own description and slot wording: with the 450M's the model put the day named into `day`, where the copy goes, so most copies were refused.
- **Five tools.** The 1.2B is offered five: 66 of 83 with 10 wrong, against the 450M's shipped 61 with 18 at three. Over all 160 sentences five tools cost something: 117 right and 28 wrong against 127 and 24 at three, with 8 of 44 non-requests acted on against 4 (a greeting opening a meal review or a note).
- **It acts more than before.** Broken, it mostly did nothing: at three tools it carried out 17 of the 69 commands it was offered and none of 44 non-requests; now 54 of 69 and 4 of 44. Many wrong actions at three tools are sentences for a tool it is not offered (a spoken meal opening a food search). Nothing is written without a tap.
- **Copies naming two meals are still poor** ("Monday's lunch as dinner": about half right, the rest swap the meals), shown on the review screen before anything is copied. Rewording the two slots to fix it lost plain copies.
- **What did not help:** more example turns of any arrangement with the calls visible, negative examples, a question in the preamble that is answered with a refusal (food searches fell to 0 of 11), and an example sentence inside a tool description (the model copied it).
- **Picking the tool after a miss** keeps the example turns: with five tools offered, all 101 sentences for a tool called it and 87 got the right arguments (instruction line: 92 and 85; nothing: 83 and 83).
- The figures are for the default tool order, one seed, temperature 0, tuned on these sentences (the held-out set was not used to choose wording). No phone was measured.
