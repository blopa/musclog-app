import type { CycleLifeStage } from './types';

export type CycleTrackingMode = 'bleeding' | 'symptoms' | 'skip';

export const CYCLE_TRACKING_CHOICES = [
  {
    value: 'bleeding',
    labelKey: 'cycle.personalize.trackBleeding',
    hintKey: 'cycle.personalize.trackBleedingHint',
  },
  {
    value: 'symptoms',
    labelKey: 'cycle.personalize.trackSymptoms',
    hintKey: 'cycle.personalize.trackSymptomsHint',
  },
  { value: 'skip', labelKey: 'cycle.personalize.skip', hintKey: 'cycle.personalize.skipHint' },
] as const;

export function trackingLifeStage(
  mode: Exclude<CycleTrackingMode, 'skip'>,
  current: CycleLifeStage
): CycleLifeStage {
  if (mode === 'symptoms') {
    return 'no_bleeding';
  }

  return current === 'no_bleeding' ? 'regular' : current;
}
