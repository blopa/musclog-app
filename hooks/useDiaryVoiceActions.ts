import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MealType } from '@/database/models/NutritionLog';
import type { VoiceAction } from '@/utils/voiceCommand/types';
import {
  subscribePendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';

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
};

/**
 * Performs the voice command the food diary was navigated to for: shows the day, then opens the
 * copy review or the food search already filled in. Nothing is written here.
 *
 * Only the focused screen takes the pending action, so a second copy lower in the stack never opens
 * a modal nobody sees. Call it on the screen above the area lock: a locked diary keeps the opened
 * state until the gate lets the modal mount.
 */
export function useDiaryVoiceActions(handlers: DiaryVoiceHandlers) {
  const [copyScope, setCopyScope] = useState<VoiceCopyScope | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useFocusEffect(
    useCallback(() => {
      const drain = () => {
        const action = takePendingVoiceAction();
        if (!action) {
          return;
        }

        const { setSelectedDate, selectMealType, openCopyDay, openFoodSearch } =
          handlersRef.current;
        if (action.kind === 'copyMeal') {
          setSelectedDate(action.targetDay);
          setCopyScope({ sourceDay: action.sourceDay, meals: action.meals });
          openCopyDay();
          return;
        }

        setSelectedDate(action.day);
        selectMealType(action.mealType);
        openFoodSearch('all', action.query);
      };

      drain();
      return subscribePendingVoiceAction(drain);
    }, [])
  );

  /** The diary's own "copy a previous day" entries: the whole day, nothing pre-picked. */
  const openWholeCopyDay = useCallback(() => {
    setCopyScope(null);
    handlersRef.current.openCopyDay();
  }, []);

  return { copyScope, openWholeCopyDay };
}
