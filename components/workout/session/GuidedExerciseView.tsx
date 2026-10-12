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
import { ImageBackground, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import type { Units } from '@/constants/settings';
import type Exercise from '@/database/models/Exercise';
import { useExerciseImageSource } from '@/hooks/useExerciseImageSource';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { SessionDraft } from '@/hooks/useWorkoutSessionController';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { adjustedFields } from '@/utils/setAdjustment';
import { getWeightUnitI18nKey } from '@/utils/units';
import { isPerformedWorkoutSet } from '@/utils/workoutSetCompletion';

import {
  ExerciseActionChips,
  type SessionExerciseAction,
  useExerciseCategory,
} from './ExerciseHeader';
import { GuidanceSummary } from './GuidanceSummary';
import type { GuidanceState, SessionBlock, SessionSetRowModel } from './sessionModel';
import { stepInput } from './setDraft';

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
  testID,
  onChange,
}: {
  label: string;
  unit?: string;
  /** The app calculated this number (see `adjustedFields`); the user has not typed over it. */
  adjusted?: boolean;
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
  const button = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${direction > 0 ? '+' : '−'}`}
      disabled={!editable}
      onPress={() => onChange(stepInput(value, direction * step, locale, digits))}
      className="h-12 w-12 items-center justify-center rounded-full bg-bg-overlay"
    >
      {direction > 0 ? (
        <Plus size={theme.iconSize.md} color={theme.colors.text.primary} />
      ) : (
        <Minus size={theme.iconSize.md} color={theme.colors.text.primary} />
      )}
    </Pressable>
  );
  return (
    <View className="flex-1 items-center gap-2 rounded-2xl border border-border-light bg-bg-card p-3">
      <View className="flex-row items-center gap-1">
        <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {label}
          {unit ? <Text className="font-medium normal-case">{` (${unit})`}</Text> : null}
        </Text>
        {adjusted ? (
          <Calculator size={theme.iconSize.xs} color={theme.colors.accent.primary} />
        ) : null}
      </View>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={adjusted ? t('trainingFlow.adjustedHint') : undefined}
        testID={testID}
        value={value}
        editable={editable}
        onChangeText={onChange}
        keyboardType={step % 1 === 0 && digits === 0 ? 'number-pad' : 'decimal-pad'}
        inputMode="decimal"
        selectTextOnFocus
        style={{
          width: '100%',
          minHeight: 64,
          color: adjusted ? theme.colors.accent.primary : theme.colors.text.primary,
          fontSize: theme.typography.fontSize['5xl'],
          fontWeight: '700',
          textAlign: 'center',
        }}
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
  nextLabel,
  onPreviousExercise,
  onNextExercise,
  onWhy,
  onRevert,
  onAction,
  onEdit,
  onDetails,
  onComplete,
}: {
  block: SessionBlock;
  exercise: Exercise;
  row: SessionSetRowModel;
  /** The user's typed values, when there are any; `values` falls back to the set's own. */
  draft?: SessionDraft;
  values: SessionDraft;
  state: GuidanceState;
  units: Units;
  weightStep: number;
  exerciseIndex: number;
  exerciseCount: number;
  notes: string[];
  warmup: 'add' | 'remove' | null;
  busy: boolean;
  /** "Up next" — the set after this one, already resolved through the superset order. */
  nextLabel?: string;
  onPreviousExercise?: () => void;
  onNextExercise?: () => void;
  onWhy: () => void;
  onRevert: () => void;
  onAction: (action: SessionExerciseAction) => void;
  onEdit: (draft: SessionDraft) => void;
  onDetails: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { locale, formatInteger } = useFormatAppNumber();
  const image = useExerciseImageSource(exercise.imageUrl);
  const category = useExerciseCategory(exercise);
  const { set, workingNumber, prescription } = row;
  const done = isPerformedWorkoutSet(set);
  const appAdjusted = adjustedFields(set.adjustment);
  const untouched = !done && !draft;
  const weightAdjusted = untouched && appAdjusted.weight;
  const repsAdjusted = untouched && appAdjusted.reps;
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
            numberOfLines={3}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trainingFlow.previousExercise')}
              disabled={!onPreviousExercise}
              onPress={onPreviousExercise}
              className="h-11 w-11 items-center justify-center rounded-full bg-bg-overlay"
            >
              <ChevronLeft
                size={theme.iconSize.md}
                color={onPreviousExercise ? theme.colors.text.primary : theme.colors.text.tertiary}
              />
            </Pressable>
            <Text className="text-sm font-semibold text-text-secondary">
              {t('trainingFlow.exerciseOf', {
                current: formatInteger(exerciseIndex + 1),
                total: formatInteger(exerciseCount),
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('trainingFlow.nextExercise')}
              disabled={!onNextExercise}
              onPress={onNextExercise}
              className="h-11 w-11 items-center justify-center rounded-full bg-bg-overlay"
            >
              <ChevronRight
                size={theme.iconSize.md}
                color={onNextExercise ? theme.colors.text.primary : theme.colors.text.tertiary}
              />
            </Pressable>
          </View>
        ) : null}

        {notes.length ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workoutSession.notes.edit')}
            onPress={() => onAction('notes')}
            className="gap-1 rounded-lg bg-bg-overlay p-3"
          >
            {notes.map((note) => (
              <Text key={note} className="text-sm text-text-secondary" numberOfLines={3}>
                {note}
              </Text>
            ))}
          </Pressable>
        ) : null}

        <View className="flex-row gap-3">
          <StepperField
            label={t('workoutSession.weight')}
            unit={weightUnit}
            value={values.weight}
            step={weightStep}
            locale={locale}
            editable={!done}
            adjusted={weightAdjusted}
            testID={`set-${set.id}-weight`}
            onChange={(weight) => onEdit({ ...values, weight })}
          />
          <StepperField
            label={t('workoutSession.reps')}
            value={values.reps}
            step={1}
            locale={locale}
            editable={!done}
            adjusted={repsAdjusted}
            testID={`set-${set.id}-reps`}
            onChange={(reps) => onEdit({ ...values, reps })}
          />
        </View>

        <Text className="text-center text-sm text-text-secondary">
          {previous
            ? t('trainingFlow.previous', {
                weight: formatDisplayWeightKg(locale, units, previous.weightKg),
                reps: formatInteger(previous.reps, { useGrouping: false }),
                unit: weightUnit,
              })
            : t('trainingFlow.noHistory')}
        </Text>

        <GuidanceSummary
          state={state}
          rule={block.rule}
          adjustment={set.adjustment}
          units={units}
          onWhy={onWhy}
          onRevert={onRevert}
        />

        <ExerciseActionChips warmup={warmup} onAction={onAction} disabled={busy} />

        <Pressable
          accessibilityRole="button"
          onPress={onDetails}
          className="min-h-12 flex-row items-center justify-between rounded-xl bg-bg-overlay px-4"
        >
          <View className="flex-row items-center gap-2">
            <Gauge size={theme.iconSize.md} color={theme.colors.text.secondary} />
            <Text className="text-base font-medium text-text-primary">
              {t('trainingFlow.details')}
            </Text>
          </View>
          <Text className="text-sm text-text-secondary">
            {values.rir?.trim()
              ? t('trainingFlow.rir', { value: values.rir })
              : t('trainingFlow.unrated')}
          </Text>
        </Pressable>

        {done ? (
          <Button
            label={t('trainingFlow.reopen')}
            icon={RotateCcw}
            variant="outline"
            size="lg"
            width="full"
            disabled={busy}
            onPress={onComplete}
          />
        ) : (
          <View testID={`set-${set.id}-complete`}>
            <Button
              label={t('trainingFlow.complete')}
              icon={CheckCircle}
              variant="gradientCta"
              size="lg"
              width="full"
              disabled={busy}
              onPress={onComplete}
            />
          </View>
        )}
        {nextLabel ? (
          <Text className="text-center text-sm text-text-tertiary">
            {t('trainingFlow.upNext', { next: nextLabel })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
