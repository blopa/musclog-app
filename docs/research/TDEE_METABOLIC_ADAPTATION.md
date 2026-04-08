# TDEE Drift and Metabolic Adaptation in Weight Management

This document summarizes the scientific research and mathematical modeling used to correct for "TDEE drift" when calculating Total Daily Energy Expenditure (TDEE) over extended tracking periods.

## The Problem: Average vs. Terminal TDEE

When TDEE is calculated empirically using weight and calorie tracking data over a period (e.g., 60 days), the result is an **average** TDEE for that period. However, as an individual's body mass and composition change, their metabolic requirements also change.

If a user loses 10 kg, their TDEE at the end of the period will be lower than their TDEE at the beginning. Relying on the 60-day average for future planning can lead to overestimating their current maintenance calories, potentially causing them to stall or even gain weight.

## Key Research Findings

### 1. Tissue-Specific Resting Metabolic Rates

Resting Metabolic Rate (RMR) is not uniform across all body tissues. According to research by Elia (1992):

- **Skeletal Muscle (Lean Mass):** ~13.0 kcal/kg/day
- **Adipose Tissue (Fat Mass):** ~4.5 kcal/kg/day

_Source: Elia M. Organ and tissue contribution to metabolic rate. In: Kinney JM, Tucker HN, eds. Energy Metabolism: Tissue Determinants and Cellular Corollaries. New York, NY: Raven Press; 1992:61–79._

### 2. Physical Activity Level (PAL) Scaling

When body mass is lost, the mechanical cost of movement decreases. A person moving through space requires less energy to move a lighter frame. To account for this, the resting tissue-specific calorie drop must be scaled by the user's activity multiplier (PAL).

- **Sedentary:** 1.2
- **Active:** 1.725+
  Losing 1 kg of tissue reduces TDEE significantly more for an active individual than a sedentary one.

### 3. Adaptive Thermogenesis

Weight loss triggers hormonal and metabolic shifts that reduce energy expenditure beyond what can be explained by tissue loss or mechanical costs alone.

- This "adaptive" component is driven by neuroendocrine changes (decreased leptin, thyroid hormones) and subconscious reductions in Non-Exercise Activity Thermogenesis (NEAT).
- Widely validated dynamic energy balance models (Hall et al., NIH) suggest a mass-independent penalty of approximately **15 kcal/day per kg of total body weight lost**.

_Source: Müller MJ, et al. Tissue losses and metabolic adaptations both contribute to the reduction in resting metabolic rate following weight loss. PMC9151388 (2022)._

## Refined Mathematical Model for TDEE Drift Correction

To adjust the **average TDEE** of a tracking period to the **terminal (current) TDEE**, we use a three-component model based on the change in mass between the initial and final states.

### Coefficients

1.  **Resting Lean Mass:** 13.0 kcal/kg
2.  **Resting Fat Mass:** 4.5 kcal/kg
3.  **Adaptive Thermogenesis:** 15.0 kcal/kg

### The Adjustment Formula

Since the average TDEE represents the midpoint of the tracking period, we adjust from the midpoint to the final state using half of the total differences (Δ/2).

```
1. RestingDrop = (ΔLean / 2 * 13.0) + (ΔFat / 2 * 4.5)
2. ActivityScaledDrop = RestingDrop * PAL_Multiplier
3. AdaptivePenalty = (ΔTotalWeight / 2 * 15.0)

TDEE_final = TDEE_average + ActivityScaledDrop + AdaptivePenalty
```

Where Δ is `FinalState - InitialState`.

- During weight loss, Δ is negative, resulting in a TDEE correction downwards.
- During weight gain, Δ is positive, resulting in a TDEE correction upwards.
