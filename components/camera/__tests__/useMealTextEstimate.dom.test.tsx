/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { useMealTextEstimate } from '@/components/camera/useMealTextEstimate';
import { trackMealFromVoice } from '@/utils/coachMealEstimate';

const mockTrackMealFromVoice = jest.fn();
jest.mock('@/utils/coachMealEstimate', () => ({
  trackMealFromVoice: (...args: unknown[]) => mockTrackMealFromVoice(...args),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const INGREDIENT = {
  name: 'oats',
  kcal: 300,
  carbs: 50,
  fat: 5,
  protein: 10,
  grams: 80,
};

type RunParams = {
  timerName: string;
  logLabel: string;
  onError?: (message: string) => void;
  onFinish?: (outcome: string) => void;
  task: (ctx: { signal: AbortSignal; config: Record<string, unknown> }) => Promise<string | null>;
};

/** Runs the task the way the camera's run does: its returned message is the error shown. */
function makeAi() {
  const run = jest.fn(async (params: RunParams) => {
    const signal = new AbortController().signal;
    const message = await params.task({ signal, config: { provider: 'gateway' } });
    if (message) {
      params.onError?.(message);
    }
    params.onFinish?.('done');
  });

  return { run, setProgress: jest.fn(), abandon: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMealTextEstimate', () => {
  it('estimates the spoken meal with the debug dump redacted and builds the review', async () => {
    mockTrackMealFromVoice.mockResolvedValue({
      meals: [{ mealType: 'breakfast', mealName: 'Porridge', ingredients: [INGREDIENT] }],
    });
    const ai = makeAi();
    const onEstimate = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useMealTextEstimate(ai as never));

    await result.current({ transcript: 'oats with milk', onEstimate, onError });

    expect(mockTrackMealFromVoice).toHaveBeenCalledTimes(1);
    expect(mockTrackMealFromVoice).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gateway', redactDump: true }),
      'oats with milk',
      expect.any(Function)
    );
    expect(onError).not.toHaveBeenCalled();
    expect(onEstimate).toHaveBeenCalledTimes(1);
    const review = onEstimate.mock.calls[0][0];
    expect(review.ingredients).toEqual([INGREDIENT]);
    expect(review.meal.name).toBe('Porridge');
    expect(review.meal.calories).toBe(300);
    expect(review.meal.grams).toBe(80);
  });

  it('returns the error key and builds no review when the estimate holds no ingredient', async () => {
    mockTrackMealFromVoice.mockResolvedValue({ meals: [] });
    const ai = makeAi();
    const onEstimate = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => useMealTextEstimate(ai as never));

    await result.current({ transcript: 'nothing', onEstimate, onError });

    expect(onEstimate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('food.aiCamera.aiAnalysisFailed');
  });

  it('reports a failed or cancelled estimate through onFailure', async () => {
    mockTrackMealFromVoice.mockRejectedValue(new Error('boom'));
    const ai = makeAi();
    ai.run.mockImplementation(async (params: RunParams) => {
      const signal = new AbortController().signal;
      try {
        await params.task({ signal, config: {} });
        params.onFinish?.('done');
      } catch {
        params.onFinish?.('error');
      }
    });
    const onFailure = jest.fn();
    const onEstimate = jest.fn();
    const { result } = renderHook(() => useMealTextEstimate(ai as never));

    await result.current({ transcript: 'x', onEstimate, onError: jest.fn(), onFailure });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onEstimate).not.toHaveBeenCalled();
  });
});
