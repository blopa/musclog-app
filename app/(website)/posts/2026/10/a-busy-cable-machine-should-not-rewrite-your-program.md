---
title: "A busy cable machine shouldn't rewrite your program"
date: '2026-10-19'
category: 'product-updates'
description: 'Swapping an exercise mid-workout sounds like one feature. In Musclog it turned into three: a swap that only touches today, restrictions that remember what hurts, and a single answer to "what is the app allowed to suggest?" that even an AI-generated plan has to obey.'
tags: ['Musclog', 'React Native', 'TypeScript', 'Fitness', 'UX', 'AI']
---

Someone is on the cable machine. Your shoulder is doing that thing again. The gym's only leg press is broken. Every workout app has a "swap exercise" button for these moments, and almost all of them have the same problem: they don't know _why_ you swapped, so they either forget immediately or remember forever.

Neither is right. "Someone's on the machine" should be forgotten the moment you finish. "This hurts" should be remembered, but probably not forever. "I just hate lunges" should mean "stop suggesting them", not "hide them so I can never find them".

Musclog 2.13 treats those as different things.

## Today versus the plan

The rule I started from: **a swap changes the session, never the plan.** Your program is something you (or a coach, or a template) designed. One busy afternoon shouldn't edit it.

So swapping rewrites the workout you're doing right now, not the template it came from. Next week, the original exercise is back.

![Replacing an exercise: other chest presses suggested first, with Replace and an optional Add reason](/images/blog/2026/10/swap-flow.webp)

The swap list puts the closest movements first: same body region, then same muscle, same type of movement, same equipment, with a small bonus for things you've done recently. And because the most common reason by far is "just today", **Replace** works in one tap. Saying why is optional, behind "Add reason".

## Half-done exercises

The hard case is swapping after you've already done some sets. You did two sets of bench, your shoulder complained, and you want to finish with dumbbell presses.

Those two bench sets happened. They're bench press history: volume, records, and next week's starting weight all depend on them. Rewriting them as dumbbell presses would corrupt all three.

So a swap after work has started splits the exercise in two. The performed sets stay where they are. The remaining planned sets move to a new block for the new exercise, right after the old one:

```typescript
const replacement = collection.prepareCreate((record) => {
  record.workoutLogId = original.workoutLogId;
  record.exerciseOrder = original.exerciseOrder + 1;
  record.groupId = original.groupId;
  // a split stays in the same superset slot, so rounds and rests don't reshuffle
  record.supersetSlotId = original.supersetSlotId ?? original.id;
  // repeated swaps still point at what the plan originally asked for
  record.replacedExerciseId = original.replacedExerciseId ?? original.exerciseId;
  // …
});
```

Three details were each a bug at some point:

- **The planned weight doesn't carry over.** An 80 kg bench press is not an 80 kg dumbbell fly. Sets that haven't been done yet are reset to the new exercise's own starting load.
- **A partial block must not look complete.** Two bench sets out of a planned four would otherwise read as "all prescribed sets done", and next week's progression would move you up for a session you didn't finish. The original block keeps its planned set count.
- **Supersets keep their order.** If the swapped exercise was part of a superset, the new block takes its slot, so the rounds and rest timing don't reshuffle around it.

## What should be remembered

When you do say why, some reasons imply something that should outlive the session:

| Reason                       | What the app offers to remember         |
| ---------------------------- | --------------------------------------- |
| Just today, machine occupied | Nothing. That's the point of these two. |
| Pain or discomfort           | Stop suggesting it, until it heals      |
| Don't like it                | Suggest it less                         |
| Equipment unavailable        | Remove that equipment from this gym     |

"Offers" is the key word. Picking "pain" turns the remember switch **on by default**, because the whole reason to say why is so the app stops offering it. But the switch is right there, visible, and you can turn it off. Nothing is applied silently.

![Why swap? with Pain or discomfort selected, then the switch to stop suggesting the exercise and how long for: 2 weeks, 1 month, 3 months, or until I say otherwise](/images/blog/2026/10/swap-remember-injury.webp)

An injury gets an end date: 2 weeks, a month, 3 months, or "until I say otherwise". When it passes, the exercise comes back, and the restrictions screen shows it as healed rather than deleting it. I didn't want shoulder pain from March to hide overhead presses in October because nobody remembered to turn it off.

## Constraints outrank preferences

Restrictions come in three strengths, and the order is fixed:

1. **Never** and **injury**: hard exclusions. They are never suggested, anywhere.
2. **Equipment the gym doesn't have**: also excluded. No point suggesting a cable fly in a garage.
3. **Dislike**: _not_ an exclusion. The exercise stays findable, marked as disliked and pushed down the list.

That last one matters more than it looks. If "don't like it" hid exercises, someone who disliked lunges in January could never find them again when their program called for them. A preference is something you weigh against other things; a constraint isn't.

All of it lives in one function, and its order is the policy:

```typescript
export function exerciseExclusionReason(exercise, ctx): ExclusionReason | null {
  const restriction = activeRestrictionFor(exercise.id, ctx.restrictions, ctx.now);
  if (restriction?.kind === 'never') return 'never';
  if (restriction?.kind === 'injury') return 'injury';
  if (!isEquipmentAvailable(exercise.equipmentType, ctx.gym)) return 'equipment';
  return null; // a dislike is deliberately not a reason to exclude
}
```

## One answer, even for the AI

There are three places that suggest exercises: the swap list, the AI that writes workout plans, and the AI's output once it comes back. Three places means three chances to disagree, so they all ask one service, `ExerciseSuggestionService`, what may be suggested right now. It reads your restrictions and your active gym's equipment together.

The AI gets that filtered list in its prompt. But a language model can ignore its instructions, so **the answer is checked again** when it comes back. If a generated plan contains something you've restricted, it's replaced with the best allowed exercise from the same body region that the plan doesn't already contain. If there's no such exercise, it's dropped.

```typescript
// The prompt only offered suggestible exercises, but a model can ignore its list.
const matchedExercise = isExerciseSuggestible(requestedExercise, suggestionContext)
  ? requestedExercise
  : rankSubstitutes(requestedExercise, suggestible, suggestionContext).find(
      (candidate) =>
        candidate.sameFamily &&
        !candidate.disliked &&
        !requestedInWorkout.has(candidate.exercise.id)
    )?.exercise;
```

The swap list does its filtering in the database query itself rather than after loading a page, so restricting a lot of exercises doesn't leave you scrolling through half-empty pages.

## The takeaway

The swap button looked like a UI feature. It was really a question about memory: for each thing the user tells you, how long should you remember it, and who gets to decide? The answers were "only today" for the common case, "until it heals" for pain, "forever, but softly" for dislikes, and "the user, visibly" for all of them.
