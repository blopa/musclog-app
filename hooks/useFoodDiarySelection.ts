import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';

import {
  type DiarySelectionKey,
  resolveDiarySelection,
  toggleSelectionKey,
} from '@/components/nutrition/foodDiarySelection';
import type { MealGroup, ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type { MealType } from '@/database/models/NutritionLog';

type SelectionState = {
  /** The diary day the keys were picked on; a different day reads as an empty selection. */
  dayKey: number;
  keys: ReadonlySet<DiarySelectionKey>;
};

const EMPTY_KEYS: ReadonlySet<DiarySelectionKey> = new Set();

/**
 * The food diary's long-press selection mode. It stores only keys; what they select is
 * derived from the diary's own lists on every render (`resolveDiarySelection`), so a card
 * that disappears drops out of the selection and selection mode ends by itself once nothing
 * selected is left. Leaving the screen, changing day and Android back all clear it.
 */
export function useFoodDiarySelection({
  dayKey,
  ungroupedByType,
  mealGroupsByType,
}: {
  dayKey: number;
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>;
  mealGroupsByType: Record<MealType, MealGroup[]>;
}) {
  const [state, setState] = useState<SelectionState>({ dayKey, keys: EMPTY_KEYS });
  const keys = state.dayKey === dayKey ? state.keys : EMPTY_KEYS;

  const selection = useMemo(
    () => resolveDiarySelection(keys, ungroupedByType, mealGroupsByType),
    [keys, ungroupedByType, mealGroupsByType]
  );
  const isSelecting = selection.itemCount > 0;

  const clear = useCallback(() => setState({ dayKey, keys: EMPTY_KEYS }), [dayKey]);

  /** Long-press: start a selection with this card, or toggle it when one is running. */
  const start = useCallback(
    (key: DiarySelectionKey) => {
      setState({
        dayKey,
        keys: isSelecting ? toggleSelectionKey(keys, key) : new Set([key]),
      });
    },
    [dayKey, isSelecting, keys]
  );

  const toggle = useCallback(
    (key: DiarySelectionKey) => setState({ dayKey, keys: toggleSelectionKey(keys, key) }),
    [dayKey, keys]
  );

  useFocusEffect(
    useCallback(() => {
      return () => setState((current) => ({ ...current, keys: EMPTY_KEYS }));
    }, [])
  );

  useEffect(() => {
    if (!isSelecting) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clear();
      return true;
    });

    return () => subscription.remove();
  }, [isSelecting, clear]);

  return {
    selection,
    selectedKeys: isSelecting ? keys : EMPTY_KEYS,
    isSelecting,
    start,
    toggle,
    clear,
  };
}
