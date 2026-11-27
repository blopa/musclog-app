import { useCallback, useEffect, useRef, useState } from 'react';

import type { MealType } from '@/database/models/NutritionLog';
import { useVoiceActions, useVoiceTask } from '@/hooks/useVoiceActions';
import type { VoiceAction } from '@/utils/voiceCommand/types';

/** What a voice command limited the copy-a-day review to. */
export type VoiceCopyScope = Pick<
  Extract<VoiceAction, { kind: 'copyMeal' }>,
  'sourceDay' | 'meals'
>;

type DiaryVoiceHandlers = {
  setSelectedDate: (date: Date) => void;
  selectMealType: (mealType: MealType) => void;
  openCopyDay: () => void;
  openFoodSearch: (tab: 'all', query: string) => void;
  /** Whether a sheet a voice command can open (or one it leads to) is on screen. */
  isTaskOpen: boolean;
};

const DIARY_KINDS = ['copyMeal', 'searchFood'] as const;

/**
 * Performs the voice command the food diary was navigated to for: shows the day, then opens the
 * copy review or the food search already filled in. Nothing is written here. Call it on the screen
 * above the area lock: a locked diary keeps the opened state until the gate lets the modal mount.
 */
export function useDiaryVoiceActions(handlers: DiaryVoiceHandlers) {
  const [copyScope, setCopyScope] = useState<VoiceCopyScope | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const { begin, forget } = useVoiceTask(handlers.isTaskOpen);

  useVoiceActions(DIARY_KINDS, (action) => {
    const { setSelectedDate, selectMealType, openCopyDay, openFoodSearch } = handlersRef.current;
    begin();
    if (action.kind === 'copyMeal') {
      setSelectedDate(action.targetDay);
      setCopyScope({ sourceDay: action.sourceDay, meals: action.meals });
      openCopyDay();

      return;
    }

    setSelectedDate(action.day);
    selectMealType(action.mealType);
    openFoodSearch('all', action.query);
  });

  /** The diary's own "copy a previous day" entries: the whole day, nothing pre-picked. */
  const openWholeCopyDay = useCallback(() => {
    setCopyScope(null);
    forget();
    handlersRef.current.openCopyDay();
  }, [forget]);

  return { copyScope, openWholeCopyDay };
}
