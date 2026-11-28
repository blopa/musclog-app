import { useCallback, useEffect, useRef, useState } from 'react';
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

export type RunCameraAiTaskParams = {
  timerName: string;
  logLabel: string;
  /** Returns null/undefined on success, or a user-facing error message on failure. */
  task: (ctx: CameraAiTaskContext) => Promise<string | null | undefined>;
  onError?: (message: string) => void;
  onFinish?: (outcome: 'done' | 'cancelled' | 'error') => void;
};

export type CameraAiProcessing = {
  /** Runs one request; does nothing while another is in flight. */
  run: (params: RunCameraAiTaskParams) => Promise<void>;
  processing: boolean;
  progress: MealEstimateProgressLine | null;
  setProgress: (progress: MealEstimateProgressLine | null) => void;
  isBusy: () => boolean;
  /** Cancels the running request (the Cancel button). */
  cancel: () => void;
  /** Cancels it and forgets it, so the next request can start at once (the camera closed). */
  abandon: () => void;
};

/**
 * Shared execution lifecycle for SmartCamera AI requests: one request at a time, its processing and
 * progress state, phase timing, cancellation checks, and error translation. Unmounting cancels it.
 */
export function useCameraAiProcessing(): CameraAiProcessing {
  const { t } = useTranslation();
  const abortRef = useRef<AbortController | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<MealEstimateProgressLine | null>(null);

  const isBusy = useCallback(() => abortRef.current !== null, []);
  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const abandon = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => abandon, [abandon]);

  const run = useCallback(
    async ({ timerName, logLabel, task, onError, onFinish }: RunCameraAiTaskParams) => {
      if (abortRef.current) {
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setProcessing(true);
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
        if (outcome !== 'done' && errorMessage) {
          onError?.(errorMessage);
        }

        onFinish?.(outcome);
      }
    },
    [t]
  );

  return { run, processing, progress, setProgress, isBusy, cancel, abandon };
}
