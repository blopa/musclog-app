/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { BackHandler } from 'react-native';

import { diaryGroupKey, diaryLogKey } from '@/components/nutrition/foodDiarySelection';
import type { MealGroup, ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type NutritionLog from '@/database/models/NutritionLog';
import type { MealType } from '@/database/models/NutritionLog';
import { useFoodDiarySelection } from '@/hooks/useFoodDiarySelection';

// Focus = mounted: the cleanup the hook registers runs when the "screen" unmounts.
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a stand-in for a focus effect
    require('react').useEffect(effect, [effect]);
  },
}));

const backListeners: (() => boolean)[] = [];
const removeBackListener = jest.fn();

beforeEach(() => {
  backListeners.length = 0;
  removeBackListener.mockClear();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backListeners.push(handler as () => boolean);
    return { remove: removeBackListener };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function entry(id: string, type: MealType, groupId?: string): ResolvedLogEntry {
  return {
    log: { id, type, groupId } as unknown as NutritionLog,
    food: null,
    nutrients: { calories: 100, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
    gramWeight: 50,
    displayName: id,
  };
}

function byType<T>(values: Partial<Record<MealType, T[]>>): Record<MealType, T[]> {
  return {
    breakfast: values.breakfast ?? [],
    lunch: values.lunch ?? [],
    dinner: values.dinner ?? [],
    snack: values.snack ?? [],
    other: values.other ?? [],
  };
}

const oats = entry('oats', 'breakfast');
const apple = entry('apple', 'snack');
const bowl: MealGroup = {
  groupId: 'bowl',
  mealName: 'Bowl',
  entries: [entry('rice', 'lunch', 'bowl'), entry('chicken', 'lunch', 'bowl')],
  totalNutrients: { calories: 200, protein: 0, carbs: 0, fat: 0 },
};

const DAY = new Date(2026, 9, 29).getTime();
const NEXT_DAY = new Date(2026, 9, 30).getTime();

type Props = {
  dayKey: number;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
};

const initialProps: Props = {
  dayKey: DAY,
  ungroupedByType: byType({ breakfast: [oats], snack: [apple] }),
  mealGroupsByType: byType({ lunch: [bowl] }),
};

const render = () => renderHook((props: Props) => useFoodDiarySelection(props), { initialProps });

describe('useFoodDiarySelection', () => {
  it('starts on long-press and toggles further cards on tap', () => {
    const { result } = render();
    expect(result.current.isSelecting).toBe(false);

    act(() => result.current.start(diaryLogKey('oats')));
    act(() => result.current.toggle(diaryGroupKey('lunch', 'bowl')));

    expect(result.current.isSelecting).toBe(true);
    expect(result.current.selection.itemCount).toBe(2);
    expect(result.current.selection.entries).toHaveLength(3);
  });

  it('ends selection mode by itself once the last card is deselected', () => {
    const { result } = render();

    act(() => result.current.start(diaryLogKey('oats')));
    act(() => result.current.toggle(diaryLogKey('oats')));

    expect(result.current.isSelecting).toBe(false);
  });

  it('a long-press while selecting toggles instead of restarting', () => {
    const { result } = render();

    act(() => result.current.start(diaryLogKey('oats')));
    act(() => result.current.start(diaryLogKey('apple')));

    expect(result.current.selection.itemCount).toBe(2);
  });

  it('ends selection mode when every selected card leaves the diary', () => {
    const { result, rerender } = render();

    act(() => result.current.start(diaryLogKey('oats')));
    rerender({ ...initialProps, ungroupedByType: byType({ snack: [apple] }) });

    expect(result.current.isSelecting).toBe(false);
  });

  it('clears the selection when the diary moves to another day', () => {
    const { result, rerender } = render();

    act(() => result.current.start(diaryLogKey('oats')));
    rerender({ ...initialProps, dayKey: NEXT_DAY });

    expect(result.current.isSelecting).toBe(false);
  });

  it('listens for Android back only while selecting, and back clears the selection', () => {
    const { result } = render();
    expect(backListeners).toHaveLength(0);

    act(() => result.current.start(diaryLogKey('oats')));
    expect(backListeners).toHaveLength(1);

    let handled = false;
    act(() => {
      handled = backListeners[0]();
    });

    expect(handled).toBe(true);
    expect(result.current.isSelecting).toBe(false);
    expect(removeBackListener).toHaveBeenCalled();
  });
});
