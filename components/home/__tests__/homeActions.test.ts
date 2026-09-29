import {
  HOME_ACTIONS,
  homeActionListLabel,
  isHomeActionAvailable,
  orderHomeActionRows,
} from '../homeActions';

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

  // Two actions sharing an icon are indistinguishable in the picker's list rows, where
  // the icon is the only thing separating them from the label beside it.
  it('gives every action its own icon', () => {
    const icons = HOME_ACTION_KEYS.map((key) => HOME_ACTIONS[key].icon);

    expect(new Set(icons).size).toBe(HOME_ACTION_KEYS.length);
  });
});

describe('homeActionListLabel', () => {
  // The tile label is two lines to fit the square button; a list row is one line, and
  // no locale carries a second copy of the words just for that.
  it('collapses the tile label break into a space', () => {
    expect(homeActionListLabel('Track\nFood')).toBe('Track Food');
    expect(homeActionListLabel('Записать\nеду')).toBe('Записать еду');
    expect(homeActionListLabel('My Meals')).toBe('My Meals');
  });
});

describe('orderHomeActionRows', () => {
  const available: HomeActionKey[] = ['start_workout', 'track_food', 'log_weight', 'add_note'];

  // The chosen block has to read exactly as the home row does, or the position badges
  // are pointing at an order the user cannot see.
  it('lists chosen actions first, in pick order', () => {
    expect(orderHomeActionRows(['add_note', 'start_workout'], available)).toEqual([
      'add_note',
      'start_workout',
      'track_food',
      'log_weight',
    ]);
  });

  it('drops a chosen action this device cannot offer', () => {
    expect(orderHomeActionRows(['ai_photo', 'track_food'], available)).toEqual([
      'track_food',
      'start_workout',
      'log_weight',
      'add_note',
    ]);
  });

  it('never repeats or invents a row', () => {
    const rows = orderHomeActionRows(['log_weight', 'start_workout'], available);

    expect(new Set(rows).size).toBe(rows.length);
    expect([...rows].sort()).toEqual([...available].sort());
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
