import type { TFunction } from 'i18next';

import { NutritionService } from '@/database/services/NutritionService';
import {
  runMealPlanIntention,
  runTrackMealIntention,
  runWorkoutPlanIntention,
} from '@/hooks/chatIntentionRunners';
import { resolveMealPlanMacroTargets } from '@/services/mealPlanTargets';
import type { CoachAIConfig, ChatHistoryEntry } from '@/utils/coachAI';
import { generateMealPlan, generateWorkoutPlan } from '@/utils/coachAI';
import { trackMeal } from '@/utils/coachMealEstimate';
import { saveBase64ImageToFile } from '@/utils/file';
import { handleError } from '@/utils/handleError';
import {
  MEAL_ESTIMATE_PROGRESS_KEYS,
  mealEstimateProgressLine,
} from '@/utils/mealEstimateProgress';
import { processMealPlanResponse } from '@/utils/nutritionAI';
import { processWorkoutPlanResponse } from '@/utils/workoutAI';

jest.mock('@/utils/coachAI', () => ({
  generateMealPlan: jest.fn(),
  generateWorkoutPlan: jest.fn(),
}));

jest.mock('@/utils/coachMealEstimate', () => ({ trackMeal: jest.fn() }));

jest.mock('@/utils/nutritionAI', () => ({ processMealPlanResponse: jest.fn() }));

jest.mock('@/utils/workoutAI', () => ({ processWorkoutPlanResponse: jest.fn() }));

jest.mock('@/utils/file', () => ({ saveBase64ImageToFile: jest.fn() }));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { normalizeAiMealIngredients: jest.fn() },
}));

jest.mock('@/services/mealPlanTargets', () => ({ resolveMealPlanMacroTargets: jest.fn() }));

const mockGenerateMealPlan = generateMealPlan as jest.Mock;
const mockGenerateWorkoutPlan = generateWorkoutPlan as jest.Mock;
const mockTrackMeal = trackMeal as jest.Mock;
const mockProcessMealPlan = processMealPlanResponse as jest.Mock;
const mockProcessWorkoutPlan = processWorkoutPlanResponse as jest.Mock;
const mockSaveImage = saveBase64ImageToFile as jest.Mock;
const mockNormalize = NutritionService.normalizeAiMealIngredients as jest.Mock;
const mockResolveTargets = resolveMealPlanMacroTargets as jest.Mock;
const mockHandleError = handleError as jest.Mock;

const aiConfig = { provider: 'openai', apiKey: 'key' } as unknown as CoachAIConfig;
const conversation: ChatHistoryEntry[] = [{ role: 'user', content: 'plan my meals' } as never];

/** Echoes the key and options so assertions can read the interpolated values. */
const t = ((key: string, options?: unknown) =>
  `${key}:${JSON.stringify(options)}`) as unknown as TFunction;

const ingredient = (name: string, kcal: number) => ({
  name,
  kcal,
  carbs: 10,
  fat: 2,
  protein: 5,
  grams: 100,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('runMealPlanIntention', () => {
  it('fails without processing when generation returns nothing', async () => {
    mockGenerateMealPlan.mockResolvedValue(null);

    const result = await runMealPlanIntention(aiConfig, conversation, 'nutrition', t);

    expect(result).toEqual({ ok: false, failure: 'mealPlan' });
    expect(mockProcessMealPlan).not.toHaveBeenCalled();
  });

  it('returns the reply and payload for a generated plan', async () => {
    const plan = { meals: [{ name: 'Oats' }] };
    const targets = { calories: 2400, protein: 160, carbs: 250, fat: 70, fiber: 34 };
    mockGenerateMealPlan.mockResolvedValue(plan);
    mockResolveTargets.mockResolvedValue(targets);
    mockProcessMealPlan.mockResolvedValue({
      mealIds: ['m1', 'm2'],
      description: 'high protein',
      meals: [{ id: 'm1', name: 'Oats' }],
    });

    const result = await runMealPlanIntention(aiConfig, conversation, 'exercise', t);

    expect(mockGenerateMealPlan).toHaveBeenCalledWith(aiConfig, conversation, targets, 'exercise');
    expect(mockProcessMealPlan).toHaveBeenCalledWith(plan);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(result.reply.msg4User).toBe(
      `coach.success.mealPlanGenerated:${JSON.stringify({ count: 2, description: 'high protein' })}`
    );
    expect(result.reply.sumMsg).toBe('Generated meal plan');
    expect(JSON.parse(result.payloadJson)).toEqual({
      type: 'mealPlan',
      mealIds: ['m1', 'm2'],
      count: 2,
      meals: [{ id: 'm1', name: 'Oats' }],
    });
  });
});

describe('runWorkoutPlanIntention', () => {
  it('fails without processing when generation returns nothing', async () => {
    mockGenerateWorkoutPlan.mockResolvedValue(null);

    const result = await runWorkoutPlanIntention(aiConfig, conversation, 'exercise', t);

    expect(result).toEqual({ ok: false, failure: 'workoutPlan' });
    expect(mockProcessWorkoutPlan).not.toHaveBeenCalled();
  });

  it('returns the payload for a generated plan', async () => {
    const plan = { workouts: [] };
    mockGenerateWorkoutPlan.mockResolvedValue(plan);
    mockProcessWorkoutPlan.mockResolvedValue({
      templateIds: ['t1', 't2', 't3'],
      description: 'three days',
      planId: 'p1',
      planName: 'Push Pull Legs',
    });

    const result = await runWorkoutPlanIntention(aiConfig, conversation, 'exercise', t);

    expect(mockProcessWorkoutPlan).toHaveBeenCalledWith(plan);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(result.reply.sumMsg).toBe('Generated workout plan');
    expect(JSON.parse(result.payloadJson)).toEqual({
      type: 'workoutPlan',
      templateIds: ['t1', 't2', 't3'],
      count: 3,
      planId: 'p1',
      planName: 'Push Pull Legs',
    });
  });

  it('drops a null planId so the key is absent from the payload', async () => {
    mockGenerateWorkoutPlan.mockResolvedValue({});
    mockProcessWorkoutPlan.mockResolvedValue({
      templateIds: ['t1'],
      description: 'one day',
      planId: null,
      planName: 'Full Body',
    });

    const result = await runWorkoutPlanIntention(aiConfig, conversation, 'general', t);

    if (!result.ok) {
      throw new Error('expected success');
    }
    const payload = JSON.parse(result.payloadJson);
    expect(payload).not.toHaveProperty('planId');
    expect(payload).toEqual({
      type: 'workoutPlan',
      templateIds: ['t1'],
      count: 1,
      planName: 'Full Body',
    });
  });
});

describe('runTrackMealIntention', () => {
  const noProgress = jest.fn();
  const formatEnergy = (kcal: number) => `${kcal} kcal!`;

  it('fails when trackMeal returns nothing', async () => {
    mockTrackMeal.mockResolvedValue(null);

    const result = await runTrackMealIntention(
      aiConfig,
      'eggs',
      undefined,
      noProgress,
      formatEnergy,
      t
    );

    expect(result).toEqual({ ok: false, failure: 'trackMeal' });
  });

  it('fails when trackMeal returns no meals', async () => {
    mockTrackMeal.mockResolvedValue({ meals: [] });

    const result = await runTrackMealIntention(
      aiConfig,
      'eggs',
      undefined,
      noProgress,
      formatEnergy,
      t
    );

    expect(result).toEqual({ ok: false, failure: 'trackMeal' });
  });

  it('totals the normalized kcal, not the model estimate, and marks meals untracked', async () => {
    mockTrackMeal.mockResolvedValue({
      meals: [
        { mealType: 'breakfast', ingredients: [ingredient('Oats', 100)] },
        { mealType: 'lunch', ingredients: [ingredient('Rice', 200.4)] },
      ],
    });
    // The stored food values replace the estimate: here every kcal is doubled.
    mockNormalize.mockImplementation(async (items: ReturnType<typeof ingredient>[]) =>
      items.map((item) => ({ ...item, kcal: item.kcal * 2 }))
    );

    const result = await runTrackMealIntention(
      aiConfig,
      'oats and rice',
      undefined,
      noProgress,
      formatEnergy,
      t
    );

    expect(mockNormalize).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected success');
    }
    // (100 + 200.4) * 2 = 600.8, rounded to 601.
    expect(result.reply.sumMsg).toBe('Analyzed 2 meal(s) (601 kcal total)');
    expect(result.reply.msg4User).toBe(
      `coach.success.trackMealReady:${JSON.stringify({
        count: 2,
        meals: 'breakfast, lunch',
        calories: '601 kcal!',
      })}`
    );
    const payload = JSON.parse(result.payloadJson);
    expect(payload.type).toBe('trackMeal');
    expect(payload.meals).toHaveLength(2);
    expect(payload.meals[0].was_tracked).toBe(false);
    expect(payload.meals[0].ingredients[0].kcal).toBe(200);
    expect(payload).not.toHaveProperty('mealImageUri');
    expect(mockSaveImage).not.toHaveBeenCalled();
  });

  it('includes mealImageUri when a photo was given and saved', async () => {
    mockTrackMeal.mockResolvedValue({
      meals: [{ mealType: 'dinner', ingredients: [ingredient('Soup', 150)] }],
    });
    mockNormalize.mockImplementation(async (items: unknown[]) => items);
    mockSaveImage.mockResolvedValue('file:///cache/meal.jpg');

    const result = await runTrackMealIntention(aiConfig, '', 'BASE64', noProgress, formatEnergy, t);

    expect(mockSaveImage).toHaveBeenCalledWith('BASE64');
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(JSON.parse(result.payloadJson).mealImageUri).toBe('file:///cache/meal.jpg');
  });

  it('omits mealImageUri when saving the photo fails', async () => {
    mockTrackMeal.mockResolvedValue({
      meals: [{ mealType: 'dinner', ingredients: [ingredient('Soup', 150)] }],
    });
    mockNormalize.mockImplementation(async (items: unknown[]) => items);
    mockSaveImage.mockRejectedValue(new Error('disk full'));

    const result = await runTrackMealIntention(aiConfig, '', 'BASE64', noProgress, formatEnergy, t);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected success');
    }
    expect(JSON.parse(result.payloadJson)).not.toHaveProperty('mealImageUri');
    // The meal is still offered, but the lost photo is not silent: it reaches Sentry once.
    expect(mockHandleError).toHaveBeenCalledTimes(1);
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      'chatIntentionRunners.saveMealPhoto',
      { showSnackbar: false }
    );
  });

  it('forwards each trackMeal progress event as the matching line', async () => {
    const onProgress = jest.fn();
    mockTrackMeal.mockImplementation(
      async (_config: unknown, _text: unknown, _image: unknown, listener: (p: unknown) => void) => {
        listener({ step: 'reading', photo: false });
        return null;
      }
    );

    await runTrackMealIntention(aiConfig, 'eggs', undefined, onProgress, formatEnergy, t);

    const expected = mealEstimateProgressLine({ step: 'reading', photo: false });
    expect(expected.key).toBe(MEAL_ESTIMATE_PROGRESS_KEYS.reading);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(expected);
  });
});
