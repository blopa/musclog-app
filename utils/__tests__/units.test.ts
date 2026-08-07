import fs from 'fs';
import path from 'path';

import * as Localization from 'expo-localization';

import type { Units } from '@/constants/settings';

import { getMassUnitLabel, metricDisplayUnit } from '@/utils/unitConversion';
import {
  getDefaultUnits,
  getHeightUnit,
  getMassUnit,
  getMassUnitI18nKey,
  getWeightUnit,
  getWeightUnitI18nKey,
} from '@/utils/units';

const LOCALES_DIR = path.join(__dirname, '..', '..', 'lang', 'locales');

/** Resolve an i18n key of the form `<namespace>.<key>` against a shipped locale bundle. */
function resolveI18nKey(locale: string, key: string): unknown {
  const [namespace] = key.split('.');
  const file = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  return key.split('.').reduce<unknown>((acc, segment) => {
    return acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined;
  }, bundle);
}

function shippedLocales(): string[] {
  return fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const BOTH_UNITS: Units[] = ['metric', 'imperial'];

describe('units', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDefaultUnits', () => {
    it('defaults a US device to imperial', () => {
      jest
        .spyOn(Localization, 'getLocales')
        .mockReturnValue([{ languageTag: 'en-US', regionCode: 'US' }] as never);
      expect(getDefaultUnits()).toBe('imperial');
    });

    it('defaults every non-US region to metric', () => {
      for (const regionCode of ['GB', 'NL', 'BR', 'RU', 'LR', 'MM']) {
        jest
          .spyOn(Localization, 'getLocales')
          .mockReturnValue([{ languageTag: 'xx', regionCode }] as never);
        expect(getDefaultUnits()).toBe('metric');
      }
    });

    it('falls back to metric when the device reports no locale at all', () => {
      jest.spyOn(Localization, 'getLocales').mockReturnValue([]);
      expect(getDefaultUnits()).toBe('metric');
    });

    it('falls back to metric when the locale carries no region code', () => {
      jest
        .spyOn(Localization, 'getLocales')
        .mockReturnValue([{ languageTag: 'en', regionCode: null }] as never);
      expect(getDefaultUnits()).toBe('metric');
    });

    it('only considers the primary (first) locale', () => {
      jest.spyOn(Localization, 'getLocales').mockReturnValue([
        { languageTag: 'nl-NL', regionCode: 'NL' },
        { languageTag: 'en-US', regionCode: 'US' },
      ] as never);
      expect(getDefaultUnits()).toBe('metric');
    });
  });

  describe('unit labels', () => {
    it('maps imperial to lbs/in/oz and metric to kg/cm/g', () => {
      expect(getWeightUnit('imperial')).toBe('lbs');
      expect(getWeightUnit('metric')).toBe('kg');
      expect(getHeightUnit('imperial')).toBe('in');
      expect(getHeightUnit('metric')).toBe('cm');
      expect(getMassUnit('imperial')).toBe('oz');
      expect(getMassUnit('metric')).toBe('g');
    });

    it.each(BOTH_UNITS)(
      'agrees with unitConversion.metricDisplayUnit / getMassUnitLabel in %s',
      (units) => {
        // AGENTS.md: never hardcode "kg"/"lbs"/"g"/"oz" in the UI. Two helper families
        // produce these labels — they must not drift apart.
        expect(getWeightUnit(units)).toBe(metricDisplayUnit('weight', units));
        expect(getHeightUnit(units)).toBe(metricDisplayUnit('height', units));
        expect(getMassUnit(units)).toBe(getMassUnitLabel(units));
      }
    );
  });

  describe('i18n key helpers', () => {
    it('maps imperial to the lb/oz keys and metric to the kg/g keys', () => {
      expect(getWeightUnitI18nKey('imperial')).toBe('workoutSession.lb');
      expect(getWeightUnitI18nKey('metric')).toBe('workoutSession.kg');
      expect(getMassUnitI18nKey('imperial')).toBe('food.unitOz');
      expect(getMassUnitI18nKey('metric')).toBe('food.unitGrams');
    });

    it('returns keys that resolve to a non-empty string in every shipped locale', () => {
      // A renamed/removed translation key would otherwise surface only as a raw key
      // string in the workout and food UIs.
      const locales = shippedLocales();
      expect(locales.length).toBeGreaterThan(0);

      for (const locale of locales) {
        for (const units of BOTH_UNITS) {
          for (const key of [getWeightUnitI18nKey(units), getMassUnitI18nKey(units)]) {
            const value = resolveI18nKey(locale, key);
            expect(typeof value).toBe('string');
            expect(value).not.toBe('');
          }
        }
      }
    });
  });
});
