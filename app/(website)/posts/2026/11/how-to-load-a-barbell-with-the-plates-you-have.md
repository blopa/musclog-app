---
title: 'Your gym has the wrong plates: how to load the bar anyway'
date: '2026-10-06'
category: 'training'
description: 'Load a barbell to a target weight with the plates your gym actually owns. Why plates load in pairs, how bar weight counts, and what to do when the exact weight cannot be made.'
tags: ['Strength training', 'Barbell', 'Plate calculator', 'Gym equipment', 'Musclog']
---

To load a barbell with the plates you have, work out the weight per side (target minus bar, divided by two), then pick the plates that reach that number using no more pairs than your gym owns. Musclog's [plate calculator](/tools/plate-calculator) does that search for you, using the plates you enter, in kg or lb.

## Start with the bar

The bar is part of the total. A 70 kg target on a 20 kg bar means 50 kg of plates, so 25 kg a side. Forgetting the bar is the most common way to load the wrong weight.

The calculator's own copy says standard Olympic bars are 20 kg (45 lb), and some are lighter. Set your bar's weight first, then enter the target. You can type kilograms or pounds.

## Plates load in pairs

A barbell takes plates in pairs, one on each side, so every plate you own counts as pairs. A gym with two 20 kg plates has one pair of 20 kg. A gym with one 20 kg plate has no pair of 20 kg at all, and the calculator leaves it out.

Enter the number of plates you have of each size, and the calculator works out how many pairs that gives. Count the plates on the rack rather than relying on a number you remember, since the calculator can only use what you tell it.

## Why the heaviest plate first is not always right

The usual method takes the heaviest plate that fits, then the next, and so on. That works when there are plenty of every plate. With limited plates it can fail.

Take a gym with one pair each of 20, 15 and 10 kg plates, a 20 kg bar, and a 70 kg target. That needs 25 kg a side. Taking the 20 kg plate first leaves 5 kg per side, and nothing on that rack fills it. The answer is 15 kg and 10 kg on each side, which makes exactly 70 kg. The app's solver checks combinations of the plates you have and finds that answer; the full engineering story is in [the post on greedy plate maths](/blog/2026/10/greedy-plate-math-is-wrong-the-moment-your-gym-runs-out-of-plates).

Among loads that reach the target, the calculator uses the fewest plates, so you are not hunting through a pile to match a weight that could be loaded with fewer.

## A worked example, step by step

Say your gym has a 20 kg bar, one pair each of 20, 15 and 10 kg plates, and you want 70 kg.

1. Take the bar off the target: 70 − 20 = 50 kg of plates.
2. Split it between the two sides: 50 ÷ 2 = 25 kg per side.
3. Try the heaviest plate first: the 20 kg fits and leaves 5 kg per side. Nothing on the rack makes 5 kg, so that path fails.
4. Try the combination: 15 + 10 = 25 kg per side. Each size has one pair, so each is used once per side.
5. Check the total: 20 + 2 × 25 = 70 kg, exactly the target.

The result is 15 kg and 10 kg on each side. The calculator reports the same plates, with the bar line showing 20 kg.

## Imperial gyms

The same method works in pounds. Take a 45 lb bar and a 135 lb target. That leaves 90 lb of plates, or 45 lb per side. If the gym has a pair of 45 lb plates, the answer is one 45 lb plate on each side, and the total is 45 + 2 × 45 = 135 lb.

Choose the unit before you type the plates, so each plate is entered in the unit printed on it.

## When the exact weight cannot be made

Some targets cannot be reached. If your gym has only 20 kg and 2.5 kg pairs, a 62 kg total on a 20 kg bar needs 21 kg a side, and nothing on that rack makes 21 kg exactly.

In that case the calculator says so and gives two numbers: the heaviest weight it can load without going over your target, and the nearest loadable weight, which may be above or below. It breaks a tie in favour of the lower one. Choose whichever suits the lift, and remember the lower number is the one that does not go over your target.

## Kilograms and pounds

Type the target in the unit you think in. The calculator converts to kilograms for the solve and back for display, so 225 lb is worked out with the same plates as its kilogram equivalent. The plates you enter are shown in the unit you chose.

A pound plate and a kilogram plate are not interchangeable. A "45" is 45 lb, about 20.4 kg, which is not the same as a 20 kg plate. Check the marking on the plate before you enter it, and remember the bar is also in the total.

## What the calculator will not tell you

It only solves the plate arithmetic. It does not know whether the collars are on, whether the plates on the rack are damaged or whether your bar is lighter than you think. Check the bar before you load it and load both sides evenly. A barbell that is heavier on one side is a bad start to any set, however good the maths is.

Once you know the load, enter it in the [plate calculator](/tools/plate-calculator) for your next session. [Musclog](/download) keeps your gym's plates and bar weight so the loads it suggests are ones you can load.
