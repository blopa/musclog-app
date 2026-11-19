---
title: 'Two calculators for your next session: how much to add, and when to cut back'
date: '2026-11-21'
category: 'training'
description: 'The progressive overload calculator tells you what to lift next session, and the deload calculator plans a lighter week. Both run the same rules the Musclog app uses, with worked examples.'
tags: ['Progressive overload', 'Deload week', 'Strength training', 'Workout planning', 'Musclog']
---

Two questions come up after almost every session: should the weight go up, and when should it come down? The [progressive overload calculator](/tools/progressive-overload-calculator) answers the first one from what you did last session. The [deload calculator](/tools/deload-calculator) answers the second by planning a lighter week for one exercise. Both run in your browser, need no account, and use the same rules the [Musclog](/download) app applies to your workouts, so what you read here is what the app would do.

## The progressive overload calculator

You enter what happened last session and it returns one of three answers: go up, repeat, or go lighter.

The fields are:

- **Last session's weight**, in kg or lb.
- **Reps in your weakest working set.** The set with the fewest reps is the one that counts, so a session of 8, 8 and 6 is a 6.
- **Reps your plan asks for**, per set.
- **Reps in reserve, averaged.** That is how many more reps you could have done after each set. Leave it empty if you did not rate your effort, and the call rests on reps alone. The [RPE and RIR explainer](/blog/2026/11/rpe-and-rir-explained) shows how to rate it.
- **Whether you finished every set**, and **whether the session before also failed** at this weight.
- Under more options: the equipment, and whether to add weight first or reps first.

### The rule behind it

The app goes up when your weakest set hit the planned reps and you ended with at least 2 reps in reserve on average. That is one load step: 2.5 kg (5 lb) with no gym set up, or twice your lightest plate on a barbell when you have entered your plates. It repeats after one hard or short session, because one bad day is not a stall. It goes lighter after two sessions in a row at the same weight where you missed the planned reps or finished with nothing in reserve. These thresholds are Musclog's product choices, not study results.

The research gives a range instead of one number. The American College of Sports Medicine's [2009 position stand](https://doi.org/10.1249/MSS.0b013e3181915670) suggests raising the load by about 2 to 10% once you can do one or two reps over your target on two sessions in a row. The calculator acts after a single session, but only when you left reps in reserve and hit every planned rep. The [rules for adding weight](/blog/2026/01/how-many-reps-before-adding-weight) post compares the approaches.

### A worked example

Say you benched 60 kg last week. The plan asked for 8 reps, your weakest set had 8, you averaged 2 reps in reserve and you finished every set. On a barbell with the default plates, the calculator gives:

| What you pick | Next session                 | Why                                  |
| ------------- | ---------------------------- | ------------------------------------ |
| Weight first  | 62.5 kg for 8 (4.2% heavier) | The session met the bar, so one step |
| Reps first    | 60 kg for 9                  | Reps climb before the load does      |

It also shows the plates for the heavier option: a 20 kg plate and a 1.25 kg plate on each side of a 20 kg bar.

Change one input and the answer changes with it. With 1 rep in reserve instead of 2, it repeats 60 kg for 8, because the session was already hard enough. With a weakest set of 6, it repeats too. If the session before also missed at this weight, it goes lighter, to 52.5 kg, which is 12.5% lighter than 60. That is 10% rounded down to a load you can actually set.

### Weight first or reps first

Weight first adds a step each time you earn it and keeps your reps. Reps first adds a rep each session until you are two reps above your plan (one above for plans of six reps or fewer), then adds weight and goes back to the planned reps. The second way is [double progression](/blog/2026/11/double-progression-explained).

One more case is worth knowing. On a light dumbbell a single step is a large share of the weight, so when one step is more than a quarter of the load, the calculator adds a rep instead.

## The deload calculator

A deload is a planned lighter week. You enter one exercise's working weight, how many working sets you do in a normal week, and the equipment. The calculator returns a week with four parts:

- **Weight:** 10% lighter or one load step lighter, whichever is larger, then rounded down to a load your equipment can really make, and always strictly lighter than now.
- **Sets:** about two thirds of your working sets, never fewer than one.
- **Effort:** stop each set with about 4 reps in reserve, so the week feels easy on purpose. Keep your usual reps.
- **Length:** one week, training as often as usual with lighter work, then back to your normal loads.

These are Musclog's defaults, and the page says so. It is the same lighter week the Weekly Review can suggest in the app.

### A worked example

For a 100 kg squat with 4 working sets a week:

| Part   | Result                                              |
| ------ | --------------------------------------------------- |
| Weight | 90 kg, which is 20 kg and 15 kg plates on each side |
| Sets   | 3, down from 4                                      |
| Effort | 4 reps in reserve                                   |
| Length | 1 week                                              |

Below that, a table shows the other common cuts, 10, 15 and 20%, each rounded down to a real load. For the same squat they come to 90, 85 and 80 kg. The page marks them as rules of thumb, not study results, so you can take a deeper cut when the week before felt very heavy.

### Why the step matters

A deload has to be lighter in practice, not only on paper. A 20 kg dumbbell with a 2.5 kg step has a 10% cut of 2 kg, which is smaller than one step, so the calculator takes the step: 17.5 kg, which is 12.5% lighter, and the sets go from 3 to 2. Rounding a small cut to the nearest weight would put you back at 20 kg and change nothing. When no lighter load exists at all, such as an empty bar, the weight stays and the page says to cut sets and effort instead.

For when a deload is the right call, and how to tell, read [deload weeks: when you need one and how to run it](/blog/2026/11/deload-weeks-when-and-how). The tool page cites a 2023 consensus study of strength and physique coaches (Bell et al., Sports Medicine - Open), which defines a deload as a period of reduced training stress meant to limit fatigue and support recovery. That is a definition, not a prescription, and the numbers above do not come from it.

## How the two fit together

They are two ends of the same loop. Most weeks the first calculator says go up, or repeat. When lifts stall, it starts saying repeat and then go lighter, and the second one turns that into a week you can run: which weight, how many sets, how hard.

The app runs the same loop for you. It deloads one exercise on its own after two failed sessions in a row at the same load, and it suggests a lighter week from the Weekly Review when several lifts stall. It shows the reason beside each number it changes, as described in [my app now explains every number it changes](/blog/2026/10/my-app-now-explains-every-number-it-changes), and a lighter week only starts when you tap.

## What they cannot see

Each calculator reads one exercise and, in the first case, one session. The app also looks at your plan, your gym and the week you are in. Treat the answers as a good starting point and not a prescription. If a joint hurts sharply, no calculator is a reason to push on: see a doctor or physiotherapist.

## Summary

- The [progressive overload calculator](/tools/progressive-overload-calculator) turns last session into a target: go up, repeat or go lighter.
- The [deload calculator](/tools/deload-calculator) turns a working weight and set count into one lighter week.
- Both round to loads you can actually set, show the plates for a barbell, and work in kg or lb.
- The thresholds are Musclog's choices. The ACSM range is the main research reference for how much to add.

To get the same suggestions inside your workouts, with the reason shown beside each one, get [Musclog](/download).
