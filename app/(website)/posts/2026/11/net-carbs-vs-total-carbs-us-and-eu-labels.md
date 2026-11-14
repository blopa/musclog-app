---
title: 'Net carbs vs total carbs: why US and EU food labels disagree'
date: '2026-07-02'
category: 'nutrition'
description: 'US and EU labels count carbohydrate differently, so the same food can show two numbers. Here is how to convert between them, with a worked example and a note on what Musclog stores.'
tags: ['Net carbs', 'Total carbs', 'Nutrition labels', 'Fiber', 'Nutrition', 'Musclog']
---

Net carbs and total carbs differ by the fiber, and the two label systems disagree on which of those numbers is printed under "carbohydrate". A label from the US or Canada prints total carbohydrate, which already includes fiber. A label from the EU declares carbohydrate without fiber, with fiber on its own line. So a food with 30 g of carbs and 6 g of fiber can mean two different things depending on where the box was sold. To compare them, subtract the fiber from a US total, or add the fiber to an EU figure. The [net carbs calculator](/tools/net-carbs) does both conversions for you.

## Why the labels differ

In the EU, the declared carbohydrate is the carbohydrate your body can use, and fiber is declared separately. [EU Regulation 1169/2011](https://eur-lex.europa.eu/eli/reg/2011/1169/oj) sets the rules for that label. In the US and Canada, the total carbohydrate line includes dietary fiber. Neither system is wrong. They answer different questions, and the same product can carry two different carbohydrate numbers.

## The two conversions

Use one rule for each label:

| Label        | Printed carbs | Fiber | Total carbs (fiber included) | Net carbs (fiber excluded) |
| ------------ | ------------- | ----- | ---------------------------- | -------------------------- |
| US or Canada | 30 g          | 6 g   | 30 g                         | 30 − 6 = 24 g              |
| EU           | 30 g          | 6 g   | 30 + 6 = 36 g                | 30 g                       |

A US label gives total carbs directly, so you subtract fiber to get net. An EU label gives net carbs directly, so you add fiber to get total. The same 30 g number means 24 g of net carbs on one label and 30 g on the other, and the total is 30 g on one and 36 g on the other.

Worked example: a bag says "carbohydrate 30 g, of which fiber 6 g" on a US label. Total carbs are 30 g and net carbs are 24 g. Another bag with the same numbers printed on an EU label has total carbs of 36 g and net carbs of 30 g. Before you log either one in a tracker, check which system its label uses.

## Energy

Net carbs are the part your body digests, and the energy math follows that. Musclog's food-energy rule for the net convention is that calories equal 4 times the carbs plus 2 times the fiber. Its meal estimator is told the same thing: 1 g of carbs is about 4 kcal and 1 g of fiber is about 2 kcal. Fiber counts, but at a lower energy value than digestible carbs. The 2 kcal per gram for fiber is the value the app uses, not a number from a study.

## What Musclog stores

Musclog stores carbs as total carbohydrate including fiber, the way US labels count them. Each food source is converted to that convention when it is saved, so the diary means one thing:

- Foods from the USDA database already count fiber in their carbohydrate, so they are stored as they are.
- Open Food Facts stores one carbohydrate figure without saying which system it follows. For each product the app first uses the product's own total carbohydrate figure when there is one. Otherwise it checks the printed energy against both readings, and adds the fiber only when the energy says the figure is net, or when it cannot tell. The check is deliberately cautious, so a product stays EU-style unless the energy clearly points the other way.
- Foods from Musclog's own supermarket data, which follow the EU label, have the fiber added on when they are saved.
- Foods an AI estimates are read as net carbs and have the fiber added on, the same as EU foods.
- Foods you type in yourself follow a setting called **Carbs include fiber**, in the advanced nutrition settings. Turn it on if your labels are US-style, and off if they are EU-style.

When you compare food against your goals, the app shows digestible carbs, which is total minus fiber. Your carbohydrate goal is a net goal, and fiber is tracked as its own macro on top. That keeps a 30 g carb target from quietly counting fiber twice.

Sugar alcohols such as erythritol are not subtracted from net carbs in the calculator. Some people also remove them, so the net figure can read a little high for a product that contains them.

## Which number to enter

Carbohydrate is the one macro where two honest label systems meet, so the mistake is easy to make and hard to notice later. A diary that quietly mixes the two will count fiber for some foods and not for others. That is why the app states one convention, converts every source to it on save, and lets you choose how your own typed numbers are read.

Check which label you are reading, then pick the number your tracker expects:

- A tracker that counts total carbs: enter the total, which is 30 g on a US label and 36 g on the EU label in the example.
- A tracker that counts net carbs: enter the net figure, which is 24 g on the US label and 30 g on the EU label.

If you use Musclog with the setting matched to your labels, you can enter the carbohydrate number exactly as printed.

Check with a professional before you change your carbohydrate or fiber intake for a medical reason, including diabetes or a digestive condition.

Try the [net carbs calculator](/tools/net-carbs) on any label, and see the [Musclog app](/download) for logging food with total and net carbs side by side.
