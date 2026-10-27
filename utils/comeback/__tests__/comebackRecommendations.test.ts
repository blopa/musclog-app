import { comebackRecommendations } from '@/utils/comeback/comebackRecommendations';

const ids = (tips: { id: string }[]) => tips.map((t) => t.id);

const noAi = { isAiConfigured: false, isAiMealPhotoEnabled: false, aiProvider: null } as const;
const strongAi = {
  isAiConfigured: true,
  isAiMealPhotoEnabled: true,
  aiProvider: 'gemini',
} as const;
const basicAi = {
  isAiConfigured: true,
  isAiMealPhotoEnabled: false,
  aiProvider: 'on-device',
} as const;

describe('comebackRecommendations', () => {
  it('suggests photo and description logging for people who mostly eat out', () => {
    expect(ids(comebackRecommendations({ eating: 'out' }, strongAi))).toEqual([
      'snapMeal',
      'describeMeal',
      'proteinFirstDish',
    ]);
  });

  it('points at AI setup, never at a dead-end button, when no provider is configured', () => {
    const tips = comebackRecommendations({ eating: 'out' }, noAi);

    expect(ids(tips)).toEqual(['setupAi', 'proteinFirstDish']);
    expect(tips[0].action).toBe('aiSettings');
  });

  it('warns that a basic provider estimates restaurant meals less well, and skips the photo tip', () => {
    expect(ids(comebackRecommendations({ eating: 'out' }, basicAi))).toEqual([
      'describeMealBasic',
      'proteinFirstDish',
    ]);
  });

  it('offers saved meals and barcodes to people who cook, with no AI involved', () => {
    expect(ids(comebackRecommendations({ eating: 'cook' }, noAi))).toEqual([
      'savedMeals',
      'scanBarcode',
    ]);
  });

  it('adds AI to a mixed diet only when it is set up', () => {
    expect(ids(comebackRecommendations({ eating: 'mix' }, noAi))).toEqual([
      'sameAsYesterday',
      'savedMeals',
    ]);
    expect(ids(comebackRecommendations({ eating: 'mix' }, strongAi))).toEqual([
      'sameAsYesterday',
      'savedMeals',
      'snapMeal',
      'describeMeal',
    ]);
  });

  it('suggests copying a previous day when eating varies', () => {
    expect(ids(comebackRecommendations({ eating: 'varies' }, noAi))[0]).toBe('copyPreviousDay');
  });

  it('gives every tip a whole translation key and an action label when it has an action', () => {
    const tips = comebackRecommendations({ eating: 'out' }, strongAi);

    for (const tip of tips) {
      expect(tip.titleKey).toBe(`comeback.tips.${tip.id}.title`);
      expect(tip.descriptionKey).toBe(`comeback.tips.${tip.id}.body`);
      expect(tip.action === 'none' ? tip.actionLabelKey === undefined : !!tip.actionLabelKey).toBe(
        true
      );
    }
  });

  it('still returns something when the eating question was skipped', () => {
    expect(comebackRecommendations({}, noAi).length).toBeGreaterThan(0);
  });
});
