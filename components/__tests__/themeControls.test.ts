import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

/**
 * Source with comments stripped. Like `statStrip.test.ts`, these assertions are about what the
 * components render, and the repo has no component-rendering harness, so they read the source; the
 * comments name the very patterns the rules forbid, so matching on code only keeps a failure
 * meaning what it says.
 */
function code(path: string): string {
  return readFileSync(join(root, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The props of the first `<Tag` element in `source`, up to its closing `>` or `/>`. */
function elementProps(source: string, tag: string): string {
  const start = source.indexOf(`<${tag}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('/>', start);
  return source.slice(start, end);
}

describe('NumericTextField', () => {
  const source = code('components/theme/NumericTextField.tsx');

  it('never hands its placeholder to the native input', () => {
    // A centered Android TextInput with a native placeholder puts the caret at the far edge of
    // an empty field on first focus (the RIR field in the set-details sheet). The placeholder is
    // drawn as an overlay instead.
    expect(elementProps(source, 'TextInput')).not.toMatch(/\bplaceholder(TextColor)?=/);
  });

  it('hides the drawn placeholder while the field is focused', () => {
    expect(source).toMatch(/showPlaceholder\s*=[^;]*!focused/);
  });

  it('keeps the drawn placeholder out of the way of taps and screen readers', () => {
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain('importantForAccessibility="no-hide-descendants"');
  });

  it('outlines its surface instead of relying on a fill that can match the sheet', () => {
    // The set-details sheet is painted `cardElevated`, which was also the field's only surface,
    // so its effort inputs had no visible edge. A surfaced field is outlined like `TextInput`,
    // the outline turns accent while focused, and a `field` uses `TextInput`'s `card` fill.
    expect(source).toMatch(/surface \? theme\.colors\.background\.ink10/);
    expect(source).toMatch(
      /focused && surface\)\s*\{\s*borderColor = theme\.colors\.accent\.primary/
    );
    expect(source).toMatch(/size === 'field' \? theme\.colors\.background\.card :/);
    expect(source).toMatch(/borderWidth: theme\.borderWidth\.medium,/);
  });
});

describe('ListRow', () => {
  const source = code('components/theme/ListRow.tsx');

  it('shows a value next to the chevron rather than in its place', () => {
    // `trailing` replaces the chevron; the effort row passed its value there and lost the only cue
    // that it opens a sheet. `value` renders before whatever trailing cue the row keeps.
    const valueAt = source.indexOf('{value ? (');
    const trailingAt = source.indexOf('{trailing === undefined ? defaultTrailing : trailing}');
    expect(valueAt).toBeGreaterThanOrEqual(0);
    expect(trailingAt).toBeGreaterThan(valueAt);
  });

  it.each(['components/workout/session/GuidedExerciseView.tsx'])(
    '%s keeps the chevron on rows that show a value',
    (path) => {
      // A text value handed to `trailing` is the pattern that hid the "Effort and details" tap cue.
      expect(code(path)).not.toMatch(/trailing=\{\s*<Text/);
    }
  );
});

/**
 * Screens whose controls were hand-rolled `Pressable`s and raw `TextInput`s, now built from the
 * theme components. A new control in one of them belongs in `components/theme/` too.
 */
const THEMED_FILES = [
  'app/app/weekly-review.tsx',
  'app/app/test/progression-flow.tsx',
  'components/ZoomableImageModal.tsx',
  'components/modals/EditGymModal.tsx',
  'components/modals/ReplaceExerciseModal.tsx',
  'components/modals/SmartCameraShell.tsx',
  'components/modals/WorkoutSettingsModal.tsx',
  'components/weeklyReview/NutritionReviewSection.tsx',
  'components/weeklyReview/TrainingReviewSection.tsx',
  'components/workout/ExerciseAliasesSection.tsx',
  'components/workout/ExerciseRestrictionSection.tsx',
  'components/workout/WeightUnitOverridePicker.tsx',
  'components/workout/WorkoutSummaryProgression.tsx',
  'components/workout/WorkoutTodayCard.tsx',
  'components/workout/session/ExerciseHeader.tsx',
  'components/workout/session/GuidedExerciseView.tsx',
  'components/workout/session/ProgressionWhySheet.tsx',
  'components/workout/session/SessionTopBar.tsx',
  'components/workout/session/SetDetailsSheet.tsx',
];

/** React Native's own `TextInput`, as opposed to the theme's. */
const RAW_TEXT_INPUT = /import\s*\{[^}]*\bTextInput\b[^}]*\}\s*from\s*'react-native'/;

describe('theme controls', () => {
  it('pairs segmented labels with the ink for their actual background', () => {
    const source = code('components/theme/SegmentedControl.tsx');
    expect(source).toContain('backgroundColor: theme.colors.accent.primary');
    expect(source).not.toContain('LinearGradient');
    expect(source).toContain('font-bold text-text-on-accent');
    expect(source).toContain('font-bold text-text-secondary');
    expect(source).not.toContain('text-text-tertiary');
  });

  it('marks the selected segment with the accent in every full-width variant', () => {
    // `elevated` and `outline` drew the selected segment as `bg-card` on the `bg-cardElevated`
    // track, which was barely distinguishable from the unselected options.
    const source = code('components/theme/SegmentedControl.tsx');
    expect(source).toMatch(
      /\{isSelected \? \(\s*<View\s+style=\{\{[^}]*backgroundColor: theme.colors.accent.primary/
    );
    expect(source).not.toContain('bg-bg-card ');
    expect(source).not.toMatch(/variant === 'gradient' && isSelected/);
  });

  it.each([
    'components/EditPhysicalStatsBody.tsx',
    'components/modals/BasicSettingsModal.tsx',
    'components/modals/CoachModal.tsx',
    'components/modals/CreateWorkoutModal.tsx',
    'components/modals/PastWorkoutsHistoryFilterMenu.tsx',
  ])('%s inks its segment icons for the accent fill', (path) => {
    // A static accent or primary-ink icon vanishes on the selected segment's accent fill.
    const source = code(path);
    expect(source).toMatch(/icon: \(selected: boolean\) =>/);
    expect(source).toContain('selected ? theme.colors.text.onAccent : theme.colors.text.secondary');
  });

  it('announces every segment as a radio, whatever the variant', () => {
    // The pill was a radiogroup while the full-width variants were buttons, so the same control
    // read as two different things to a screen reader.
    const source = code('components/theme/SegmentedControl.tsx');
    expect(source.match(/accessibilityRole="radiogroup"/g)).toHaveLength(2);
    expect(source.match(/accessibilityRole="radio"/g)).toHaveLength(2);
    expect(source).not.toContain('accessibilityRole="button"');
    expect(source.match(/checked: isSelected/g)).toHaveLength(2);
  });

  it('uses the full-width pill for every setting value in the notification settings', () => {
    // A form of settings mixed four pills with one full-width elevated control, which looks like
    // a view switcher and made the same kind of choice look like two; and pills that hugged their
    // options left a ragged edge beside the full-width cards (see DESIGN.md → Buttons).
    const source = code('components/modals/NotificationsSettingsModal.tsx');
    const controls = source.split('<SegmentedControl').slice(1);
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const props = control.slice(0, control.indexOf('/>'));
      expect(props).toContain('variant="pill"');
      expect(props).toMatch(/\bfullWidth\b/);
    }
  });

  it('stretches a fullWidth pill and shares the track between its options', () => {
    const source = code('components/theme/SegmentedControl.tsx');
    expect(source).toContain("fullWidth ? 'self-stretch' : 'self-start'");
    expect(source).toContain("fullWidth ? 'flex-1 justify-center' : ''");
  });

  it.each(THEMED_FILES)('%s builds its controls from components/theme', (path) => {
    const source = code(path);
    expect(source).not.toContain('<Pressable');
    expect(source).not.toMatch(RAW_TEXT_INPUT);
    expect(source).toContain("from '@/components/theme/");
  });

  it.each([
    'components/workout/session/SetDetailsSheet.tsx',
    'components/workout/session/GuidedExerciseView.tsx',
    'components/workout/session/InlineSetRow.tsx',
  ])('%s enters set numbers through NumericTextField', (path) => {
    const source = code(path);
    expect(source).toContain('<NumericTextField');
    expect(source).not.toMatch(RAW_TEXT_INPUT);
  });
});
