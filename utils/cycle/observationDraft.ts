import { observationsSchema } from './preferences';
import type { CycleConfig, CycleObservations } from './types';

export type ObservationDraft = Record<string, string | boolean>;

export function observationDraft(observations: CycleObservations = {}): ObservationDraft {
  const { custom } = observations;
  const fields = Object.fromEntries(
    Object.entries(observations).filter(([key]) => key !== 'custom' && key !== 'customLabels')
  );
  return Object.fromEntries(
    Object.entries({
      ...fields,
      ...Object.fromEntries(
        Object.entries(custom ?? {}).map(([id, value]) => [`custom:${id}`, value])
      ),
    }).map(([key, value]) => [key, typeof value === 'boolean' ? value : String(value)])
  );
}

/** Empty means unrecorded; false and zero are real observations. Hidden historical values survive. */
export function resolveObservationDraft(
  draft: ObservationDraft,
  config: CycleConfig,
  original: CycleObservations = {}
): CycleObservations {
  const observations: CycleObservations = {};
  const custom: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === '') {
      continue;
    }

    if (typeof value === 'string' && !value.trim()) {
      throw new Error('blank_observation');
    }

    const id = key.replace(/^custom:/, '');
    const number =
      key === 'sleepHours' ||
      key === 'temperatureC' ||
      (key.startsWith('custom:') &&
        config.customFields?.find((f) => f.id === id)?.kind === 'number') ||
      (key.startsWith('custom:') && typeof original.custom?.[id] === 'number');
    const parsed = number
      ? Number(typeof value === 'string' ? value.replace(',', '.') : value)
      : value;
    if (key.startsWith('custom:')) {
      custom[id] = parsed;
    } else {
      Object.assign(observations, { [key]: parsed });
    }
  }

  if (Object.keys(custom).length) {
    observations.custom = custom;
    observations.customLabels = Object.fromEntries(
      Object.keys(custom).map((id) => [
        id,
        config.customFields?.find((f) => f.id === id)?.label ?? original.customLabels?.[id] ?? id,
      ])
    );
  }

  return observationsSchema.parse(observations);
}
