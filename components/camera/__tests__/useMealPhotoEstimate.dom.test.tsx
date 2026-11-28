import { act, renderHook } from '@testing-library/react';

import { useCameraAiProcessing } from '../useCameraAiProcessing';
import { useMealPhotoEstimate } from '../useMealPhotoEstimate';
import { AiService } from '@/services/AiService';
import { reportAiError } from '@/utils/coachAI';
import { estimateNutritionFromPhoto } from '@/utils/coachMealEstimate';
import { readFileAsStringAsync } from '@/utils/file';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useEnergyUnit', () => ({
  useEnergyUnit: () => ({ formatEnergyWithUnit: String }),
}));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatRoundedDecimal: String }),
}));
jest.mock('@/services/AiService', () => ({
  AiService: { getAiConfig: jest.fn() },
}));
jest.mock('@/utils/coachAI', () => ({ reportAiError: jest.fn() }));
jest.mock('@/utils/coachMealEstimate', () => ({ estimateNutritionFromPhoto: jest.fn() }));
jest.mock('@/utils/file', () => ({ readFileAsStringAsync: jest.fn() }));
jest.mock('@/utils/snackbarService', () => ({ showSnackbar: jest.fn() }));

/** The estimate over the real camera request lifecycle, as the camera wires it. */
function renderEstimate() {
  return renderHook(() => {
    const ai = useCameraAiProcessing();

    return { ai, submit: useMealPhotoEstimate(ai) };
  });
}

const callbacks = () => ({ onEstimate: jest.fn(), onError: jest.fn(), onFailure: jest.fn() });

test('submits all photos and hands the first photo and named meal to review', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(readFileAsStringAsync).mockImplementation(async (uri) => `base64:${uri}`);
  jest.mocked(estimateNutritionFromPhoto).mockResolvedValue({
    meals: [
      {
        mealName: 'AI name',
        ingredients: [{ kcal: 100, protein: 10, carbs: 12, fat: 2, grams: 50 }],
      },
    ],
  } as never);
  const on = callbacks();
  const hook = renderEstimate();
  await act(async () =>
    hook.result.current.submit({ photos: ['first', 'second'], name: ' Dinner ', ...on })
  );
  expect(estimateNutritionFromPhoto).toHaveBeenCalledWith(
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ['base64:first', 'base64:second'],
    undefined,
    expect.any(Function)
  );
  expect(on.onEstimate).toHaveBeenCalledWith({
    meal: expect.objectContaining({ name: 'Dinner', calories: 100 }),
    ingredients: expect.any(Array),
    photoUri: 'first',
  });
  expect(on.onFailure).not.toHaveBeenCalled();
  expect(hook.result.current.ai.processing).toBe(false);
});

test('reopens the detailed draft on a failed estimate and says why', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(estimateNutritionFromPhoto).mockResolvedValue(null);
  const on = callbacks();
  const hook = renderEstimate();
  await act(async () => hook.result.current.submit({ photos: ['first'], ...on }));
  expect(on.onFailure).toHaveBeenCalledTimes(1);
  expect(on.onError).toHaveBeenCalledWith('food.aiCamera.aiAnalysisFailed');
  expect(on.onEstimate).not.toHaveBeenCalled();
});

test('cancelling an estimate returns to the preserved draft without handing off a meal', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  let finishRequest: (value: never) => void = () => {};
  jest.mocked(estimateNutritionFromPhoto).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRequest = resolve;
      })
  );
  const on = callbacks();
  const hook = renderEstimate();
  await act(async () => {
    const pending = hook.result.current.submit({ photos: ['first'], ...on });
    await Promise.resolve();
    await Promise.resolve();
    hook.result.current.ai.cancel();
    finishRequest(null as never);
    await pending;
  });
  expect(on.onFailure).toHaveBeenCalledTimes(1);
  expect(on.onError).not.toHaveBeenCalled();
  expect(on.onEstimate).not.toHaveBeenCalled();
});

test('reports a failure it did not expect, with the step it happened in, and reopens the draft', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(readFileAsStringAsync).mockResolvedValue('base64');
  const failure = new Error('disk full');
  jest.mocked(estimateNutritionFromPhoto).mockRejectedValue(failure);
  const on = callbacks();
  const hook = renderEstimate();

  await act(async () => {
    await hook.result.current.submit({ photos: ['first'], ...on });
  });

  expect(reportAiError).toHaveBeenCalledWith(failure, 'SmartCamera.aiMealPhotos');
  expect(on.onFailure).toHaveBeenCalledTimes(1);
  expect(on.onError).toHaveBeenLastCalledWith('food.aiCamera.aiAnalysisFailed');
});

test('totals carbs the way the diary will show them: estimated carbs are net, matched foods are not', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(readFileAsStringAsync).mockImplementation(async (uri) => `base64:${uri}`);
  jest.mocked(estimateNutritionFromPhoto).mockResolvedValue({
    meals: [
      {
        mealName: 'Plate',
        ingredients: [
          { name: 'Bar', kcal: 200, protein: 5, carbs: 20, fat: 8, fiber: 5, grams: 50 },
          {
            name: 'Rice',
            kcal: 130,
            protein: 2.7,
            carbs: 28,
            fat: 0.3,
            fiber: 0.4,
            grams: 100,
            foodId: 'food-rice',
          },
        ],
      },
    ],
  } as never);
  const on = callbacks();
  const hook = renderEstimate();
  await act(async () => hook.result.current.submit({ photos: ['only'], ...on }));

  // 20 net + 5 fiber for the estimated bar, 28 (already total) for the matched rice.
  expect(on.onEstimate).toHaveBeenCalledWith(
    expect.objectContaining({
      meal: expect.objectContaining({ carbs: 53 }),
      photoUri: 'only',
    })
  );
});
