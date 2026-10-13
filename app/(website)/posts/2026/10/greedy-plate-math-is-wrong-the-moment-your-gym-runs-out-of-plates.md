---
title: 'Greedy plate math is wrong the moment your gym runs out of plates'
date: '2026-10-15'
category: 'engineering'
description: 'Putting the heaviest plate that fits on the bar works until your gym only owns one pair of each. Musclog now models your gym and solves plate loading as a small bounded knapsack, so the weights it suggests are weights you can actually load.'
tags: ['Musclog', 'TypeScript', 'Algorithms', 'Fitness', 'Dynamic Programming']
---

Every fitness app has a plate calculator, and almost all of them do the same thing: take the target, put on the biggest plate that fits, repeat until nothing fits. It's the coin-change algorithm you learn in the first week of programming, and for a commercial gym with a bin of every plate it's fine.

It is wrong the moment the inventory is limited. I know because Musclog started suggesting weights, and a suggestion for a weight you can't physically load is worse than no suggestion.

## The smallest counterexample

Say your garage gym has a 20 kg bar and exactly one pair each of 20, 15 and 10 kg plates, and the target is 70 kg. That's 25 kg per side.

Greedy takes the 20, leaves 5, and has nothing small enough to finish. It reports "65 kg, 5 short". The right answer is 15 + 10 on each side, which makes exactly 70.

You can make this fail with a pair of plates and a pencil, and anyone with a limited rack hits it constantly. Those are exactly the people for whom plate maths is useful, since someone with a full commercial set doesn't need a calculator.

## The honest algorithm

Per side, each plate size can be used a limited number of times, and you want a total. That's a bounded knapsack: which combination of available plates reaches this weight, using as few as possible?

The sizes are tiny, so an exact solution is instant. I solve it in hundredths of a kilogram so that 1.25 kg plates (and the awkward 20.4117 kg you get from converting 45 lb) stay exact integers:

```typescript
/** Loads are solved in hundredths of a kilogram so 1.25 kg and 20.4117 kg plates stay exact. */
const UNITS_PER_KG = 100;

function reachableWithin(denominations: Denomination[], capUnits: number): ReachableTable {
  let previous = new Uint16Array(capUnits + 1).fill(NOT_REACHABLE);
  previous[0] = 0;

  for (const { units, pairs } of denominations) {
    const next = new Uint16Array(capUnits + 1).fill(NOT_REACHABLE);
    for (let u = 0; u <= capUnits; u++) {
      for (let k = 0; k <= pairs && k * units <= u; k++) {
        const before = previous[u - k * units];
        if (before !== NOT_REACHABLE && before + k < next[u]) {
          next[u] = before + k; // fewest plates that make u
        }
      }
    }
    previous = next;
  }
  return { fewestPlates: previous /* … */ };
}
```

`fewestPlates[u]` is the fewest plates per side that make exactly `u` units, or "not reachable". To load a target, walk down from the target until you find a reachable amount: that's the heaviest load that doesn't exceed it. The table also remembers how many of each plate it used, so the answer comes back as "15 ×1, 10 ×1" rather than just a weight.

![The plate calculator loading 62.5 kg: a 20 kg and a 1.25 kg plate on each side of a 20 kg bar, loaded exactly](/images/blog/2026/10/plate-calculator-sheet.webp)

Two details that matter:

- **Plates load in pairs.** A stored count of 3 is one pair, not 1.5. The solver works per side and counts pairs.
- **Capped pairs.** Past 12 pairs of one size the answer can't change, and the table only gets bigger, so counts are clamped. A "commercial" gym is simply 20 of everything.

## Reaching weights, not just loading them

The more interesting use isn't the calculator. It's rounding.

When progression says "62.4 kg", the app needs a real load. `nearestLoadableKg` finds the closest weight the gym's plates can make, above or below the target (the lower one on a tie). It only needs to look about one heavy plate past the target, so the table stays small.

Equipment decides how rounding works. A barbell snaps to what the plates can make. A dumbbell, a stack or a cable snaps to a multiple of the gym's own increment, because those move in rack steps, not plate steps. And with no gym at all, the app falls back to its long-standing defaults rather than inventing a coarse step for someone who never described their gym.

That fallback also had a bug worth mentioning. For a metric user with no gym, it used to round suggestions to a whole kilogram after adding 2.5, so progression went 60 → 63 → 66. No plates make 63. The fix was to land on 2.5 kg multiples, the loads a standard set can make (the full story is in [my post about explaining every number](/blog/2026/10/my-app-now-explains-every-number-it-changes)).

## What a "step" means on a barbell

How much should the app add when you progress? Not "2.5 kg" for everyone. On a barbell, a step is **one pair of your smallest plate**, because plates go on both sides:

```typescript
if (isBarLoadedEquipment(equipmentType)) {
  const pairable = gym.plates.filter(({ count }) => count >= 2);
  if (pairable.length > 0) {
    return 2 * Math.min(...pairable.map(({ weightKg }) => weightKg));
  }
}
return gym.weightIncrementKg;
```

A gym with 1.25 kg plates steps by 2.5. A gym whose smallest pair is 2.5 kg steps by 5, and the app doesn't suggest 102.5 for a lifter who can't make it. Anything not bar-loaded uses the gym's increment.

The same data drives other small things: the warm-up ramp snaps each set to something loadable and never goes below the empty bar, and a target that the active gym can't load gets a "needs attention" badge on its card instead of failing quietly.

## Two guard rails I added on purpose

**Inputs accept 1.25.** The usual numeric field in the app only takes whole numbers. That was fine for reps and wrong for plates, so plate and bar weights use a stepper input that handles decimals, and gym weights are stored with seven decimals so that quarter-pound inputs survive conversion to kilograms and back.

**A broken gym row degrades, it doesn't throw.** A gym is stored with its plates and equipment as raw JSON strings, parsed in exactly one place. A hand-edited or newer-version row falls back to defaults. Throwing in the middle of a set because of a bad plate list would be an awful way to find out.

## The lesson

Greedy is a good heuristic for a world where supply is unlimited, and I think many "obviously fine" algorithms hide that assumption. The check that finds it is cheap: ask what happens if you run out. For plates, the answer was a bug visible with 3 sizes and a pencil, and a dozen lines of dynamic programming fixed it.
