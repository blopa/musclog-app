import { HOME_ACTIONS, isHomeActionAvailable } from '../homeActions';

import { HOME_ACTION_KEYS, type HomeActionKey } from '@/constants/homeActions';

describe('HOME_ACTIONS', () => {
  it('configures every key in the canonical list', () => {
    for (const key of HOME_ACTION_KEYS) {
      expect(HOME_ACTIONS[key]).toBeDefined();
      expect(HOME_ACTIONS[key].labelKey).toMatch(/^home\.actions\./);
      expect(HOME_ACTIONS[key].icon).toBeDefined();
    }

    expect(Object.keys(HOME_ACTIONS).sort()).toEqual([...HOME_ACTION_KEYS].sort());
  });
});

describe('isHomeActionAvailable', () => {
  const android = { isAiConfigured: true, platform: 'android' };

  // Per the AI-affordance gating rule: an action inside a sheet must not advertise an
  // LLM feature the user has no provider for, because tapping it would dead-end.
  it('hides the AI photo action when no provider is configured', () => {
    expect(isHomeActionAvailable('ai_photo', android)).toBe(true);
    expect(isHomeActionAvailable('ai_photo', { ...android, isAiConfigured: false })).toBe(false);
  });

  it('hides the camera-backed actions on web regardless of AI config', () => {
    expect(isHomeActionAvailable('ai_photo', { ...android, platform: 'web' })).toBe(false);
    expect(isHomeActionAvailable('scan_barcode', { ...android, platform: 'web' })).toBe(false);
    expect(isHomeActionAvailable('scan_barcode', android)).toBe(true);
  });

  it('keeps the unshipped cardio action hidden everywhere', () => {
    expect(isHomeActionAvailable('log_cardio', android)).toBe(false);
    expect(isHomeActionAvailable('log_cardio', { ...android, platform: 'ios' })).toBe(false);
  });

  // The home screen renders whatever survives this filter, so a key with no gate of its
  // own must fail open rather than silently emptying the action row.
  it('allows every ungated action on a configured native device', () => {
    const gated: HomeActionKey[] = ['ai_photo', 'scan_barcode', 'log_cardio'];

    for (const key of HOME_ACTION_KEYS.filter((k) => !gated.includes(k))) {
      expect(isHomeActionAvailable(key, android)).toBe(true);
    }
  });
});
