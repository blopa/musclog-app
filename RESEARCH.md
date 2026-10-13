# Musclog — Research Notes

This file consolidates the research that still informs the product or implementation. Historical
code dumps, speculative week-by-week plans, repeated setup instructions, and conclusions superseded
by the current code have been removed. For implementation rules use `AGENTS.md`; for incident
history use `FIXES.md`.

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
point; whole-series regression is tracked in `FUTURE_FEATURES.md`.

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

Those conclusions are translated into the prioritized backlog in `FUTURE_FEATURES.md`.

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
as a development workaround. The Apple Silicon compatibility patch is documented in `FIXES.md`.

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

Product research (see `FUTURE_FEATURES.md`) found that logger users lose time to literal search: a
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
slow `settings-read` or `image-read` on the first scan after boot, record the cause in `FIXES.md`.

## Photo viewer, saving and feedback links

**Why "save" is the share sheet.** Saving straight to the gallery needs `expo-media-library`, which
declares read permissions of its own (`READ_MEDIA_*` on Android) that the committed manifest would
have to be diffed and stripped of, and an iOS add-only usage string; the app's rule is that photo
picking needs no media permission at all. The share sheet reaches the same place ("Save image" / "Save
to Photos") with no permission, so the manual save shipped on it and the automatic save-after-logging
setting is parked in `FUTURE_FEATURES.md` until someone can run a prebuild and read the manifest.

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

The duplicate Health Connect package failure is documented in `FIXES.md`.

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

**Prediction is a range with a confidence level.** `utils/cycle/cycleStats.ts` takes the median of up to the last 12 usable cycles, and the range is the shortest to longest of them (at least one day either side of the median). Confidence is `low` below two usable cycles, `moderate` below four and `high` from four; a spread above 9 days (the ACOG threshold for irregular cycles) lowers it one level, and above 20 days it is `low` and a single date is offered to be hidden. The numbers are named constants in `constants/cycle.ts`. Logged period count is deliberately not the input: four starts 70 days apart are four logs but a poor basis for a date.

**Which cycles count.** A gap under 15 days is treated as a probable mislog, and one at least 1.8 times the median of the others (with at least two others to compare) as a probable missed period. They are shown with the reason rather than dropped, and the person can include or exclude any cycle. Cycles under a method that usually stops ovulation, and postpartum cycles, are excluded because they are not natural cycles.

**Ovulation is not predicted from cycle length.** Calendar-style estimates identify ovulation poorly ([systematic review of consumer apps](https://pubmed.ncbi.nlm.nih.gov/29749274/)), so the fertile window is opt-in, shown with a not-contraception note, and absent whenever the context makes it meaningless (hormonal methods, postpartum, perimenopause, PCOS, tracking without bleeding). Which methods usually suppress ovulation follows the [NICHD overview](https://www.nichd.nih.gov/health/topics/contraception/conditioninfo/types): combined methods usually do, a hormonal IUD or progestin-only pill often does not, a copper IUD never does.

**No phase prescriptions.** A [meta-analysis of exercise performance across the cycle](https://link.springer.com/article/10.1007/s40279-020-01319-3) found trivial average differences and does not support universal phase-based guidance. The app therefore removed the fixed energy labels and intensity multipliers and instead reports how the person's own logged symptoms, mood and workout volume behaved near the start of their periods, only from three or more cycles and with the evidence listed.

**Residual metadata.** The cycle tables encrypt every personal field in one `payload`, but record ids and `created_at` / `updated_at` stay plaintext, so the device can reveal _when_ something was logged, never _what_. Exports shared outside the app, and local recovery points made before the conversion, can hold plaintext copies; "delete all cycle data" offers to remove the recovery points and says plainly that shared files are out of reach.

**Dates.** Starts and ends are local calendar days. Predicted dates are computed with calendar-day arithmetic (`utils/cycle/dates.ts`), never `start + N * 24h`, which lands an hour off midnight across a daylight-saving change and moves a predicted day at the edge of a range.
