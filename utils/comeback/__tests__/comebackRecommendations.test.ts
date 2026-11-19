import { comebackRecommendations } from '@/utils/comeback/comebackRecommendations';

const ids = (tips: { id: string }[]) => tips.map((t) => t.id);

const noAi = {
  isAiConfigured: false,
  isAiMealPhotoEnabled: false,
  aiProvider: null,
  hasCamera: true,
} as const;
const strongAi = {
  isAiConfigured: true,
  isAiMealPhotoEnabled: true,
  aiProvider: 'gemini',
  hasCamera: true,
} as const;
const basicAi = {
  isAiConfigured: true,
  isAiMealPhotoEnabled: false,
  aiProvider: 'on-device',
  hasCamera: true,
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

  describe('without a camera', () => {
    const CAMERA_ACTIONS = ['smartCameraMeal', 'barcodeScan'];
    const noCamera = { ...strongAi, hasCamera: false } as const;
    const noCameraNoAi = { ...noAi, hasCamera: false } as const;

    it('never offers a tip whose action opens the camera, for any eating answer', () => {
      const answers = [
        { eating: 'out' },
        { eating: 'cook' },
        { eating: 'mix' },
        { eating: 'varies' },
        {},
      ] as const;

      for (const answer of answers) {
        for (const ctx of [noCamera, noCameraNoAi, { ...basicAi, hasCamera: false }]) {
          const tips = comebackRecommendations(answer, ctx);

          for (const tip of tips) {
            expect(CAMERA_ACTIONS).not.toContain(tip.action);
          }
        }
      }
    });

    it('drops the photo and barcode tips but keeps the chat-based AI tip', () => {
      expect(ids(comebackRecommendations({ eating: 'out' }, noCamera))).toEqual([
        'describeMeal',
        'proteinFirstDish',
      ]);
    });

    it('leaves a cooking household with saved meals only', () => {
      expect(ids(comebackRecommendations({ eating: 'cook' }, noCamera))).toEqual(['savedMeals']);
    });

    it('keeps every branch non-empty', () => {
      for (const eating of ['out', 'cook', 'mix', 'varies', undefined] as const) {
        expect(comebackRecommendations({ eating }, noCameraNoAi).length).toBeGreaterThan(0);
        expect(comebackRecommendations({ eating }, noCamera).length).toBeGreaterThan(0);
      }
    });

    it('does not change the result when a camera is present', () => {
      expect(ids(comebackRecommendations({ eating: 'cook' }, strongAi))).toEqual([
        'savedMeals',
        'scanBarcode',
      ]);
    });
  });
});
