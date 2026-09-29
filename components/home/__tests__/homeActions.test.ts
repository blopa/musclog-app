import {
  HOME_ACTIONS,
  homeActionListLabel,
  orderHomeActionRows,
  reconcileHomeActions,
} from '../homeActions';

import type { HomeActionContext } from '../homeActions';

import {
  DEFAULT_HOME_ACTIONS,
  HOME_ACTION_KEYS,
  type HomeActionKey,
  MIN_HOME_ACTIONS,
} from '@/constants/homeActions';

describe('HOME_ACTIONS', () => {
  it('configures every key in the canonical list', () => {
    for (const key of HOME_ACTION_KEYS) {
      expect(HOME_ACTIONS[key]).toBeDefined();
      expect(HOME_ACTIONS[key].labelKey).toMatch(/^home\.actions\./);
      expect(HOME_ACTIONS[key].icon).toBeDefined();
      // Declared per entry, never a fallthrough default: this is what stops a new key
      // being silently offered on every device because nobody decided about it.
      expect(typeof HOME_ACTIONS[key].isAvailable).toBe('function');
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
  const available: HomeActionKey[] = ['start_workout', 'track_food', 'my_meals', 'add_note'];

  // The chosen block has to read exactly as the home row does, or the position badges
  // are pointing at an order the user cannot see.
  it('lists chosen actions first, in pick order', () => {
    expect(orderHomeActionRows(['add_note', 'start_workout'], available)).toEqual([
      'add_note',
      'start_workout',
      'track_food',
      'my_meals',
    ]);
  });

  it('drops a chosen action this device cannot offer', () => {
    expect(orderHomeActionRows(['ai_photo', 'track_food'], available)).toEqual([
      'track_food',
      'start_workout',
      'my_meals',
      'add_note',
    ]);
  });

  it('never repeats or invents a row', () => {
    const rows = orderHomeActionRows(['my_meals', 'start_workout'], available);

    expect(new Set(rows).size).toBe(rows.length);
    expect([...rows].sort()).toEqual([...available].sort());
  });
});

describe('HOME_ACTIONS[key].isAvailable', () => {
  const native = { isAiConfigured: true, isWeb: false };
  const isAvailable = (key: HomeActionKey, context: HomeActionContext) =>
    HOME_ACTIONS[key].isAvailable(context);

  // Per the AI-affordance gating rule: an action inside a sheet must not advertise an
  // LLM feature the user has no provider for, because tapping it would dead-end.
  it('hides the AI photo action when no provider is configured', () => {
    expect(isAvailable('ai_photo', native)).toBe(true);
    expect(isAvailable('ai_photo', { ...native, isAiConfigured: false })).toBe(false);
  });

  it('hides the camera-backed actions on web regardless of AI config', () => {
    expect(isAvailable('ai_photo', { ...native, isWeb: true })).toBe(false);
    expect(isAvailable('scan_barcode', { ...native, isWeb: true })).toBe(false);
    expect(isAvailable('scan_barcode', native)).toBe(true);
  });

  // The home screen renders whatever survives this filter, so a key with no gate of its
  // own must stay available rather than silently emptying the action row.
  it('allows every ungated action on a configured native device', () => {
    const gated: HomeActionKey[] = ['ai_photo', 'scan_barcode'];

    for (const key of HOME_ACTION_KEYS.filter((k) => !gated.includes(k))) {
      expect(isAvailable(key, native)).toBe(true);
    }
  });

  // Every catalogue entry must be reachable on some device. An action that can never be
  // offered is dead config, a dead handler and a dead translation in every locale — which
  // is what `log_weight` and `log_cardio` were before they were removed.
  it('has no permanently unavailable action', () => {
    for (const key of HOME_ACTION_KEYS) {
      const reachable = [
        { isAiConfigured: true, isWeb: false },
        { isAiConfigured: false, isWeb: false },
        { isAiConfigured: true, isWeb: true },
      ].some((context) => isAvailable(key, context));

      expect(reachable).toBe(true);
    }
  });
});

describe('reconcileHomeActions', () => {
  const available: HomeActionKey[] = ['start_workout', 'track_food', 'my_meals', 'add_note'];

  it('returns the same array when every chosen action is still offered', () => {
    const selected: HomeActionKey[] = ['track_food', 'add_note'];

    expect(reconcileHomeActions(selected, available)).toBe(selected);
  });

  it('drops an action this device no longer offers', () => {
    expect(reconcileHomeActions(['track_food', 'scan_barcode', 'add_note'], available)).toEqual([
      'track_food',
      'add_note',
    ]);
  });

  // Opening the same database on web left anyone who had picked the camera actions below
  // the floor, and a home row with one tile in it reads as a bug rather than a preference.
  it('tops a short selection back up to the floor', () => {
    const reconciled = reconcileHomeActions(['add_note', 'scan_barcode'], available);

    expect(reconciled).toHaveLength(MIN_HOME_ACTIONS);
    expect(reconciled[0]).toBe('add_note');
    expect(available).toContain(reconciled[1]);
  });

  it('prefers the defaults when topping up, so the row looks like a fresh install', () => {
    expect(reconcileHomeActions(['scan_barcode', 'ai_photo'], available)).toEqual([
      ...DEFAULT_HOME_ACTIONS,
    ]);
  });

  it('tops up from whatever is offered when the defaults are not', () => {
    const narrow: HomeActionKey[] = ['my_meals', 'add_note'];

    expect(reconcileHomeActions(['scan_barcode'], narrow)).toEqual(narrow);
  });

  it('never repeats an action or exceeds the floor while topping up', () => {
    const reconciled = reconcileHomeActions(['start_workout'], available);

    expect(new Set(reconciled).size).toBe(reconciled.length);
    expect(reconciled).toHaveLength(MIN_HOME_ACTIONS);
  });

  it('leaves a full selection alone rather than trimming it', () => {
    const selected: HomeActionKey[] = [...available];

    expect(reconcileHomeActions(selected, available)).toBe(selected);
  });
});
