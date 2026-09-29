import {
  DEFAULT_HOME_ACTIONS,
  HOME_ACTION_KEYS,
  type HomeActionKey,
  MAX_HOME_ACTIONS,
  MIN_HOME_ACTIONS,
  parseHomeActions,
  toggleHomeAction,
} from '../homeActions';

describe('homeActions', () => {
  describe('HOME_ACTION_KEYS', () => {
    it('contains all expected keys', () => {
      expect(HOME_ACTION_KEYS).toContain('start_workout');
      expect(HOME_ACTION_KEYS).toContain('track_food');
      expect(HOME_ACTION_KEYS).toContain('scan_barcode');
      expect(HOME_ACTION_KEYS).toContain('ai_photo');
      expect(HOME_ACTION_KEYS).toContain('log_weight');
      expect(HOME_ACTION_KEYS).toContain('my_meals');
      expect(HOME_ACTION_KEYS).toContain('add_note');
      expect(HOME_ACTION_KEYS).toContain('log_cardio');
      expect(HOME_ACTION_KEYS).toHaveLength(8);
    });
  });

  describe('parseHomeActions', () => {
    const DEFAULT = ['start_workout', 'track_food'];

    it('returns default for null or empty', () => {
      expect(parseHomeActions(null)).toEqual(DEFAULT);
      expect(parseHomeActions('')).toEqual(DEFAULT);
      expect(parseHomeActions(undefined)).toEqual(DEFAULT);
    });

    it('returns default for invalid JSON', () => {
      expect(parseHomeActions('{ not json ]')).toEqual(DEFAULT);
    });

    it('returns default for non-array JSON', () => {
      expect(parseHomeActions('{"key":"value"}')).toEqual(DEFAULT);
      expect(parseHomeActions('"string"')).toEqual(DEFAULT);
    });

    it('returns default if array contains no valid keys', () => {
      expect(parseHomeActions('["unknown_key", "another_unknown"]')).toEqual(DEFAULT);
      expect(parseHomeActions('[1, 2, 3]')).toEqual(DEFAULT);
    });

    // A single action leaves the home row looking broken, and a value written by a build
    // that predates MIN_HOME_ACTIONS can still be one, so the floor is enforced on read.
    it('returns default when fewer than MIN_HOME_ACTIONS survive validation', () => {
      expect(parseHomeActions('["log_weight"]')).toEqual(DEFAULT);
      expect(parseHomeActions('["log_weight", "unknown_key"]')).toEqual(DEFAULT);
      expect(parseHomeActions('["log_weight", "log_weight"]')).toEqual(DEFAULT);
      expect(DEFAULT_HOME_ACTIONS.length).toBeGreaterThanOrEqual(MIN_HOME_ACTIONS);
    });

    it('filters out unknown keys', () => {
      expect(parseHomeActions('["start_workout", "unknown_key", "track_food"]')).toEqual([
        'start_workout',
        'track_food',
      ]);
    });

    it('removes duplicates', () => {
      expect(parseHomeActions('["start_workout", "start_workout", "track_food"]')).toEqual([
        'start_workout',
        'track_food',
      ]);
    });

    it('clamps to 4 items', () => {
      expect(
        parseHomeActions(
          '["start_workout", "track_food", "scan_barcode", "ai_photo", "log_weight"]'
        )
      ).toEqual(['start_workout', 'track_food', 'scan_barcode', 'ai_photo']);
    });

    it('clamps to MAX_HOME_ACTIONS rather than a hardcoded count', () => {
      expect(parseHomeActions(JSON.stringify(HOME_ACTION_KEYS))).toHaveLength(MAX_HOME_ACTIONS);
    });

    // Every default branch must hand back a fresh array: the picker stores the result in
    // React state and reorders it in place, which would otherwise mutate the constant
    // that `SettingsProvider` seeds its own state from.
    it('never returns the shared DEFAULT_HOME_ACTIONS array itself', () => {
      const first = parseHomeActions(null);
      first.push('log_weight');

      expect(parseHomeActions(null)).toEqual([...DEFAULT_HOME_ACTIONS]);
      expect(DEFAULT_HOME_ACTIONS).toHaveLength(2);
    });
  });

  describe('toggleHomeAction', () => {
    const two: HomeActionKey[] = ['start_workout', 'track_food'];
    const four: HomeActionKey[] = ['start_workout', 'track_food', 'log_weight', 'add_note'];

    // Pick order is home order, so an added action goes to the end rather than back to
    // its position in the canonical catalogue.
    it('appends a newly picked action', () => {
      expect(toggleHomeAction(two, 'log_weight')).toEqual([
        'start_workout',
        'track_food',
        'log_weight',
      ]);
    });

    it('removes a picked action while above the floor', () => {
      expect(toggleHomeAction(['start_workout', 'track_food', 'log_weight'], 'track_food')).toEqual(
        ['start_workout', 'log_weight']
      );
    });

    // Re-picking is the only way to reorder, so it must land at the end, not in place.
    it('moves an action to the end when removed and picked again', () => {
      const withoutFirst = toggleHomeAction(
        ['start_workout', 'track_food', 'log_weight'],
        'start_workout'
      );

      expect(toggleHomeAction(withoutFirst, 'start_workout')).toEqual([
        'track_food',
        'log_weight',
        'start_workout',
      ]);
    });

    // The same reference is the signal the caller uses to skip the write, so a refused
    // toggle must not hand back an equal-but-new array.
    it('returns the same array when the floor refuses a removal', () => {
      expect(toggleHomeAction(two, 'track_food')).toBe(two);
      expect(two).toHaveLength(MIN_HOME_ACTIONS);
    });

    it('returns the same array when the ceiling refuses an addition', () => {
      expect(toggleHomeAction(four, 'my_meals')).toBe(four);
      expect(four).toHaveLength(MAX_HOME_ACTIONS);
    });

    it('still removes at the ceiling, so a full selection is not a dead end', () => {
      expect(toggleHomeAction(four, 'log_weight')).toEqual([
        'start_workout',
        'track_food',
        'add_note',
      ]);
    });

    it('never mutates the array it was given', () => {
      const original = [...two];

      toggleHomeAction(two, 'log_weight');
      toggleHomeAction(two, 'track_food');

      expect(two).toEqual(original);
    });

    it('keeps every result within the bounds parseHomeActions enforces', () => {
      let selection: HomeActionKey[] = [...DEFAULT_HOME_ACTIONS];

      for (const key of HOME_ACTION_KEYS) {
        selection = toggleHomeAction(selection, key);
        expect(selection.length).toBeGreaterThanOrEqual(MIN_HOME_ACTIONS);
        expect(selection.length).toBeLessThanOrEqual(MAX_HOME_ACTIONS);
      }
    });
  });
});
