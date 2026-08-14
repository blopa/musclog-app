---
title: 'Creating a calorie tracker for the Game Boy Color'
date: '2026-08-14'
category: 'retroComputing'
description: 'I put Musclog on a 1998 cartridge — 517 foods in ROM, macro goals packed into 23 bytes of battery-backed SRAM, and a way to beam the whole save, or just one day of eating, into your phone using nothing but light.'
tags: ['Game Boy', 'GBDK', 'C', 'Retro', 'Homebrew', 'Nutrition', 'WasmBoy']
---

I like to build things, many times not because of how useful they are, but just to see if I can. Like integrating React with Phaser.js, or adding Reels to my blog. Not only because I like the challenge, but also because it's so hard to write something in my blog that hasn't been written before, therefore I need to go beyond what's possible, beyond creativity, beyond the impossible, where the possible and impossible meet: the possimpible.

So I put [Musclog](https://musclog.app/), my open source fitness tracker, on a Game Boy Color. A real cartridge layout, battery-backed saves, 517 foods baked into the ROM, the whole thing. You can track your macros and your workouts on hardware from 1998.

![The Musclog GB splash screen](/images/blog/2026/08/gameboy-splash-screen.png)

_160x144 pixels of pure questionable decision-making._

## The tech stack

I already knew that to make a Game Boy game I needed to write code in C, and last time I did that was 19 years ago... yeah. I knew that this project would be challenging, but I also knew that with Game Boy development advances in the past years, like GB Studio and so on, there should be a nice framework where I can pair it with Claude and get a nice result, after all, the UI is simple.

Then I actually looked at GB Studio. It's great, but it's built for event-driven games: rooms, sprites, dialogue, triggers. Musclog is a data-entry app. Spinners, lists, progress bars, saved records. Trying to express "scroll a list of 517 foods, scale macros by grams, and write a checksummed record to cartridge SRAM" through a visual scene editor is fighting the tool the whole way. So I dropped down to plain C with [GBDK-2020](https://github.com/gbdk-2020/gbdk-2020), the modern fork of the old Game Boy Development Kit. You write C, it compiles to a `.gbc` with `lcc` (which wraps `sdcc`), and you get a ROM that runs on real hardware.

No `npm install`. The build script downloads the toolchain, converts the logo and title art PNGs into C tile data with `png2asset`, compiles every `src/**/*.c`, and links it into a cartridge with very specific flags:

```javascript
// gameboy/tools/build-gb-rom.mjs
run(
  lcc,
  [
    '-Wm-yC', // Game Boy Color only
    '-Wm-yt0x10', // MBC3 + Timer + RAM + battery
    '-Wm-ya4', // four 8 KB SRAM banks
    '-Wm-yo16', // sixteen 16 KB ROM banks (256 KB total)
    '-Wm-yn"MUSCLOG"',
    '-Wl-m', // emit the .map so I can catch bank overflows
    '-o',
    romPath,
    ...cSources,
  ],
  gameboyDir
);
```

That `-Wm-yt0x10` picks the MBC3 mapper, the same chip Pokémon Gold/Silver used, because it has a real-time clock. I need the RTC so the cartridge knows what day it is, which matters a lot when your whole app is "what did you eat today." The battery keeps your saves alive between power-offs. This is genuinely how the 1998 cartridges worked, and it still works now.

GBDK gives you the title and the cartridge type, but not the rest of the header, so after linking there's a small patch step that writes the four-character game code `MLOG` at `0x13F`, sets the mask-ROM revision byte, and recalculates both cartridge checksums. The result is `CGB-MLOG-HOL-1`, modelled on Nintendo's own `DMG-TR-USA` scheme. Which is how I ended up designing a cartridge label for a game that will never be manufactured.

![The cartridge label: CGB-MLOG-NL-0, made in Holland, gluten free, no cloud](/images/blog/2026/08/gameboy-cartridge-label.webp)

_Palm oil free, gluten free, cloud free._

Pairing it with Claude was the right call, but not in the "AI writes the whole thing" sense. C with manual memory layout and ROM bank switching is exactly the kind of code where a model confidently hands you something that compiles and then silently corrupts a save three menus later. I drove, it accelerated. More on the parts where it tried to kill me later.

## The scope

Musclog is a very complex app. It took me originally 8 months to build a very UGLY but functional version of it, and later on another 4 months to "refactor" / redesign it with Claude, so, you know, it's no simple task to port it to a Game Boy. Shall we port the AI chatbot? What about AI photo estimation? Should I allow users to add their own exercises? Custom foods? What about fetching food from USDA or Open Food Facts?

Yeah, it's complex. So first I had to decide on the scope, and to be honest some of the things I mentioned above are of course unportable. There's no way to scan a barcode because the Game Boy has no camera, and there's no internet so forget about AI or fetching food from USDA or Open Food Facts, [although there was a guy who ran a tiny LLM on a Game Boy](https://www.reddit.com/r/LocalLLaMA/comments/1tbi2n3/i_got_a_real_transformer_language_model_running/).

So I cut it down to the parts that actually make sense on a cartridge:

- A title screen with `NEW GAME` / `CONTINUE` / `OPTIONS`, a soundtrack, and a blip on every button press
- First-run onboarding that generates your calorie and macro goals
- A daily macro dashboard (calories, protein, digestible carbs, fat, fiber against goals)
- Food logging with date selection, search, serving sizes, and delete
- 517 bundled foods (215 USDA foundation foods plus 302 common foods) compiled into the ROM
- Up to 100 custom foods you create on the cart
- Body-weight tracking with a trend chart
- Free workout sessions with muscle filtering, suggested weights, editable sets, and a 60-second rest timer
- 100 bundled exercises across 8 muscle groups
- A progress dashboard with charts
- Settings to re-edit everything, plus a reset
- `SHARE DATA`, which throws your entire cartridge save at your phone's camera as a stream of QR codes
- `SHARE DAY`, which throws just one day of eating at it instead, and merges into the phone rather than replacing it

The neat part: the foods and exercises come from the exact same `data/*.json` files the React Native app uses. A Node script ports them into hardcoded, ROM-banked C tables, so the cartridge and the phone app share one source of truth. Change the dataset, re-run `npm run gb:gen-foods`, rebuild.

```
// gameboy/tools/gen-exercises.mjs
// Source: data/exercisesData.json -> exercises.{c,h} (bank 6)
// Muscle groups, equipment types, and mechanic types are emitted as compact
// uint8 enum values. Load multipliers are stored as centi-units (1.45 -> 145).
```

Since I first wrote about this, the app's exercise catalogue was replaced wholesale with an 873-entry import from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), which is public domain. 873 exercises do not fit on a cartridge and nobody wants to scroll them with a D-pad anyway, so the generator now takes only the 100 rows flagged `isPopular` and assigns them compact cartridge IDs from 1 to 100.

## The title screen

The cartridge boots into the splash, then into an actual title screen: full-screen art with `NEW GAME`, `CONTINUE` once a completed save exists, and `OPTIONS`. Picking `NEW GAME` over an existing save asks for confirmation first, because erasing someone's six months of logs on a mis-tapped D-pad is a bad look.

![The title art, 160x144 in four colors](/images/blog/2026/08/gameboy-title-art.png)

The constraint here is tiles, not pixels. The Game Boy draws backgrounds from a tile map, and the background tile indices only go up to 256. `png2asset` dedupes identical and flipped tiles, so a picture only fits if it's repetitive enough to compress into that budget — every extra bit of detail in the sky costs you a unique tile. The build fails outright if a new `gb_background.png` is too detailed, which is a very fast feedback loop for "you got greedy with the gradient."

The art and the code that draws it are both pinned to ROM bank 8, so `start_screen.c` reads the tile data co-located in its own bank without a single `SWITCH_ROM()` call.

## Sound

There's a soundtrack, and a short blip on every selection, confirm, and back press. Both can be toggled independently in `OPTIONS`, and those two flags live in SRAM and deliberately survive a `NEW GAME` erase — if you turned the music off, you meant it.

The Game Boy cannot play MIDI. It has four hardware channels: two pulse waves, one programmable wave, one noise generator. So the build step takes the bundled `.mid` files and reduces them at build time to exactly that: SFX on pulse 1, and the soundtrack arranged as pulse lead, wave bass, and noise drums, emitted as a C table of APU register writes. The converter lives under `gameboy/tools/music/` and has its own `node:test` coverage, because a MIDI parser is precisely the kind of thing that works on one file and then silently transposes another one down an octave.

The bug I did not anticipate: heavy screen transitions and tile loading can starve the sequencer, and a Game Boy channel that stops receiving updates does not go quiet, it just holds its last note forever. So there's a VBlank interrupt handler that watches a stall counter reset by the sequencer each frame and kills channels 2, 3, and 4 after two frames without a tick. Two frames of silence is imperceptible. An indefinitely sustained square wave while you scroll a food list is not.

## Onboarding

The first time you boot the cartridge there's no save, so it walks you through unit system, biological sex, activity level, age, height, weight, lifting experience, fitness focus, and weight goal. Same questions the phone app asks, just driven by the D-pad instead of touch. Every value is a spinner: up/down changes it, left/right jumps faster.

![Onboarding asks the same questions the app does](/images/blog/2026/08/gameboy-onboarding.png)

Then it generates your macro targets from that profile and lets you review and edit them before saving.

![Generated macro goals, editable before saving](/images/blog/2026/08/gameboy-macro-goals-overview.png)

Here's where the constraints get fun. On a phone, a user profile is a row in a database and you never think about its size. On the cartridge, the entire profile, all nine answers plus five macro goals plus the RTC calibration, is packed into 23 bytes of SRAM. Booleans and small enums get bit-packed into single bytes:

```c
// gameboy/src/data/profile.c
raw[SRAM_FLAGS1] = (uint8_t)(((data->units & 1u) << FLAGS1_UNITS_BIT) |
                             ((data->gender & 3u) << FLAGS1_GENDER_SHIFT) |
                             (((data->activity_level - 1u) & 7u) << FLAGS1_ACTIVITY_SHIFT) |
                             ((data->lifting_experience & 3u) << FLAGS1_EXPERIENCE_SHIFT));
```

One byte holds four answers. Units is one bit, gender is two bits (three options), activity level is three bits, experience is two bits. Reading it back is the same thing in reverse with shifts and masks. There's no JSON, no key-value store, no ORM. Just bytes at fixed offsets, and a 16-bit checksum at the end so a half-written save from a yanked cartridge gets detected and reset instead of read as garbage.

Storage is always metric, by the way, exactly like the main app. Kilograms in tenths, centimeters as whole numbers. If you picked imperial, the conversion happens at the UI boundary when you enter or display a value, never in storage. I learned that lesson the expensive way on the phone app and I was not going to relearn it on a Game Boy.

The dates are powered by the MBC3 real-time clock. When you set the clock during onboarding it stores a base date and zeroes the RTC's day counter, then "today" is just the base date advanced by however many days the clock has ticked since. If you never set it, everything falls back to 2026-01-01, which is wrong but at least it's deterministically wrong.

![Setting the clock so the cartridge knows what day it is](/images/blog/2026/08/gameboy-set-date.png)

## Nutrition

This is the core loop. Pick a date, search a food, set the serving in grams or ounces, log it. The home screen shows the day's totals against your goals with little progress bars, the same five macros as the app.

![The daily macro dashboard](/images/blog/2026/08/gameboy-nutrition.png)

The 517 foods live in ROM banks 2 and 3, not in SRAM. They're read-only reference data so they belong in the cartridge's program space, and at roughly 16 KB per bank you have to actually budget for them. Each food stores energy as whole kilocalories and macros as decigrams (tenths of a gram), because the Game Boy has no floating point. None. There's no FPU, and software floats are slow and bloated, so the entire app is integer math with fixed scaling.

When you log "85 grams of chicken breast," the food log doesn't store the macros at all. It stores a 6-byte record of `{ day_number, food_index, grams }` and recomputes the macros on demand by scaling the per-100g values:

```c
// gameboy/src/data/foodlog.c
void foodlog_scale(const FoodCache *fc, uint16_t grams, uint16_t *cal, uint16_t *pro,
                   uint16_t *carb, uint16_t *fat, uint16_t *fib) NONBANKED {
    *cal  = (uint16_t)(((uint32_t)fc->kcal * grams + 50u) / 100u);
    *pro  = (uint16_t)(((uint32_t)fc->protein_dg * grams + 500u) / 1000u);
    *carb = (uint16_t)(((uint32_t)fc->carbs_dg * grams + 500u) / 1000u);
    *fat  = (uint16_t)(((uint32_t)fc->fat_dg * grams + 500u) / 1000u);
    *fib  = (uint16_t)(((uint32_t)fc->fiber_dg * grams + 500u) / 1000u);
}
```

The `+ 50` and `+ 500` are rounding done with integers: add half the divisor before dividing so you round to nearest instead of always truncating down. The `uint32_t` cast matters too, because `kcal * grams` overflows a 16-bit register fast and the Game Boy's CPU is natively 8-bit. Get the cast wrong and a big portion of cereal silently wraps around to a small number, which is the kind of bug that's very funny until it's your bug.

![Searching the 517 bundled foods, custom foods marked with an asterisk](/images/blog/2026/08/gameboy-food-filter.png)

Custom foods are the one writable food source. You can create up to 100 of them (name plus per-100g macros), stored in their own SRAM bank, and they show up first in search marked with a `*`. The clever-ugly detail: deleting a custom food never compacts the slots. It just clears the name and keeps the slot stable, because old food-log records point at foods by index, and if I shuffled the slots after a delete, every historical log would suddenly point at the wrong food. Tombstones instead of compaction. Boring, correct, done.

![Logging a food with a serving size](/images/blog/2026/08/gameboy-track-food.png)

The carbs convention is the same one I obsess over in the main app: bundled food carbs include fiber (US label style), but the progress bar shows digestible carbs (`carbs - fiber`) against your goal, so fiber doesn't get double-counted. Yes, I ported that nitpick to the Game Boy too. If you're going to do a thing, do the thing.

## Workouts

Free sessions: pick an exercise, optionally filter by muscle group with left/right, get a suggested starting weight, then edit sets, weight, and reps. There's a 60-second rest timer because of course there is.

![Picking an exercise, filtered by muscle group](/images/blog/2026/08/gameboy-exercise-picker.png)

The 100 exercises live in ROM bank 6 as a generated table. Completed workouts get written to SRAM bank 2 as a variable-length record: a small header plus one 4-byte row per set. Exercise names aren't stored, just an index into the ROM table, same trick as the foods.

![A workout session in progress](/images/blog/2026/08/gameboy-workout-session.png)

Volume is where the integer math earns its keep. The first version of this just summed raw tonnage — `weight * reps`, clamped so a maniac doing 65,535 kg doesn't overflow the counter — and I wrote at the time that the phone app's real model was overkill for a cartridge. The phone app averages seven different one-rep-max formulas (Epley, Brzycki, Lander, Lombardi, Mayhew, O'Connor, Wathen) to score a set, and there is no world in which a CPU with no FPU evaluates seven of those per set.

Then I realised I didn't have to evaluate them at all. Those formulas only depend on the rep count, so their average is just a multiplier per rep count, and rep counts are integers from 1 to 30. So it's a 30-entry lookup table, computed once, stored as hundredths:

```c
// gameboy/src/features/workouts/volume_calc.h
static const uint16_t avg_1rm_factor_centi[30] = {
    102, 105, 108, 111, 114, 117, 120, 122, 125, 128, /* R= 1-10 */
    131, 135, 138, 141, 144, 148, 152, 156, 160, 165, /* R=11-20 */
    170, 176, 182, 189, 196, 205, 215, 227, 242, 260  /* R=21-30 */
};

static uint16_t set_volume_1rm_kg(uint16_t weight_kg_tenths, uint8_t reps) {
    uint8_t r;
    uint32_t vol;

    if (reps == 0u || weight_kg_tenths == 0u) return 0u;
    r = reps > 30u ? 30u : reps;
    vol = ((uint32_t)weight_kg_tenths * avg_1rm_factor_centi[r - 1u] + 500u) / 1000u;

    return vol > 65535u ? 65535u : (uint16_t)vol;
}
```

60 bytes of ROM and one multiply, and the cartridge now reports the same volume number as the phone. This is my favourite kind of optimization: not making the slow thing fast, but noticing that the expensive part was constant the whole time.

![Rest timer, because the cartridge respects your recovery](/images/blog/2026/08/gameboy-rest-timer.png)

## Progress

Charts on a 160x144 screen with no graphics library and no floats.

It's a paged dashboard over a rolling 7-day or 30-day window. Up/down toggles the window, left/right cycles pages: a summary (distinct muscle groups hit, workout count, days logged, average daily macros), then per-day bar charts for calories, protein, carbs, and fat, then a body-weight trend.

![The home screen, with the Progress button at the bottom](/images/blog/2026/08/gameboy-home-screen.png)

There's no canvas. The "chart" is whole background tiles colored with palette attributes, the exact same primitive the progress bars use. A bar is just a rectangle of filled tiles. To draw the daily calorie chart I compute a per-day total, find the max, and scale each day's height to the 9-row plot area with integer math:

```c
// gameboy/src/app/progress.c
for (b = 0u; b != n_bars; ++b) {
    v = bucket_avg(vals, len, b, n_bars);
    h = (uint8_t)(((uint32_t)v * PLOT_ROWS + (max >> 1u)) / max);
    if (v != 0u && h == 0u) h = 1u;      // never hide a non-zero day
    if (h > PLOT_ROWS) h = PLOT_ROWS;
    if (h == 0u) continue;
    x = (uint8_t)(x0 + b * bar_w);
    top = (uint8_t)(PLOT_BASE + 1u - h);
    ui_fill_attr(x, top, bar_w, h, UI_PAL_SELECTED); // paint the column
}
```

The 30-day window is the interesting bit. The plot is 18 tiles wide and 30 days don't fit, so it buckets the days down to 18 columns and averages each bucket. 7 days get fatter 2-tile bars, 30 days get thin 1-tile bars. Same code path, different `bar_w`. The "average daily calories" on the summary page deliberately divides by days you actually logged food, not by the full 7 or 30, otherwise a couple of lazy days drag the number down and it stops meaning anything.

The body-weight trend needed its own version of that loop. Calories start at zero, so scaling against the max is fine; body weight does not, and normalising 82.1–83.4 kg against a max of 83.4 gives you five identical full-height bars. So the weight chart normalises over min..max instead, and the lightest weigh-in keeps a 1-tile base so it doesn't vanish.

Aggregating it is cheap because the food log is tiny. For each day in the window I sum that day's entries once, fill four parallel arrays (calories, protein, digestible carbs, fat), and every chart page reads from those without rescanning. The whole thing renders in well under a second on hardware that runs at roughly 1 MHz.

I wrote a host-side test for the bucketing and bar-height math before ever touching the emulator, because debugging integer overflow by squinting at a Game Boy screen is not a life I want.

## Settings

The Select button opens a menu, and Settings lets you re-edit every profile field and all your macro targets after onboarding, change units, and there's a confirmation-gated Reset Data option for when you want a clean slate. There's also an About screen that points at [musclog.app](https://musclog.app/), because the cartridge is a gimmick and the real app is on your phone.

![The settings list](/images/blog/2026/08/gameboy-settings.png)

Nothing exciting here — except for the entry I added last, which is the whole reason this section is no longer boring.

## Getting the data off the cartridge

The first version of this post ended with an admission: I had written a decoder that reads the cartridge's SRAM image back into JavaScript objects, it was dev-only, and the obvious endgame — actually moving what you logged on the Game Boy into the real app — was sitting in the code as a `TODO`. I said the hard half, understanding the format on both ends, was done.

That bridge exists now. It just doesn't work the way I expected, because in the meantime I built [optical transfer](/blog/2026/08/using-decimen-optical-transfer-foss-to-transfer-data-between-devices) for the phone app: moving a database between two devices by animating fountain-coded QR codes on one screen and pointing the other device's camera at them. No network, no cable, no server.

A Game Boy has a screen. That is the entire requirement.

So Settings now has one more entry, `SHARE DATA`, and it puts your whole cartridge save on screen as an endless stream of QR codes. You point your phone at it, hold it there while the bar fills, and your Game Boy's food logs, weigh-ins, workouts and custom foods land in the app — mapped onto the app's own exercises and foods, previewed before anything is written. The cartridge is sender-only: it has no camera, so there is no receive path and no Game Boy-to-Game Boy exchange to design.

There is nothing new to build on the phone side, which is the nicest part. It's the same receive screen you'd use to move a database between two phones — Settings, Data, Optical Transfer, Receive — and it has no idea it's talking to a 1998 console.

![The Musclog app's optical receiver pointed at a screen running SHARE DATA](/images/blog/2026/08/gameboy-optical-share-scan.webp)

_Caught at 0%, which is exactly the moment that hint card exists for. This is a real screen-to-camera link with no back-channel, so when nothing is arriving the only thing the app can do is tell you to fill the frame and hold still. It's also mGBA rather than a cartridge — the ROM doesn't care what's drawing its pixels, so the emulator on the website beams a save just as happily as the real thing._

The pipeline is the same one the phones use, which is the point:

```text
profile + SRAM stores + referenced ROM records
      ↓  compact JSON schema v1, streamed as bytes
      ↓  SHA-256
      ↓  MLOG container v1 (plain, uncompressed, database payload kind)
      ↓  LT fountain, 292-byte blocks, frozen 20-byte frame header
      ↓  base44 (468 alphanumeric characters per frame)
      ↓  QR version 11-L, mask 0, 61×61 modules at 2 Game Boy pixels/module
      ↓  phone scanner and the existing receiver
```

Every line of that was a problem.

**The cartridge cannot hold its own save as a string.** There's no JSON library, and more importantly there's nowhere to put the result — the Game Boy's work RAM is measured in kilobytes and most of it is already spoken for. So `optical_export.c` never builds the payload. It renders it as a _virtual_ byte stream — a function that walks the SRAM stores and emits bytes — and runs that same walk multiple times for different purposes. First pass measures the length and hashes it with SHA-256. Second pass computes the container checksum. Then it caches the first twelve finalized 292-byte blocks into the unused high end of SRAM bank 3, which is enough that a normal save is served entirely from cache and never re-streamed. The payload only has to be _reproducible_, never _resident_.

**There's no floating point, and the fountain code needs a logarithm.** The frame format decides which source blocks to XOR together using a robust soliton distribution, and both devices have to derive the identical subset from a sequence number with no handshake at all — the phone might be running a version of the app from months later. On the phone that's `Math.log`. GBDK has no floating-point runtime, so the C side is fixed point, and it deliberately skips sequence numbers that land on an ambiguous CDF boundary rather than risk disagreeing with the TypeScript by one block. Arbitrary gaps in the sequence are legal; a frame the two sides decode differently is not. There's a test that pins the C encoder's emitted frames against the app's own constants, because "the bar fills to 98% and stops forever" is the failure mode here and it comes with no error message.

**Exercise identity has to survive on two wires at once.** A cartridge `.sav` stores a logged set's exercise as a 0-based index into a frozen table, and the optical export sends that same index. So the table order in `data/gameBoyOpticalProtocol.json` can never change — not sorted, not regenerated from whatever the current "popular" 100 happen to be. Reordering it would silently re-point every existing save file and every past export at a different movement. On the receiving side the app maps the index back to the bundled catalogue's stable slug, so an imported Game Boy workout arrives with its real name, photos and target muscles instead of a text stub. And an index past the end of the list means the cartridge is newer than the phone, which creates a plain user exercise rather than rejecting the transfer.

The QR rendering has its own set of indignities. QR version 11 is 61×61 modules, drawn at 2 pixels per module, which needs 324 background tiles — more than the 256 a single VRAM bank addresses, so the tile map has to keep the bank bit set in its attribute map across both CGB VRAM banks. Encoding runs with the CGB double-speed CPU switched on, each frame is held for at least 30 VBlanks so a phone camera can actually focus on it, and the whole QR workspace lives in that same transient bank-3 scratch region — carefully above the custom foods, which end at `0x0A2F`, because overwriting somebody's saved foods to display a QR code would be a genuinely spectacular bug.

The thing I keep turning over is that the cartridge and the phone never negotiate anything. There's no handshake, no version exchange, no retry request. One device emits light in a format frozen months ago and the other one reconstructs a database from it. It's the least modern data transfer I've ever built and it's the only one in the app that doesn't depend on a single third party.

## Sending one day instead of everything

`SHARE DATA` is a migration. It hands over the whole save, and the phone treats it the way it treats any full backup: it previews it, asks, and then replaces everything on the receiving device. That's the right shape exactly once, when you're moving in.

It is the wrong shape for the thing I actually kept doing, which was logging a day of food on the couch with the cartridge and then wanting it on my phone. Nobody wipes their phone to import a Tuesday.

So the nutrition screen's Select menu has a second action, `SHARE DAY`. It sends only the day you're looking at, and the phone _merges_ it: it previews what's coming, matches every food against what you already have, and adds the entries to that date in your diary. It only shows up when the day has something logged, because streaming QR codes at someone to transfer nothing is a poor use of both our time.

The cartridge side turned out to be almost free. Same streaming byte-walk, same container, same fountain, same QR encoder. Three things change: the reference scan stops at that one day, so only the foods it used get sent; the schema it renders is a much smaller one; and two bytes in the container header flip. Those two bytes are load-bearing — one marks the payload as a share rather than a database, and the other declares a version number so implausible that a copy of the app built _before_ day sharing existed reads it, decides the sender is from the future, and refuses to offer its destructive restore. An old build can't be taught anything, so the format had to be shaped so that the wrong thing was impossible rather than merely discouraged.

**The hard part was food identity, and the reason is a 16-character buffer.** When the cartridge loads a food out of ROM it copies the name into a buffer sized for exactly what fits the UI: sixteen characters and a terminator. Which means "Lettuce, leaf, green, raw" reaches your phone as `Lettuce, leaf, g`.

That's fine when you're replacing the whole database — nothing is there to conflict with. It is not fine when you're merging into a phone that already has a food catalogue, because matching on a truncated name misses essentially every bundled food, and the punishment is a second, worse-named copy of it appearing every single time you share a day.

The fix was the exercise trick again, one layer down: send the index, not the name. The generator that builds the ROM's food tables now also freezes each food's identity into that same protocol file, so position 0 is permanently that lettuce, and the phone resolves the index back to the food it already seeded — real name, barcode, micronutrients and all. Your existing food gets reused instead of duplicated. A food you typed in on the cartridge has no bundled identity to look up, so it falls back to the truncated tuple, which is correct: it's genuinely a new food.

Freezing that list has the same rule as the exercises, and the generator enforces it — regenerating the tables in a way that would change an existing position fails the build with a message about save files, rather than silently re-pointing every logged meal at a different food.

**The cartridge does not know what time you ate.** A food log entry is six bytes: day number, food index, grams. There's no clock field and nowhere to put one. So every imported entry lands at midday, filed under "Other", and the receiving screen says so in plain words — an entry arriving at 12:00 under a generic meal looks like the transfer lost something, and it's better to admit the cartridge never knew than to invent a breakfast.

The last decision was the one I couldn't make on your behalf. If the day you're importing already has entries on the phone, adding to it double-counts everything, and replacing it throws away anything you typed there yourself. Both are things people genuinely want — re-scanning a day you already imported wants replace, adding your Game Boy lunch to a day you'd already logged breakfast on wants add. So the import refuses to guess: the receiving screen asks, and there is no default. Replacing is the only destructive thing any share in the app does, and it happens in the same database transaction as the insert, so it can't half-succeed and leave you with an emptied day.

## Other challenges

The thing that almost ended the project was running out of space in the wrong place. The Game Boy splits ROM into 16 KB banks, and bank 0 is special: it's always mapped, so all the shared code and helpers live there, and it can't be paged out. When I finished the progress screen and ran the build, bank 0 was at 16,093 bytes out of 16,384. **291 bytes free.** Not kilobytes. Bytes.

So the whole progress screen had to go into a numbered, paged bank, and the home loop calls into it through a banked function trampoline that swaps the active ROM bank and restores it on return. Then the title screen, the audio driver, and three banks' worth of optical export needed to land somewhere too, so the cartridge grew from 128 KB to 256 KB and the persistent food-log operations got evicted from bank 0 as well. The current layout:

```
Bank layout: ROM_0 uses 14880 / 16384 bytes
Bank layout: _CODE_2 uses 9591 / 16384 bytes     (USDA foundation foods)
Bank layout: _CODE_6 uses 2893 / 16384 bytes     (exercise table)
Bank layout: _CODE_8 uses 6266 / 16384 bytes     (title screen + art)
Bank layout: _CODE_9 uses 6627 / 16384 bytes     (audio driver + APU data)
Bank layout: _CODE_10 uses 11488 / 16384 bytes   (sharing UI + QR encoder)
Bank layout: _CODE_11 uses 10296 / 16384 bytes   (streaming exporter + SHA-256)
Bank layout: _CODE_12 uses 4519 / 16384 bytes    (fountain encoder)
```

1,504 bytes free in bank 0 now, which after the 291-byte era feels like a mansion. The build script parses the linker map and fails the build if any bank overflows, because a ROM that overflows a bank doesn't error, it just maps the wrong code in and crashes when you walk into that menu. Ask me how I learned that.

The other recurring tax is that there's no `malloc`. No heap, basically. Everything is static buffers and stack, and the stack is small, so you don't get to casually declare a 256-byte array inside a function. The workout set scanner for the progress screen uses a fixed static buffer and caps how many sets it reads, because the alternative is blowing the stack and corrupting whatever's next to it.

And this is where Claude and I disagreed most. An LLM has read a million heap-allocating, float-using, malloc-happy C tutorials, so its instinct is to write that C. On a Game Boy that C is a slow-motion crash. A lot of the work was catching "this looks right" code that would have quietly stepped on an unlinked SRAM bank or overflowed a `uint16_t`. The model is a fantastic accelerator and a terrible substitute for understanding the hardware. Both things are true.

The thing that helped most was making the machine check the machine. There's `clang-tidy` and `clang-format` wired up over the C sources against stub GBDK headers, the linker map check fails the build on bank overflow, and the parts with real algorithms — the MIDI arrangement reducer, the fountain port, the chart bucketing — have host-side tests that run in Node instead of on a 1 MHz CPU I can't set a breakpoint in.

19 years between C sessions, and the language was the easy part. The platform was the teacher.

## Creating the webpage

A cartridge nobody can run is a screenshot, not a project. So the Musclog website has a [`/gameboy` page](https://musclog.app/gameboy) that boots the actual ROM in your browser through [WasmBoy](https://github.com/torch2424/wasmBoy), a Game Boy emulator compiled to WebAssembly. Keyboard controls on desktop, on-screen touch buttons on mobile.

```tsx
// app/(website)/gameboy.web.tsx
const { WasmBoy } = await import('wasmboy');
await WasmBoy.config(canvasRef.current, { isGbcEnabled: true, ... });
await WasmBoy.loadROM(rom);
```

The fun problem is saves. A Game Boy battery save is just the cartridge's SRAM image, and WasmBoy persists it to IndexedDB. So I flush it on an interval and when you leave the page, and on the next load it comes right back. Your in-browser weigh-ins survive a refresh.

That decoder I mentioned — the one that reads the SRAM image back into JavaScript objects, mirroring the exact byte layouts from the C firmware — turned out to be useful in the opposite direction. There's no real-time clock in a browser tab, so a web player would otherwise be stuck setting the date by hand on a virtual cartridge. Instead the page now _writes_ a valid profile block into the save before the ROM boots, complete with a matching checksum, handing the cartridge today's real date. The hour and minute ride along in two extra bytes that sit just outside the checksummed region, so the picker can pre-fill the time too without touching the save format.

There's also a PDF instruction manual, generated from a script and linked on that page, because if you're going to do a fake cartridge you may as well do a fake manual.

## Conclusion

The thing that surprised me wasn't C. It was how much modern app development hides from you. On the phone I never think about bytes, banks, or whether a multiply overflows. On the cartridge that's the entire job, and there's something clarifying about a platform that refuses to let you be sloppy. 291 free bytes is a very honest code reviewer.

What I did not expect was that the cartridge would end up teaching the phone app something. The seven-formula volume model became a 30-entry lookup table because the Game Boy couldn't afford the multiplications, and it turns out the phone couldn't really justify them either. Constraints kept turning into simplifications that were just... better.

It's also a genuinely good way to understand the hardware that raised me. I grew up on this thing. Now I can tell it how many grams of chicken I ate and then beam that confession into my phone with a flashing square, which is either the most or least productive use of a Game Boy Color ever shipped, and I refuse to decide which.

The ROM, the build scripts, and the firmware are all open source in the same repo as the app: [github.com/blopa/musclog-app](https://github.com/blopa/musclog-app), under `gameboy/`. If you want to actually mash the buttons without building anything, it runs in your browser at [musclog.app/gameboy](https://musclog.app/gameboy). Bring your own greek yogurt.

Lift, Log, Repeat. On a cartridge now.

See you in the next one!
