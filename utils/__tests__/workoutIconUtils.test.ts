import { Dumbbell, Flame, Heart, Trophy } from 'lucide-react-native';

import { getWorkoutIcon, WORKOUT_ICON_MAP, WORKOUT_ICON_OPTIONS } from '@/utils/workoutIconUtils';

describe('getWorkoutIcon', () => {
  it('resolves a stored icon name to its lucide component', () => {
    expect(getWorkoutIcon('trophy')).toBe(Trophy);
    expect(getWorkoutIcon('heart')).toBe(Heart);
    expect(getWorkoutIcon('flame')).toBe(Flame);
  });

  it('falls back to Dumbbell when no icon is stored', () => {
    // Templates created before the icon column existed (and AI templates that omit it)
    // read back as null/undefined/'' and must still render.
    expect(getWorkoutIcon(undefined)).toBe(Dumbbell);
    expect(getWorkoutIcon(null)).toBe(Dumbbell);
    expect(getWorkoutIcon('')).toBe(Dumbbell);
  });

  it('falls back to Dumbbell for an unrecognised icon name', () => {
    // The value can come straight from an LLM, so an invented name must not crash the card.
    expect(getWorkoutIcon('rocket')).toBe(Dumbbell);
  });

  it('looks up case-sensitively, so a capitalised name falls back', () => {
    // The picker stores the lowercase `value`, not the `ai.icons.*` label.
    expect(getWorkoutIcon('Trophy')).toBe(Dumbbell);
    expect(getWorkoutIcon('FLAME')).toBe(Dumbbell);
  });
});

describe('WORKOUT_ICON_OPTIONS', () => {
  it('offers exactly the icons the resolver can render', () => {
    // The picker list and the lookup table are two hand-maintained registries; an option
    // without a map entry would render as a silent Dumbbell.
    expect(WORKOUT_ICON_OPTIONS.map((option) => option.value).sort()).toEqual(
      Object.keys(WORKOUT_ICON_MAP).sort()
    );
  });

  it('resolves every offered option to a distinct, non-fallback component', () => {
    const resolved = WORKOUT_ICON_OPTIONS.map((option) => getWorkoutIcon(option.value));
    expect(new Set(resolved).size).toBe(WORKOUT_ICON_OPTIONS.length);
    // `dumbbell` is the one option that legitimately resolves to the fallback component.
    const accidentalFallbacks = WORKOUT_ICON_OPTIONS.filter(
      (option) => option.value !== 'dumbbell' && getWorkoutIcon(option.value) === Dumbbell
    );
    expect(accidentalFallbacks).toEqual([]);
  });

  it('labels every option with an ai.icons translation key', () => {
    // These labels are only visible to `scripts/check-translations.js` through this table.
    expect(WORKOUT_ICON_OPTIONS.every((option) => option.label.startsWith('ai.icons.'))).toBe(true);
  });
});
