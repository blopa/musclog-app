import type { Units } from '@/constants/settings';
import { celsiusToDisplay, displayToCelsius } from '@/utils/unitConversion';

import { observationsSchema } from './preferences';
import type { CycleConfig, CycleObservations } from './types';

export type ObservationDraft = Record<string, string | boolean>;

/** `temperatureC` is stored in °C and drafted in the person's own unit. */
export function observationDraft(
  observations: CycleObservations = {},
  units: Units = 'metric'
): ObservationDraft {
  const { custom } = observations;
  const fields = Object.fromEntries(
    Object.entries(observations).filter(
      ([key]) => key !== 'custom' && key !== 'customLabels' && key !== 'health'
    )
  );
  return Object.fromEntries(
    Object.entries({
      ...fields,
      ...Object.fromEntries(
        Object.entries(custom ?? {}).map(([id, value]) => [`custom:${id}`, value])
      ),
    }).map(([key, value]) => {
      if (key === 'temperatureC' && typeof value === 'number') {
        return [key, String(celsiusToDisplay(value, units))];
      }

      return [key, typeof value === 'boolean' ? value : String(value)];
    })
  );
}

/** Empty means unrecorded; false and zero are real observations. Hidden historical values survive. */
export function resolveObservationDraft(
  draft: ObservationDraft,
  config: CycleConfig,
  original: CycleObservations = {},
  units: Units = 'metric'
): CycleObservations {
  const observations: CycleObservations = original.health ? { health: original.health } : {};
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
      key === 'impact' ||
      (key.startsWith('custom:') &&
        config.customFields?.find((f) => f.id === id)?.kind === 'number') ||
      (key.startsWith('custom:') &&
        config.customFields?.find((f) => f.id === id)?.kind === 'rating') ||
      (key.startsWith('custom:') && typeof original.custom?.[id] === 'number');
    let parsed = number
      ? Number(typeof value === 'string' ? value.replace(',', '.') : value)
      : value;
    if (key === 'temperatureC' && typeof parsed === 'number' && Number.isFinite(parsed)) {
      parsed = displayToCelsius(parsed, units);
    }

    if (key.startsWith('custom:')) {
      const field = config.customFields?.find((f) => f.id === id);
      if (
        field?.kind === 'rating' &&
        (typeof parsed !== 'number' ||
          !Number.isInteger(parsed) ||
          parsed < (field.min ?? 0) ||
          parsed > (field.max ?? 10))
      ) {
        throw new Error('invalid_rating');
      }

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
