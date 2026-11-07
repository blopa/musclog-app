---
title: 'Bring your own AI: log food and build workouts with ChatGPT or Claude'
date: '2026-11-07'
category: 'product-updates'
description: 'Musclog can now track food and build a workout plan with ChatGPT or Claude: you copy a prompt, chat in your own assistant, and bring a small JSON file back. The interesting part is everything that happens after the file arrives: what gets validated, what gets left out, and why I only found a carbs bug by taking the screenshots for this post.'
tags: ['Musclog', 'React Native', 'Expo', 'AI', 'ChatGPT', 'Claude', 'TypeScript', 'Privacy']
---

Most of the time I log food the boring way. Search, pick, set a portion, save. It works, and it is also the reason people stop logging by Thursday.

Meanwhile, I already have an assistant open in another tab that I pay for and trust more than a form. I can send it a photo of my plate and say "that was lunch". It is good at that, and I am not going to build a worse version of it inside a food diary.

So Musclog now has two new buttons that do exactly one thing: let your own ChatGPT or Claude do the thinking, and let Musclog do the saving.

- **Food:** in the Add food sheet, **Track with ChatGPT or Claude**.
- **Workouts:** in the workouts menu, **Create workout template → Build with ChatGPT or Claude**.

![The Add food sheet with the new Track with ChatGPT or Claude row between AI camera and Quick track meal](/images/blog/2026/11/external-food-add-food.webp)

Neither needs an API key, a Musclog account or an AI provider set up in the app. If you want to know why that is the right shape for it, the longer version is in [my post about letting an AI set up Musclog](/blog/2026/10/i-let-an-ai-set-up-musclog-but-it-never-touches-your-data). This is the same trick used twice more, and it turns out the trick is the easy half.

## The trick, in one picture

You tap the button. Musclog copies a block of instructions to your clipboard and opens ChatGPT or Claude. You paste them, answer a few questions (or send a photo), and at the end the assistant gives you a JSON file or a JSON block. You come back, import or paste it, and Musclog takes it from there.

![The first step: open ChatGPT or Claude with the instructions already copied, then import the file or paste its JSON when you come back](/images/blog/2026/11/external-food-instructions.webp)

```mermaid
flowchart TD
    Y[You tell the assistant what you ate, or what program you want] --> F[It writes a JSON file]
    F --> P{Musclog parses and validates it}
    P -- Parts it cannot use --> W[Left out, and listed on the review screen]
    P -- Parts it can --> R[Review screen]
    W --> R
    R -- You tap Log or Create plan --> S[Musclog's own services write the data]
```

The assistant never talks to Musclog. There is no API in the middle, no key and no account. The only thing that crosses over is a small text file that you carry yourself, which Musclog treats as untrusted input.

## What a food file looks like

This is a complete one. It is what you would get after telling an assistant "chicken, rice, some broccoli and a bit of olive oil, about 150 grams of chicken":

```json
{
  "schema": "musclog-food-log",
  "version": 1,
  "mealType": "lunch",
  "mealName": "Chicken, rice and broccoli",
  "foods": [
    {
      "name": "Grilled chicken breast",
      "grams": 150,
      "calories": 235,
      "protein": 46.5,
      "carbs": 0,
      "fat": 5.4,
      "fiber": 0
    },
    {
      "name": "Cooked white rice",
      "grams": 180,
      "calories": 224,
      "protein": 4.9,
      "carbs": 49.6,
      "fat": 0.5,
      "fiber": 0.7
    },
    {
      "name": "Steamed broccoli",
      "grams": 90,
      "calories": 32,
      "protein": 2.5,
      "carbs": 3.6,
      "fat": 0.3,
      "fiber": 2.3
    },
    {
      "name": "Olive oil",
      "grams": 10,
      "calories": 90,
      "protein": 0,
      "carbs": 0,
      "fat": 10,
      "fiber": 0
    }
  ]
}
```

Three decisions are baked into that shape.

**Each food carries the numbers for the amount you ate, not per 100 g.** That is how the in-app AI meal tracker already works, so one code path logs both.

**There is no date and no time in it.** The assistant does not know what day it is where you are, or that you ate at 13:30. You choose the day, time and meal on the review screen. The one hint the file may carry is `mealType`, and only if you said which meal it was.

**One or many foods, and an optional `mealName`.** You asked for single foods or several, optionally grouped. The assistant sets `mealName` only when the foods were one dish (a bowl, a sandwich), and leaves it out for an apple and a coffee. Whatever it did, you can flip it on the review.

## The prompt has to teach one convention, or your carbs are wrong

This is the part of the project I was most afraid of getting subtly wrong.

Musclog stores carbohydrates the way a US label does: **total carbs, fiber included**. Every AI estimate in the app, though, is **net carbs**: the digestible part, with fiber as its own field. The service converts on the way in. An assistant that writes total carbs into a field Musclog reads as net would make the fiber count twice.

So the instructions say it, in words a model cannot miss:

```text
- "carbs" is NET carbohydrate: total carbohydrate MINUS fiber. "fiber" is its own field.
  For example 25 g of total carbohydrate that includes 4 g of fiber is "carbs": 21 and "fiber": 4.
- Keep calories consistent with the macros: about 4 kcal per gram of protein, 4 per gram of
  net carbs, 9 per gram of fat and 2 per gram of fiber.
```

On the way in, the existing service does the conversion, and I wrote a test against the real thing on an in-memory database rather than trusting my reading of it. 200 g of rice written as 56 g net carbs and 4 g fiber ends up stored as 30 g of total carbs per 100 g.

## The bug I only found by taking screenshots

Here is the embarrassing part. I wrote all of that, the tests passed, and then I took the screenshots for this post.

![The review screen: the meal's name, 581 kcal, protein, carbs and fat tiles, and the four foods with a remove button each](/images/blog/2026/11/external-food-review.webp)

The first version of that screen (the screenshot above is the fixed one) said **53.2 g** of carbs. After logging, the diary said **56.2 g** for the very same meal.

Nothing was broken in the data. The review was showing the assistant's net carbs, and the diary was showing the stored total, with the 3.0 g of fiber added. Both numbers were correct and the screen was still lying, because the person checking a meal is promised that the figures they check are the figures they get.

The fix is one small function. An assistant's own numbers become the stored total exactly as the service will store them, and a food matched to one of Musclog's own foods keeps its carbs untouched, because those already include the fiber:

```ts
export function storedCarbs(ingredient: FoodLogIngredient): number {
  return ingredient.foodId
    ? ingredient.carbs
    : totalCarbsForFoodSource('ai', { carbs: ingredient.carbs, fiber: ingredient.fiber });
}
```

And the test that should have existed in the first place logs a file through the real service, reads every log back, and checks that what the review showed equals what the diary reads:

```ts
const reviewed = sumIngredients(read.ingredients);
await logExternalFoods({ ingredients: read.ingredients, date: day, time: lunchtime, ... });

const stored = await Promise.all((await storedLogs()).map((log) => log.getNutrients()));
expect(sum((n) => n.calories)).toBeCloseTo(reviewed.kcal, 1);
expect(sum((n) => n.carbs)).toBeCloseTo(reviewed.carbs, 1);
```

I then deliberately broke the function to show the old number and watched that test fail, which is the only way I trust a test.

## Nothing is saved until you have looked at it

The review is where you stay in control. Each food has a remove button, the day, time and meal are yours to change, and for two or more foods there is a **Log as one meal** switch with an editable name.

![The bottom of the review: the Log as one meal switch on, a meal name field, a date and a time, and the meal type tabs with Lunch selected](/images/blog/2026/11/external-food-review-bottom.webp)

Grouping is just a shared group id. The same code path logs a grouped meal and loose entries, in one database write:

```ts
const resolvedGrouping = resolveGrouping(ingredients, grouping);

return NutritionService.logCustomMealsBatch(toBatchIngredients(ingredients), date, mealType, {
  consumedTime: time,
  ...(resolvedGrouping.grouped
    ? { groupId: randomUUID(), loggedMealName: resolvedGrouping.loggedMealName }
    : {}),
});
```

Two small rules are in `resolveGrouping`. A single food is never a group, whatever the switch says. And a grouped meal always has a name: if you clear the field, it falls back to its foods ("Chicken, Rice") trimmed to the length limit, so the diary never shows an anonymous card.

![The diary after logging: one Meal card named Chicken, rice and broccoli with 581 kcal, listed under Lunch](/images/blog/2026/11/external-food-diary.webp)

## When the assistant gets it wrong

Assistants will sometimes hand you something that is not quite right, and the cheapest way to build trust is to say so out loud on the review.

![A review with two foods and two warnings: one food could not be matched and has no numbers of its own, one food in the file could not be read](/images/blog/2026/11/external-food-unmatched.webp)

That file had four foods. One had `"grams": "lots"`, which is not a number, so it is counted and left out. Another named a Musclog food id that does not exist and gave no numbers of its own.

That second one deserves a paragraph, because it is a trap. The prompt can include the foods Musclog already knows, with their ids, so an assistant can say "this is Musclog's food number X" and let the app use its exact macros. The existing lookup that does this quietly drops an id it cannot find and leaves the numbers it was given. For a food that arrived with no numbers, that means zeros, which means logging a **0 kcal banana** and telling you it went fine.

So the importer remembers who brought their own numbers, and drops the rest before you ever see the review:

```ts
for (const ingredient of ingredients) {
  if (ingredient.foodId || ingredient.hasOwnMacros) {
    usable.push(ingredient);
  } else {
    unresolved.push(ingredient);
  }
}
```

Two more details on that list of foods. It is only added to the prompt if **Send Foundation Foods to AI** is on in your AI settings (it is on by default, and the same switch the in-app AI respects). And it is just ids and names, about 200 of them, which takes the prompt from roughly 4.5 KB to roughly 21 KB. The macros never travel: they come from your own database.

## Workouts: same pipeline, different contract

The workout side is the same trick with a different file, `musclog-workout-plan`.

![The create workout options screen with Start free training, Generate with AI, Build with ChatGPT or Claude, Create from empty template and Browse templates](/images/blog/2026/11/external-workout-options.webp)

The file names exercises by their catalogue slug, so the prompt lists **all 873 of them**, which makes it roughly 25 KB. That is far too long for a prefilled link, so for this one copy-and-paste is genuinely the only path (I explained the link story in the setup post).

An assistant that has been told "give the reps as a range" will happily write `"8-12"` as text. The reader accepts that and turns it into a top of 12 and a bottom of 8, the way bundled programs store a range:

```ts
const range = /^\s*(\d+)\s*[-–—]\s*(\d+)\s*$/.exec(value);
if (range) {
  const low = Number(range[1]);
  const high = Number(range[2]);
  return low < high ? { reps: high, minReps: low } : { reps: low };
}
```

It is lenient about that kind of slip and strict about identity. The matcher tries the exact slug first, then a name in any language the app ships in, and only accepts a match when **exactly one** exercise fits. It never picks the closest-looking one for you.

![The plan review: Push, Pull and Legs workouts with sets and rep ranges, set to repeat on Monday, Wednesday and Friday](/images/blog/2026/11/external-workout-review.webp)

I put a made-up exercise in that file on purpose:

![The bottom of the review: a warning that one exercise is not in Musclog and will be left out, then Create plan](/images/blog/2026/11/external-workout-review-bottom.webp)

A plan with 16 exercises that quietly became a plan with 15 would be worse than a plan that says so. The unknown one is named and left out, and you decide whether to create the rest.

Three more choices, all aimed at one thing: nothing about this path is special once the file is accepted.

- **The file has no loads.** The assistant does not know what you lift. Musclog suggests starting weights from your own profile when the plan is created.
- **Weekdays make a weekly plan, no weekdays make a rotating one.** The reviewed plan is converted into the same shape the bundled programs use, and created by the same function, so slug lookup, starting loads, supersets and plan membership all behave identically.
- **Nothing is created until you tap Create plan.**

![The Workouts screen after creating the plan: a Push / Pull / Legs card, Weekly and Intermediate, with Push on Monday and Pull on Wednesday](/images/blog/2026/11/external-workout-created.webp)

## What I tested, and what I know I have not

There are 56 new tests: the pure contract and parsing code, the grouping rules, the service with its dependencies mocked, and the integration test above against the real nutrition service. I broke the carbs conversion, the review totals and the grouping on purpose, and each time the suite noticed.

What I can not test is the other side of the file. How a given model behaves on its worst day is out of my hands, which is exactly why the design never needs it to be right, only reviewable. If an assistant writes something Musclog rejects, the review tells you what it left out, and I would love to see that file.

There is also one gap I want to be upfront about. The in-app AI plan generator checks the exercises you have marked as "never" or injured, and swaps or drops them. **The ChatGPT and Claude path does not**, because the plan comes from outside and I have not wired that check in yet. The instructions do ask the assistant about injuries and limitations, but Musclog does not re-check the answer. If you have restrictions, look over the review.

## What stays private

- Only the instructions are copied. Nothing about you and no API key is in them.
- Musclog never sees a photo. The photo goes from you to your assistant.
- The file is capped at 64 KB, identified by its `schema` field, version-checked and read food by food and exercise by exercise.
- Whatever Musclog could not use is listed, never silently dropped.

Both buttons are in this release. If you try one, I want to hear how your assistant did.
