import { act, renderHook } from '@testing-library/react';

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

test('submits all photos and hands the first photo and named meal to logging', async () => {
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
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const hook = renderHook(() =>
    useMealPhotoEstimate({
      abortRef: { current: null },
      setProcessing: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
      onSuccess,
    })
  );
  await act(async () =>
    hook.result.current({ photos: ['first', 'second'], name: ' Dinner ', onFailure })
  );
  expect(estimateNutritionFromPhoto).toHaveBeenCalledWith(
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ['base64:first', 'base64:second'],
    undefined,
    expect.any(Function)
  );
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Dinner', calories: 100 }),
    expect.any(Array),
    'first'
  );
  expect(onFailure).not.toHaveBeenCalled();
});

test('reopens the detailed draft on failure or cancellation', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(estimateNutritionFromPhoto).mockResolvedValue(null);
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const setError = jest.fn();
  const hook = renderHook(() =>
    useMealPhotoEstimate({
      abortRef: { current: null },
      setProcessing: jest.fn(),
      setProgress: jest.fn(),
      setError,
      onSuccess,
    })
  );
  await act(async () => hook.result.current({ photos: ['first'], onFailure }));
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(setError).toHaveBeenLastCalledWith('food.aiCamera.aiAnalysisFailed');
  expect(onSuccess).not.toHaveBeenCalled();
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
  const abortRef: { current: AbortController | null } = { current: null };
  const onSuccess = jest.fn();
  const onFailure = jest.fn();
  const hook = renderHook(() =>
    useMealPhotoEstimate({
      abortRef,
      setProcessing: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
      onSuccess,
    })
  );
  await act(async () => {
    const pending = hook.result.current({ photos: ['first'], onFailure });
    await Promise.resolve();
    await Promise.resolve();
    abortRef.current?.abort();
    finishRequest(null as never);
    await pending;
  });
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('reports a failure it did not expect, with the step it happened in, and reopens the draft', async () => {
  jest.mocked(AiService.getAiConfig).mockResolvedValue({} as never);
  jest.mocked(readFileAsStringAsync).mockResolvedValue('base64');
  const failure = new Error('disk full');
  jest.mocked(estimateNutritionFromPhoto).mockRejectedValue(failure);
  const onFailure = jest.fn();
  const setError = jest.fn();
  const hook = renderHook(() =>
    useMealPhotoEstimate({
      abortRef: { current: null },
      setProcessing: jest.fn(),
      setProgress: jest.fn(),
      setError,
      onSuccess: jest.fn(),
    })
  );

  await act(async () => {
    await hook.result.current({ photos: ['first'], onFailure });
  });

  expect(reportAiError).toHaveBeenCalledWith(failure, 'SmartCamera.aiMealPhotos');
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(setError).toHaveBeenLastCalledWith('food.aiCamera.aiAnalysisFailed');
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
  const onSuccess = jest.fn();
  const hook = renderHook(() =>
    useMealPhotoEstimate({
      abortRef: { current: null },
      setProcessing: jest.fn(),
      setProgress: jest.fn(),
      setError: jest.fn(),
      onSuccess,
    })
  );
  await act(async () => hook.result.current({ photos: ['only'] }));

  // 20 net + 5 fiber for the estimated bar, 28 (already total) for the matched rice.
  expect(onSuccess).toHaveBeenCalledWith(
    expect.objectContaining({ carbs: 53 }),
    expect.any(Array),
    'only'
  );
});
