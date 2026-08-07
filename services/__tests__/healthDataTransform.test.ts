import { HealthConnectError, HealthConnectErrorCode } from '@/services/healthConnectErrors';
import {
  DataValidator,
  EnergyConverter,
  HC_TO_APP_METRIC_MAP,
  HealthDataTransformer,
  HeightConverter,
  METRIC_VALIDATION_RANGES,
  MetricType,
  TimestampConverter,
  UnitSystem,
  WeightConverter,
} from '@/services/healthDataTransform';

// Echo `key|{interpolation}` so the assertions can pin the *numbers handed to i18n*
// without coupling to the wording in `lang/locales`.
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: {
    t: (key: string, opts?: Record<string, unknown>) => `${key}|${JSON.stringify(opts ?? {})}`,
    resolvedLanguage: 'en-US',
    language: 'en-US',
  },
}));

describe('HeightConverter', () => {
  it('round-trips m <-> cm and cm <-> in', () => {
    expect(HeightConverter.metersToCm(1.8)).toBeCloseTo(180, 6);
    expect(HeightConverter.cmToMeters(180)).toBeCloseTo(1.8, 6);
    expect(HeightConverter.cmToInches(2.54)).toBeCloseTo(1, 6);
    expect(HeightConverter.inchesToCm(1)).toBeCloseTo(2.54, 6);

    expect(HeightConverter.cmToMeters(HeightConverter.metersToCm(1.755))).toBeCloseTo(1.755, 9);
    expect(HeightConverter.inchesToCm(HeightConverter.cmToInches(173.5))).toBeCloseTo(173.5, 9);
  });

  it('formats metric height as whole centimetres', () => {
    expect(HeightConverter.formatHeight(180.4, UnitSystem.METRIC)).toBe(
      'common.heightFormatMetric|{"value":180}'
    );
  });

  it('splits imperial height into feet and remaining inches', () => {
    expect(HeightConverter.formatHeight(181, UnitSystem.IMPERIAL)).toBe(
      'common.heightFormatImperial|{"feet":5,"inches":11}'
    );
    // Exactly 6ft — the remainder must be 0, not 12.
    expect(HeightConverter.formatHeight(182.88, UnitSystem.IMPERIAL)).toBe(
      'common.heightFormatImperial|{"feet":6,"inches":0}'
    );
  });
});

describe('WeightConverter', () => {
  it('round-trips kg <-> lb and g <-> kg', () => {
    expect(WeightConverter.kgToLbs(1)).toBeCloseTo(2.20462, 4);
    expect(WeightConverter.lbsToKg(2.20462)).toBeCloseTo(1, 4);
    expect(WeightConverter.gToKg(1500)).toBeCloseTo(1.5, 9);
    expect(WeightConverter.kgToG(1.5)).toBeCloseTo(1500, 9);

    expect(WeightConverter.lbsToKg(WeightConverter.kgToLbs(82.3))).toBeCloseTo(82.3, 9);
    expect(WeightConverter.gToKg(WeightConverter.kgToG(0.375))).toBeCloseTo(0.375, 9);
  });

  it('converts to pounds before formatting an imperial weight', () => {
    expect(WeightConverter.formatWeight(80, UnitSystem.IMPERIAL)).toBe(
      'common.weightFormatLbs|{"value":"176.4"}'
    );
  });

  it('leaves a metric weight in kilograms — the DB unit — rather than converting', () => {
    expect(WeightConverter.formatWeight(80, UnitSystem.METRIC)).toContain('"value":"80"');
    expect(WeightConverter.formatWeight(72.55, UnitSystem.METRIC, 2)).toContain('"value":"72.55"');
  });

  it('honours the requested decimal count', () => {
    expect(WeightConverter.formatWeight(80.456, UnitSystem.METRIC, 0)).toContain('"value":"80"');
    expect(WeightConverter.formatWeight(80.456, UnitSystem.METRIC, 2)).toContain('"value":"80.46"');
  });

  it('treats a negative decimal count as "drop the .0 on whole numbers"', () => {
    expect(WeightConverter.formatWeight(80, UnitSystem.METRIC, -1)).toContain('"value":"80"');
    expect(WeightConverter.formatWeight(80.5, UnitSystem.METRIC, -1)).toContain('"value":"80.5"');
  });
});

describe('EnergyConverter', () => {
  it('converts kJ <-> kcal and round-trips within rounding error', () => {
    expect(EnergyConverter.kjToKcal(4.184)).toBeCloseTo(1, 3);
    expect(EnergyConverter.kcalToKj(1)).toBeCloseTo(4.184, 6);
    expect(EnergyConverter.kjToKcal(EnergyConverter.kcalToKj(2000))).toBeCloseTo(2000, 1);
  });

  it('rounds to a whole number of kcal by default', () => {
    expect(EnergyConverter.formatCalories(1234.6)).toBe('common.amount_kcal|{"amount":"1235"}');
  });

  it('keeps decimals when asked', () => {
    expect(EnergyConverter.formatCalories(1234.56, 1)).toBe('common.amount_kcal|{"amount":"1234.6"}');
  });
});

describe('TimestampConverter', () => {
  it('round-trips ISO <-> unix ms', () => {
    const iso = '2026-03-14T15:09:26.535Z';

    expect(TimestampConverter.isoToUnix(iso)).toBe(Date.parse(iso));
    expect(TimestampConverter.unixToIso(Date.parse(iso))).toBe(iso);
  });

  describe('isValidTimestamp', () => {
    it('accepts a past timestamp', () => {
      expect(TimestampConverter.isValidTimestamp(Date.now() - 60_000)).toBe(true);
    });

    it('tolerates up to a minute of clock skew into the future', () => {
      expect(TimestampConverter.isValidTimestamp(Date.now() + 30_000)).toBe(true);
    });

    it('rejects a timestamp further ahead than the skew allowance', () => {
      expect(TimestampConverter.isValidTimestamp(Date.now() + 120_000)).toBe(false);
    });

    it('rejects the epoch and negative timestamps, which mean "missing"', () => {
      expect(TimestampConverter.isValidTimestamp(0)).toBe(false);
      expect(TimestampConverter.isValidTimestamp(-1)).toBe(false);
    });
  });

  it('reports the device timezone as a ±HH:MM offset', () => {
    expect(TimestampConverter.getTimezone()).toMatch(/^[+-]\d{2}:\d{2}$/);
  });
});

describe('DataValidator.validateMetricValue', () => {
  it('accepts both range boundaries — they are inclusive', () => {
    const { min, max } = METRIC_VALIDATION_RANGES[MetricType.WEIGHT];

    expect(() => DataValidator.validateMetricValue(MetricType.WEIGHT, min)).not.toThrow();
    expect(() => DataValidator.validateMetricValue(MetricType.WEIGHT, max)).not.toThrow();
  });

  it('rejects a value below the minimum with a non-retryable range error', () => {
    expect.assertions(4);
    try {
      DataValidator.validateMetricValue(MetricType.WEIGHT, 5);
    } catch (error) {
      const hcError = error as HealthConnectError;
      expect(hcError).toBeInstanceOf(HealthConnectError);
      expect(hcError.code).toBe(HealthConnectErrorCode.INVALID_VALUE_RANGE);
      expect(hcError.isRetryable()).toBe(false);
      expect(hcError.context).toMatchObject({ metricType: MetricType.WEIGHT, value: 5 });
    }
  });

  it('rejects a value above the maximum', () => {
    expect(() => DataValidator.validateMetricValue(MetricType.HEIGHT, 400)).toThrow(
      HealthConnectError
    );
  });

  it('has a range for every metric type, so no metric silently skips validation', () => {
    for (const metricType of Object.values(MetricType)) {
      const range = METRIC_VALIDATION_RANGES[metricType];
      expect(range).toBeDefined();
      expect(range.min).toBeLessThan(range.max);
      expect(typeof range.unit).toBe('string');
    }
  });
});

describe('DataValidator.validateTimestamp', () => {
  it('passes a plausible past timestamp through', () => {
    expect(() => DataValidator.validateTimestamp(Date.now() - 1000)).not.toThrow();
  });

  it('rejects a far-future timestamp as an invalid-timestamp error', () => {
    expect.assertions(2);
    try {
      DataValidator.validateTimestamp(Date.now() + 10 * 60_000);
    } catch (error) {
      const hcError = error as HealthConnectError;
      expect(hcError.code).toBe(HealthConnectErrorCode.INVALID_TIMESTAMP);
      expect(hcError.isRetryable()).toBe(false);
    }
  });
});

describe('DataValidator.isOutlier', () => {
  it('needs at least three samples before it will call anything an outlier', () => {
    expect(DataValidator.isOutlier(500, [80, 81])).toBe(false);
    expect(DataValidator.isOutlier(500, [])).toBe(false);
  });

  it('flags a value more than 3 standard deviations from the mean', () => {
    expect(DataValidator.isOutlier(500, [80, 81, 79, 80])).toBe(true);
  });

  it('accepts a value that sits inside the normal spread', () => {
    expect(DataValidator.isOutlier(81, [80, 81, 79, 80])).toBe(false);
  });

  it('does not flag anything when every sample is identical (zero variance)', () => {
    // stdDev is 0, so the z-score is NaN — which must fall through as "not an outlier"
    // rather than throwing or flagging every reading.
    expect(DataValidator.isOutlier(5, [5, 5, 5, 5])).toBe(false);
  });
});

describe('HealthDataTransformer record transforms', () => {
  const timezonePattern = /^[+-]\d{2}:\d{2}$/;
  const time = new Date(Date.now() - 60_000).toISOString();

  it('converts Health Connect metres to the centimetres the DB stores', () => {
    const result = HealthDataTransformer.transformHeight({ height: { inMeters: 1.8 }, time } as any);

    expect(result.type).toBe(MetricType.HEIGHT);
    expect(result.value).toBeCloseTo(180, 6);
    expect(result.unit).toBe('cm');
    expect(result.date).toBe(Date.parse(time));
    expect(result.timezone).toMatch(timezonePattern);
  });

  it('keeps weight in kilograms, which is already the storage unit', () => {
    const result = HealthDataTransformer.transformWeight({
      weight: { inKilograms: 82.4 },
      time,
    } as any);

    expect(result).toMatchObject({ type: MetricType.WEIGHT, value: 82.4, unit: 'kg' });
  });

  it('passes body fat through as a percentage', () => {
    const result = HealthDataTransformer.transformBodyFat({ percentage: 18.5, time } as any);

    expect(result).toMatchObject({ type: MetricType.BODY_FAT, value: 18.5, unit: '%' });
  });

  it('keeps lean body mass in kilograms', () => {
    const result = HealthDataTransformer.transformLeanBodyMass({
      mass: { inKilograms: 60 },
      time,
    } as any);

    expect(result).toMatchObject({ type: MetricType.LEAN_BODY_MASS, value: 60, unit: 'kg' });
  });

  it('dates calorie records from startTime, not the record instant', () => {
    const startTime = new Date(Date.now() - 3_600_000).toISOString();

    const total = HealthDataTransformer.transformTotalCalories({
      energy: { inKilocalories: 2400 },
      startTime,
    } as any);
    const active = HealthDataTransformer.transformActiveCalories({
      energy: { inKilocalories: 600 },
      startTime,
    } as any);

    expect(total).toMatchObject({ type: MetricType.TOTAL_CALORIES, value: 2400, unit: 'kcal' });
    expect(total.date).toBe(Date.parse(startTime));
    expect(active).toMatchObject({ type: MetricType.ACTIVE_CALORIES, value: 600, unit: 'kcal' });
    expect(active.date).toBe(Date.parse(startTime));
  });

  it('labels BMR per day', () => {
    const result = HealthDataTransformer.transformBMR({
      basalMetabolicRate: { inKilocaloriesPerDay: 1750 },
      time,
    } as any);

    expect(result).toMatchObject({ type: MetricType.BMR, value: 1750, unit: 'kcal/day' });
  });

  it('takes the step count and day key as given — steps arrive pre-aggregated', () => {
    const dayStart = new Date(2026, 2, 14).getTime();

    const result = HealthDataTransformer.transformSteps(8412, dayStart);

    expect(result).toMatchObject({ type: MetricType.STEPS, value: 8412, unit: 'steps' });
    expect(result.date).toBe(dayStart);
  });

  it('refuses an out-of-range reading rather than writing garbage to the DB', () => {
    expect(() =>
      HealthDataTransformer.transformWeight({ weight: { inKilograms: 900 }, time } as any)
    ).toThrow(HealthConnectError);

    expect(() =>
      HealthDataTransformer.transformHeight({ height: { inMeters: 4 }, time } as any)
    ).toThrow(HealthConnectError);

    expect(() => HealthDataTransformer.transformSteps(999_999, Date.now())).toThrow(
      HealthConnectError
    );
  });

  it('refuses a future-dated record', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();

    expect(() =>
      HealthDataTransformer.transformWeight({ weight: { inKilograms: 80 }, time: future } as any)
    ).toThrow(HealthConnectError);
  });
});

describe('HealthDataTransformer collection helpers', () => {
  it('keeps the first record for a timestamp and drops later duplicates', () => {
    const records = [
      { date: 1, value: 'first' },
      { date: 2, value: 'second' },
      { date: 1, value: 'duplicate' },
    ];

    expect(HealthDataTransformer.deduplicateRecords(records)).toEqual([
      { date: 1, value: 'first' },
      { date: 2, value: 'second' },
    ]);
  });

  it('leaves an already-unique list untouched', () => {
    const records = [{ date: 1 }, { date: 2 }, { date: 3 }];

    expect(HealthDataTransformer.deduplicateRecords(records)).toEqual(records);
  });

  it('handles an empty list', () => {
    expect(HealthDataTransformer.deduplicateRecords([])).toEqual([]);
    expect(HealthDataTransformer.sortRecordsByDate([])).toEqual([]);
  });

  it('sorts newest first by default and oldest first when asked', () => {
    expect(HealthDataTransformer.sortRecordsByDate([{ date: 1 }, { date: 3 }, { date: 2 }])).toEqual(
      [{ date: 3 }, { date: 2 }, { date: 1 }]
    );

    expect(
      HealthDataTransformer.sortRecordsByDate([{ date: 1 }, { date: 3 }, { date: 2 }], false)
    ).toEqual([{ date: 1 }, { date: 2 }, { date: 3 }]);
  });

  it('sorts in place — callers must not rely on the input staying ordered', () => {
    const records = [{ date: 1 }, { date: 3 }, { date: 2 }];

    const sorted = HealthDataTransformer.sortRecordsByDate(records);

    expect(sorted).toBe(records);
  });
});

describe('HC_TO_APP_METRIC_MAP', () => {
  it('maps every Health Connect record type the app reads onto a known MetricType', () => {
    const knownMetrics = new Set<string>(Object.values(MetricType));

    for (const [recordType, metricType] of Object.entries(HC_TO_APP_METRIC_MAP)) {
      expect(knownMetrics.has(metricType)).toBe(true);
      expect(recordType).not.toHaveLength(0);
    }
  });

  it('is injective — two record types mapping to one metric would collide on sync', () => {
    const mapped = Object.values(HC_TO_APP_METRIC_MAP);

    expect(new Set(mapped).size).toBe(mapped.length);
  });
});
