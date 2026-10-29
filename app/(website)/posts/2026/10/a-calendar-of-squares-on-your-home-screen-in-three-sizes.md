---
title: 'I put a calendar of squares on the home screen, in three sizes'
date: '2026-10-22'
category: 'product-updates'
description: 'Musclog can now show your workouts and your food logging as GitHub-style heatmaps on Home. Here is what each square means, the three layouts (full width, side by side, compact), why the half-width version got redesigned, and why it is off until you ask for it.'
tags: ['Musclog', 'Heatmap', 'React Native', 'Home Screen', 'Fitness', 'UX']
---

The most useful thing a fitness app can show you on a quiet Tuesday isn't a number. It's a pattern. Did the last three weeks look like the three before them? Is there a hole where a holiday went? Did you actually log food on the days you think you did?

A row of totals can't answer that. A calendar of squares can, at a glance, and everyone already knows how to read one because of GitHub's contribution graph. So Home can now show one, for your workouts, for your food logging, or both.

It's **off by default**. Home is still the same screen you had yesterday until you turn it on. (The screenshots below use Musclog's demo data, so the patterns are made up. Yours will be yours.)

## What a square means

Each square is one calendar day, and darker means busier.

- **Workouts:** the number of workouts you completed that day. A workout belongs to the day it _started_, so a late session that runs past midnight doesn't split in two. One workout is already a solid shade, and two reach the darkest.
- **Nutrition:** the number of different meals you logged that day, out of breakfast, lunch, dinner and snacks. All four reaches the darkest square.

That nutrition rule is deliberate. When the AI estimates a meal, it can expand "chicken salad" into twelve ingredient rows. If the square counted rows, one lunch would look like twelve lunches and a lazy-logging day would outshine a careful one. Counting distinct meals means a day is measured by how much of it you accounted for, not by how finely you wrote it down.

Two more rules keep it honest:

- **A quiet day never reads as an empty one.** Any activity at all is at least the lightest shade, however high the top of the scale is.
- **The scale is fixed.** It isn't stretched to fit your busiest day, so a shade means the same thing in every window and in every month. A square that was dark in September is the same dark today.

```typescript
export function activityLevel(value: number, max: number): ActivityHeatmapLevel {
  const safeValue = sanitizeValue(value);
  if (safeValue === 0 || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  const level = Math.ceil((safeValue / max) * ACTIVITY_HEATMAP_LEVELS);

  return Math.min(ACTIVITY_HEATMAP_LEVELS, Math.max(1, level)) as ActivityHeatmapLevel;
}
```

Tap a square, or hover over it on the web version, and the day is read out: "Oct 14: No workout", "Sun, Aug 16, 2026: Nothing logged". Every square also has a screen-reader label with the same text.

## Three ways to show it

You choose which heatmaps appear (workouts, nutrition, both) and, when it makes sense, how they're laid out.

![The Home heatmaps settings: a source picker set to "Workouts and nutrition" and a layout picker set to "Full width"](/images/blog/2026/10/home-heatmaps-settings.webp)

![The heatmap layout picker with three choices: Full width, Side by side and Compact](/images/blog/2026/10/home-heatmaps-layout-picker.webp)

### Full width

The classic. One card per heatmap, stacked, each showing the last 18 weeks as one column per week and one row per weekday, with month names on top and a "less to more" legend underneath.

![Two full-width heatmaps, Workouts and Nutrition, each showing 18 weeks with month labels, weekday labels and a legend](/images/blog/2026/10/home-heatmaps-full.webp)

It fits a phone without scrolling. If a window is ever wider than its card (say, on a very small screen), the hidden side fades into the card and an arrow appears that scrolls it into view. On the web, where a mouse has no horizontal scroll wheel, that arrow is the only way to reach the hidden weeks, which is why it exists at all.

### Side by side

Both heatmaps in one row, as two small cards with the last 30 days each. No month names, no legend, no hint text. Just a title and a month of squares.

![Two small cards side by side, Workouts and Nutrition, each with a title and three rows of ten squares](/images/blog/2026/10/home-heatmaps-side-by-side.webp)

Tapping a square swaps the card's title for that day's readout, so the card never changes height and nothing below it jumps:

![The Workouts card showing "Oct 14: No workout" in place of its title while a square is selected](/images/blog/2026/10/home-heatmaps-side-by-side-tapped.webp)

This layout only applies when both heatmaps are on. A single heatmap always gets the full width, because half a row with nothing next to it is just wasted space.

### Compact

The shortest option, for one heatmap or both: a single thin card with a row of the last 30 days per source. A small dumbbell icon marks workouts and a fork-and-knife marks food, so there's no legend and no labels.

![One short card titled "Last 30 days" with a thin row of squares for workouts and another for nutrition](/images/blog/2026/10/home-heatmaps-compact.webp)

It uses a fraction of the height of the full version, which matters on a Home screen that already has a summary card, your quick actions and a weekly review on it.

## The side-by-side version got redesigned

I want to be upfront about this one, because the first version of it was bad.

My first attempt at "side by side" was the full calendar, just shrunk: 12 weeks, smaller squares, no weekday column. It technically fit. It also looked terrible. A calendar grid is seven rows tall whatever its width, so each card was nearly as tall as before and left half its width empty. I had made it narrower and not any shorter, which defeated the point.

The fix was to stop pretending it was a calendar. A half-width card has width to spare and no height, so it needs the opposite shape: the last 30 days as one run of squares, oldest first, wrapped into three rows of ten. You lose the weekday alignment, which you can't read at that size anyway, and each card drops to roughly half its previous height.

If ten per row doesn't suit you, that's a single constant in the code. Fifteen would give two rows of slightly smaller squares. I'd rather ship one good default than a slider.

## What it costs

A heatmap sounds like a decorative feature, but it's two live database queries per chart, so I was careful about when they run.

- **With the setting off, it costs nothing.** The Home screen mounts one component that checks the setting first and renders nothing, and the queries live below that check. A test fails the build if the Home route ever reads a heatmap setting or subscribes to the data itself.
- **Nothing is decrypted.** Musclog encrypts your food names and nutrient values, and decryption is the expensive part of reading a long diary. The heatmap only reads plain columns: when a workout started, and the date, time zone and meal type of a food log. Those are exactly the fields it needs and nothing more.
- **It updates live.** Log a meal and the square darkens. The meal type is edited in place on a row that already exists, so the query watches that column explicitly, or an edit would never show up.
- **Days are calendar strings, not timestamps.** Each day is a local `yyyy-MM-dd` key. A timestamp for "midnight" drifts by an hour across a daylight-saving change and quietly lands a day on the wrong square.

## Turning it on

Open **Settings → Appearance and home → Home heatmaps**. Pick workouts, nutrition or both, and if you picked both, pick a layout. The first time you update to this version, the What's new tour also tells you about it.

## What it deliberately doesn't do

It doesn't count streaks, and it doesn't turn a gap into a red mark. A pale square isn't a failure. It's a rest day, a holiday, a busy week or a day you didn't feel like logging, and the heatmap treats all of them the same: as information about a pattern, never a verdict about you.
