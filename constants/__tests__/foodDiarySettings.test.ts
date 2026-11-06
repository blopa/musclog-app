import { SETTINGS } from '../settingDefinitions';
import { FOOD_DIARY_GROUPING_OPTIONS, parseFoodDiaryGrouping } from '../settings';

describe('food diary settings', () => {
  it("defaults to today's expanded, category-grouped layout", () => {
    expect(SETTINGS.foodDiaryCompact.defaultValue).toBe(false);
    expect(SETTINGS.foodDiaryGrouping.defaultValue).toBe('categories');
  });

  it('parses every offered grouping and falls back to categories otherwise', () => {
    for (const option of FOOD_DIARY_GROUPING_OPTIONS) {
      expect(parseFoodDiaryGrouping(option)).toBe(option);
    }

    expect(parseFoodDiaryGrouping('hourly')).toBe('categories');
    expect(parseFoodDiaryGrouping(null)).toBe('categories');
    expect(parseFoodDiaryGrouping(undefined)).toBe('categories');
  });

  it('round-trips the compact flag through its definition', () => {
    const def = SETTINGS.foodDiaryCompact;
    expect(def.parse(def.serialize(true))).toBe(true);
    expect(def.parse(def.serialize(false))).toBe(false);
  });
});

describe('animated Loggy setting', () => {
  it('is on by default and round-trips', () => {
    const def = SETTINGS.animatedLoggy;
    expect(def.defaultValue).toBe(true);
    expect(def.parse(def.serialize(false))).toBe(false);
    expect(def.parse(def.serialize(true))).toBe(true);
  });
});
