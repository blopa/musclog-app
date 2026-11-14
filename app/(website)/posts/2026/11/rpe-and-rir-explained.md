---
title: 'RPE and RIR explained, with a chart you can use tomorrow'
date: '2026-11-14'
category: 'training'
description: 'What RPE and reps in reserve mean, how the two convert, how to rate a set, and a chart of effort against your one-rep max with a worked example.'
tags: ['RPE', 'Reps in reserve', 'Strength training', 'Training chart', 'Musclog']
---

RPE is a 1 to 10 score for how hard a set was, and reps in reserve (RIR) is how many more good reps you could have done when you stopped. In Musclog they are the same scale written two ways: RPE = 10 minus RIR. The [RPE and RIR chart](/tools/rpe-chart) on Musclog's site shows what each rating means in reps and in a share of your one-rep max. This post explains the scale, how to rate a set, and how the chart is worked out.

## The scale

| RPE | Reps in reserve | What it means                           |
| --- | --------------- | --------------------------------------- |
| 10  | 0               | No reps left. The set ended at failure. |
| 9   | 1               | One rep left in the tank.               |
| 8   | 2               | Two reps left.                          |
| 7   | 3               | Three reps left.                        |
| 6   | 4               | Four reps left.                         |
| 5   | 5               | Five reps left.                         |

The idea of rating resistance training by repetitions in reserve comes from [Zourdos and colleagues (2016)](https://doi.org/10.1519/JSC.0000000000001049), who proposed an RPE scale built around that measure. Musclog uses the same conversion. The table is a definition of the scale, not a claim about any particular lifter.

In the app, the rating is stored as reps in reserve. A set with no rating stays unrated. It is never treated as zero reps in reserve, because zero means you failed, and a missing rating should not look like a failed set.

## How to rate a set

Finish the set, then ask one question: how many more good reps could I have done with the same form?

- Answer with a number: 0, 1, 2, or 3 or more. You do not need to be exact.
- Count only reps with the form you started with. A rep you could only grind out with a bad back is not a rep you had in reserve.
- Rate the set you just did, not the set you expected to do. Your guess gets better with practice, so keep rating for a few weeks before you trust it.

Judging how many reps you had left is a skill, and it is less accurate the further a set was from failure. Use the chart as a guide and check it against how your sets go.

## The chart

Each cell is the share of your one-rep max that many reps at that RPE represent. Read across for the reps you did and down for the effort you rated the set.

| Reps | RPE 10 | RPE 9 | RPE 8 | RPE 7 | RPE 6 |
| ---- | ------ | ----- | ----- | ----- | ----- |
| 1    | 98%    | 95%   | 92%   | 90%   | 88%   |
| 3    | 92%    | 90%   | 88%   | 86%   | 84%   |
| 5    | 88%    | 86%   | 84%   | 82%   | 80%   |
| 8    | 82%    | 80%   | 78%   | 76%   | 74%   |
| 10   | 78%    | 76%   | 74%   | 73%   | 71%   |

A single rep at RPE 10 reads 98%, not 100%, because the chart uses an average of seven published one-rep max formulas, and that average is an estimate. Every number in the chart is an estimate of the same kind.

## A worked example

Take 100 kg for 5 reps at RPE 8. That is 2 reps in reserve.

The app's averaged formula adds the reps in reserve to the reps you did. So the 5 reps are treated as 5 + 2 = 7 reps, and each formula is run on 100 kg for 7 reps. The seven results are:

| Formula  | Estimated one-rep max |
| -------- | --------------------- |
| Epley    | 123.33 kg             |
| Brzycki  | 120.02 kg             |
| Lander   | 121.06 kg             |
| Lombardi | 121.48 kg             |
| Mayhew   | 123.90 kg             |
| O'Connor | 117.50 kg             |
| Wathen   | 109.90 kg             |

The average of the seven is 119.60 kg. Note the spread: the formulas run from about 110 kg to about 124 kg for the same set. That spread is why the average is shown, and why the number is an estimate.

The calculator on the [RPE and RIR chart page](/tools/rpe-chart) uses the same estimate to work out a load for another set. Asking for 8 reps at RPE 8 gives 93.25 kg before rounding to plates. That is the same average, run for 8 reps with 2 in reserve.

These are estimates. A formula cannot know your technique, how rested you were, or how the set felt on the day. Use them to pick a starting load for a new set, then adjust by feel and log what happened.

## What to do with it

- **Rate the last set of each exercise.** One rating per exercise is enough to start.
- **Use the chart to pick a load, not to predict a max.** If your top set was 100 kg for 5 at RPE 8, a set of 8 reps at RPE 8 is in the region of 93 kg.

If you have an injury or a condition that makes heavy sets unsafe, check with a doctor or physiotherapist before you test your limits.

## Try it in Musclog

Musclog stores your rating for every set, and uses it when it suggests the next session's target. The same conversion is what the app uses on your logged sets. [Musclog](/download) is the app behind this chart.
