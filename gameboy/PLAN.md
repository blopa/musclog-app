# Musclog GB — Game Boy Port (Gimmick)

A feasibility study and technical bootstrap for porting a **stripped-down, manual-only** version of
Musclog to the original Nintendo Game Boy (DMG) / Game Boy Color (CGB) as a homebrew cartridge.

> **TL;DR — Is it possible?** Yes. The Game Boy is a fully programmable computer with a CPU,
> 8 KB work RAM, and battery-backed cartridge save RAM. A macro + workout tracker is well within
> reach. What we lose is everything that depends on the outside world: no internet, no camera,
> no barcode/OCR, no AI, no Health sync, no cloud. What remains is a self-contained, **manual**
> logbook — which is exactly what "Lift, Log, Repeat" was at its core.

---

## 1. Hardware reality check

| Resource               | Original Game Boy (DMG)                          | Implication for Musclog GB                                                                                                                          |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU                    | Sharp LR35902 @ ~4.19 MHz (8-bit)                | Plenty for menus + integer math. No floating point.                                                                                                 |
| Work RAM               | 8 KB                                             | Hold the "current session" in RAM, page the rest.                                                                                                   |
| Video RAM              | 8 KB                                             | Tile-based text UI only. No bitmaps/photos.                                                                                                         |
| Save RAM (cart)        | 8–32 KB SRAM, battery-backed                     | This is our "database". Budget carefully (see §6).                                                                                                  |
| Display                | 160×144, 4 shades of gray                        | ~20×18 tiles ≈ 20 chars × 18 rows of text.                                                                                                          |
| Input                  | D-pad, A, B, Start, Select                       | All navigation is menu-driven.                                                                                                                      |
| Network / Camera / Mic | **None**                                         | No food search, scanning, AI, or sync.                                                                                                              |
| Date/Time clock        | MBC3 RTC (5 registers: sec/min/hr/day-lo/day-hi) | Using MBC3+Timer+RAM+Battery (`0x10`). User sets today's date once; `cal_current_date()` computes current date from `rtc_base_date + elapsed_days`. |

**Key takeaway:** everything is **integer math, tile-based text, and menu navigation**, persisted into a
small battery-backed SRAM. Treat it like an embedded device, not a phone.

---

## 2. Features we CAN port (manual-only subset)

These map cleanly onto an offline, manual logbook:

### Workout tracking

- Log a workout session: pick exercise(s), enter sets, reps, weight per set
- Custom exercise list (a fixed library bundled in ROM + a small user-added list in SRAM)
- Workout templates (save a routine, reload it next time)
- Rest timer (counts down on-device using the CPU timer; beeps via the sound channels)
- Session summary: total sets, total reps, total volume (reps × weight, integer math)
- Workout history: scroll past sessions stored in SRAM
- Personal record (PR) detection per exercise (heaviest weight / best volume)
- Volume-over-time as a simple tile-based bar chart

### Nutrition / macro tracking

- Log foods manually: name + calories, protein, carbs, fat, fiber (all integer grams/kcal)
- Custom food library stored in SRAM (no online database)
- Daily totals vs. a goal, shown as numbers + a simple progress bar
- Meal grouping (breakfast / lunch / dinner / snack buckets)
- Net-carbs handling (carbs − fiber) — pure integer subtraction, same convention as the app
- Multi-day history (limited by SRAM budget)

### Goals & body metrics

- Set a calorie + macro goal (entered manually)
- Log body weight per day; show last value and a min/max trend chart
- Simple TDEE/goal as a stored constant the user sets (no empirical recalculation)

### Settings / UX

- Units toggle (metric/imperial) — display-side integer conversion, store metric internally
- A "day counter" or RTC-based date for grouping entries
- Save/erase data (SRAM management)

> **Note on numbers:** the app's locale-aware decimal formatting does **not** port. The Game Boy
> shows ASCII digits only. Keep everything in whole numbers (round protein to grams, weight to
> 0.5 kg/lb steps stored as integer tenths) and format by hand.

---

## 3. Features we CANNOT port (and why)

| App feature                                       | Why it can't come along                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Food search (Open Food Facts / USDA / Musclog DB) | No network.                                                                    |
| Barcode scanning                                  | No camera.                                                                     |
| AI food photo / OCR / AI Coach (Loggy)            | No camera, no network, no room for an LLM.                                     |
| Meal/workout plan generation, AI insights         | Requires the LLM.                                                              |
| Health Connect / HealthKit sync, BLE devices      | No connectivity stack.                                                         |
| Weekly check-ins with trend analysis              | Doable in spirit, but heavy math/storage; defer.                               |
| Menstrual cycle predictions                       | Possible as manual logging, but predictions need date math + RTC; defer to v2. |
| Charts beyond simple bars                         | 4-shade tile display; keep visualizations minimal.                             |
| Export to JSON/Excel, encryption                  | No filesystem; SRAM only. (Link Cable export is a stretch goal.)               |
| Multilingual i18n                                 | Bundle one language to save ROM/SRAM; English first.                           |

---

## 4. Technical bootstrap — toolchain choice

There are three realistic paths. **Recommendation: GBDK-2020.**

### Option A — GBDK-2020 (C) ✅ recommended

- **What:** A maintained dev kit built on the SDCC C compiler: compiler, assembler, linker, and a
  Game Boy hardware API (graphics, input, sound, SRAM). The modern continuation of the classic GBDK.
- **Why for us:** Musclog GB is logic-heavy (lists, math, menus), not a fast action game. C lets us
  port data structures and integer logic directly, get running fast, and lean on a broad API plus
  many open-source sample ROMs.
- **Trade-off:** SDCC won't match hand-optimized assembly speed, and occasional compiler quirks
  appear — irrelevant for a menu-driven tracker.
- **Repo:** <https://github.com/gbdk-2020/gbdk-2020>

### Option B — GB Studio (no-code) ⚠️ probably too constrained

- **What:** Drag-and-drop visual game creator; great for beginners and rapid prototypes.
- **Why not:** Built around scenes/actors/scripted events for games. Arbitrary data entry, large
  editable lists, and integer aggregation across many records fight the tool. Good for a mockup,
  bad for the real data model.
- **Site:** <https://gb-studio.dev>

### Option C — RGBDS (pure assembly) ⚠️ maximum control, slowest to build

- **What:** The assembler toolchain most commercial-grade homebrew uses; total control over every byte.
- **Why not (for v1):** We don't need the performance and we'd pay for it in development time. Keep in
  reserve if a hot path ever needs hand-tuning.

**Decision:** start in **GBDK-2020 (C)**. Drop to RGBDS assembly only for a specific bottleneck.

Resource hubs: [gbdev.io tools guide](https://gbdev.io/guides/tools) ·
[awesome-gbdev](https://github.com/gbdev/awesome-gbdev) · [gbdev.io resources](https://gbdev.io/resources.html)

---

## 5. Getting started with GBDK-2020

### Install

1. Download the latest GBDK-2020 release for your OS from the
   [releases page](https://github.com/gbdk-2020/gbdk-2020/releases) and unzip it (it bundles SDCC).
2. Put `gbdk/bin` on your `PATH` so `lcc` (the compiler driver) is available.
3. Grab an emulator with good debugging for the dev loop: **Emulicious**, **BGB**, or **SameBoy**.

### Hello, world (build loop)

```c
// main.c
#include <gb/gb.h>
#include <stdio.h>   // GBDK provides a tile-based printf to the background

void main(void) {
    printf("MUSCLOG GB\n");
    printf("Lift Log Repeat\n");
    while (1) {
        wait_vbl_done();   // sync to ~59.7 Hz frame
    }
}
```

```bash
lcc -o musclog.gb main.c     # produces a runnable .gb ROM
```

Open `musclog.gb` in the emulator. That's the entire inner loop: edit C → `lcc` → run ROM.

### Project layout (suggested)

```
gameboy/
├── src/
│   ├── main.c            # boot, top-level menu state machine
│   ├── ui_text.c/.h      # tile font, menu/list rendering, number formatting
│   ├── input.c/.h        # debounced D-pad/button handling
│   ├── workouts.c/.h     # workout history shell + free-session planning flow
│   ├── nutrition.c/.h    # banked nutrition shell; subflows live in nutrition_date/detail/search
│   ├── food_db.c/.h      # NONBANKED banked-food readers (ff_load/ff_filter)
│   ├── foundation_foods.c/.h # generated USDA food table (name+kcal+protein/fat/carbs/fiber per 100g), ROM bank 2
│   ├── common_foods.c/.h # generated common-food table (same compact struct), ROM bank 3
│   ├── exercises.c/.h    # generated exercise table (name+group+equipment+mechanic+load multiplier), ROM bank 6
│   ├── exercise_db.c/.h  # NONBANKED banked-exercise readers (ex_load/ex_filter_by_muscle)
│   ├── foodlog.c/.h      # persisted food log (6-byte records in SRAM bank 1) + macro scaling
│   ├── metrics.c/.h      # body weight log
│   └── database.c/.h     # SRAM bank-0 profile layout, named address constants, load/save, checksum
├── data/
│   └── exercises.c       # bundled exercise names (const, lives in ROM)
└── tools/                # build helpers (see "Build" below — Node scripts, not a Makefile)
```

### UI building blocks

- **Text:** GBDK ships a tile-based `printf`; for real UI use `gotoxy()`, `puts()`, and a custom font
  loaded into VRAM. Budget ~20 columns × 18 rows.
- **Menus:** a state machine. Each screen = a state; D-pad moves a cursor sprite/tile, A/Start
  confirms, B backs out. This replaces the app's navigation stack.
- **Number entry:** no keyboard — use a digit-spinner (Up/Down changes a digit, Left/Right moves
  between digits) for weights, reps, and macros.
- **Charts:** draw bars out of solid tiles at increasing heights; 4 shades is enough for one series.
- **Sound:** use a sound channel for the rest-timer beep and PR fanfare.

---

## Build (current state — Milestone 1c: nutrition + free-session workout planning)

The first interactive milestone is implemented: a **Game Boy Color** ROM that shows the Musclog logo,
runs a first-time onboarding flow, generates calorie/macro goals, saves the profile to cartridge SRAM,
skips onboarding on later boots when the save checksum is valid, and includes a first pass at the
free-session workout start flow. Build it from the repo root with:

```bash
npm run gb:build        # produces gameboy/build/musclog.gbc
```

On the **first** run this auto-downloads the GBDK-2020 toolchain into `gameboy/.gbdk/` (gitignored) —
no system compiler needed. Then it converts the logo to tile data and compiles the ROM. Subsequent
runs reuse the cached toolchain and are fast. Open the resulting `gameboy/build/musclog.gbc` in a Game
Boy Color emulator (SameBoy / BGB / mGBA / Emulicious).

What's wired up so far:

- **`scripts/build-gb-rom.mjs`** — orchestrator: ensures GBDK is present, runs `png2asset` on the logo,
  then compiles every `gameboy/src/*.c` file with `lcc`. The ROM is CGB-only (`-Wm-yC`), uses the
  MBC3+Timer+RAM+battery cart type (`-Wm-yt0x10`), declares 4 SRAM banks / 32 KB (`-Wm-ya4`), and
  reserves 8 ROM banks / 128 KB (`-Wm-yo8`) so the bundled food/exercise tables and banked screen modules can
  live in dedicated banks. The build emits `gameboy/build/musclog.map` and fails if the fixed bank crosses
  `0x4000` or any banked `_CODE_N` area exceeds 16 KB; a ROM can otherwise link successfully and still
  crash as soon as code maps a switchable ROM bank.
- **`gameboy/tools/gen-foundation-foods.mjs`** — ports `data/usda_foundation_foods.json` into
  `gameboy/src/foundation_foods.{c,h}` and `data/common_foundation_foods.json` into
  `gameboy/src/common_foods.{c,h}`: per food it keeps only name + kcal + protein/fat/carbs/fiber per 100 g
  (macros as decigrams in `uint16`, energy as whole kcal). The USDA table is placed in **ROM bank 2** via
  `#pragma bank 2`; the common-food table is placed in **ROM bank 3** via `#pragma bank 3`. Rows with missing,
  empty, or physically impossible per-100 g macro data are quarantined instead of emitted. Output is committed;
  re-run with `npm run gb:gen-foods` if either dataset changes.
- **`gameboy/tools/gen-exercises.mjs`** — ports `data/exercisesData.json` into
  `gameboy/src/exercises.{c,h}`: per exercise it keeps only name, primary muscle group, equipment type,
  mechanic type, and load multiplier. Muscle groups, equipment types, and mechanic types are compact enum
  values; load multipliers are stored as
  centi-units in `uint16` (`1.45` → `145`) to preserve the source precision. The table is ordered by
  `exerciseIndex`, so exercise ID is implicit as array index + 1, and it is placed in **ROM bank 6** via
  `#pragma bank 6`. Output is committed; re-run with `npm run gb:gen-exercises` if the exercise dataset changes.
- **`gameboy/src/food_db.c` / `.h`** — the only code that reads the banked food tables. `ff_load` copies a
  food into a RAM `FoodCache`; `ff_filter` does a case-insensitive **prefix** search over all foods. Both
  APIs use a single global index space: USDA foods keep indices `0..FOUNDATION_FOOD_COUNT-1`, and common
  foods are appended after that range so existing USDA food-log references remain stable. The readers
  and their switched-bank helpers are marked `NONBANKED`, `SWITCH_ROM(...)` to map the relevant table over
  the `0x4000` window, then restore the caller's saved `CURRENT_BANK` before returning. These functions
  must remain physically below `0x4000`; the build map guard exists to catch regressions.
- **`gameboy/src/exercise_db.c` / `.h`** — the same NONBANKED reader pattern for the generated exercise table
  in ROM bank 6. `ex_load` copies one exercise row into RAM, and `ex_filter_by_muscle` builds a RAM list of
  exercise indices for the workout picker. Banked workout screens must use these readers instead of
  dereferencing `exercises[]` directly.
- **`gameboy/tools/fetch-gbdk.mjs`** — downloads/extracts the GBDK-2020 release (platform-aware, pinned
  fallback version when offline). Also exposed as `npm run gb:setup`.
- **`gameboy/tools/prepare-logo.mjs`** — converts `assets/icon-pixel.png` → `gameboy/assets/logo.png`
  (64×64, quantized to 4 colors = one CGB palette) using `sharp`. Output is committed, so the ROM build
  itself doesn't depend on `sharp`. Re-run with `npm run gb:prepare-logo` if the source icon changes.
- **`gameboy/src/main.c`** — splash, text-mode init, save validation, onboarding/home routing, and the
  macro-summary home screen that routes into nutrition and workouts. `Select+B` on home erases the save
  and reruns onboarding.
- **`gameboy/src/onboarding.c`** — `BANKED` first-run flow in ROM bank 5 with a combined unit/sex/activity setup screen,
  then age, height, weight, training experience, fitness focus, weight goal, generated goal review,
  and manual macro edits.
- **`gameboy/src/nutrition.c`** — `BANKED` nutrition shell in ROM bank 4: daily macro totals for the viewed date, the list of foods logged that day,
  and the nutrition `Select` action menu. Goal-facing carb totals use digestible carbs (`carbs - fiber`),
  while food detail/amount screens continue to show total food carbs and fiber separately. The date picker,
  food detail, and food search/amount subflows live in `nutrition_date.c`, `nutrition_detail.c`, and
  `nutrition_search.c`, also in ROM bank 4.
- **`gameboy/src/workouts.c`** — `BANKED` workouts shell in ROM bank 7: a visual-only mocked workout
  history list with summary stats and scrolling. Its `Select` action menu opens the first free-session
  start flow: exercise picker, muscle-group filter (`Select` or left/right), and a planning screen where
  the user adjusts set count and sees profile-based suggested weight/reps. The suggestion mirrors the Expo
  fallback logic: `weight * loadMultiplier * experienceFactor * ageFactor`, bodyweight/load-zero exercises
  show no external load, and compound exercises suggest 10 reps while other mechanic types suggest 14.
- **`gameboy/src/foodlog.c`** — the persisted food log. Each entry is a compact 6-byte record
  `{ day_num, food_idx, grams }` (day_num = `cal_day_number`, food_idx in the global bundled-food index,
  grams metric)
  stored in **SRAM bank 1** behind its own magic/version/count/checksum header, leaving the bank-0 profile
  untouched. Macros are never stored — `foodlog_sum_day` / the UI recompute them on demand by `ff_load`-ing the
  food and scaling per-100g values by grams (`foodlog_scale`). Validated/reset at boot (`foodlog_init`) and
  cleared on profile reset (`foodlog_erase`). It may call `ff_load`, which is `NONBANKED` and restores the
  caller's saved ROM bank on return.
- **`gameboy/src/database.c`** — SRAM bank 0 persistence with named byte-address constants, bit-packed profile flags, magic/version/checksum validation, and a compact 23-byte save block (down from 31 bytes; the extra byte vs the previous 22-byte layout holds the MBC3 RTC calibration date).
- **`gameboy/src/rtc.c`** — MBC3 RTC hardware access (`rtc_latch`, `rtc_write_days`), calendar arithmetic (`cal_advance`, `cal_compare`, `cal_format`, `cal_day_number`), and the `rtc_setup_date` screen that lets the user pin today's date on first boot or after re-calibration.
- **`gameboy/src/nutrition_math.c`** — `BANKED` ROM-bank-5 integer-only Mifflin-style BMR, activity multipliers,
  calorie adjustments, macro splits, and fiber target generation.
- **`gameboy/src/ui_text.c` / `input.c`** — tiny text UI helpers and debounced joypad input.

The generated `gameboy/src/logo.c`/`.h` files are still produced by `png2asset` and gitignored.

---

## 6. Persistence — the cartridge "database" (SRAM)

This is the most important architectural piece. The save lives in **battery-backed cartridge SRAM**,
so we must (a) pick an MBC that has SRAM + battery, (b) declare our save layout, and (c) validate it.

### Cartridge / MBC type

Set the MBC type at link time with `-Wm-yt<hex>`. The project uses **`0x10` (MBC3 + Timer + RAM + battery)**:

- **Type `0x03`** — MBC1 + SRAM + battery (up to 32 KB SRAM). No RTC.
- **Type `0x1B`** — MBC5 + SRAM + battery (more banks, no RTC). Previously used; replaced.
- **Type `0x0F`/`0x10`** — MBC3 **with RTC** — `0x0F` has no RAM, `0x10` has RAM + battery. **Currently active.**

### Declaring save variables

GBDK keeps SRAM access **write-protected by default**. The implemented save lives in SRAM bank 0 via the
hardware `_SRAM` window, and every load/save brackets access with `ENABLE_RAM` / `DISABLE_RAM`:

```c
void db_save(const SaveData *data) {
    // Pack 7 enum/flag fields into 2 bytes (SRAM_FLAGS1 + SRAM_FLAGS2).
    // Store height as 1 byte offset from DB_HEIGHT_CM_MIN (saves 1 byte).
    // Store fiber_goal as 1 byte (max 99 < 256, saves 1 byte).
    // Store RTC calibration base date as 3 bytes (year-2000, month, day).
    // Compute the checksum over the canonical packed 23-byte SRAM payload,
    // not over the compiler's in-memory SaveData struct.
    ...
}
```

`database.h` defines the full SRAM byte-address map with named constants (`SRAM_AGE`,
`SRAM_HEIGHT`, `SRAM_WEIGHT`, `SRAM_CAL_GOAL`, etc.), bit-field shift/mask constants for
`SRAM_FLAGS1` and `SRAM_FLAGS2`, and the `SaveData` in-memory struct that all game code uses.
Metric is always the storage format; the UI converts to imperial for display only.

### Validation

SRAM powers up as garbage on a fresh cart, and there is no "null". Use the **magic-number / checksum**
trick above: stamp a known value on save, check it on boot. If it's absent, run first-time setup
(seed the bundled exercise library, defaults). Optionally checksum the whole block to detect a dying
battery.

### SRAM budget (the hard constraint)

The ROM currently declares 32 KB SRAM. Bank 0 holds the tiny profile block and bank 1 holds the food log.
Rough plan for future data:

- Keep food/exercise **names** as short fixed-width strings (e.g. 12 chars) or indices into a
  ROM-bundled table; don't store long names per log entry.
- Store records as packed integer structs; reference foods/exercises by **ID**, not by name.
- Use **ring buffers** with a cap (e.g. last N workouts, last 30 days of macros). Old entries roll off.
- Move to a 32 KB (MBC1) or multi-bank (MBC5) cart if history needs to grow.

Background on saving: [Larold's "How to Save Data in Game Boy Games"](https://laroldsretrogameyard.com/tutorials/gb/how-to-save-data-in-game-boy-games/)
· general approach to [GBA/GB backup storage](https://dillonbeliveau.com/2020/06/05/GBA-FLASH.html).

---

## 7. Suggested milestones

1. **Boot + onboarding skeleton** — implemented: splash, text UI, joypad input, first-run setup, and
   home placeholder.
2. **SRAM layout + save/load** — implemented: magic/version/checksum validation, 32 KB SRAM header,
   bank 0 profile save, and erase-data option.
3. **Workout logging** — exercise picker, set/rep/weight digit spinners, session summary, save.
4. **Workout history + PRs** — scrollable list, per-exercise PR detection, volume bar chart.
5. **Macro logging** — implemented: bundled food search, daily totals vs. goal, digestible-carb math, progress bars.
6. **Body weight + units** — weight log, metric/imperial display conversion, simple trend chart.
7. **Polish** — rest-timer beep, PR fanfare. Date tracking is already live via MBC3 RTC.
8. **Stretch goals** — Link Cable data export to a second cart/PC; minimal cycle logging.

---

## 8. Reality of running it

- **Emulator:** any `.gb` ROM runs in Emulicious / BGB / SameBoy / mGBA — zero hardware needed.
- **Real hardware:** flash the ROM onto an **EverDrive** / EZ-Flash cart (SD-card based) and play on an
  actual Game Boy, or have a one-off **battery-backed cartridge** produced for the full "save survives
  power-off" experience.

---

## Sources

- [Choosing tools for Game Boy development — gbdev.io](https://gbdev.io/guides/tools)
- [GBDK-2020 (GitHub)](https://github.com/gbdk-2020/gbdk-2020)
- [awesome-gbdev — curated GB dev resources](https://github.com/gbdev/awesome-gbdev)
- [gbdev.io resources](https://gbdev.io/resources.html)
- [How to Save Data in Game Boy Games — Larold's Retro Gameyard](https://laroldsretrogameyard.com/tutorials/gb/how-to-save-data-in-game-boy-games/)
- [Long Live the Nintendo Game Boy — Larold's Retro Gameyard](https://laroldsretrogameyard.com/articles/long-live-the-nintendo-game-boy/)
- [GameBoy Advance Cartridge Backup Storage — Dillon Beliveau](https://dillonbeliveau.com/2020/06/05/GBA-FLASH.html)
