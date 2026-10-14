import {
  celsiusToDisplay,
  displayToCelsius,
  getTemperatureUnitLabel,
} from '@/utils/unitConversion';

import { observationDraft, resolveObservationDraft } from '../observationDraft';

const config = {
  fallbackCycleLength: 28,
  fallbackPeriodDuration: 5,
  enabledFields: ['temperatureC' as const],
};

describe('basal temperature in the person’s own unit', () => {
  it('converts both ways and labels the unit', () => {
    expect(celsiusToDisplay(36.5, 'imperial')).toBe(97.7);
    expect(displayToCelsius(97.7, 'imperial')).toBe(36.5);
    expect(celsiusToDisplay(36.5, 'metric')).toBe(36.5);
    expect(getTemperatureUnitLabel('imperial')).toBe('°F');
    expect(getTemperatureUnitLabel('metric')).toBe('°C');
  });

  it('drafts a stored °C value as °F for imperial users and stores what they type in °C', () => {
    expect(observationDraft({ temperatureC: 36.5 }, 'imperial')).toEqual({ temperatureC: '97.7' });
    expect(resolveObservationDraft({ temperatureC: '97,7' }, config, {}, 'imperial')).toEqual({
      temperatureC: 36.5,
    });
    // Metric stays untouched, so existing payloads round-trip exactly.
    expect(
      resolveObservationDraft(observationDraft({ temperatureC: 36.42 }), config, {}, 'metric')
    ).toEqual({ temperatureC: 36.42 });
  });

  it('rejects a °F reading that converts outside the plausible body range', () => {
    expect(() =>
      resolveObservationDraft({ temperatureC: '120' }, config, {}, 'imperial')
    ).toThrow();
  });
});
