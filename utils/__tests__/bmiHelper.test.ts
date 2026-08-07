import fs from 'fs';
import path from 'path';

import { calculateBMIWithStatus, getBMIStatusKey } from '@/utils/bmiHelper';

const LOCALES_DIR = path.join(__dirname, '..', '..', 'lang', 'locales');

function resolveI18nKey(locale: string, key: string): unknown {
  const [namespace] = key.split('.');
  const bundle = JSON.parse(
    fs.readFileSync(path.join(LOCALES_DIR, locale, `${namespace}.json`), 'utf8')
  );
  return key.split('.').reduce<unknown>((acc, segment) => {
    return acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined;
  }, bundle);
}

describe('bmiHelper', () => {
  describe('getBMIStatusKey', () => {
    it('classifies the WHO bands', () => {
      expect(getBMIStatusKey(17)).toBe('profile.bmiStatus.underweight');
      expect(getBMIStatusKey(22)).toBe('profile.bmiStatus.normal');
      expect(getBMIStatusKey(27)).toBe('profile.bmiStatus.overweight');
      expect(getBMIStatusKey(35)).toBe('profile.bmiStatus.obese');
    });

    it('puts each band boundary in the higher band (bands are [lower, upper))', () => {
      expect(getBMIStatusKey(18.4)).toBe('profile.bmiStatus.underweight');
      expect(getBMIStatusKey(18.5)).toBe('profile.bmiStatus.normal');
      expect(getBMIStatusKey(24.9)).toBe('profile.bmiStatus.normal');
      expect(getBMIStatusKey(25)).toBe('profile.bmiStatus.overweight');
      expect(getBMIStatusKey(29.9)).toBe('profile.bmiStatus.overweight');
      expect(getBMIStatusKey(30)).toBe('profile.bmiStatus.obese');
    });

    it('returns keys that resolve in every shipped locale', () => {
      const locales = fs
        .readdirSync(LOCALES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      expect(locales.length).toBeGreaterThan(0);

      for (const locale of locales) {
        for (const bmi of [17, 22, 27, 35]) {
          const value = resolveI18nKey(locale, getBMIStatusKey(bmi));
          expect(typeof value).toBe('string');
          expect(value).not.toBe('');
        }
      }
    });
  });

  describe('calculateBMIWithStatus', () => {
    it('computes BMI from kg and metres', () => {
      // 70 / 1.75^2 = 22.857 -> rounded to 1 dp
      expect(calculateBMIWithStatus(70, 1.75, 'kg', 'm')).toEqual({
        bmi: 22.9,
        statusKey: 'profile.bmiStatus.normal',
      });
    });

    it('accepts height in cm', () => {
      expect(calculateBMIWithStatus(70, 175, 'kg', 'cm').bmi).toBe(22.9);
    });

    it('accepts weight in lbs and height in inches', () => {
      // 154.324 lb / 68.8976 in is the same person as 70 kg / 175 cm.
      expect(calculateBMIWithStatus(154.324, 68.8976, 'lbs', 'in').bmi).toBe(22.9);
    });

    it('is unit-independent: the same body gives the same BMI in all four combinations', () => {
      const metricM = calculateBMIWithStatus(82, 1.8, 'kg', 'm');
      const metricCm = calculateBMIWithStatus(82, 180, 'kg', 'cm');
      const imperial = calculateBMIWithStatus(180.779, 70.8661, 'lbs', 'in');
      const mixed = calculateBMIWithStatus(180.779, 180, 'lbs', 'cm');

      expect(metricCm.bmi).toBe(metricM.bmi);
      expect(imperial.bmi).toBe(metricM.bmi);
      expect(mixed.bmi).toBe(metricM.bmi);
      expect(imperial.statusKey).toBe(metricM.statusKey);
    });

    it('rounds BMI to one decimal place', () => {
      const { bmi } = calculateBMIWithStatus(70, 1.75, 'kg', 'm');
      expect(bmi).toBe(Math.round(bmi * 10) / 10);
      expect(bmi).not.toBe(70 / 1.75 ** 2);
    });

    it('derives the status key from the rounded BMI it returns', () => {
      const heavy = calculateBMIWithStatus(110, 1.75, 'kg', 'm');
      expect(heavy.bmi).toBeGreaterThanOrEqual(30);
      expect(heavy.statusKey).toBe('profile.bmiStatus.obese');
      expect(heavy.statusKey).toBe(getBMIStatusKey(heavy.bmi));
    });

    it('degrades to BMI 0 (underweight) when height is missing rather than dividing by zero', () => {
      const result = calculateBMIWithStatus(70, 0, 'kg', 'cm');
      expect(result.bmi).toBe(0);
      expect(Number.isFinite(result.bmi)).toBe(true);
      expect(result.statusKey).toBe('profile.bmiStatus.underweight');
    });
  });
});
