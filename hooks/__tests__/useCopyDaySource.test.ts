/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { NutritionService } from '@/database/services';
import { useCopyDaySource } from '@/hooks/useCopyDaySource';
import { utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

jest.mock('@/database/services', () => ({
  NutritionService: {
    getNutritionLogsForDate: jest.fn(),
    getRecentLoggedDays: jest.fn(),
  },
}));

jest.mock('@/utils/handleError', () => ({
  handleError: jest.fn(),
}));

const mockGetRecentLoggedDays = NutritionService.getRecentLoggedDays as jest.Mock;
const mockGetLogsForDate = NutritionService.getNutritionLogsForDate as jest.Mock;
const mockHandleError = handleError as jest.Mock;

const TARGET_DATE = new Date(2026, 5, 15, 10, 0);
const SOURCE_DATE = new Date(2026, 5, 12, 10, 0);

type LogOptions = {
  calories?: number;
  foodMissing?: boolean;
  groupId?: null | string;
  id: string;
  loggedMealName?: null | string;
  name?: string;
  type?: string;
};

const makeLog = ({
  calories = 100,
  foodMissing = false,
  groupId = null,
  id,
  loggedMealName = null,
  name = `Food ${id}`,
  type = 'lunch',
}: LogOptions) => ({
  get food() {
    return foodMissing
      ? Promise.reject(new Error('food deleted'))
      : Promise.resolve({ id: `food-${id}` });
  },
  getDisplayName: jest.fn().mockResolvedValue(name),
  getGramWeight: jest.fn().mockResolvedValue(100),
  getNutrients: jest
    .fn()
    .mockResolvedValue({ alcohol: 0, calories, carbs: 0, fat: 0, fiber: 0, protein: 0 }),
  groupId,
  id,
  loggedMealName,
  type,
});

const render = ({
  enabled = true,
  sourceDate = null as Date | null,
  targetDate = TARGET_DATE,
} = {}) =>
  renderHook(
    (props: { enabled: boolean; sourceDate: Date | null; targetDate: Date }) =>
      useCopyDaySource(props),
    { initialProps: { enabled, sourceDate, targetDate } }
  );

describe('useCopyDaySource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRecentLoggedDays.mockResolvedValue([{ calories: 1800, dayKey: 1, itemCount: 5 }]);
    mockGetLogsForDate.mockResolvedValue([]);
  });

  it('reads nothing while the modal is closed', async () => {
    const { result } = render({ enabled: false, sourceDate: SOURCE_DATE });

    await act(async () => {});

    expect(mockGetRecentLoggedDays).not.toHaveBeenCalled();
    expect(mockGetLogsForDate).not.toHaveBeenCalled();
    expect(result.current.recentDays).toEqual([]);
  });

  // The day being copied *into* must never be offered as its own source.
  it('lists candidate days excluding the target day', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.isLoadingRecentDays).toBe(false));
    expect(mockGetRecentLoggedDays).toHaveBeenCalledWith(14, 60, {
      excludeDayKey: utcDayKeyFromLocalDate(TARGET_DATE),
    });
    expect(result.current.recentDays).toHaveLength(1);
  });

  it('loads no preview until a source day is picked', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.isLoadingRecentDays).toBe(false));

    expect(mockGetLogsForDate).not.toHaveBeenCalled();
    expect(result.current.sections).toEqual([]);
    // Nothing has been loaded, so the modal must not claim the day is empty.
    expect(result.current.isSourceEmpty).toBe(false);
  });

  // Grouped logs (an AI/saved meal) collapse into one all-or-nothing row; loose logs stay
  // individual, and sections follow the diary's canonical meal order.
  it('builds the source-day preview with grouped meals collapsed into a single row', async () => {
    mockGetLogsForDate.mockResolvedValue([
      makeLog({ calories: 300, id: 'l1', name: 'Oats', type: 'breakfast' }),
      makeLog({ calories: 200, groupId: 'g1', id: 'l2', loggedMealName: 'Chicken bowl' }),
      makeLog({ calories: 150, groupId: 'g1', id: 'l3' }),
    ]);

    const { result } = render({ sourceDate: SOURCE_DATE });

    await waitFor(() => expect(result.current.isLoadingPreview).toBe(false));
    expect(mockGetLogsForDate).toHaveBeenCalledWith(SOURCE_DATE);
    expect(result.current.sections.map((section) => section.mealType)).toEqual([
      'breakfast',
      'lunch',
    ]);
    expect(result.current.sections[0].items).toEqual([
      { calories: 300, id: 'l1', kind: 'single', label: 'Oats', logIds: ['l1'] },
    ]);
    expect(result.current.sections[1].items).toEqual([
      { calories: 350, id: 'g1', kind: 'group', label: 'Chicken bowl', logIds: ['l2', 'l3'] },
    ]);
    expect(result.current.isSourceEmpty).toBe(false);
  });

  // The log snapshot still carries the name and nutrients, so a since-deleted food relation
  // must not blank out the row.
  it('still previews a log whose food relation no longer resolves', async () => {
    mockGetLogsForDate.mockResolvedValue([
      makeLog({ calories: 90, foodMissing: true, id: 'l1', name: 'Deleted apple' }),
    ]);

    const { result } = render({ sourceDate: SOURCE_DATE });

    await waitFor(() => expect(result.current.isLoadingPreview).toBe(false));
    expect(result.current.sections[0].items[0].label).toBe('Deleted apple');
  });

  it('flags an empty source day once its read has finished', async () => {
    const { result } = render({ sourceDate: SOURCE_DATE });

    await waitFor(() => expect(result.current.isSourceEmpty).toBe(true));
    expect(result.current.sections).toEqual([]);
  });

  // The effect keys off the day key, not the Date identity — a re-render with a fresh Date for
  // the same calendar day must not re-issue the read.
  it('does not reload the preview for a new Date on the same calendar day', async () => {
    const { rerender, result } = render({ sourceDate: SOURCE_DATE });

    await waitFor(() => expect(result.current.isLoadingPreview).toBe(false));
    expect(mockGetLogsForDate).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({
        enabled: true,
        sourceDate: new Date(2026, 5, 12, 23, 30),
        targetDate: TARGET_DATE,
      });
    });

    expect(mockGetLogsForDate).toHaveBeenCalledTimes(1);
  });

  it('reports a failed preview read without a snackbar and leaves the preview empty', async () => {
    const error = new Error('read failed');
    mockGetLogsForDate.mockRejectedValue(error);

    const { result } = render({ sourceDate: SOURCE_DATE });

    await waitFor(() => expect(result.current.isLoadingPreview).toBe(false));
    expect(mockHandleError).toHaveBeenCalledWith(error, 'copyDay.loadSourceDay', {
      showSnackbar: false,
    });
    expect(result.current.sections).toEqual([]);
  });

  it('reports a failed candidate-day read without a snackbar', async () => {
    const error = new Error('recent days failed');
    mockGetRecentLoggedDays.mockRejectedValue(error);

    const { result } = render();

    await waitFor(() => expect(result.current.isLoadingRecentDays).toBe(false));
    expect(mockHandleError).toHaveBeenCalledWith(error, 'copyDay.loadRecentDays', {
      showSnackbar: false,
    });
    expect(result.current.recentDays).toEqual([]);
  });
});
