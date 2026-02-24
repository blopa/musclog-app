import type { LucideIcon } from 'lucide-react-native';
import { Dumbbell, User } from 'lucide-react-native';

import type { SelectorOption } from '../components/theme/OptionsMultiSelector/utils';
import Exercise, { type EquipmentType } from '../database/models/Exercise';
import Schedule, { type DayOfWeek } from '../database/models/Schedule';
import type { ExerciseInWorkout } from '../database/services/WorkoutTemplateService';
import i18n from '../lang/lang';
import { theme } from '../theme';

// ============================================================================
// Day Mapping Utilities
// ============================================================================

// Day labels for WeekdayPicker (Monday through Sunday)
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
export function getExerciseIconConfig(isBodyweight: boolean): ExerciseIconConfig {
  return {
    icon: isBodyweight ? User : Dumbbell,
    iconBgColor: isBodyweight ? theme.colors.background.white5 : theme.colors.accent.primary10,
    iconColor: isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary,
  };
}

/**
 * Format exercise description from sets and reps
 */
export function formatExerciseDescription(sets: number, reps: number): string {
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
  restTimeAfter?: number; // Rest time in seconds after completing this set
  groupId?: string;
  isDropSet?: boolean;
}

export interface CreateExerciseOptionParams {
  exercise: Exercise;
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  groupId?: string;
}

/**
 * Create a SelectorOption from exercise data
 * This combines exercise info with metadata (sets/reps/weight)
 */
export function createExerciseOption(params: CreateExerciseOptionParams): SelectorOption<string> {
  const { exercise, sets, reps, weight, isBodyweight, groupId } = params;

  const isBodyweightType = isBodyweightExercise(exercise.equipmentType) || isBodyweight;
  const iconConfig = getExerciseIconConfig(isBodyweightType);

  return {
    id: exercise.id,
    label: exercise.name ?? '',
    description: formatExerciseDescription(sets, reps),
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
      // Create default metadata if it doesn't exist
      updated.set(ex.id, {
        sets: 3,
        reps: 10,
        weight: 0,
        isBodyweight: false,
        restTimeAfter: 60, // Default to 60 seconds
        groupId: ex.groupId,
        isDropSet: false,
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
      restTimeAfter: 60, // Default to 60 seconds
      groupId: undefined,
      isDropSet: false,
    };

    return {
      id: ex.id,
      label: ex.label,
      description: ex.description,
      icon: ex.icon,
      iconBgColor: ex.iconBgColor,
      iconColor: ex.iconColor,
      groupId: ex.groupId || meta.groupId,
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
    description: ex.description,
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
