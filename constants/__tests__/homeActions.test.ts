import {
  DEFAULT_HOME_ACTIONS,
  HOME_ACTION_KEYS,
  MAX_HOME_ACTIONS,
  parseHomeActions,
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
});
