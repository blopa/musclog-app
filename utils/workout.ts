import type { LucideIcon } from 'lucide-react-native';
import { Dumbbell, User } from 'lucide-react-native';

import type { SelectorOption } from '../components/theme/OptionsMultiSelector/utils';
import type { Units } from '../constants/settings';
import Exercise, { type EquipmentType } from '../database/models/Exercise';
import Schedule, { type DayOfWeek } from '../database/models/Schedule';
import type { ExerciseInWorkout } from '../database/services/WorkoutTemplateService';
import i18n from '../lang/lang';
import { Theme } from '../theme';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { kgToDisplay } from './unitConversion';
import { getWeightUnit } from './units';

// ============================================================================
// Day Mapping Utilities
// ============================================================================

// Day labels for WeekdayPicker (Monday through Sunday)
export function getWeekdayLabels(): string[] {
  return [
    i18n.t('common.days.letter.mon'),
    i18n.t('common.days.letter.tue'),
    i18n.t('common.days.letter.wed'),
    i18n.t('common.days.letter.thu'),
    i18n.t('common.days.letter.fri'),
    i18n.t('common.days.letter.sat'),
    i18n.t('common.days.letter.sun'),
  ];
}

// Day names mapping for database: WeekdayPicker index -> Day name
// WeekdayPicker uses: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
export const WEEKDAY_NAMES: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Convert day name from database to WeekdayPicker index
 */
export function dayNameToIndex(dayName: DayOfWeek | string): number {
  return WEEKDAY_NAMES.indexOf(dayName as DayOfWeek);
}

/**
 * Convert WeekdayPicker index to day name for database
 */
export function indexToDayName(index: number): DayOfWeek {
  return (WEEKDAY_NAMES[index] || WEEKDAY_NAMES[0]) as DayOfWeek;
}

// ============================================================================
// Exercise UI Helpers
// ============================================================================

export interface ExerciseIconConfig {
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
}

/**
 * Determine if an exercise is bodyweight based on equipment type
 */
export function isBodyweightExercise(equipmentType?: EquipmentType | string): boolean {
  const type = equipmentType?.toLowerCase() || '';
  return type.includes('bodyweight') || type.includes('body weight');
}

/**
 * Get icon and colors for an exercise based on whether it's bodyweight
 */
export function getExerciseIconConfig(theme: Theme, isBodyweight: boolean): ExerciseIconConfig {
  return {
    icon: isBodyweight ? User : Dumbbell,
    iconBgColor: isBodyweight ? theme.colors.background.white5 : theme.colors.accent.primary10,
    iconColor: isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary,
  };
}

/**
 * Format exercise description from sets, reps, and optionally weight.
 * @param sets
 * @param reps
 * @param weight
 * @param isBodyweight
 * @param units
 * @param appNumberLocale — `Intl` locale for decimal separator (default: current i18n language)
 */
export function formatExerciseDescription(
  sets: number,
  reps: number,
  weight?: number,
  isBodyweight?: boolean,
  units?: Units,
  appNumberLocale: string = i18n.resolvedLanguage ?? i18n.language ?? 'en-US'
): string {
  if (weight !== undefined && weight > 0 && !isBodyweight && units) {
    const displayWeight = kgToDisplay(weight, units);
    const rounded = displayWeight % 1 === 0 ? displayWeight : Math.round(displayWeight * 10) / 10;
    const unit = getWeightUnit(units);
    const weightStr =
      rounded % 1 === 0
        ? formatAppInteger(appNumberLocale, Math.round(rounded))
        : formatAppDecimal(appNumberLocale, rounded, 1);

    return i18n.t('workouts.addExercise.exerciseDescriptionWithWeight', {
      sets,
      reps,
      weight: weightStr,
      unit,
    });
  }

  return i18n.t('workouts.addExercise.exerciseDescription', { sets, reps });
}

// ============================================================================
// Exercise Option Creation
// ============================================================================

export interface ExerciseMetadata {
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  restTimeAfter?: number;
  groupId?: string;
  isDropSet?: boolean;
  notes?: string;
}

export interface CreateExerciseOptionParams {
  exercise: Exercise;
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  groupId?: string;
  units?: Units;
}

/**
 * Create a SelectorOption from exercise data
 * This combines exercise info with metadata (sets/reps/weight)
 */
export function createExerciseOption(
  theme: Theme,
  params: CreateExerciseOptionParams
): SelectorOption<string> {
  const { exercise, sets, reps, weight, isBodyweight, groupId, units } = params;

  const isBodyweightType = isBodyweightExercise(exercise.equipmentType) || isBodyweight;
  const iconConfig = getExerciseIconConfig(theme, isBodyweightType);

  return {
    id: exercise.id,
    label: exercise.name ?? '',
    description: formatExerciseDescription(
      sets,
      reps,
      weight,
      isBodyweightType,
      units,
      i18n.resolvedLanguage ?? i18n.language
    ),
    icon: iconConfig.icon,
    iconBgColor: iconConfig.iconBgColor,
    iconColor: iconConfig.iconColor,
    groupId,
  };
}

// ============================================================================
// Exercise Metadata Management
// ============================================================================

/**
 * Extract metadata from ExerciseInWorkout, excluding UI fields
 */
export function extractExerciseMetadata(exercise: ExerciseInWorkout): ExerciseMetadata {
  return {
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    isBodyweight: exercise.isBodyweight,
    restTimeAfter: exercise.restTimeAfter,
    groupId: exercise.groupId,
    isDropSet: exercise.isDropSet,
    notes: exercise.notes,
  };
}

/**
 * Update metadata map when exercises are reordered or grouped
 */
export function updateMetadataWithGroupIds(
  currentMetadata: Map<string, ExerciseMetadata>,
  reorderedExercises: SelectorOption<string>[]
): Map<string, ExerciseMetadata> {
  const updated = new Map(currentMetadata);

  reorderedExercises.forEach((ex) => {
    const existing = updated.get(ex.id);
    if (existing) {
      updated.set(ex.id, { ...existing, groupId: ex.groupId });
    } else {
      updated.set(ex.id, {
        sets: 3,
        reps: 10,
        weight: 0,
        isBodyweight: false,
        restTimeAfter: 60,
        groupId: ex.groupId,
        isDropSet: false,
        notes: undefined,
      });
    }
  });

  return updated;
}

/**
 * Convert exercises with metadata to ExerciseInWorkout format
 */
export function exercisesToWorkoutFormat(
  exercises: SelectorOption<string>[],
  metadata: Map<string, ExerciseMetadata>
): ExerciseInWorkout[] {
  return exercises.map((ex) => {
    const meta = metadata.get(ex.id) || {
      sets: 3,
      reps: 10,
      weight: 0,
      isBodyweight: false,
      restTimeAfter: 60,
      groupId: undefined,
      isDropSet: false,
      notes: undefined,
    };

    return {
      id: ex.id,
      label: ex.label,
      description: ex.description,
      icon: ex.icon,
      iconBgColor: ex.iconBgColor,
      iconColor: ex.iconColor,
      groupId: ex.groupId || meta.groupId,
      notes: meta.notes,
      sets: meta.sets,
      reps: meta.reps,
      weight: meta.weight,
      isBodyweight: meta.isBodyweight,
      restTimeAfter: meta.restTimeAfter,
      isDropSet: meta.isDropSet,
    };
  });
}

// ============================================================================
// Template Data Transformation
// ============================================================================

/**
 * Transform exercises from WorkoutTemplateService to SelectorOption format
 */
export function transformExercisesToOptions(
  exercisesInWorkout: ExerciseInWorkout[]
): SelectorOption<string>[] {
  return exercisesInWorkout.map((ex) => ({
    id: ex.id,
    label: ex.label,
    description: ex.notes ? `${ex.description} • 📝` : ex.description,
    icon: ex.icon,
    iconBgColor: ex.iconBgColor,
    iconColor: ex.iconColor,
    groupId: ex.groupId,
  }));
}

/**
 * Transform schedule days to WeekdayPicker indices
 */
export function transformScheduleDays(schedule: Schedule[]): number[] {
  return schedule.map((s) => dayNameToIndex(s.dayOfWeek ?? '')).filter((idx) => idx !== -1);
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate workout title
 */
export function validateWorkoutTitle(title: string): { valid: boolean; error?: string } {
  if (!title.trim()) {
    return {
      valid: false,
      error: 'titleRequired', // Translation key
    };
  }
  return { valid: true };
}

/**
 * Format time to HH:MM:SS format
 */
export function formatDuration(hours: number, minutes: number, seconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
