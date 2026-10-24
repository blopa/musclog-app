/** The shared mood scale: an integer from 0 (worst) to 4 (best), as `MoodSelectorCard` writes it. */
export const MOOD_LABEL_KEYS = {
  0: 'bodyMetrics.addEntry.moods.0',
  1: 'bodyMetrics.addEntry.moods.1',
  2: 'bodyMetrics.addEntry.moods.2',
  3: 'bodyMetrics.addEntry.moods.3',
  4: 'bodyMetrics.addEntry.moods.4',
} as const;
export type MoodValue = keyof typeof MOOD_LABEL_KEYS;

export function isMoodValue(value: unknown): value is MoodValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4;
}
