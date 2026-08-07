/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { useFastingDay } from '@/hooks/useFastingDay';
import { handleError } from '@/utils/handleError';

jest.mock('@/database/repositories/FastedDayRepository', () => ({
  FastedDayRepository: {
    isFasted: jest.fn(),
    markFasted: jest.fn(),
    unmarkFasted: jest.fn(),
  },
}));

jest.mock('@/utils/handleError', () => ({
  handleError: jest.fn(),
}));

const mockIsFasted = FastedDayRepository.isFasted as jest.Mock;
const mockMarkFasted = FastedDayRepository.markFasted as jest.Mock;
const mockUnmarkFasted = FastedDayRepository.unmarkFasted as jest.Mock;
const mockHandleError = handleError as jest.Mock;

// All dates are built with the local-time constructor so the assertions hold in any timezone.
const YESTERDAY = new Date(2026, 5, 14, 13, 0);
const TODAY = new Date(2026, 5, 15, 8, 30);
const TOMORROW = new Date(2026, 5, 16, 9, 0);

const CLOCK_MORNING = new Date(2026, 5, 15, 9, 0).getTime();
/** One minute before FASTING_DAY_TODAY_MIN_HOUR (20:00). */
const CLOCK_1959 = new Date(2026, 5, 15, 19, 59).getTime();
const CLOCK_2000 = new Date(2026, 5, 15, 20, 0).getTime();

/** Lets the repository promise chain (`.then` → `.catch` → setState) settle. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const render = ({
  enabled = true,
  selectedDate = YESTERDAY,
  hasLoggedFoodOnSelectedDay = false,
}: {
  enabled?: boolean;
  hasLoggedFoodOnSelectedDay?: boolean;
  selectedDate?: Date;
} = {}) =>
  renderHook(
    (props: { enabled: boolean; hasLoggedFoodOnSelectedDay: boolean; selectedDate: Date }) =>
      useFastingDay(props),
    { initialProps: { enabled, hasLoggedFoodOnSelectedDay, selectedDate } }
  );

describe('useFastingDay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(CLOCK_MORNING);
    mockIsFasted.mockResolvedValue(false);
    mockMarkFasted.mockResolvedValue(undefined);
    mockUnmarkFasted.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never queries the fasted_days table while the feature setting is off', async () => {
    const { result } = render({ enabled: false, selectedDate: YESTERDAY });
    await flush();

    expect(mockIsFasted).not.toHaveBeenCalled();
    expect(result.current.showFastingMarkPrompt).toBe(false);
    expect(result.current.isFastedDayView).toBe(false);
  });

  it('offers the mark prompt on an empty past day', async () => {
    const { result } = render({ selectedDate: YESTERDAY });
    await flush();

    expect(mockIsFasted).toHaveBeenCalledWith(YESTERDAY);
    expect(result.current.showFastingMarkPrompt).toBe(true);
  });

  it('hides the prompt on a day that already has logged food', async () => {
    const { result } = render({ hasLoggedFoodOnSelectedDay: true, selectedDate: YESTERDAY });
    await flush();

    expect(result.current.showFastingMarkPrompt).toBe(false);
  });

  // FASTING_DAY_TODAY_MIN_HOUR = 20: a not-yet-eaten morning must not be prompted as a fast.
  it('does not offer the current day before 20:00 local', async () => {
    jest.setSystemTime(CLOCK_1959);

    const { result } = render({ selectedDate: TODAY });
    await flush();

    expect(result.current.showFastingMarkPrompt).toBe(false);
  });

  it('offers the current day from 20:00 local onwards', async () => {
    jest.setSystemTime(CLOCK_2000);

    const { result } = render({ selectedDate: TODAY });
    await flush();

    expect(result.current.showFastingMarkPrompt).toBe(true);
  });

  it('never offers a future day, even in the evening', async () => {
    jest.setSystemTime(CLOCK_2000);

    const { result } = render({ selectedDate: TOMORROW });
    await flush();

    expect(result.current.showFastingMarkPrompt).toBe(false);
  });

  it('shows the fasted-day view instead of the prompt once the day is flagged', async () => {
    mockIsFasted.mockResolvedValue(true);

    const { result } = render({ selectedDate: YESTERDAY });
    await flush();

    expect(result.current.isFastedDayView).toBe(true);
    expect(result.current.showFastingMarkPrompt).toBe(false);
  });

  it('persists the flag on confirm, swaps to the fasted view and closes the confirmation', async () => {
    const { result } = render({ selectedDate: YESTERDAY });
    await flush();

    act(() => result.current.openConfirm());
    expect(result.current.confirmVisible).toBe(true);

    await act(async () => {
      await result.current.markFastedDay();
    });

    expect(mockMarkFasted).toHaveBeenCalledWith(YESTERDAY);
    expect(result.current.isFastedDayView).toBe(true);
    expect(result.current.confirmVisible).toBe(false);
    expect(result.current.fastingLoading).toBe(false);
  });

  it('clears the flag on unmark and returns the day to the mark prompt', async () => {
    mockIsFasted.mockResolvedValue(true);
    const { result } = render({ selectedDate: YESTERDAY });
    await flush();

    await act(async () => {
      await result.current.unmarkFastedDay();
    });

    expect(mockUnmarkFasted).toHaveBeenCalledWith(YESTERDAY);
    expect(result.current.isFastedDayView).toBe(false);
    expect(result.current.showFastingMarkPrompt).toBe(true);
  });

  it('reports a failed lookup and treats the day as not fasted', async () => {
    const error = new Error('db down');
    mockIsFasted.mockRejectedValue(error);

    const { result } = render({ selectedDate: YESTERDAY });
    await flush();

    expect(mockHandleError).toHaveBeenCalledWith(error, 'food.loadFastedDay');
    expect(result.current.isFastedDayView).toBe(false);
    // Resolved as "not fasted", so the mark affordance is still offered.
    expect(result.current.showFastingMarkPrompt).toBe(true);
  });

  // The resolved flag is tagged with the day it belongs to, so a day switch reads as
  // "not yet known" rather than briefly reusing the previous day's answer.
  it('does not flash the previous day flag while a newly selected day is still loading', async () => {
    mockIsFasted.mockResolvedValue(true);
    const { result, rerender } = render({ selectedDate: YESTERDAY });
    await flush();
    expect(result.current.isFastedDayView).toBe(true);

    mockIsFasted.mockReturnValue(new Promise(() => {}));
    act(() => {
      rerender({
        enabled: true,
        hasLoggedFoodOnSelectedDay: false,
        selectedDate: new Date(2026, 5, 13, 12, 0),
      });
    });

    expect(result.current.isFastedDayView).toBe(false);
    expect(result.current.showFastingMarkPrompt).toBe(false);
  });
});
