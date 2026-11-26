import { type RefObject, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { AiService } from '@/services/AiService';
import { describeAiError } from '@/utils/aiErrors';
import { reportAiError } from '@/utils/coachAI';
import type { MealEstimateProgressLine } from '@/utils/mealEstimateProgress';
import { createPhaseTimer } from '@/utils/phaseTimer';

export type CameraAiConfig = NonNullable<Awaited<ReturnType<typeof AiService.getAiConfig>>> & {
  signal: AbortSignal;
};

export type CameraAiTaskContext = {
  signal: AbortSignal;
  config: CameraAiConfig;
  timer: ReturnType<typeof createPhaseTimer>;
};

export type CameraAiProcessingOptions = {
  abortRef: RefObject<AbortController | null>;
  setProcessing: (value: boolean) => void;
  setProgress: (value: MealEstimateProgressLine | null) => void;
  setError?: (value: string | null) => void;
};

export type RunCameraAiTaskParams = {
  timerName: string;
  logLabel: string;
  /** Returns null/undefined on success, or a user-facing error message on failure. */
  task: (ctx: CameraAiTaskContext) => Promise<string | null | undefined>;
  onError?: (message: string) => void;
  onFinish?: (outcome: 'done' | 'cancelled' | 'error') => void;
};

/**
 * Shared execution lifecycle for SmartCamera AI requests: manages the AbortController ref,
 * processing and progress state, phase timing, cancellation checks, and error translation.
 */
export function useCameraAiProcessing({
  abortRef,
  setProcessing,
  setProgress,
  setError,
}: CameraAiProcessingOptions) {
  const { t } = useTranslation();

  return useCallback(
    async ({ timerName, logLabel, task, onError, onFinish }: RunCameraAiTaskParams) => {
      if (abortRef.current) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
      setError?.(null);
      setProgress(null);
      const timer = createPhaseTimer(timerName);
      let outcome: 'done' | 'cancelled' | 'error' = 'done';
      let errorMessage: string | null = null;

      try {
        const config = await AiService.getAiConfig();
        timer.mark('settings-read');
        if (controller.signal.aborted) {
          outcome = 'cancelled';

          return;
        }

        if (!config) {
          outcome = 'error';
          errorMessage = t('food.aiCamera.aiNotConfigured');

          return;
        }

        const taskError = await task({
          signal: controller.signal,
          config: { ...config, signal: controller.signal },
          timer,
        });

        if (controller.signal.aborted) {
          outcome = 'cancelled';

          return;
        }

        if (taskError) {
          outcome = 'error';
          errorMessage = taskError;
        }
      } catch (error) {
        outcome = controller.signal.aborted ? 'cancelled' : 'error';
        if (!controller.signal.aborted) {
          console.error(`[SmartCamera] ${logLabel}:`, error);
          // A typed, user-fixable failure (a rejected key, a timeout) is filtered out here.
          reportAiError(error, timerName);
          errorMessage = describeAiError(error, t) ?? t('food.aiCamera.aiAnalysisFailed');
        }
      } finally {
        timer.log(outcome);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }

        setProcessing(false);
        setProgress(null);
        if (outcome !== 'done') {
          if (errorMessage) {
            onError?.(errorMessage);
          }

          setError?.(errorMessage);
        }

        onFinish?.(outcome);
      }
    },
    [abortRef, setProcessing, setProgress, setError, t]
  );
}
