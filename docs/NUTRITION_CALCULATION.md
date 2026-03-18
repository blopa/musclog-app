# Nutrition Calculation: How It Works

This document describes how the app computes your daily calorie target, macros, and weight projection. It also explains why we use each formula and how we handle uncertainty (e.g. from body fat measurement).

---

## Overview of the Pipeline

The calculation runs in this order:

1. **BMR** (Basal Metabolic Rate) – energy your body uses at rest.
2. **TDEE** (Total Daily Energy Expenditure) – BMR × activity multiplier.
3. **Target calories** – TDEE adjusted for your weight goal (lose / maintain / gain).
4. **Macros** – protein, carbs, and fats from target calories and your fitness goal split.
5. **Weight projection** – estimated weight change over 90 days from the calorie delta.

Optionally, when you provide **body fat %**, we use a different BMR formula (Katch-McArdle) and add a **calorie range** to reflect measurement error.

---

## Step 1: BMR (Basal Metabolic Rate)

We use one of two equations depending on whether body fat is available.

### When body fat is **not** provided: Mifflin-St Jeor

We use the **Mifflin-St Jeor equation** (1990), which predicts resting energy expenditure from weight, height, age, and sex. It is widely recommended for modern, healthy adults.

- **Male:**  
  `BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5`
- **Female:**  
  `BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161`
- **Other:**  
  We use the average of the male and female formulas (equivalent to `− 78` instead of `+ 5` or `− 161`).

**Source:**  
Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. _A new predictive equation for resting energy expenditure in healthy individuals._ American Journal of Clinical Nutrition. 1990;51(2):241-247.

- PubMed: <https://pubmed.ncbi.nlm.nih.gov/2305711/>

---

### When body fat **is** provided: Katch-McArdle

If you enter a body fat percentage in the valid range (5–60%), we switch to the **Katch-McArdle** formula. It uses **lean body mass (LBM)** instead of total weight, which is better when you have a body composition estimate (e.g. from a scale or calipers).

- **Lean body mass:**  
  `LBM (kg) = weight (kg) × (1 − bodyFat% / 100)`
- **BMR:**  
  `BMR = 370 + 21.6 × LBM (kg)`

This form is often recommended when body fat is available, especially for more muscular or leaner users, because metabolic rate is more closely tied to lean mass than to total weight.

**Sources / further reading:**

- Med LibreTexts – RMR from lean body mass (Katch-McArdle):  
  <https://med.libretexts.org/Courses/Irvine_Valley_College/Physiology_Labs_at_Home/04%3A_Metabolism_and_Calorie_Burn/4.02%3A_Part_B._Calculating_RMR_based_off_of_Lean_Body_Mass_(LBM)>
- Nutrium – Katch-McArdle for nutrition professionals:  
  <https://nutrium.com/blog/katch-mcardle-equation-for-nutrition-professionals/>

---

## Step 2: TDEE (Total Daily Energy Expenditure)

TDEE is BMR multiplied by an **activity factor** (same idea as in Harris–Benedict–style equations):

| Level | Multiplier | Description              |
| ----- | ---------- | ------------------------ |
| 1     | 1.2        | Sedentary                |
| 2     | 1.375      | Light (1–3 days/week)    |
| 3     | 1.55       | Moderate (3–5 days/week) |
| 4     | 1.725      | Active (6–7 days/week)   |
| 5     | 1.9        | Very active              |

`TDEE = BMR × activity multiplier`

These multipliers are standard in practice for converting resting expenditure to total daily expenditure.

---

## Step 3: Target calories

Target calories are TDEE adjusted for your **weight goal**:

- **Lose:** TDEE − 500 kcal/day (moderate deficit)
- **Maintain:** TDEE (no change)
- **Gain:** TDEE + 250 kcal/day (moderate surplus)

We never go below a **safety floor** of 1,200 kcal/day.

---

## Step 4: Macros (protein, carbs, fats)

We split **target calories** into protein, carbs, and fats using **percentage splits** that depend on your **fitness goal**. This approach is grounded in evidence-based sports nutrition literature, while acknowledging that absolute gram-per-kilogram targets (g/kg body weight or g/kg fat-free mass) are more precise for individual optimization.

### Scientific Basis for Macro Splits

Our percentage splits derive from the following authoritative sources:

#### 1. Institute of Medicine (IOM) Acceptable Macronutrient Distribution Ranges (AMDR)

The IOM Dietary Reference Intakes (2005) establish broad acceptable ranges for active individuals:

| Macronutrient | AMDR                   |
| ------------- | ---------------------- |
| Carbohydrates | 45–65% of total energy |
| Protein       | 10–35% of total energy |
| Fat           | 20–35% of total energy |

**Source:** Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. National Academies Press, 2005.  
https://doi.org/10.17226/10490

#### 2. International Society of Sports Nutrition (ISSN) Position Stand: Protein and Exercise (2017)

- General exercising individuals: **1.4–2.0 g protein/kg/day**
- During caloric restriction (cutting): **2.3–3.1 g protein/kg FFM** maximizes muscle retention
- Very high protein intakes (>3 g/kg) show emerging evidence for amplified thermic, satiating, and fat-mass loss effects in resistance-trained subjects

**Source:** Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.  
https://pubmed.ncbi.nlm.nih.gov/28642676/

#### 3. ACSM/ADA/DC Joint Position Stand: Nutrition and Athletic Performance (2016)

- **Endurance athletes:** 6–10 g carbohydrate/kg/day during training (higher volume = higher end)
- **Resistance athletes:** Lower carbohydrate requirements; protein emphasis for recovery
- **General population:** Within AMDR with attention to timing and distribution

**Source:** Thomas DT, Erdman KA, Burke LM. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and Athletic Performance. J Acad Nutr Diet. 2016;116(3):501-528.  
https://pubmed.ncbi.nlm.nih.gov/26920240/

#### 4. Helms et al. Evidence-Based Recommendations for Natural Bodybuilding (2014)

For athletes undergoing caloric restriction:

- **Protein:** 2.3–3.1 g/kg FFM to maximize muscle retention
- **Fat:** 15–30% of calories to maintain endocrine function
- **Carbohydrates:** Remainder of calories after protein/fat requirements met

**Source:** Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Sports Sci. 2014;32(18):1701-1711.  
https://pubmed.ncbi.nlm.nih.gov/25000063/

---

### Goal-Specific Macro Splits

| Fitness Goal    | Carbs | Protein | Fat | Rationale                                                                                                           |
| --------------- | ----- | ------- | --- | ------------------------------------------------------------------------------------------------------------------- |
| **Weight loss** | 40%   | 30%     | 30% | Higher protein aligns with Helms/Issn for muscle preservation in deficit; moderate fat supports hormones            |
| **Endurance**   | 55%   | 20%     | 25% | Carbs approach ACSM lower bound for glycogen-demanding training; lower protein sufficient for non-hypertrophy goals |
| **Hypertrophy** | 45%   | 30%     | 25% | Balanced approach; protein at 30% provides ~1.6–2.2 g/kg for average body weights; supports MPS                     |
| **Strength**    | 50%   | 30%     | 20% | Emphasizes carbs for glycolytic demands of heavy lifting; fat at IOM minimum threshold                              |
| **General**     | 45%   | 25%     | 30% | Centered within IOM AMDR; protein provides ~1.2–1.6 g/kg for general fitness                                        |

**Conversion:** Protein and carbohydrates = 4 kcal/g; Fat = 9 kcal/g

---

### Important Caveats

1. **Percentage vs. Gram-per-Kilogram:** All major sports nutrition bodies (ISSN, ACSM) provide **g/kg recommendations** rather than percentages because protein needs scale with body mass, not calorie intake. Our percentage approach is a practical compromise for broad applicability but may require adjustment for:
   - Very light or very heavy individuals relative to their calorie target
   - Athletes with significantly above or below-average body fat
   - Those requiring precise competition preparation

2. **Protein Distribution:** The ISSN recommends **0.25 g/kg per meal** (or 20–40 g absolute) distributed every 3–4 hours for optimal muscle protein synthesis—regardless of total percentage.

3. **Individual Variation:** Research (ISSN 2017) confirms a wide range of dietary approaches can be effective. Adherence and total daily protein are primary drivers; specific ratios are secondary.

---

## Step 5: Weight projection (90 days)

We estimate how your weight might change over **90 days** from the difference between target calories and TDEE.

We use an **energy equivalent of body weight change** of **7,700 kcal per kg**. That value is a practical average for “mixed” weight change (both fat and lean tissue), not pure fat (which would be ~9,400 kcal/kg) or pure lean (~1,800 kcal/kg). Hall’s analysis notes that this rule can slightly overestimate the deficit required per kg lost in leaner individuals (lower initial body fat) and underestimate it in those with higher body fat; we keep a single constant for simplicity.

- **Daily calorie delta** = target calories − TDEE
- **Weekly weight change (kg)** = (daily delta × 7) / 7,700
- **90-day projected weight** = current weight + (weekly change × 90/7)

**Source:**

- Hall KD. _What is the required energy deficit per unit weight loss?_ International Journal of Obesity. 2008;32(3):573-576.
  - PubMed: <https://pubmed.ncbi.nlm.nih.gov/17848938/>
  - PMC: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2376744/>

---

## Body fat and the “calorie range”

Body fat from scales (BIA), calipers, or other methods is **not perfectly accurate**. Studies report errors on the order of **±3–5%** (or more) body fat depending on method and population. So we treat your number as a **point estimate** and add an **uncertainty band**.

- We use a **±4%** band (e.g. if you enter 27%, we consider 23% and 31% as well).
- For each of those three values (low, your value, high) we compute LBM → BMR → TDEE → target calories.
- The **main** plan (target calories, macros, projection) uses **your** value (mid).
- We also store **min** and **max** target calories from the low and high body fat values.

On the results screen, when body fat was used we show this range (e.g. “2,100 – 2,300 kcal”) and a short note that the range reflects body fat measurement variation.

**Sources on body fat measurement error:**

- Validity of BIA and skinfolds for body composition (ACSM):  
  <https://journals.lww.com/acsm-msse/fulltext/2024/10001/validity_of_bia_and_skinfolds_for_the_measurement.1813.aspx>
- Comparison of percent body fat by different methods (ACSM):  
  <https://journals.lww.com/acsm-msse/fulltext/2023/09001/comparison_of_percent_body_fat_measurement_by.884.aspx>
- A comparison of six estimates of body fat percent in adults:  
  <https://journals.lww.com/acsm-msse/fulltext/2015/05001/a_comparison_of_six_estimates_of_body_fat_percent.137.aspx>
- Accuracy of consumer BIA vs. air displacement plethysmography:  
  <https://digitalcommons.wku.edu/ijes/vol4/iss3/2/>

---

## Where it lives in the code

- **Calculator logic:** `utils/nutritionCalculator.ts`
  - BMR (Mifflin-St Jeor and Katch-McArdle), TDEE, target calories, macros, projection, body fat band and min/max targets.
- **Inputs:**
  - Onboarding: `app/onboarding/fitness-info.tsx` (saves body fat to `user_metrics`).
  - “Calculate for me”: `app/onboarding/set-goals.tsx` (loads weight, height, body fat and calls the calculator).
- **Results:**
  - `app/onboarding/nutrition-goals-results.tsx` shows the single target and, when present, the min–max range and body fat note.

---

## References (all links used in this document)

| Topic                                     | Citation / link                                                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BMR & Energy Expenditure**              |                                                                                                                                                                                                                       |
| Mifflin-St Jeor (1990)                    | Mifflin et al., Am J Clin Nutr. 1990;51(2):241-247. <https://pubmed.ncbi.nlm.nih.gov/2305711/>                                                                                                                        |
| Katch-McArdle (LBM-based BMR)             | Med LibreTexts – RMR from LBM: <https://med.libretexts.org/Courses/Irvine_Valley_College/Physiology_Labs_at_Home/04%3A_Metabolism_and_Calorie_Burn/4.02%3A_Part_B._Calculating_RMR_based_off_of_Lean_Body_Mass_(LBM)> |
| Katch-McArdle (nutrition use)             | Nutrium blog: <https://nutrium.com/blog/katch-mcardle-equation-for-nutrition-professionals/>                                                                                                                          |
| 7,700 kcal per kg weight change           | Hall KD. Int J Obes. 2008;32(3):573-576. <https://pubmed.ncbi.nlm.nih.gov/17848938/> ; PMC: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2376744/>                                                                   |
| **Macronutrient Guidelines**              |                                                                                                                                                                                                                       |
| IOM AMDR (DRI 2005)                       | Institute of Medicine. Dietary Reference Intakes. National Academies Press, 2005. <https://doi.org/10.17226/10490>                                                                                                    |
| ISSN Protein Position Stand (2017)        | Jäger R et al., J Int Soc Sports Nutr. 2017;14:20. <https://pubmed.ncbi.nlm.nih.gov/28642676/>                                                                                                                        |
| ACSM/ADA/DC Joint Position Stand (2016)   | Thomas DT et al., J Acad Nutr Diet. 2016;116(3):501-528. <https://pubmed.ncbi.nlm.nih.gov/26920240/>                                                                                                                  |
| Helms Bodybuilding Recommendations (2014) | Helms ER et al., J Sports Sci. 2014;32(18):1701-1711. <https://pubmed.ncbi.nlm.nih.gov/25000063/>                                                                                                                     |
| **Body Fat Measurement**                  |                                                                                                                                                                                                                       |
| Body fat validity (BIA/skinfolds)         | ACSM-MSSE: <https://journals.lww.com/acsm-msse/fulltext/2024/10001/validity_of_bia_and_skinfolds_for_the_measurement.1813.aspx>                                                                                       |
| Body fat comparison (methods)             | ACSM-MSSE: <https://journals.lww.com/acsm-msse/fulltext/2023/09001/comparison_of_percent_body_fat_measurement_by.884.aspx>                                                                                            |
| Six body fat estimates comparison         | ACSM-MSSE: <https://journals.lww.com/acsm-msse/fulltext/2015/05001/a_comparison_of_six_estimates_of_body_fat_percent.137.aspx>                                                                                        |
| Consumer BIA vs. ADP accuracy             | WKU Digital Commons: <https://digitalcommons.wku.edu/ijes/vol4/iss3/2/>                                                                                                                                               |

These are the same links used to justify the formulas, macro splits, and the ±4% body fat uncertainty in this doc; no other or “hallucinated” references are included.
