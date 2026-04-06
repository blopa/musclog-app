# TDEE Drift and Metabolic Adaptation in Weight Management

This document summarizes the scientific research and mathematical modeling used to correct for "TDEE drift" when calculating Total Daily Energy Expenditure (TDEE) over extended tracking periods.

## The Problem: Average vs. Terminal TDEE

When TDEE is calculated empirically using weight and calorie tracking data over a period (e.g., 60 days), the result is an **average** TDEE for that period. However, as an individual's body mass and composition change, their metabolic requirements also change.

If a user loses 10 kg, their TDEE at the end of the period will be lower than their TDEE at the beginning. Relying on the 60-day average for future planning can lead to overestimating their current maintenance calories, potentially causing them to stall or even gain weight.

## Key Research Findings

### 1. Tissue-Specific Metabolic Rates
Resting Metabolic Rate (RMR) is not uniform across all body tissues. According to research by Elia (1992) and subsequent validations:
- **Skeletal Muscle:** ~13 kcal/kg/day
- **Adipose Tissue (Fat):** ~4.5 kcal/kg/day
- **Organs (Liver, Heart, Kidneys, Brain):** 200–440 kcal/kg/day

*Source: Elia M. Organ and tissue contribution to metabolic rate. In: Kinney JM, Tucker HN, eds. Energy Metabolism: Tissue Determinants and Cellular Corollaries. New York, NY: Raven Press; 1992:61–79.*

### 2. Metabolic Adaptation (Adaptive Thermogenesis)
Weight loss triggers hormonal and metabolic shifts that reduce energy expenditure beyond what can be explained by tissue loss alone.
- A secondary analysis of the **CALERIE study (2022)** found that the total RMR reduction from weight loss was:
    - **60%** explained by the loss of energy-expending tissues.
    - **40%** attributed to metabolic adaptation (declines in leptin, triiodothyronine, and insulin).
- The total observed RMR reduction was approximately **13.8 kcal/day per kg of weight loss**.

*Source: Müller MJ, et al. Tissue losses and metabolic adaptations both contribute to the reduction in resting metabolic rate following weight loss. PMC9151388 (2022).*

### 3. Non-Resting Energy Expenditure (NEAT and TEF)
As body weight decreases:
- **Thermology of Movement:** Moving a lighter body requires less energy for the same amount of activity.
- **NEAT (Non-Exercise Activity Thermogenesis):** Often decreases spontaneously during a calorie deficit.

## Mathematical Model for TDEE Drift Correction

To adjust the **average TDEE** of a tracking period to the **terminal (current) TDEE**, we apply drift coefficients to the change in lean and fat mass.

### Derived Coefficients
Accounting for the 60/40 tissue/adaptation split and scaling RMR changes to TDEE (assuming a typical Physical Activity Level of 1.4–1.6):

1.  **Lean Mass Drift Coefficient:** ~27 kcal/kg/day
    - (13 kcal/kg RMR * 1.5 PAL) / 0.6 (tissue fraction) ≈ 32 kcal/kg.
    - We use a more conservative **27 kcal/kg** to avoid over-adjustment.
2.  **Fat Mass Drift Coefficient:** ~9 kcal/kg/day
    - (4.5 kcal/kg RMR * 1.5 PAL) / 0.6 (tissue fraction) ≈ 11 kcal/kg.
    - We use a more conservative **9 kcal/kg** to avoid over-adjustment.

### The Adjustment Formula
The average weight/composition of the period is the midpoint between the initial and final states. The adjustment from average to final is:

```
TDEE_final = TDEE_average + (ΔLeanMass / 2 * LeanCoefficient) + (ΔFatMass / 2 * FatCoefficient)
```

Where ΔLeanMass and ΔFatMass are `Final - Initial`.
- If weight is lost, Δ is negative, reducing the TDEE from the average.
- If weight is gained, Δ is positive, increasing the TDEE from the average.
