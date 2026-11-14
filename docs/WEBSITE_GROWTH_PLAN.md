# Website growth plan: tools and articles for lifters

Status: tools 1–10 and the Tools navigation shipped (2026-11-14); Search Console, blog posts and share links remain. Like `NEW_LEARNINGS_PLAN.md`, this is an active plan: update the
status table as phases ship, fold lasting rules into `AGENTS.md` / `docs/DESIGN.md`, and delete this file
when it is done.

## Why

Of the 25 blog posts on musclog.app, 23 are written for developers (`engineering`, `product-updates`,
`retro`). They suit Hacker News, but nobody who wants a workout or calorie app searches for "greedy plate
math". Lifters search for things like "1RM calculator", "plate calculator", "how much protein" and "push
pull legs program". Free calculators are a well-known way to rank for those searches, and each tool page
leads naturally into the app. Expect 3–6 months before search traffic shows up.

## Rules for everything in this plan

- **Reuse the app's own math.** Every tool imports the pure function the app already uses, so the website
  and the app can never disagree. Never re-implement a formula in a page.
- **Honest copy.** No invented numbers, testimonials or "thousands of users" (the deslop guards already ban
  them on the homepage). Studies are cited with links. Strength levels never show or imply a percentile.
  Cycle content never promises phase-based training advice.
- **Comparisons with other apps are fine on the website, never in the Play listing.** Google Play's
  metadata policy forbids comparing with other apps in a store listing. On our own pages, keep each claim
  factual, dated ("checked on 2026-11-14") and linked to the competitor's own page or store listing.
- **Each page has one call to action:** the store buttons (`StoreButtons`). A program page can also offer an
  "Open in Musclog" link (`buildOpenHttpsUrl`). Campaign tags follow the existing first-touch rules in
  `utils/websiteAnalytics.web.ts`.
- **Follow the website conventions in `AGENTS.md`:** plain HTML elements, links as `<a href>`, no
  decorative layers, `generateMetadata()` per route. Every fixed route goes in
  `components/website/websiteRoutes.json` and gets a `website.seo.routes.<key>` title and description in
  every locale's `website.json`. Tool pages are translated like the rest of the site. Blog posts can start
  in English only.
- **Structured data:** tool pages render `WebApplication` JSON-LD (free, `applicationCategory`
  `HealthApplication`), and an article with a real Q&A section can add `FaqPageJsonLd`. Never fabricate
  fields such as `aggregateRating`.
- **Tests:** each tool gets a test that the page calls the shared function (as `routes.test.ts` /
  `deslopGuards.test.ts` do), plus unit tests for any new pure helper. New routes must pass the layout
  audit (`npm run layout:audit`).

## Phase 0: free groundwork (one evening)

- [ ] Verify musclog.app in Google Search Console and submit `/sitemap.xml`, which the build already
      generates. Note the queries the site already ranks for; they decide which tools come first.
- [ ] Add a "Tools" entry to the header burger menu (`MobileMenu` `menuLinks`) and the footer. Don't add a
      homepage section: the homepage composition is pinned by `deslopGuards.test.ts`.

## What exists today

| Route           | What it does                                             | Reuse for                                                 |
| --------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `/calculator`   | BMR, TDEE, macros, BMI, FFMI, and a starting plan        | protein and deficit tools (split out, see below)          |
| `/exercises`    | Exercise library by muscle, equipment, mechanic          | links from every program and article                      |
| `/alternatives` | Feature grid vs MyFitnessPal, MacroFactor, Hevy and more | missing Strong and FitNotes, and a "free tier limits" row |
| `/progress`     | In-browser explorer for a Musclog export                 |                                                           |
| `/rep-marker`   | Rep-marking tool for the rep model                       |                                                           |
| `/gameboy`      | The Game Boy Color ROM                                   | Hacker News and retro launch posts                        |

## Missing tools

Ordered by expected search demand and how much existing code they reuse. Routes go under `/tools/<slug>`
(one registry entry each), with a `/tools` index page.

| #   | Tool                                  | Route                           | Reuses                                                                                                                                     | Unique angle                                                                                                  |
| --- | ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1   | One-rep max calculator                | `/tools/one-rep-max`            | e1RM in `utils/workoutCalculator.ts`, `MAX_E1RM_REPS` (`utils/relativeStrength.ts`)                                                        | Takes reps in reserve as well as reps, shows a % of 1RM table, and says why sets above 10 reps aren't trusted |
| 2   | Plate calculator                      | `/tools/plate-calculator`       | `platesPerSide`, `nearestLoadableKg` (`utils/plateCalculator.ts`), `defaultGymSnapshot`                                                    | Works with the plates your gym actually has (knapsack, not greedy), in kg or lb, with a custom bar            |
| 3   | Strength level checker                | `/tools/strength-level`         | `gradeStrength` (`utils/strengthLevel.ts`), `normalizedRelativeStrength`, `utils/strengthGradedLifts.ts`                                   | Levels by body weight and sex, shown as a range for "other"; never a percentile                               |
| 4   | Warm-up set calculator                | `/tools/warm-up-calculator`     | `buildWarmupSets`, `WARMUP_RAMP` (`utils/warmupSets.ts`) + plate rounding                                                                  | Every warm-up set loadable with your plates                                                                   |
| 5   | RPE / RIR chart and load calculator   | `/tools/rpe-chart`              | `repsInReserveFromRpe`, `RPE_AT_FAILURE` (`utils/setEffort.ts`), the e1RM function                                                         | "I did 100 kg × 5 at RPE 8; what should 3 reps at RPE 9 be?"                                                  |
| 6   | Protein calculator                    | `/tools/protein-calculator`     | `calculateMacros` and `PROTEIN_G_PER_KG_BODYWEIGHT` (`utils/nutritionCalculator.ts`)                                                       | Grams per kg of body weight by goal, capped at a BMI-30 reference weight, not a percentage of calories        |
| 7   | Calorie deficit and goal date         | `/tools/calorie-deficit`        | the `/calculator` TDEE math                                                                                                                | Honest ranges, and a link to the adaptive TDEE article (#4 below)                                             |
| 8   | Free workout programs                 | `/programs`, `/programs/<slug>` | the 15 bundled plans in `data/workoutTemplatesData.json` + `data/workoutTemplates{EnUS,…}.json`, `buildOpenHttpsUrl` (`utils/openLink.ts`) | Each program page lists days, exercises (linked to `/exercises`), sets and reps, plus "Open in Musclog"       |
| 9   | Net carbs vs total carbs converter    | `/tools/net-carbs`              | `digestibleCarbs`, `totalCarbsFromSource` (`utils/carbsConvention.ts`)                                                                     | US labels include fiber and EU labels don't. Almost no other site explains this                               |
| 10  | Competitor pages and free tier limits | `/alternatives/<app>`           | the `/alternatives` grid data                                                                                                              | Add Strong and FitNotes to the grid; one page each for Strong, Hevy and MyFitnessPal                          |

Notes:

- #8 carries the most weight: "push pull legs program", "upper lower split" and "PHUL" are large searches,
  and the page leads straight into the app. Program slugs come from the template's `__title` (stable), never
  its array index. The copy comes from the locale files, so programs are translated for free.
- #10: free tier limits as checked on 2026-11-14: Strong's free version allows 3 custom routines (its App
  Store listing), Hevy's 4, and MyFitnessPal's barcode scanner is Premium-only. Re-check these before
  publishing and date them on the page. They change.
- #2, #4 and #5 can share one "your gym" form (bar weight, plates, unit) remembered in `localStorage` (a
  per-visitor convenience; wrap every access in try/catch).

## Blog post ideas (lifter-facing)

Add a `training` and a `nutrition` category (`website.blog.categories.<key>` in every locale). Each post
targets one search, links to one tool and to `/download`, and uses 390×844 screenshots (gallery rules in
`AGENTS.md`). Cite sources and don't invent statistics.

| #   | Working title                                                                     | Target search                                             | Links to                                                                          | Category  |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | --------- |
| 1   | How to estimate your one-rep max (and why sets of 15 lie to you)                  | "1rm calculator", "how to calculate one rep max"          | tool 1                                                                            | training  |
| 2   | Your gym has the wrong plates: how to load the bar anyway                         | "plate calculator", "how to load a barbell"               | tool 2 (lifter version of the engineering post)                                   | training  |
| 3   | RPE and RIR explained, with a chart you can use tomorrow                          | "rpe chart", "reps in reserve"                            | tool 5                                                                            | training  |
| 4   | Why every TDEE calculator is wrong, and how your weight trend fixes it            | "tdee calculator", "adaptive tdee"                        | `/calculator`, tool 7                                                             | nutrition |
| 5   | How much protein do you actually need? By goal and body weight                    | "how much protein to build muscle"                        | tool 6                                                                            | nutrition |
| 6   | Push Pull Legs: a free 6-day program you can open in your app                     | "push pull legs program"                                  | `/programs/push-pull-legs`                                                        | training  |
| 7   | Upper/Lower 4-day split for people with jobs                                      | "upper lower split"                                       | `/programs/upper-lower-4-day`                                                     | training  |
| 8   | Double progression: the simplest way to add weight every week                     | "double progression", "progressive overload"              | the app's progression explanations                                                | training  |
| 9   | Deload weeks: when you need one and how to run it                                 | "deload week"                                             | Weekly Review "lighter week"                                                      | training  |
| 10  | Coming back to the gym after a break: what weight to start with                   | "returning to gym after break"                            | Comeback mode (say which numbers are product choices, as `docs/RESEARCH.md` does) | training  |
| 11  | Net carbs vs total carbs: why US and EU food labels disagree                      | "net carbs vs total carbs", "carbs fiber eu label"        | tool 9                                                                            | nutrition |
| 12  | Warm-up sets: how many and how heavy                                              | "warm up sets before squat"                               | tool 4                                                                            | training  |
| 13  | Strength standards: what a good bench, squat and deadlift is for your body weight | "strength standards", "good bench press for weight"       | tool 3 (levels, never percentiles)                                                | training  |
| 14  | Moving your workout history from Strong, Hevy or FitNotes                         | "export strong app data", "hevy export csv"               | the import flow, `/alternatives/<app>`                                            | guides    |
| 15  | Counting calories without an account: what food apps learn about you              | "calorie counter without account", "private food tracker" | `/privacy`, the encryption post                                                   | nutrition |

Order: start with 6 and 7, together with tool 8, then 1, 2 and 5 with their tools, then the rest. The
engineering posts keep their place; post them to Hacker News with the "Show HN" label when relevant.

## Optional: share links (no server needed)

The `/open#workout=<payload>` bridge already works on GitHub Pages: the payload lives in the URL fragment,
so no server ever sees it. Two follow-ups would turn sharing into free distribution:

- Share a routine as an `https://musclog.app/open#workout=…` link (`encodeOpenPayload`,
  `buildOpenHttpsUrl`) instead of clipboard text. Someone who has the app gets the import review; someone
  who doesn't lands on the bridge page with store buttons.
- Make the workout summary's share an image card drawn on the phone (the `useChartCapture` path the year
  story uses) with `musclog.app` on it, instead of plain text.

`assetlinks.json` still has placeholder fingerprints (see `AGENTS.md`, open links), so on Android a tapped
link opens the bridge page rather than the app until they are filled in.

## Status

| Phase                               | Status                                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Search Console, Tools navigation | Tools navigation done (burger menu, footer); Search Console is a manual step                                                                                                                                   |
| Tools 1–10                          | done: tools 1–7 and 9 under `/tools`, programs under `/programs`, `/alternatives/{strong,hevy,myfitnesspal}`. Not done: Strong and FitNotes columns in the `/alternatives` grid (needs verified facts per row) |
| Blog posts (0 of 15)                | not started                                                                                                                                                                                                    |
| Share links (optional)              | not started                                                                                                                                                                                                    |
