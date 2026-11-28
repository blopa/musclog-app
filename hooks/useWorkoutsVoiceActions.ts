import { useEffect, useRef } from 'react';

import { useVoiceActions, useVoiceTask } from '@/hooks/useVoiceActions';

type WorkoutsVoiceHandlers = {
  openPreview: (templateId: string, planId?: string) => void;
  /** Whether the workout preview a voice command can open is open. */
  isPreviewOpen: boolean;
};

const WORKOUT_KINDS = ['previewWorkout'] as const;

/**
 * Performs the voice command the Workouts screen was navigated to for: shows the preview of the
 * workout that was named. Starting it stays the preview's own button. Call it on the screen above
 * the area lock: a locked screen keeps the opened state until the gate lets the preview mount.
 */
export function useWorkoutsVoiceActions({ openPreview, isPreviewOpen }: WorkoutsVoiceHandlers) {
  const openRef = useRef(openPreview);
  useEffect(() => {
    openRef.current = openPreview;
  });
  const { begin } = useVoiceTask(isPreviewOpen);

  useVoiceActions(WORKOUT_KINDS, ({ templateId, planId }) => {
    begin();
    openRef.current(templateId, planId);
  });
}
