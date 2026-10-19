import { LinearGradient } from 'expo-linear-gradient';
import {
  Calculator,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ImageBackground, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { ListRow } from '@/components/theme/ListRow';
import { NumericTextField } from '@/components/theme/NumericTextField';
import { TextButton } from '@/components/theme/TextButton';
import type { Units } from '@/constants/settings';
import type Exercise from '@/database/models/Exercise';
import { useExerciseImageSource } from '@/hooks/useExerciseImageSource';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import type { GuidanceState } from '@/utils/progressionProjection';
import { adjustedFields } from '@/utils/setAdjustment';
import { getWeightUnitI18nKey } from '@/utils/units';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

import {
  ExerciseActionChips,
  type SessionExerciseAction,
  useExerciseCategory,
} from './ExerciseHeader';
import { ExerciseNotes, type SessionNote } from './ExerciseNotes';
import { GuidanceSummary } from './GuidanceSummary';
import { RirQuickPick } from './RirQuickPick';
import {
  canRevertStartAdjustment,
  type SessionBlock,
  type SessionSetRowModel,
} from './sessionModel';
import { draftFromPrevious, type SetDraftField, stepInput } from './setDraft';

const HERO_HEIGHT = 260;

/** Decimal places a step needs to stay exact: 2.5 → 1, 1.25 → 2, 5 → 0. */
const stepFractionDigits = (step: number) => {
  for (let digits = 0; digits <= 3; digits++) {
    if (Math.abs(Math.round(step * 10 ** digits) - step * 10 ** digits) < 1e-9) {
      return digits;
    }
  }

  return 3;
};

function StepperField({
  label,
  unit,
  value,
  step,
  locale,
  editable,
  adjusted,
  invalid,
  testID,
  onChange,
}: {
  label: string;
  unit?: string;
  /** The app calculated this number (see `adjustedFields`); the user has not typed over it. */
  adjusted?: boolean;
  /** The value stopped the last completion (see `setDraftProblem`). */
  invalid?: boolean;
  value: string;
  step: number;
  locale: string;
  editable: boolean;
  testID: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const digits = stepFractionDigits(step);
  const wholeNumbers = Number.isInteger(step) && digits === 0;
  const button = (direction: -1 | 1) => (
    <IconButton
      icon={direction > 0 ? Plus : Minus}
      accessibilityLabel={`${label} ${direction > 0 ? '+' : '−'}`}
      size="lg"
      disabled={!editable}
      onPress={() => onChange(stepInput(value, direction * step, locale, digits))}
    />
  );
  return (
    <View className="flex-1 items-center gap-2 rounded-2xl border border-border-light bg-bg-card p-3">
      <View className="flex-row items-center gap-1">
        <Text className="text-xs font-bold text-text-secondary">
          {label}
          {unit ? <Text className="font-medium normal-case">{` (${unit})`}</Text> : null}
        </Text>
        {adjusted ? (
          <Calculator size={theme.iconSize.xs} color={theme.colors.accent.primary} />
        ) : null}
      </View>
      <NumericTextField
        size="hero"
        accessibilityLabel={label}
        accessibilityHint={adjusted ? t('trainingFlow.adjustedHint') : undefined}
        testID={testID}
        value={value}
        editable={editable}
        onChangeText={onChange}
        integer={wholeNumbers}
        marked={!!adjusted}
        invalid={invalid}
      />
      <View className="flex-row gap-3">
        {button(-1)}
        {button(1)}
      </View>
    </View>
  );
}

/**
 * The Guided view: one set at a time, large enough to read from the bench, over the exercise's
 * photo. It edits the same drafts and saves through the same controller as Inline, so switching
 * views changes only what is drawn.
 */
export function GuidedExerciseView({
  block,
  exercise,
  row,
  draft,
  values,
  state,
  units,
  weightStep,
  exerciseIndex,
  exerciseCount,
  notes,
  warmup,
  busy,
  invalidField,
  nextLabel,
  onPreviousExercise,
  onNextExercise,
  onWhy,
  onRevert,
  onAction,
  onEdit,
  onDetails,
}: {
  block: SessionBlock;
  exercise: Exercise;
  row: SessionSetRowModel;
  /** The user's typed values, when there are any; `values` falls back to the set's own. */
  draft?: Partial<SessionDraft>;
  values: SessionDraft;
  state: GuidanceState;
  units: Units;
  weightStep: number;
  exerciseIndex: number;
  exerciseCount: number;
  notes: SessionNote[];
  warmup: 'add' | 'remove' | null;
  busy: boolean;
  /** The field that stopped the last attempt to complete this set, until the user edits it. */
  invalidField?: SetDraftField | null;
  /** "Up next" — the set after this one, already resolved through the superset order. */
  nextLabel?: string;
  onPreviousExercise?: () => void;
  onNextExercise?: () => void;
  onWhy: () => void;
  onRevert: () => void;
  onAction: (action: SessionExerciseAction) => void;
  onEdit: (patch: Partial<SessionDraft>) => void;
  onDetails: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const image = useExerciseImageSource(exercise.imageUrl);
  const category = useExerciseCategory(exercise);
  const { set, workingNumber, prescription } = row;
  const done = isPerformedWorkoutSet(set);
  const appAdjusted = adjustedFields(set.adjustment);
  const weightAdjusted = !done && draft?.weight === undefined && appAdjusted.weight;
  const repsAdjusted = !done && draft?.reps === undefined && appAdjusted.reps;
  const isLastWorkingSet = workingNumber != null && workingNumber === block.workingCount;
  const previous = prescription?.previous;
  const weightUnit = t(getWeightUnitI18nKey(units));

  return (
    <View testID={`guided-${block.logExerciseId}`}>
      <ImageBackground
        source={image}
        resizeMode="cover"
        style={{ height: HERO_HEIGHT, marginHorizontal: -16, justifyContent: 'flex-end' }}
      >
        <LinearGradient
          colors={[
            ...theme.colors.gradients.workoutSessionOverlay,
            theme.colors.background.primary,
          ]}
          locations={[0, 0.2, 0.5, 1]}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
        <View className="gap-2 px-4 pb-2">
          <Text
            className="font-bold text-text-primary"
            style={{ fontSize: theme.typography.fontSize['4xl'], lineHeight: 42 }}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {exercise.name}
          </Text>
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="rounded-full bg-accent-primary px-3.5 py-1.5">
              <Text className="text-sm font-bold text-text-on-accent">
                {workingNumber == null
                  ? t('workoutSession.warmup.badge')
                  : t('workoutSession.setOf', {
                      current: formatInteger(workingNumber),
                      total: formatInteger(block.workingCount),
                    })}
              </Text>
            </View>
            {isLastWorkingSet ? (
              <Text className="text-sm font-semibold text-accent-primary">
                {t('workoutSession.lastSetForExercise')}
              </Text>
            ) : null}
            {category ? <Text className="text-sm text-text-secondary">{category}</Text> : null}
          </View>
        </View>
      </ImageBackground>

      <View className="gap-4 pt-3">
        {exerciseCount > 1 ? (
          <View className="flex-row items-center justify-between">
            <IconButton
              icon={ChevronLeft}
              accessibilityLabel={t('trainingFlow.previousExercise')}
              disabled={!onPreviousExercise}
              onPress={onPreviousExercise}
            />
            <Text className="text-sm font-semibold text-text-secondary">
              {t('trainingFlow.exerciseOf', {
                current: formatInteger(exerciseIndex + 1),
                total: formatInteger(exerciseCount),
              })}
            </Text>
            <IconButton
              icon={ChevronRight}
              accessibilityLabel={t('trainingFlow.nextExercise')}
              disabled={!onNextExercise}
              onPress={onNextExercise}
            />
          </View>
        ) : null}

        <ExerciseNotes notes={notes} onPress={() => onAction('notes')} />

        {/* Last time sits above the numbers it informs; one tap repeats it. */}
        {previous ? (
          <TextButton
            label={t('trainingFlow.previous', {
              weight: formatDisplayWeightKg(locale, units, previous.weightKg),
              reps: formatInteger(previous.reps, { useGrouping: false }),
              unit: weightUnit,
            })}
            accessibilityLabel={t('trainingFlow.usePrevious')}
            tone="muted"
            align="center"
            disabled={done}
            onPress={() => onEdit(draftFromPrevious(values, previous, units, locale))}
            testID={`set-${set.id}-previous`}
          />
        ) : (
          <Text className="text-center text-sm text-text-secondary">
            {t('trainingFlow.noHistory')}
          </Text>
        )}

        <View className="flex-row gap-3">
          <StepperField
            label={t('workoutSession.weight')}
            unit={weightUnit}
            value={values.weight}
            step={weightStep}
            locale={locale}
            editable={!done}
            adjusted={weightAdjusted}
            invalid={invalidField === 'weight'}
            testID={`set-${set.id}-weight`}
            onChange={(weight) => onEdit({ weight })}
          />
          <StepperField
            label={t('workoutSession.reps')}
            value={values.reps}
            step={1}
            locale={locale}
            editable={!done}
            adjusted={repsAdjusted}
            invalid={invalidField === 'reps'}
            testID={`set-${set.id}-reps`}
            onChange={(reps) => onEdit({ reps })}
          />
        </View>

        <RirQuickPick
          value={values.rir}
          disabled={done}
          onChange={(rir) => onEdit({ rir })}
          testID={`set-${set.id}-rir-quick`}
        />

        <GuidanceSummary
          state={state}
          rule={block.rule}
          adjustment={set.adjustment}
          units={units}
          onWhy={onWhy}
          canRevert={canRevertStartAdjustment(block)}
          onRevert={onRevert}
        />

        <ExerciseActionChips
          warmup={warmup}
          onAction={onAction}
          disabled={busy}
          canSwap={block.doneCount < block.rows.length}
        />

        <ListRow
          icon={Gauge}
          iconColor={theme.colors.text.secondary}
          title={t('trainingFlow.details')}
          onPress={onDetails}
          trailing={
            <Text className="text-sm text-text-secondary">
              {values.rir?.trim()
                ? t('trainingFlow.rir', { value: values.rir })
                : t('trainingFlow.unrated')}
            </Text>
          }
        />

        {nextLabel ? (
          <Text className="text-center text-sm text-text-tertiary">
            {t('trainingFlow.upNext', { next: nextLabel })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Complete (or reopen) the Guided set. It is pinned above the rest bar by `WorkoutTrainingView`
 * rather than placed at the end of the scroll: under the hero, steppers and guidance it sat below
 * the fold on a 390×844 phone, so the one action taken on every set needed a scroll first.
 */
export function GuidedCompleteButton({
  setId,
  done,
  busy,
  onPress,
}: {
  setId: string;
  done: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return done ? (
    <Button
      label={t('trainingFlow.reopen')}
      icon={RotateCcw}
      variant="outline"
      size="lg"
      width="full"
      disabled={busy}
      onPress={onPress}
    />
  ) : (
    <View testID={`set-${setId}-complete`}>
      <Button
        label={t('trainingFlow.complete')}
        icon={CheckCircle}
        variant="gradientCta"
        size="lg"
        width="full"
        disabled={busy}
        onPress={onPress}
      />
    </View>
  );
}
