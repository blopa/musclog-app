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
});

/**
 * Screens whose controls were hand-rolled `Pressable`s and raw `TextInput`s, now built from the
 * theme components. A new control in one of them belongs in `components/theme/` too.
 */
const THEMED_FILES = [
  'app/app/nutrition/checkin-list.tsx',
  'app/app/test/progression-flow.tsx',
  'components/ZoomableImageModal.tsx',
  'components/modals/EditGymModal.tsx',
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
