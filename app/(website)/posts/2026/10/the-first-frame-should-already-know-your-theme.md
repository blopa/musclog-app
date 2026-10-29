---
title: 'The first frame should already know your theme'
date: '2026-10-29'
category: 'engineering'
description: 'On a big diary, Musclog opened in the default theme, in the wrong language and with your lock off, then corrected itself seconds later. Here is the small settings mirror that fixed the first frame, and the repeated decryption that was making the wait so long.'
tags: ['Musclog', 'React Native', 'Expo', 'WatermelonDB', 'Performance', 'Startup', 'Encryption']
---

For the past few weeks, opening Musclog on my own phone did something small and annoying. The app would come up in the default green theme, sit there for a couple of seconds, and then repaint itself in the theme I had actually chosen. If I looked quickly, the text was in the wrong language too.

It never happened on a fresh install or on the web version. It happened on my real database, which has about three and a half years of food logs in it.

Today I fixed it, and in the process found out why the wait was so long to begin with. This post is about both, because they turned out to be the same problem seen from two sides: **the first screen was waiting for the database, and the database was slow.**

## Why a setting can be slow to read

Every setting in Musclog (theme, language, units, which areas are locked) lives in a `settings` table in the same database as everything else. That's the right place for them. It means they're backed up, restored and migrated like the rest of your data.

The catch is when you can read them. The sequence on a cold start is roughly:

1. The splash screen is hidden on the first commit.
2. The database opens and the boot migrations run.
3. `SettingsProvider` mounts and runs its first query.
4. That query emits, and now the app knows your theme.

Step 3 is queued behind step 2, and on a large database step 2 takes a while. WatermelonDB runs on the JS thread here, so the queue is the thread. Until the first emission, every consumer of settings sees `DEFAULT_STATE`, and that default is a perfectly reasonable state for nobody in particular: dark green theme, English, metric units, nothing locked.

So the app drew the whole Home screen from defaults and then redrew it once the real values arrived.

![Left: the default theme the app used to show on its first frame. Right: the theme the person had chosen. An illustration composed from the app's own theme screenshots, not a screen recording.](/images/blog/2026/10/boot-first-frame.webp)

The picture above is an illustration I put together from the theme screenshots rather than a recording of the flash. The point it makes is real, though: the two frames have nothing in common, and the first one is the one you see.

Three things were wrong at once, and only one was visible:

- **Theme.** Home painted in the default palette, then repainted.
- **Language.** The text was drawn in the phone's language, then switched to English (the default), then to the app's language. `LanguageInitializer` applied the default straight away instead of waiting for the real value.
- **Lock.** The lock scopes default to "none", so for the seconds before the table was read, a locked area was simply open.

The third one is the one I care about. A lock that opens for the length of a database query isn't a lock.

## Web already had the answer

On the web the theme never flashed, and the reason is mundane. A small module, `themeMirror`, kept the preference in `localStorage` and replayed it as CSS variables before the app loaded. `localStorage` is synchronous and exists before anything else does.

Native has nothing like that. The closest equivalent is AsyncStorage, which is asynchronous but is a single small read from a key-value store, with no migrations in front of it.

My first attempt was the obvious one: do the same for the theme on native. That shipped as a commit this morning. It worked for the theme, and then I looked at the other two symptoms and realised I'd fixed one-third of a problem. The theme was just the one you could see.

## One mirror for everything the first frame needs

So I replaced it, the same day, with a mirror of everything the first frame depends on:

```typescript
export type MirroredSettings = {
  theme: ThemeOption;
  language: string;
  units: Units;
  appLockScopesRaw: string;
};
```

It's one AsyncStorage entry, and the flow is:

- `hydrateSettingsMirror()` starts at module load in the root layout, so the read is already in flight while everything else initialises.
- `AppDbReadyGate` waits for it before mounting the providers, and applies the mirrored language to i18n first, so the first thing drawn is already in the right language.
- `SettingsProvider` seeds its initial state from the mirror instead of from defaults.
- Every time the settings table emits, the provider writes the mirror back:

```typescript
export function recordSettingsMirror(next: MirroredSettings): void {
  if (
    snapshot?.theme === next.theme &&
    snapshot.language === next.language &&
    snapshot.units === next.units &&
    snapshot.appLockScopesRaw === next.appLockScopesRaw
  ) {
    return;
  }

  snapshot = next;
  notify();
  AsyncStorage.setItem(SETTINGS_MIRROR_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}
```

The important sentence in the module's own comment is: **the table stays the only authority.** The mirror is a hint for the first frame. As soon as the real settings load, they replace it, and if the two ever disagree the table wins.

That also dictates what's allowed in. AsyncStorage isn't encrypted, so nothing secret goes in. A short list of theme, language, units and which areas are locked is fine; it's the kind of thing someone could read off your screen. It's also excluded from backups, so restoring a file doesn't carry another install's preferences across.

The language part has a second half. `LanguageInitializer` now does nothing while settings are still loading. Before, it saw the pre-load default and switched to it, which is exactly how English flashed in before the real language.

## The lock only trusts the mirror in one direction

The lock is the one setting where being wrong is not cosmetic, so I treated it differently.

If there's no mirror at all (first launch after an update, or right after a restore), the app can't know whether you have a lock. The old behaviour was to assume none. The new behaviour is the opposite: until the table has actually been read, **every scope is treated as locked**.

That's easy to get wrong in a second way. The lock screen prompts for authentication the moment it mounts, and most people have no lock set up at all. Showing it to everyone for a second would be a new bug that is worse than the one I started with. So while the settings are pending, the overlay draws a plain neutral cover instead, and the lock screen only appears once the app knows a lock really exists. An area gate renders nothing at all in that window for the same reason.

There's one deliberate exception. A brand-new install that hasn't finished onboarding can't have a lock, and covering the onboarding screens would hide the very thing the person is trying to use.

I wrote down what this does not solve, because it's easy to over-claim:

- The first launch after updating has no mirror, so it still shows the default theme once and is covered until settings load.
- If the last write of the mirror failed, the next launch could say "no lock" for one launch after you turned the lock on.
- If the settings query itself errors, loading still ends with defaults, as it did before.

All three are narrow, and the second is the only one I'd call a real gap. It's documented rather than hidden.

## But why was the wait so long?

A mirror makes the first frame correct. It doesn't make the wait shorter, and on my phone the wait was around two seconds with the UI frozen. A fix that only hides a slow start behind a nicer first frame isn't something I wanted to leave at that.

My first guess was queries. It was wrong. Loading every nutrition log as a model took about 26 ms on my dataset, and the date reads were already using an indexed column. The database was fine.

The cost was **decryption**. Logged macros are encrypted, and every value is its own `CryptoJS.AES.decrypt(cipher, passphrase)`. Passing a passphrase makes CryptoJS derive the key with an MD5-based routine before every single value, which was about 91% of the time of each decrypt. Hermes has no JIT, so that's slower on a phone than it is on my desktop. And all of it runs back to back on the JS thread without yielding, so nothing repaints until it finishes.

I counted how many decrypts a cold start did on my dataset: **8,426**. Most were duplicates.

## Three ways to decrypt the same thing

**Decrypting twice to answer one question.** `NutritionLog.getNutrients()` first called `hasSnapshot()`, which decrypted the whole snapshot (including the food name) to check it was complete, and then decrypted all of it again to read the numbers. Now it decrypts once, and only what it needs: the macros and micros, never the name. `hasSnapshot()` shares the same completeness check.

**Two screens asking the same question at the same time.** Home needs the last 30 days of nutrition for the energy figure, and a dynamic goal needs the same window for its macros. Each computed it independently, about 2,800 decrypts apiece. The fix is to share a request that's already running:

```typescript
const existing = inFlightWindows.get(key);
if (existing) {
  return existing;
}

const request = readLatestHistoricalNutritionWindow({ ...options, asOfDate }).finally(() => {
  if (inFlightWindows.get(key) === request) {
    inFlightWindows.delete(key);
  }
});
inFlightWindows.set(key, request);
return request;
```

Only requests in flight are shared, never a finished result, so a call made after you log something still sees it. The key uses the calendar day rather than the exact instant, because the window only ever reads the day.

**A repair that never finished being necessary.** A boot task fixed negative fibre values by loading and decrypting the fibre of every log, on every launch: about 1,900 decrypts. Every writer has clamped fibre for a while, so only rows from before that fix can be wrong. It is now a run-once migration (restoring a backup runs it again), while the two halves that filter on plain columns still run every time because they cost nothing once clean.

![A bar chart of AES decrypts during one cold start on the same diary: 8,426 before and 1,386 after](/images/blog/2026/10/boot-decrypts.webp)

A cold start on the same dataset now decrypts **1,386 values, 84% fewer**. I counted decrypts rather than timing the result end to end, so I'm not going to put a stopwatch number on the improvement. Every one of them was deterministic work with the same answer, and now it isn't being repeated.

## The two fixes together

Put side by side, the sequence is easy to see. Before, the first frame waited on the whole chain. Now it waits on a single small read, and the chain itself got shorter.

![A timeline of a cold start. Before, Home is drawn from defaults until the settings table emits. After, a mirror read lets Home draw with the right theme and language while the database opens](/images/blog/2026/10/boot-timeline.webp)

I'd say the mirror is the more important of the two, because it fixes something that stays fixed. A database will keep growing, and a boot path that depends on how big it is will keep getting slower. A first frame that doesn't depend on the database can't.

## What's still not great

Each decrypted value still pays its own key derivation the first time it's read. Fixing that properly means a new ciphertext format where the key is derived once, or encrypting the database as a whole. That's a real migration of everyone's data, so it's not something to slip in on a Thursday, and I've left it written down rather than half done.

The boot repairs also still run alongside Home's first reads. They're cheaper now, but they share the thread.

What I'd take from today is mostly about where state lives. Putting every setting in the database was correct, but treating the database as ready by the time the first frame needs it wasn't. The first frame is the one thing every user sees on every launch, so it deserves a path of its own that doesn't wait for anything.
