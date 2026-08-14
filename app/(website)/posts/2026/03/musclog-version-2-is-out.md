---
title: 'Musclog version 2 is out!'
date: '2026-03-19'
category: 'productUpdates'
description: 'Musclog started in 2024 as an app I built for myself. Version 2 is a full rewrite — new UI layer, one database instead of two, and a much clearer answer to the question of where your data lives.'
tags: ['Release', 'React Native', 'Rewrite', 'Privacy', 'TypeScript']
---

Musclog 2 is out.

It is not a redesign, and it is not a big feature drop. It is the same app rebuilt from an empty folder, and it took about two and a half months of evenings to get from that empty folder to something I was willing to put on people's phones.

Here is what changed and why I thought it was worth throwing away a working app to do it.

## Where this came from

I started Musclog in September 2024, for me. I lift, I wanted to log it, and every app I tried either wanted a subscription, wanted an account, or wanted to sync my body weight to a server I knew nothing about. I am a web developer, I had React experience, and React Native was close enough that "just write it yourself" stopped sounding unreasonable.

So I did. That version — the one now living in the git history as `musclog-app` — ran for about a year and a half across 602 commits, up to v1.8.9. It worked. People other than me used it, which was never the plan and was quietly the best part.

It also had two problems I could not fix by adding to it.

**Problem one: two databases.** Version 1 had a mobile data layer on `expo-sqlite` and a completely separate web data layer on Dexie, with a shared "common" module trying to hold the two together. Every schema change meant writing the same migration twice, in two dialects, and hoping they agreed. Every bug was potentially two bugs. It worked right up until it did not, and the failures were always the boring, expensive kind where web and mobile silently disagreed about what was in the database.

**Problem two: the UI layer.** Version 1 was built on React Native Paper. Nothing wrong with it — but every screen had grown its own `StyleSheet.create`, the theming was a layer on top of a layer, and by the end I was fighting the component library more often than I was using it. Making the app _look_ like anything specific meant overriding something.

Neither was going to be fixed incrementally. So on the 5th of January 2026 I made a new repo and started over.

## What version 2 actually is

The rewrite has two structural decisions in it, and pretty much everything else follows from them.

### One database, reactive, everywhere

Everything runs on **WatermelonDB** now — one schema, one set of models, one service layer. The only platform-specific file is the adapter: SQLite on native, LokiJS on web. Same schema, same migrations, same queries.

The nice second-order effect is reactivity. WatermelonDB queries are observables, so a screen subscribes to a query and simply re-renders when the underlying rows change. There is no manual cache invalidation anywhere in the app, and no "pull to refresh because the number is stale". You log a meal in a modal and the daily total behind it updates because it was watching the query the whole time.

### Tailwind instead of a component library

The whole UI is **NativeWind** — Tailwind classes on React Native primitives. No component library underneath, and a small set of theme components on top.

The concrete difference: version 1 had styling spread across hundreds of `StyleSheet.create` blocks that each knew a little bit about the theme. Version 2 has utility classes and one source of truth for the design tokens. Changing spacing across the app is now a change, not a project.

It also collapsed the platform gap. The same components render on web, which is how the app has a working web build at all.

## Some things I am happy with

The rewrite was mostly the boring part — reimplementing what already existed. But a few things came out much better than they were.

### Sensitive data is encrypted at rest

Every nutrition log and every body metric is AES-encrypted in the database. Not the whole file — the individual fields, so the plaintext values are never sitting in a `.db` anyone can pull off the device.

The models make this pretty readable. The raw columns hold ciphertext, and the decrypted values are only ever produced on demand:

```ts
export default class NutritionLog extends Model {
  static table = 'nutrition_logs';

  @field('food_id') foodId!: string;
  @field('date') date!: number;
  @field('type') type!: MealType;
  @field('amount') amount!: number;

  // Encrypted at rest (ciphertext in DB)
  @field('logged_food_name') loggedFoodNameRaw?: string;
  @field('logged_calories') loggedCaloriesRaw?: string;
  @field('logged_protein') loggedProteinRaw?: string;
  @field('logged_carbs') loggedCarbsRaw?: string;
  @field('logged_fat') loggedFatRaw?: string;
  @field('logged_fiber') loggedFiberRaw?: string;
  @field('logged_micros_json') loggedMicrosRaw?: string;
}
```

Note what is _not_ encrypted: `date` and `type`. That is deliberate. Those columns have to stay queryable so "show me everything I ate on Tuesday" is a SQL `WHERE` clause rather than decrypting the entire table and filtering in JavaScript. Keeping a plaintext day key next to encrypted values is the compromise that makes the whole thing usable, and it is a pattern that shows up in several tables now.

### The database always stores metric

This sounds trivial and absolutely is not. Version 1 stored whatever the user typed and remembered which unit that was, which meant every calculation had to know about units too, and a bug anywhere in that chain silently corrupted data rather than displaying it wrong.

Version 2 stores metric. Always. Kilograms, centimetres, grams, kilocalories. Conversion happens only at the two edges — input and display — through one module:

```ts
/**
 * Convert weight from storage (kg) to display value.
 * Returns value in kg when metric, in lb when imperial.
 */
export function kgToDisplay(kg: number, units: Units): number {
  if (units === 'imperial') {
    return convert(kg, 'kg').to('lb') as number;
  }
  return kg;
}

/**
 * Convert display weight (user unit) to storage (kg).
 * Input is in kg when metric, in lb when imperial.
 */
export function displayToKg(value: number, units: Units): number {
  if (units === 'imperial') {
    return convert(value, 'lb').to('kg') as number;
  }
  return value;
}
```

Every chart, every average, every TDEE estimate now operates on one unit system and never has to ask. Switching the app to imperial changes what you see and touches nothing that was stored.

### AI is optional, and the app knows it

Musclog has an AI coach — chat, workout generation, estimating macros from a photo of your dinner. It runs on Gemini or OpenAI with your own key.

The rule I set for myself in the rewrite is that **AI is never load-bearing**. The app is fully usable with no key configured, and every button whose only purpose is to reach a model is hidden rather than shown-and-then-failing. There is no upsell, no "unlock with", no degraded experience. If you never configure it, you never see it, and nothing you do leaves the device.

Alongside that there is an option to run OCR locally before sending an image to a model, so a nutrition label can be read on-device and only the extracted text goes out — not the photo.

## How it actually went

Honestly? The middle was rough.

The first few weeks were great, because rebuilding something you have already designed once is fast and you get to fix every decision you regretted. Workouts, sets, the rest timer, the exercise library, food logging, barcode scanning — all of that came back quickly and came back better.

Then I hit the long tail, and the long tail is where a rewrite either ships or quietly dies. Around the five-week mark I stopped and wrote out an honest inventory of what version 1 did that version 2 did not. The temporary audit has since been folded into the repo's current-feature list and roadmap, but it was not flattering — the AI coach was a mock that appended messages locally and talked to nothing, the smart camera had `// Implement actual AI processing here` sitting in it, and the progress screen was a menu item pointing at a route that did not exist.

Writing it down was the thing that made it finishable. The gap stopped being a vague feeling that the app was not ready and became a list, and lists get shorter.

I bumped the version to 2.0.0 on the 9th of February, five weeks in. It took another five weeks after that before I actually believed it.

The whole thing is in the git history if you want the unglamorous version: 2,633 commits between January 5th and today, most of them small, plenty of them undoing something from the day before.

## What version 2 ships with

- **Workouts** — templates, supersets, drag-to-reorder, rest timer, weekly scheduling, volume and estimated 1RM tracking, and a built-in exercise library
- **Nutrition** — food logging with barcode scanning, Open Food Facts / USDA / local search, custom foods and saved meals, 40+ micronutrients, and empirical TDEE derived from what you actually logged
- **Cycle tracking** — phases, predictions, and optional intensity adjustment, fully toggleable
- **AI coach** — chat, workout generation, photo macro estimation, custom system prompts, bring your own key
- **Health integration** — Google Health Connect on Android, Apple HealthKit on iOS
- **Home screen widgets** on Android
- **Export and import** — your entire database as JSON, encrypted if you want it to be
- **English and Portuguese**, with more coming

## The part that has not changed

Version 1 was written because I did not want my training and body data on someone else's server. Version 2 is a better-built app with the same answer: everything lives on your device, the sensitive parts are encrypted, the AI is optional and off unless you turn it on, and there is no account to make because there is nothing to sign in to.

The rewrite was worth doing because it makes that promise cheaper to keep. One database instead of two means one place where data can go wrong. One styling system means the next feature is a feature rather than an argument with a component library.

There is a lot more coming — I have a long list, and now I have somewhere sane to build it.

## Get it

- [Download Musclog for Android](https://play.google.com/store/apps/details?id=com.werules.logger)
- [Join the iOS TestFlight](https://testflight.apple.com/join/mq3QMSHU)
- [Browse the source on GitHub](https://github.com/blopa/musclog-app) — it is all there, including the parts I am not proud of
- [How Musclog came to be](https://pablo.gg/en/blog/coding/musclog-leveraging-my-reactjs-experience-to-build-a-react-native-app/), written back when version 1 was new

If you use it and something is broken, please open an issue. It is one person building this, and I genuinely cannot see your device from here.
