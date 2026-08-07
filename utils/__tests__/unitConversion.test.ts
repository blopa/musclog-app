import type { Units } from '@/constants/settings';

import {
  cmToDisplay,
  displayToCm,
  displayToGrams,
  displayToKg,
  displayValueToMetric,
  getMassUnitLabel,
  gramsToDisplay,
  isLengthMetricType,
  isWeightMetricType,
  kgToDisplay,
  metricDisplayUnit,
  metricValueToDisplay,
  prepareMetricDataToDisplay,
  prepareMetricDataToSave,
  storedHeightToCm,
  storedWeightToKg,
} from '@/utils/unitConversion';

/**
 * Every `UserMetricType` in `database/models/UserMetric.ts`. Kept here so that the
 * partition asserted below (weight / length / passthrough) is checked against the
 * *complete* set — a newly added metric type that needs conversion must be classified,
 * and one that does not must stay a passthrough.
 */
const ALL_METRIC_TYPES = [
  'weight',
  'body_fat',
  'muscle_mass',
  'lean_body_mass',
  'basal_metabolic_rate',
  'total_calories_burned',
  'active_calories_burned',
  'bmi',
  'height',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
  'neck',
  'shoulders',
  'mood',
  'water',
  'supplement',
  'ffmi',
  'nutrition',
  'exercise',
  'period_flow',
  'period_symptoms',
  'basal_body_temp',
  'daily_steps',
  'other',
] as const;

const WEIGHT_TYPES = ['weight', 'muscle_mass', 'lean_body_mass'];
const LENGTH_TYPES = [
  'height',
  'chest',
  'waist',
  'hips',
  'arms',
  'thighs',
  'calves',
  'neck',
  'shoulders',
];

const BOTH_UNITS: Units[] = ['metric', 'imperial'];

// Exact conversion factors (NIST): assertions below are derived from these rather than
// from whatever `convert` happens to return, so a bad factor would be caught.
const LB_PER_KG = 2.2046226218487757;
const CM_PER_IN = 2.54;
const G_PER_OZ = 28.349523125;

describe('unitConversion', () => {
  describe('metric-type classifiers', () => {
    it('classifies exactly the kg-stored types as weight types', () => {
      const classified = ALL_METRIC_TYPES.filter(isWeightMetricType);
      expect([...classified].sort()).toEqual([...WEIGHT_TYPES].sort());
    });

    it('classifies exactly the cm-stored types as length types', () => {
      const classified = ALL_METRIC_TYPES.filter(isLengthMetricType);
      expect([...classified].sort()).toEqual([...LENGTH_TYPES].sort());
    });

    it('never classifies a type as both weight and length', () => {
      const both = ALL_METRIC_TYPES.filter((t) => isWeightMetricType(t) && isLengthMetricType(t));
      expect(both).toEqual([]);
    });

    it('returns false for unknown / non-metric type strings instead of throwing', () => {
      expect(isWeightMetricType('not_a_metric')).toBe(false);
      expect(isLengthMetricType('')).toBe(false);
    });

    it('does not classify body_fat, bmi or ffmi (unitless) as convertible', () => {
      for (const type of ['body_fat', 'bmi', 'ffmi']) {
        expect(isWeightMetricType(type)).toBe(false);
        expect(isLengthMetricType(type)).toBe(false);
      }
    });
  });

  describe('kg <-> display weight', () => {
    it('passes kg through untouched in metric (DB already stores kg)', () => {
      expect(kgToDisplay(82.4, 'metric')).toBe(82.4);
      expect(displayToKg(82.4, 'metric')).toBe(82.4);
    });

    it('converts kg to lb in imperial', () => {
      expect(kgToDisplay(100, 'imperial')).toBeCloseTo(100 * LB_PER_KG, 8);
      expect(kgToDisplay(1, 'imperial')).toBeCloseTo(LB_PER_KG, 10);
    });

    it('converts entered lb back to kg in imperial', () => {
      // The example in AGENTS.md: 180 lb entered by an imperial user stores as ~81.6 kg.
      expect(displayToKg(180, 'imperial')).toBeCloseTo(81.6466, 4);
      expect(displayToKg(LB_PER_KG, 'imperial')).toBeCloseTo(1, 10);
    });

    it('handles 0 and negative deltas symmetrically', () => {
      expect(kgToDisplay(0, 'imperial')).toBe(0);
      expect(kgToDisplay(-2.5, 'imperial')).toBeCloseTo(-2.5 * LB_PER_KG, 8);
    });
  });

  describe('cm <-> display length', () => {
    it('passes cm through untouched in metric', () => {
      expect(cmToDisplay(178.5, 'metric')).toBe(178.5);
      expect(displayToCm(178.5, 'metric')).toBe(178.5);
    });

    it('converts cm to in and in to cm in imperial', () => {
      expect(cmToDisplay(180, 'imperial')).toBeCloseTo(180 / CM_PER_IN, 10);
      expect(displayToCm(72, 'imperial')).toBeCloseTo(72 * CM_PER_IN, 10);
    });
  });

  describe('grams <-> display mass', () => {
    it('passes grams through untouched in metric', () => {
      expect(gramsToDisplay(250, 'metric')).toBe(250);
      expect(displayToGrams(250, 'metric')).toBe(250);
    });

    it('converts g to oz and oz to g in imperial', () => {
      expect(gramsToDisplay(100, 'imperial')).toBeCloseTo(100 / G_PER_OZ, 10);
      expect(displayToGrams(1, 'imperial')).toBeCloseTo(G_PER_OZ, 10);
    });
  });

  describe('round-trip stability (DB stores metric; UI must not drift the stored value)', () => {
    const SAMPLES = [0, 0.5, 1, 12.3, 75, 100.75, 453.6, 10000];

    it.each(BOTH_UNITS)('kg -> display -> kg is stable in %s', (units) => {
      for (const kg of SAMPLES) {
        expect(displayToKg(kgToDisplay(kg, units), units)).toBeCloseTo(kg, 9);
      }
    });

    it.each(BOTH_UNITS)('cm -> display -> cm is stable in %s', (units) => {
      for (const cm of SAMPLES) {
        expect(displayToCm(cmToDisplay(cm, units), units)).toBeCloseTo(cm, 9);
      }
    });

    it.each(BOTH_UNITS)('g -> display -> g is stable in %s', (units) => {
      for (const g of SAMPLES) {
        expect(displayToGrams(gramsToDisplay(g, units), units)).toBeCloseTo(g, 9);
      }
    });

    it.each(BOTH_UNITS)(
      'metric -> display -> metric is stable in %s for every metric type',
      (units) => {
        for (const type of ALL_METRIC_TYPES) {
          for (const stored of [0, 1, 37.5, 180]) {
            const display = metricValueToDisplay(stored, type, units);
            expect(displayValueToMetric(display, type, units)).toBeCloseTo(stored, 9);
          }
        }
      }
    );

    it('is an exact identity (not merely close) in metric for every metric type', () => {
      for (const type of ALL_METRIC_TYPES) {
        expect(metricValueToDisplay(63.27, type, 'metric')).toBe(63.27);
        expect(displayValueToMetric(63.27, type, 'metric')).toBe(63.27);
      }
    });
  });

  describe('metricValueToDisplay / displayValueToMetric', () => {
    it('routes weight types through the kg converter', () => {
      for (const type of WEIGHT_TYPES) {
        expect(metricValueToDisplay(70, type, 'imperial')).toBe(kgToDisplay(70, 'imperial'));
        expect(displayValueToMetric(154, type, 'imperial')).toBe(displayToKg(154, 'imperial'));
      }
    });

    it('routes length types through the cm converter', () => {
      for (const type of LENGTH_TYPES) {
        expect(metricValueToDisplay(90, type, 'imperial')).toBe(cmToDisplay(90, 'imperial'));
        expect(displayValueToMetric(36, type, 'imperial')).toBe(displayToCm(36, 'imperial'));
      }
    });

    it('leaves unitless / already-universal types untouched even in imperial', () => {
      // %, kcal, mood, steps and BMI/FFMI have no imperial equivalent — converting them
      // would silently corrupt stored values.
      const passthrough = ALL_METRIC_TYPES.filter(
        (t) => !isWeightMetricType(t) && !isLengthMetricType(t)
      );
      expect(passthrough).toContain('body_fat');
      expect(passthrough).toContain('basal_metabolic_rate');
      expect(passthrough).toContain('daily_steps');

      for (const type of passthrough) {
        expect(metricValueToDisplay(18.4, type, 'imperial')).toBe(18.4);
        expect(displayValueToMetric(18.4, type, 'imperial')).toBe(18.4);
      }
    });
  });

  describe('metricDisplayUnit', () => {
    it('labels weight types kg / lbs and length types cm / in', () => {
      expect(metricDisplayUnit('weight', 'metric')).toBe('kg');
      expect(metricDisplayUnit('weight', 'imperial')).toBe('lbs');
      expect(metricDisplayUnit('lean_body_mass', 'imperial')).toBe('lbs');
      expect(metricDisplayUnit('waist', 'metric')).toBe('cm');
      expect(metricDisplayUnit('waist', 'imperial')).toBe('in');
    });

    it('ignores a stale stored unit for convertible types (units setting wins)', () => {
      // A legacy row may carry unit 'lbs' while holding kg; the label must follow the
      // user's current setting, never the stored string.
      expect(metricDisplayUnit('weight', 'metric', 'lbs')).toBe('kg');
      expect(metricDisplayUnit('height', 'imperial', 'cm')).toBe('in');
    });

    it('falls back to the stored unit for non-convertible types', () => {
      expect(metricDisplayUnit('body_fat', 'imperial', '%')).toBe('%');
      expect(metricDisplayUnit('basal_metabolic_rate', 'metric', 'kcal')).toBe('kcal');
      expect(metricDisplayUnit('mood', 'metric')).toBeUndefined();
    });
  });

  describe('getMassUnitLabel', () => {
    it('returns oz for imperial and g for metric', () => {
      expect(getMassUnitLabel('imperial')).toBe('oz');
      expect(getMassUnitLabel('metric')).toBe('g');
    });
  });

  describe('legacy stored-unit normalisation', () => {
    it('converts a legacy lbs-stored weight to kg', () => {
      expect(storedWeightToKg(180, 'lbs')).toBeCloseTo(81.6466, 4);
    });

    it('leaves the value alone for kg / missing / null stored units', () => {
      expect(storedWeightToKg(82, 'kg')).toBe(82);
      expect(storedWeightToKg(82)).toBe(82);
      expect(storedWeightToKg(82, null)).toBe(82);
    });

    it("only normalises the exact 'lbs' spelling (not 'lb')", () => {
      // Guards against double-converting rows that already use the canonical 'lb'.
      expect(storedWeightToKg(180, 'lb')).toBe(180);
    });

    it('converts a legacy in-stored height to cm and leaves cm alone', () => {
      expect(storedHeightToCm(72, 'in')).toBeCloseTo(182.88, 10);
      expect(storedHeightToCm(180, 'cm')).toBe(180);
      expect(storedHeightToCm(180)).toBe(180);
      expect(storedHeightToCm(180, null)).toBe(180);
    });
  });

  describe('prepareMetricDataToSave / prepareMetricDataToDisplay', () => {
    const fields = [
      { key: 'targetWeight' as const, type: 'weight' as const },
      { key: 'height' as const, type: 'length' as const },
      { key: 'portion' as const, type: 'mass' as const },
    ];

    it('converts each field by its declared type when imperial', () => {
      const saved = prepareMetricDataToSave(
        { targetWeight: 180, height: 72, portion: 4 },
        fields,
        'imperial'
      );
      expect(saved.targetWeight).toBeCloseTo(81.6466, 4);
      expect(saved.height).toBeCloseTo(182.88, 10);
      expect(saved.portion).toBeCloseTo(4 * G_PER_OZ, 10);
    });

    it('is a no-op in metric (DB units already equal display units)', () => {
      const input = { targetWeight: 82, height: 180, portion: 125 };
      expect(prepareMetricDataToSave(input, fields, 'metric')).toEqual(input);
      expect(prepareMetricDataToDisplay(input, fields, 'metric')).toEqual(input);
    });

    it('round-trips save -> display back to the original display values', () => {
      const entered = { targetWeight: 180, height: 72, portion: 4 };
      const stored = prepareMetricDataToSave(entered, fields, 'imperial');
      const shown = prepareMetricDataToDisplay(stored, fields, 'imperial');
      expect(shown.targetWeight).toBeCloseTo(entered.targetWeight, 9);
      expect(shown.height).toBeCloseTo(entered.height, 9);
      expect(shown.portion).toBeCloseTo(entered.portion, 9);
    });

    it('does not mutate the input object', () => {
      const input = { targetWeight: 180, height: 72, portion: 4 };
      prepareMetricDataToSave(input, fields, 'imperial');
      expect(input).toEqual({ targetWeight: 180, height: 72, portion: 4 });
    });

    it('leaves non-numeric and absent fields untouched', () => {
      const result = prepareMetricDataToSave(
        { targetWeight: '180', height: undefined, note: 'keep me' },
        [
          { key: 'targetWeight', type: 'weight' },
          { key: 'height', type: 'length' },
        ],
        'imperial'
      );
      expect(result).toEqual({ targetWeight: '180', height: undefined, note: 'keep me' });
    });

    it('converts stored metric values to display values', () => {
      const shown = prepareMetricDataToDisplay(
        { weight: 75 },
        [{ key: 'weight', type: 'weight' }],
        'imperial'
      );
      // AGENTS.md example: 75 kg shows as ~165.3 lb.
      expect(shown.weight).toBeCloseTo(165.3, 1);
    });
  });
});
