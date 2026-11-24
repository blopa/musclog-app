import fs from 'node:fs';
import path from 'node:path';

import { MEAL_ESTIMATE_PROGRESS_KEYS, mealEstimateProgressLine } from '../mealEstimateProgress';

const FOOD_JSON = path.join(__dirname, '../../lang/locales/en-us/food.json');

describe('mealEstimateProgressLine', () => {
  it('reports reading with the text key and no options', () => {
    expect(mealEstimateProgressLine({ step: 'reading', photo: false })).toEqual({
      key: 'food.aiProgress.reading',
    });
  });

  it('reports reading a photo with its own key and no options', () => {
    expect(mealEstimateProgressLine({ step: 'reading', photo: true })).toEqual({
      key: 'food.aiProgress.readingPhoto',
    });
  });

  it('reports the first look at a description with the observing key and no options', () => {
    expect(mealEstimateProgressLine({ step: 'observing', photo: false })).toEqual({
      key: 'food.aiProgress.observing',
    });
  });

  it('reports the first look at a photo with its own observing key and no options', () => {
    expect(mealEstimateProgressLine({ step: 'observing', photo: true })).toEqual({
      key: 'food.aiProgress.observingPhoto',
    });
  });

  it('uses the plain estimating key when nothing was matched', () => {
    expect(mealEstimateProgressLine({ step: 'estimating', count: 3, matched: 0 })).toEqual({
      key: 'food.aiProgress.estimating',
      options: { count: 3 },
    });
  });

  it('uses the matched key when some ingredients were found in the foods', () => {
    expect(mealEstimateProgressLine({ step: 'estimating', count: 3, matched: 2 })).toEqual({
      key: 'food.aiProgress.estimatingWithMatches',
      options: { count: 3, matched: 2 },
    });
  });

  it('reports rechecking with its count', () => {
    expect(mealEstimateProgressLine({ step: 'rechecking', count: 2 })).toEqual({
      key: 'food.aiProgress.rechecking',
      options: { count: 2 },
    });
  });
});

describe('review and comparison steps', () => {
  it('reports reviewing without options', () => {
    expect(mealEstimateProgressLine({ step: 'reviewing' })).toEqual({
      key: 'food.aiProgress.reviewing',
    });
  });

  it('reports comparing with its count', () => {
    expect(mealEstimateProgressLine({ step: 'comparing', count: 3 })).toEqual({
      key: 'food.aiProgress.comparing',
      options: { count: 3 },
    });
  });
});

describe('MEAL_ESTIMATE_PROGRESS_KEYS', () => {
  const values = Object.values(MEAL_ESTIMATE_PROGRESS_KEYS);

  it('puts every key under food.aiProgress.', () => {
    for (const value of values) {
      expect(value.startsWith('food.aiProgress.')).toBe(true);
    }
  });

  it('has unique values', () => {
    expect(new Set(values).size).toBe(values.length);
  });

  it('exists in the English food locale', () => {
    const root = JSON.parse(fs.readFileSync(FOOD_JSON, 'utf8'));
    const PLURAL = new Set(['estimating', 'estimatingWithMatches', 'rechecking', 'comparing']);
    for (const [name, value] of Object.entries(MEAL_ESTIMATE_PROGRESS_KEYS)) {
      const segments = value.split('.');
      const leaf = segments[segments.length - 1];
      const aiProgress = segments
        .slice(0, -1)
        .reduce<Record<string, unknown>>(
          (node, key) => node?.[key] as Record<string, unknown>,
          root
        );
      expect(aiProgress).toBeDefined();
      if (PLURAL.has(name)) {
        expect(typeof aiProgress[`${leaf}_one`]).toBe('string');
        expect(typeof aiProgress[`${leaf}_other`]).toBe('string');
      } else {
        expect(typeof aiProgress[leaf]).toBe('string');
      }
    }
  });
});
