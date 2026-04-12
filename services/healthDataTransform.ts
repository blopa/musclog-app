import convert from 'convert';

import type { Units } from '@/constants/settings';
import i18n from '@/lang/lang';
import { formatAppDecimal, formatAppInteger } from '@/utils/formatAppNumber';
import { cmToDisplay, kgToDisplay } from '@/utils/unitConversion';

import { HealthConnectError, HealthConnectErrorCode } from './healthConnectErrors';

/**
 * Supported metric types in the app
 */
export enum MetricType {
  HEIGHT = 'height',
  WEIGHT = 'weight',
  BODY_FAT = 'body_fat',
  LEAN_BODY_MASS = 'lean_body_mass',
  BMR = 'basal_metabolic_rate',
  TOTAL_CALORIES = 'total_calories_burned',
  ACTIVE_CALORIES = 'active_calories_burned',
  NUTRITION = 'nutrition',
  EXERCISE = 'exercise',
}

/**
 * Unit systems
 */
export enum UnitSystem {
  METRIC = 'metric',
  IMPERIAL = 'imperial',
}

/**
 * Health Connect record types to app metric types mapping
 */
export const HC_TO_APP_METRIC_MAP: Record<string, MetricType> = {
  Height: MetricType.HEIGHT,
  Weight: MetricType.WEIGHT,
  BodyFat: MetricType.BODY_FAT,
  LeanBodyMass: MetricType.LEAN_BODY_MASS,
  BasalMetabolicRate: MetricType.BMR,
  TotalCaloriesBurned: MetricType.TOTAL_CALORIES,
  ActiveCaloriesBurned: MetricType.ACTIVE_CALORIES,
  Nutrition: MetricType.NUTRITION,
  ExerciseSession: MetricType.EXERCISE,
};

/**
 * Validation ranges for different metrics
 */
export const METRIC_VALIDATION_RANGES: Record<
  MetricType,
  { min: number; max: number; unit: string }
> = {
  [MetricType.HEIGHT]: { min: 50, max: 300, unit: 'cm' }, // 50cm - 300cm
  [MetricType.WEIGHT]: { min: 20, max: 500, unit: 'kg' }, // 20kg - 500kg
  [MetricType.BODY_FAT]: { min: 2, max: 70, unit: '%' }, // 2% - 70%
  [MetricType.LEAN_BODY_MASS]: { min: 10, max: 300, unit: 'kg' }, // 10kg - 300kg
  [MetricType.BMR]: { min: 500, max: 10000, unit: 'kcal/day' }, // 500 - 10000 kcal/day
  [MetricType.TOTAL_CALORIES]: { min: 0, max: 20000, unit: 'kcal' }, // 0 - 20000 kcal
  [MetricType.ACTIVE_CALORIES]: { min: 0, max: 15000, unit: 'kcal' }, // 0 - 15000 kcal
  [MetricType.NUTRITION]: { min: 0, max: 100000, unit: 'kcal' }, // 0 - 100000 kcal (for single meal)
  [MetricType.EXERCISE]: { min: 0, max: 86400000, unit: 'ms' }, // 0 - 24 hours in milliseconds
};

/**
 * Unit conversion factors
 * Note: Weight and length conversions now use the 'convert' package.
 * Only energy conversions remain here as they may not be supported by convert.
 */
const CONVERSION_FACTORS = {
  // Energy
  KJ_TO_KCAL: 0.239006,
  KCAL_TO_KJ: 4.184,
};

/**
 * Height conversion utilities
 */
export class HeightConverter {
  /**
   * Convert meters to centimeters
   */
  static metersToCm(meters: number): number {
    return convert(meters, 'm').to('cm') as number;
  }

  /**
   * Convert centimeters to meters
   */
  static cmToMeters(cm: number): number {
    return convert(cm, 'cm').to('m') as number;
  }

  /**
   * Convert centimeters to inches
   */
  static cmToInches(cm: number): number {
    return convert(cm, 'cm').to('in') as number;
  }

  /**
   * Convert inches to centimeters
   */
  static inchesToCm(inches: number): number {
    return convert(inches, 'in').to('cm') as number;
  }

  /**
   * Format height for display based on unit system (uses central unitConversion)
   */
  static formatHeight(cm: number, system: UnitSystem): string {
    const units: Units = system === UnitSystem.IMPERIAL ? 'imperial' : 'metric';
    const displayIn = cmToDisplay(cm, units);
    if (system === UnitSystem.IMPERIAL) {
      const totalInches = displayIn;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return i18n.t('common.heightFormatImperial', { feet, inches });
    }

    return i18n.t('common.heightFormatMetric', { value: Math.round(displayIn) });
  }
}

/**
 * Weight conversion utilities
 */
export class WeightConverter {
  /**
   * Convert kilograms to pounds
   */
  static kgToLbs(kg: number): number {
    return convert(kg, 'kg').to('lb') as number;
  }

  /**
   * Convert pounds to kilograms
   */
  static lbsToKg(lbs: number): number {
    return convert(lbs, 'lb').to('kg') as number;
  }

  /**
   * Convert grams to kilograms
   */
  static gToKg(grams: number): number {
    return convert(grams, 'g').to('kg') as number;
  }

  /**
   * Convert kilograms to grams
   */
  static kgToG(kg: number): number {
    return convert(kg, 'kg').to('g') as number;
  }

  /**
   * Format weight for display based on unit system (uses central unitConversion)
   */
  static formatWeight(kg: number, system: UnitSystem, decimals: number = 1): string {
    const units: Units = system === UnitSystem.IMPERIAL ? 'imperial' : 'metric';
    const display = kgToDisplay(kg, units);
    const locale = i18n.resolvedLanguage ?? i18n.language;

    // Helper function to format rounded value
    const formatRoundedValue = (value: number, decimalPlaces: number): string => {
      if (decimalPlaces >= 0) {
        return formatAppDecimal(locale, value, decimalPlaces);
      }

      if (value % 1 === 0) {
        return formatAppInteger(locale, value, { useGrouping: false });
      }

      return formatAppDecimal(locale, value, 1);
    };

    const rounded = formatRoundedValue(display, decimals);

    return system === UnitSystem.IMPERIAL
      ? i18n.t('common.weightFormatLbs', { value: rounded })
      : i18n.t('common.weightFormatG', { value: rounded });
  }
}

/**
 * Energy/Calorie conversion utilities
 */
export class EnergyConverter {
  /**
   * Convert kilojoules to kilocalories
   */
  static kjToKcal(kj: number): number {
    return kj * CONVERSION_FACTORS.KJ_TO_KCAL;
  }

  /**
   * Convert kilocalories to kilojoules
   */
  static kcalToKj(kcal: number): number {
    return kcal * CONVERSION_FACTORS.KCAL_TO_KJ;
  }

  /**
   * Format energy for display
   */
  static formatCalories(kcal: number, decimals: number = 0): string {
    const locale = i18n.resolvedLanguage ?? i18n.language;
    const num =
      decimals === 0
        ? formatAppInteger(locale, Math.round(kcal))
        : formatAppDecimal(locale, kcal, decimals);
    return `${num} kcal`;
  }
}

/**
 * Timestamp conversion utilities
 */
export class TimestampConverter {
  /**
   * Convert ISO string to Unix timestamp (milliseconds)
   */
  static isoToUnix(isoString: string): number {
    return new Date(isoString).getTime();
  }

  /**
   * Convert Unix timestamp (milliseconds) to ISO string
   */
  static unixToIso(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Get timezone offset in minutes
   */
  static getTimezoneOffset(): number {
    return new Date().getTimezoneOffset();
  }

  /**
   * Get timezone string (e.g., "America/New_York")
   */
  static getTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Validate timestamp is not in the future
   */
  static isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    // Allow up to 1 minute in the future to account for clock skew
    return timestamp <= now + 60000 && timestamp > 0;
  }
}

/**
 * Data validation utilities
 */
export class DataValidator {
  /**
   * Validate metric value is within acceptable range
   */
  static validateMetricValue(metricType: MetricType, value: number): void {
    const range = METRIC_VALIDATION_RANGES[metricType];

    if (value < range.min || value > range.max) {
      throw new HealthConnectError(
        HealthConnectErrorCode.INVALID_VALUE_RANGE,
        `${metricType} value ${value} is outside valid range [${range.min}, ${range.max}] ${range.unit}`,
        {
          retryable: false,
          context: { metricType, value, range },
        }
      );
    }
  }

  /**
   * Validate timestamp
   */
  static validateTimestamp(timestamp: number): void {
    if (!TimestampConverter.isValidTimestamp(timestamp)) {
      throw new HealthConnectError(
        HealthConnectErrorCode.INVALID_TIMESTAMP,
        `Invalid timestamp: ${timestamp}. Cannot be in the future or negative.`,
        {
          retryable: false,
          context: { timestamp, now: Date.now() },
        }
      );
    }
  }

  /**
   * Check if value is a statistical outlier (basic z-score method)
   * Returns true if value is likely an error (more than 3 standard deviations from mean)
   */
  static isOutlier(value: number, recentValues: number[]): boolean {
    if (recentValues.length < 3) {
      return false;
    } // Need enough data points

    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const variance =
      recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Z-score: how many standard deviations from mean
    const zScore = Math.abs((value - mean) / stdDev);

    // More than 3 standard deviations is likely an outlier
    return zScore > 3;
  }
}

/**
 * Health Connect to App data transformation
 */
export class HealthDataTransformer {
  /**
   * Transform Health Connect Height record to app format
   */
  static transformHeight(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns height in meters
    const heightCm = HeightConverter.metersToCm(hcRecord.height.inMeters);

    DataValidator.validateMetricValue(MetricType.HEIGHT, heightCm);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.time);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.HEIGHT,
      value: heightCm,
      unit: 'cm',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect Weight record to app format
   */
  static transformWeight(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns weight in kilograms
    const weightKg = hcRecord.weight.inKilograms;

    DataValidator.validateMetricValue(MetricType.WEIGHT, weightKg);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.time);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.WEIGHT,
      value: weightKg,
      unit: 'kg',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect BodyFat record to app format
   */
  static transformBodyFat(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns body fat as percentage
    const bodyFatPercent = hcRecord.percentage;

    DataValidator.validateMetricValue(MetricType.BODY_FAT, bodyFatPercent);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.time);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.BODY_FAT,
      value: bodyFatPercent,
      unit: '%',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect LeanBodyMass record to app format
   */
  static transformLeanBodyMass(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns lean body mass in kilograms
    const leanBodyMassKg = hcRecord.mass.inKilograms;

    DataValidator.validateMetricValue(MetricType.LEAN_BODY_MASS, leanBodyMassKg);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.time);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.LEAN_BODY_MASS,
      value: leanBodyMassKg,
      unit: 'kg',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect TotalCaloriesBurned record to app format
   */
  static transformTotalCalories(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns energy in kilocalories
    const caloriesKcal = hcRecord.energy.inKilocalories;

    DataValidator.validateMetricValue(MetricType.TOTAL_CALORIES, caloriesKcal);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.startTime);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.TOTAL_CALORIES,
      value: caloriesKcal,
      unit: 'kcal',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect ActiveCaloriesBurned record to app format
   */
  static transformActiveCalories(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns energy in kilocalories
    const caloriesKcal = hcRecord.energy.inKilocalories;

    DataValidator.validateMetricValue(MetricType.ACTIVE_CALORIES, caloriesKcal);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.startTime);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.ACTIVE_CALORIES,
      value: caloriesKcal,
      unit: 'kcal',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Transform Health Connect BasalMetabolicRate record to app format
   */
  static transformBMR(hcRecord: any): {
    type: MetricType;
    value: number;
    unit: string;
    date: number;
    timezone: string;
  } {
    // Health Connect returns BMR in kilocalories per day
    const bmrKcal = hcRecord.basalMetabolicRate.inKilocaloriesPerDay;

    DataValidator.validateMetricValue(MetricType.BMR, bmrKcal);
    const timestamp = TimestampConverter.isoToUnix(hcRecord.time);
    DataValidator.validateTimestamp(timestamp);

    return {
      type: MetricType.BMR,
      value: bmrKcal,
      unit: 'kcal/day',
      date: timestamp,
      timezone: TimestampConverter.getTimezone(),
    };
  }

  /**
   * Detect and filter duplicate records by timestamp
   */
  static deduplicateRecords<T extends { date: number }>(records: T[]): T[] {
    const seen = new Set<number>();
    return records.filter((record) => {
      if (seen.has(record.date)) {
        return false;
      }
      seen.add(record.date);
      return true;
    });
  }

  /**
   * Sort records by date (newest first)
   */
  static sortRecordsByDate<T extends { date: number }>(records: T[], descending = true): T[] {
    return records.sort((a, b) => (descending ? b.date - a.date : a.date - b.date));
  }
}
