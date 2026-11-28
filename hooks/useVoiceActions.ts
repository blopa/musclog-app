import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { aiSettingsHref } from '@/constants/aiSettingsRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import type { VoiceAction, VoiceActionKind } from '@/utils/voiceCommand/types';
import {
  subscribePendingVoiceAction,
  takePendingVoiceAction,
} from '@/utils/voiceCommand/voiceActionInbox';

const WRONG_TASK_SNACKBAR_MS = 6000;

/**
 * Performs the voice commands of the given kinds on the screen that was navigated to for them. Only
 * the focused screen takes the pending action, so a second copy lower in the stack never opens a
 * modal nobody sees. `kinds` must be a stable (module-level) list.
 */
export function useVoiceActions<K extends VoiceActionKind>(
  kinds: readonly K[],
  perform: (action: Extract<VoiceAction, { kind: K }>) => void
) {
  const performRef = useRef(perform);
  useEffect(() => {
    performRef.current = perform;
  });

  useFocusEffect(
    useCallback(() => {
      const drain = () => {
        const action = takePendingVoiceAction(kinds);
        if (action) {
          performRef.current(action);
        }
      };

      drain();

      return subscribePendingVoiceAction(drain);
    }, [kinds])
  );
}

/** A snackbar offering the AI settings, in case the model picked the wrong task. */
export function useWrongTaskNotice() {
  const router = useRouter();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();

  return useCallback(() => {
    const openAiSettings = () => router.navigate(aiSettingsHref());
    showSnackbar('success', t('voiceInput.command.wrongTask'), {
      action: t('voiceInput.command.openAiSettings'),
      onAction: openAiSettings,
      onPress: openAiSettings,
      duration: WRONG_TASK_SNACKBAR_MS,
    });
  }, [router, showSnackbar, t]);
}

/**
 * Watches the sheet a voice command opens and shows the wrong-task notice once it closes, confirmed
 * or not: not sooner, so it is never hidden behind the sheet and tapping it can leave the screen.
 * `begin` marks that a command opened the sheet; `forget` that the person opened it themselves.
 */
export function useVoiceTask(isOpen: boolean) {
  // 'opening' from the command until its sheet is seen open, then 'open' until it closes.
  const taskRef = useRef<'opening' | 'open' | null>(null);
  const notice = useWrongTaskNotice();

  useEffect(() => {
    if (isOpen) {
      if (taskRef.current === 'opening') {
        taskRef.current = 'open';
      }

      return;
    }

    if (taskRef.current !== 'open') {
      return;
    }

    taskRef.current = null;
    notice();
  }, [isOpen, notice]);

  const begin = useCallback(() => {
    taskRef.current = 'opening';
  }, []);
  const forget = useCallback(() => {
    taskRef.current = null;
  }, []);

  return { begin, forget };
}
