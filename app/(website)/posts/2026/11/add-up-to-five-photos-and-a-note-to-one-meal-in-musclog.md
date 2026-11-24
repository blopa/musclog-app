---
title: 'Add up to five photos and a note to one meal in Musclog'
date: '2026-11-24'
category: 'product-updates'
description: "Musclog's AI meal camera used to take one photo and estimate right away. Now, after you crop a photo, a details sheet lets you add up to five photos of the same meal and a few optional notes before anything is estimated. Here is how it works, what the AI is actually sent, and how to switch back to the quick way."
tags:
  [
    'Musclog',
    'AI',
    'Food Tracking',
    'Calorie Counting',
    'On-device AI',
    'Musclog Iron',
    'Open Source',
  ]
---

Until now, the AI meal camera in Musclog worked in one step: take a photo, get an estimate. If you wanted the AI to know something a photo cannot show, like "I ate half" or "this came from a restaurant", you had to type it **before** the shutter, with a small button next to it. Most people never tapped it, and I do not blame them. When you are hungry you take the photo and move on.

So the order changes. **Take the photo first, add context after.**

## The new flow

1. Take a photo (or pick one from your gallery) and crop it, like before.
2. A sheet opens with a sideways strip of the photos you have so far.
3. Tap **+** to go back to the camera and add another photo of the same meal. Each one is cropped and joins the strip. The limit is five.
4. Add anything you want to tell the AI. All of it is optional.
5. Tap **Estimate**.

![The meal details sheet in Musclog with three photos in a sideways strip, a filled-in meal name and empty note field](/images/blog/2026/11/meal-photos-sheet.webp 'Three photos of one meal. The dashed tile at the edge is the + to add another.')
![The same sheet scrolled down to the origin, added fat and tag chips, with a few chips selected](/images/blog/2026/11/meal-photos-sheet-fields.webp 'Everything below the photos is optional.')

What you can add:

- **A name** for the meal. If you type one, it replaces the name the AI would have picked.
- **A note** in your own words, like "ate half, no dressing".
- **Where it is from:** home cooked, restaurant, takeaway or packaged. Restaurant and takeaway portions tend to be bigger than home ones, and the AI is told so.
- **Whether oil, butter or sauces were added.** Cooking fat is the calorie a photo hides best.
- **Quick tags** such as high protein or eating out, the same ones the old context button had.

If you close the sheet with something filled in, Musclog asks before throwing it away. If the estimate fails or you cancel it while it runs, the sheet comes back exactly as you left it, with the reason on top, so nothing you typed is lost.

![Musclog asking whether to discard the meal, with Keep editing and Discard buttons](/images/blog/2026/11/meal-photos-discard.webp 'Closing with photos or notes asks first.')

## What the AI is actually sent

All the photos go in **one request**, together with your name, note and chips. The request also tells the model that the photos show one meal from different angles, and that a food visible in two of them is still one food. A photo can be a close-up, the other side of the plate, or the menu or a label, and the model is told it may use those as information.

It works the same way at every thinking level. In the higher levels, which make several requests (a first look, independent estimates, reviews), **every one of those requests carries all the photos**. The photos are resized once and reused, so a level that asks six times does not re-encode them six times.

![The five-photo state of the sheet, scrolled sideways, with the counter reading 5 of 5 photos and the + tile gone](/images/blog/2026/11/meal-photos-five.webp 'At five photos the + tile disappears.')

Two honest costs:

- **More photos are more image tokens on every request.** On Musclog Iron that is more of your monthly allowance, and with your own key it is more on your bill. I have not measured how much a second or third photo improves the estimate. They help most when one photo hides something, like the far side of a bowl.
- **How many photos fit is up to the provider.** Musclog asks, and shows only as many slots as the provider takes. On Musclog Iron the photos also share one request size limit, so with several photos each may be sent a bit smaller than a single photo would be.

### On your phone, one photo at a time

The AI model that runs on your phone can look at **one image per request**. So with several photos it looks at each one separately, writes down the foods it sees and a rough amount of each, and Musclog merges the lists in code. A food that shows up in more than one photo counts once, at the **largest** amount any photo suggested. I do not add them up, because photos of the same plate overlap: two photos of one chicken breast are not two chicken breasts. As with a single photo, you review every food and gram amount before anything is saved.

### Only the first photo is kept

The meal you log gets a picture, and that is the **first photo** in the strip. The others are used for the estimate and are not stored with the meal.

## Prefer the old way? It is a setting

The new flow is the default. If you would rather take a photo and get an estimate straight away, switch to **Quick** in **Settings → AI behavior → AI meal camera**. Quick keeps the old behavior, including the context button before the shutter.

![Musclog's AI behavior settings with the AI meal camera section and a Detailed or Quick switch](/images/blog/2026/11/meal-camera-setting.webp 'Detailed is the default. Quick is the old one-step camera.')

The same choice is a page of the What's new tour, so you can pick without hunting for the setting.

![The What's new page for the meal camera, with Detailed and Quick options](/images/blog/2026/11/meal-camera-whats-new.webp 'You can choose right in the tour.')

Musclog is open source. The AI meal camera needs an AI provider set up in Settings, and the on-device model needs the photo-understanding part of its download.
