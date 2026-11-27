import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { aiSettingsHref } from '@/constants/aiSettingsRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import type { MealType } from '@/database/models/NutritionLog';
import type { VoiceAction } from '@/utils/voiceCommand/types';
import {
  subscribePendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';

const WRONG_TASK_SNACKBAR_MS = 6000;

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

/**
 * Performs the voice command the food diary was navigated to for: shows the day, then opens the
 * copy review or the food search already filled in. Nothing is written here. Once that sheet closes,
 * confirmed or not, a snackbar offers the AI settings in case the model picked the wrong task: not
 * sooner, so it is never hidden behind the sheet and tapping it can leave the screen.
 *
 * Only the focused screen takes the pending action, so a second copy lower in the stack never opens
 * a modal nobody sees. Call it on the screen above the area lock: a locked diary keeps the opened
 * state until the gate lets the modal mount.
 */
export function useDiaryVoiceActions(handlers: DiaryVoiceHandlers) {
  const [copyScope, setCopyScope] = useState<VoiceCopyScope | null>(null);
  const handlersRef = useRef(handlers);
  // 'opening' from the command until its sheet is seen open, then 'open' until it closes.
  const taskRef = useRef<'opening' | 'open' | null>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { isTaskOpen } = handlers;
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
        taskRef.current = 'opening';
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

  useEffect(() => {
    if (isTaskOpen) {
      if (taskRef.current === 'opening') {
        taskRef.current = 'open';
      }

      return;
    }

    if (taskRef.current !== 'open') {
      return;
    }

    taskRef.current = null;
    const openAiSettings = () => router.navigate(aiSettingsHref());
    showSnackbar('success', t('voiceInput.command.wrongTask'), {
      action: t('voiceInput.command.openAiSettings'),
      onAction: openAiSettings,
      onPress: openAiSettings,
      duration: WRONG_TASK_SNACKBAR_MS,
    });
  }, [isTaskOpen, router, showSnackbar, t]);

  /** The diary's own "copy a previous day" entries: the whole day, nothing pre-picked. */
  const openWholeCopyDay = useCallback(() => {
    setCopyScope(null);
    taskRef.current = null;
    handlersRef.current.openCopyDay();
  }, []);

  return { copyScope, openWholeCopyDay };
}
