import { Q } from '@nozbe/watermelondb';
import convert from 'convert';
import { Dumbbell, User } from 'lucide-react-native';

import type { RawWorkoutTemplate } from '../../components/modals/BrowseTemplatesModal';
import { UNITS_SETTING_TYPE } from '../../constants/settings';
import i18n from '../../lang/lang';
import { theme } from '../../theme';
import { getWeightUnit } from '../../utils/units';
import { indexToDayName, WEEKDAY_NAMES } from '../../utils/workout';
import { database } from '../index';
import Exercise from '../models/Exercise';
import Schedule from '../models/Schedule';
import Setting from '../models/Setting';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutTemplateSet from '../models/WorkoutTemplateSet';
import { WorkoutTemplateRepository } from '../repositories/WorkoutTemplateRepository';
import { UserMetricService } from './UserMetricService';
import { UserService } from './UserService';

/**
 * Exercise data for workout template creation/editing.
 * Combines Exercise model fields with WorkoutTemplateSet data and UI-specific properties.
 */
export type ExerciseInWorkout = Pick<Exercise, 'id'> & {
  label: string; // UI label (derived from exercise name)
  description: string; // UI description (formatted sets/reps)
  icon: any;
  iconBgColor: string;
  iconColor: string;
  groupId?: string; // UI-only for grouping
  sets: number; // From WorkoutTemplateSet aggregation
  reps: number; // From WorkoutTemplateSet
  weight: number; // From WorkoutTemplateSet
  isBodyweight: boolean; // Derived from Exercise.equipmentType
  restTimeAfter?: number; // From WorkoutTemplateSet
  isDropSet?: boolean; // From WorkoutTemplateSet (true if any set in exercise is a drop set)
};

export interface SaveTemplateData {
  templateId?: string;
  name: string;
  description?: string;
  volumeCalculationType?: string;
  weekDaysJson?: number[];
  exercises: ExerciseInWorkout[];
  selectedDays: number[];
}

export class WorkoutTemplateService {
  /**
   * Get template with all details (sets and schedule)
   */
  static async getTemplateWithDetails(templateId: string): Promise<{
    template: WorkoutTemplate;
    sets: WorkoutTemplateSet[];
    schedule: Schedule[];
  }> {
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);

    // Fetch template sets ordered by set_order
    const sets = await database
      .get<WorkoutTemplateSet>('workout_template_sets')
      .query(
        Q.where('template_id', templateId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('set_order', Q.asc)
      )
      .fetch();

    // Fetch schedule entries
    const schedule = await database
      .get<Schedule>('schedules')
      .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return { template, sets, schedule };
  }

  /**
   * Convert template sets to ExerciseInWorkout array
   * Groups sets by exercise and aggregates the data
   */
  static async convertSetsToExercises(sets: WorkoutTemplateSet[]): Promise<ExerciseInWorkout[]> {
    if (sets.length === 0) {
      return [];
    }

    // Get unique exercise IDs
    const exerciseIds = [...new Set(sets.map((set) => set.exerciseId))];

    // Fetch exercise details
    const exercises = await database
      .get<Exercise>('exercises')
      .query(
        Q.where('id', Q.oneOf(exerciseIds.filter((id) => id !== undefined))),
        Q.where('deleted_at', Q.eq(null))
      )
      .fetch();

    // Create map for quick lookup
    const exerciseMap = new Map<string, Exercise>();
    exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

    // Group sets by exercise
    const exerciseGroups = new Map<string, WorkoutTemplateSet[]>();
    sets.forEach((set) => {
      const exerciseId = set.exerciseId ?? '';
      if (!exerciseGroups.has(exerciseId)) {
        exerciseGroups.set(exerciseId, []);
      }
      exerciseGroups.get(exerciseId)!.push(set);
    });

    // Convert to ExerciseInWorkout format
    const exercisesInWorkout: ExerciseInWorkout[] = [];
    exerciseGroups.forEach((exerciseSets, exerciseId) => {
      const exercise = exerciseMap.get(exerciseId);
      if (!exercise) {
        return;
      } // Skip if exercise not found

      // Get the first set's data (all sets for same exercise should have same reps/weight)
      const firstSet = exerciseSets[0];
      const setsCount = exerciseSets.length;

      // Determine icon and colors based on exercise type
      const equipmentType = exercise.equipmentType?.toLowerCase() || '';
      const isBodyweight =
        equipmentType.includes('bodyweight') || equipmentType.includes('body weight');

      // Get icon based on exercise type
      const Icon = isBodyweight ? User : Dumbbell;

      // Get colors based on exercise type
      const iconBgColor = isBodyweight
        ? theme.colors.background.white5
        : theme.colors.accent.primary10;
      const iconColor = isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary;

      // Generate description
      const weightText = isBodyweight ? 'bodyweight' : `${firstSet.targetWeight} kg`;
      const description = `${setsCount} sets × ${firstSet.targetReps} reps`;

      exercisesInWorkout.push({
        id: exerciseId,
        label: exercise.name ?? '',
        description,
        icon: Icon,
        iconBgColor,
        iconColor,
        groupId: firstSet.groupId, // Load groupId from database
        sets: setsCount,
        reps: firstSet.targetReps ?? 0,
        weight: firstSet.targetWeight ?? 0,
        isBodyweight,
        restTimeAfter: firstSet.restTimeAfter,
        isDropSet: exerciseSets.some((s) => s.isDropSet),
      });
    });

    // Sort by set_order of first set in each group
    exercisesInWorkout.sort((a, b) => {
      const aSets = exerciseGroups.get(a.id)!;
      const bSets = exerciseGroups.get(b.id)!;
      const aOrder = aSets[0].setOrder;
      const bOrder = bSets[0].setOrder;
      return (aOrder ?? 0) - (bOrder ?? 0);
    });

    return exercisesInWorkout;
  }

  /**
   * Save or update workout template
   */
  static async saveTemplate(data: SaveTemplateData): Promise<WorkoutTemplate> {
    const now = Date.now();

    return await database.write(async () => {
      let template: WorkoutTemplate;

      // Create or update template
      if (data.templateId) {
        // Update existing template
        template = await database.get<WorkoutTemplate>('workout_templates').find(data.templateId);
        await template.update((t) => {
          t.name = data.name;
          t.description = data.description || undefined;
          t.volumeCalculationType =
            data.volumeCalculationType ?? t.volumeCalculationType ?? 'standard';
          t.weekDaysJson = data.weekDaysJson ?? t.weekDaysJson;
          t.updatedAt = now;
        });

        // Soft delete existing template sets
        const existingSets = await database
          .get<WorkoutTemplateSet>('workout_template_sets')
          .query(Q.where('template_id', data.templateId), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        for (const set of existingSets) {
          await set.update((s) => {
            s.deletedAt = now;
            s.updatedAt = now;
          });
        }

        // Soft delete existing schedule entries
        const existingSchedule = await database
          .get<Schedule>('schedules')
          .query(Q.where('template_id', data.templateId), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        for (const schedule of existingSchedule) {
          await schedule.update((s) => {
            s.deletedAt = now;
            s.updatedAt = now;
          });
        }
      } else {
        // Create new template
        template = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
          t.name = data.name;
          t.description = data.description || undefined;
          t.volumeCalculationType = data.volumeCalculationType || 'standard';
          t.weekDaysJson = data.weekDaysJson || undefined;
          t.isArchived = false; // Default to not archived
          t.createdAt = now;
          t.updatedAt = now;
        });
      }

      // Create template sets
      const templateSetsCollection = database.get<WorkoutTemplateSet>('workout_template_sets');
      const preparedSets: WorkoutTemplateSet[] = [];

      // Calculate set_order based on exercise order
      // set_order is continuous across all exercises in the workout
      // Example: Exercise 1 (3 sets) = orders 1,2,3; Exercise 2 (2 sets) = orders 4,5
      let currentOrder = 0;
      data.exercises.forEach((exercise) => {
        // Create sets for this exercise
        // All sets for this exercise will have sequential order starting from currentOrder + 1
        for (let set = 1; set <= exercise.sets; set++) {
          currentOrder++; // Increment first, then assign (so first set is 1, not 0)
          preparedSets.push(
            templateSetsCollection.prepareCreate((ts) => {
              ts.templateId = template.id;
              ts.exerciseId = exercise.id;
              ts.targetReps = exercise.reps;
              ts.targetWeight = exercise.isBodyweight ? 0 : exercise.weight;
              ts.restTimeAfter = exercise.restTimeAfter ?? 60; // Default to 60 seconds if not provided
              ts.setOrder = currentOrder;
              ts.groupId = exercise.groupId; // Persist groupId from UI
              ts.isDropSet = exercise.isDropSet ?? false;
              ts.createdAt = now;
              ts.updatedAt = now;
            })
          );
        }
      });

      // Batch create all template sets
      if (preparedSets.length > 0) {
        await database.batch(...preparedSets);
      }

      // Create schedule entries
      // WeekdayPicker indices: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
      const schedulesCollection = database.get<Schedule>('schedules');
      const preparedSchedules: Schedule[] = [];

      data.selectedDays.forEach((dayIndex) => {
        if (dayIndex >= 0 && dayIndex < WEEKDAY_NAMES.length) {
          preparedSchedules.push(
            schedulesCollection.prepareCreate((s) => {
              s.templateId = template.id;
              s.dayOfWeek = indexToDayName(dayIndex);
              s.createdAt = now;
              s.updatedAt = now;
            })
          );
        }
      });

      // Batch create all schedule entries
      if (preparedSchedules.length > 0) {
        await database.batch(...preparedSchedules);
      }

      return template;
    });
  }

  /**
   * Get all active workout templates with metadata (exercise count, last completed, etc.)
   */
  static async getAllTemplatesWithMetadata(scope: 'active' | 'archived' = 'active'): Promise<
    {
      id: string;
      name: string;
      description?: string;
      exerciseCount: number;
      lastCompleted?: string; // Formatted relative date string
      lastCompletedTimestamp?: number;
      duration?: string; // Formatted duration string
      image?: any;
    }[]
  > {
    // Fetch templates based on scope
    const templates =
      scope === 'archived'
        ? await WorkoutTemplateRepository.getArchived().fetch()
        : await WorkoutTemplateRepository.getActive().fetch();

    // Process each template to get metadata
    const templatesWithMetadata = await Promise.all(
      templates.map((template) => this.processTemplateMetadata(template))
    );

    // Sort by last completed (most recent first), then by creation date
    templatesWithMetadata.sort((a, b) => {
      // If one has lastCompleted and other doesn't, prioritize the one with lastCompleted
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) {
        return -1;
      }
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return 1;
      }
      // If both have lastCompleted, sort by timestamp (most recent first)
      if (a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return b.lastCompletedTimestamp - a.lastCompletedTimestamp;
      }
      // If neither has lastCompleted, maintain original order (by created_at desc)
      return 0;
    });

    return templatesWithMetadata;
  }

  /**
   * Helper function to process a single template and get its metadata
   */
  private static async processTemplateMetadata(template: WorkoutTemplate): Promise<{
    id: string;
    name: string;
    description?: string;
    exerciseCount: number;
    lastCompleted?: string;
    lastCompletedTimestamp?: number;
    duration?: string;
    image?: any;
  }> {
    // Get exercise count from template sets (count unique exercises)
    const templateSets = (await template.templateSets?.fetch()) ?? [];
    const uniqueExerciseIds = new Set(
      templateSets.filter((set) => !set.deletedAt).map((set) => set.exerciseId)
    );
    const exerciseCount = uniqueExerciseIds.size;

    // Get last completed workout log for this template
    const workoutLogs = await database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('template_id', template.id),
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('completed_at', Q.desc)
      )
      .fetch();

    let lastCompleted: string | undefined;
    let lastCompletedTimestamp: number | undefined;
    let duration: string | undefined;

    if (workoutLogs.length > 0) {
      const lastLog = workoutLogs[0];
      lastCompletedTimestamp = lastLog.completedAt || undefined;

      if (lastCompletedTimestamp) {
        // Format relative date
        const date = new Date(lastCompletedTimestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          lastCompleted = 'Today';
        } else if (diffDays === 1) {
          lastCompleted = 'Yesterday';
        } else if (diffDays < 7) {
          lastCompleted = `${diffDays} days ago`;
        } else if (diffDays < 14) {
          lastCompleted = '1 week ago';
        } else if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          // When diffDays >= 14, weeks >= 2, so always plural
          lastCompleted = `${weeks} weeks ago`;
        } else {
          const months = Math.floor(diffDays / 30);
          lastCompleted = `${months} month${months > 1 ? 's' : ''} ago`;
        }

        // Calculate duration if available
        if (lastLog.startedAt && lastLog.completedAt) {
          const durationMinutes = Math.round((lastLog.completedAt - lastLog.startedAt) / 60000);
          if (durationMinutes < 60) {
            duration = `${durationMinutes} mins`;
          } else {
            const hours = Math.floor(durationMinutes / 60);
            const mins = durationMinutes % 60;
            duration = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
          }
        }
      }
    }

    return {
      id: template.id,
      name: template.name ?? '',
      description: template.description || undefined,
      exerciseCount,
      lastCompleted,
      lastCompletedTimestamp,
      duration,
      image: require('../../assets/icon.png'), // Default image for now
    };
  }

  /**
   * Get workout templates with pagination (for Manage Workout Template Data modal).
   * Active templates only, ordered by created_at desc.
   */
  static async getWorkoutTemplatesPaginated(
    limit: number,
    offset: number
  ): Promise<WorkoutTemplate[]> {
    let query = WorkoutTemplateRepository.getActive();
    if (limit > 0) {
      if (offset > 0) {
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }
    return await query.fetch();
  }

  /**
   * Get templates with metadata and pagination support
   */
  static async getTemplatesWithMetadataPaginated(
    limit?: number,
    offset?: number,
    scope: 'active' | 'archived' = 'active'
  ): Promise<
    {
      id: string;
      name: string;
      description?: string;
      exerciseCount: number;
      lastCompleted?: string;
      lastCompletedTimestamp?: number;
      duration?: string;
      image?: any;
    }[]
  > {
    // Fetch templates with pagination based on scope
    let query =
      scope === 'archived'
        ? WorkoutTemplateRepository.getArchived()
        : WorkoutTemplateRepository.getActive();

    if (limit) {
      if (offset !== undefined && offset !== null && offset > 0) {
        // Apply both skip and take together - skip must come before take
        query = query.extend(Q.skip(offset), Q.take(limit));
      } else {
        query = query.extend(Q.take(limit));
      }
    }

    const templates = await query.fetch();

    // Process each template to get metadata
    const templatesWithMetadata = await Promise.all(
      templates.map((template) => this.processTemplateMetadata(template))
    );

    // Sort by last completed (most recent first), then by creation date
    templatesWithMetadata.sort((a, b) => {
      // If one has lastCompleted and other doesn't, prioritize the one with lastCompleted
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) {
        return -1;
      }
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return 1;
      }
      // If both have lastCompleted, sort by timestamp (most recent first)
      if (a.lastCompletedTimestamp && b.lastCompletedTimestamp) {
        return b.lastCompletedTimestamp - a.lastCompletedTimestamp;
      }
      // If neither has lastCompleted, maintain original order (by created_at desc)
      return 0;
    });

    return templatesWithMetadata;
  }

  /**
   * Calculate suggested weight for an exercise based on user profile and exercise characteristics
   *
   * Formula based on strength standards research:
   * - Uses bodyweight multipliers from established strength standards (ExRx.net, Strength Level)
   * - Experience factors derived from strength standards ratios:
   *   - Beginner: ~40% of intermediate capacity (based on strength standards showing beginners lift ~0.5x BW vs intermediate ~1.25x BW for bench)
   *   - Intermediate: 100% (baseline)
   *   - Advanced: ~140% of intermediate capacity (based on advanced lifters achieving ~1.75x BW vs intermediate ~1.25x BW)
   * - Age factors: Conservative reduction for older adults, though research shows resistance training remains effective
   *
   * References:
   * - Strength Standards: https://exrx.net/WorkoutTools/StrengthStandards
   * - Bodyweight multipliers vary by exercise and experience level
   *
   * Note: Weight is always stored in kg in the database. If user prefers pounds, we convert to lbs,
   * round to nearest integer, then convert back to kg to ensure clean integer values in the user's preferred unit.
   */
  private static async calculateSuggestedWeight(
    userWeightKg: number,
    loadMultiplier: number,
    liftingExperience: string,
    age: number,
    isBodyweight: boolean
  ): Promise<number> {
    // Bodyweight exercises always return 0
    if (isBodyweight || loadMultiplier === 0) {
      return 0;
    }

    // Experience factor based on strength standards research
    // Strength standards show: Beginner ~0.5x BW, Intermediate ~1.25x BW, Advanced ~1.75x BW (for bench press)
    // Normalized to intermediate as baseline (1.0):
    let experienceFactor: number;
    switch (liftingExperience) {
      case 'beginner':
        // Beginner lifts ~40% of intermediate capacity (0.5/1.25 = 0.4)
        // Using 0.4 for conservative starting point
        experienceFactor = 0.4;
        break;
      case 'intermediate':
        // Intermediate is the baseline (100%)
        experienceFactor = 1.0;
        break;
      case 'advanced':
        // Advanced lifts ~140% of intermediate capacity (1.75/1.25 = 1.4)
        experienceFactor = 1.4;
        break;
      default:
        // Unknown experience level, default to intermediate
        experienceFactor = 1.0;
    }

    // Age factor: Conservative reduction for older users
    // Research shows resistance training remains effective for older adults, but we apply
    // slight reduction for safety and recovery considerations
    let ageFactor: number;
    if (age < 35) {
      ageFactor = 1.0; // No reduction for younger adults
    } else if (age < 50) {
      ageFactor = 0.95; // 5% reduction for middle-aged adults
    } else if (age < 65) {
      ageFactor = 0.9; // 10% reduction for older adults
    } else {
      ageFactor = 0.85; // 15% reduction for seniors (still effective per research)
    }

    // Calculate suggested weight: userWeight × loadMultiplier × experienceFactor × ageFactor
    // The loadMultiplier represents the typical bodyweight multiplier for the exercise at intermediate level
    // We then adjust based on experience and age
    let suggestedWeightKg = userWeightKg * loadMultiplier * experienceFactor * ageFactor;

    // Get user's preferred weight unit from settings
    const unitsSetting = await database
      .get<Setting>('settings')
      .query(Q.where('type', UNITS_SETTING_TYPE), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    const units = unitsSetting.length > 0 && unitsSetting[0].value === '1' ? 'imperial' : 'metric';
    const weightUnit = getWeightUnit(units);

    // If user prefers pounds, convert to lbs, round to nearest integer, then convert back to kg
    // This ensures the weight appears as a clean integer in the user's preferred unit
    if (weightUnit === 'lbs') {
      const suggestedWeightLbs = convert(suggestedWeightKg, 'kg').to('lb');
      const roundedWeightLbs = Math.round(suggestedWeightLbs);
      suggestedWeightKg = convert(roundedWeightLbs, 'lb').to('kg');
    } else {
      // For metric (kg), just round to nearest integer
      suggestedWeightKg = Math.round(suggestedWeightKg);
    }

    return suggestedWeightKg;
  }

  /**
   * Create workout templates from a JSON template, splitting by day
   * Each day becomes a separate workout template
   */
  static async createWorkoutsFromJsonTemplate(
    rawTemplate: RawWorkoutTemplate
  ): Promise<WorkoutTemplate[]> {
    // Validate that exercises is an array
    if (!Array.isArray(rawTemplate.exercises)) {
      throw new Error('Template exercises must be an array');
    }

    const exercises = rawTemplate.exercises.filter(
      (e): e is { exerciseId: number; day: number; sets: number; reps: number } =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.exerciseId === 'number' &&
        typeof e.day === 'number' &&
        typeof e.sets === 'number' &&
        typeof e.reps === 'number'
    );

    if (exercises.length === 0) {
      throw new Error('Template has no valid exercises');
    }

    // Fetch user context for weight calculation
    const user = await UserService.getCurrentUser();
    const weightMetric = await UserMetricService.getLatest('weight');

    // Convert user weight to kg (default to 70 kg if not available)
    let userWeightKg = 70; // Default fallback
    if (weightMetric) {
      const decrypted = await weightMetric.getDecrypted();
      userWeightKg = decrypted.value;
      if (decrypted.unit === 'lbs') {
        userWeightKg = decrypted.value / 2.20462;
      }
    }

    // Get user lifting experience (default to 'intermediate' if not available)
    const liftingExperience = user?.liftingExperience || 'intermediate';

    // Get user age (default to 30 if not available, which gives ageFactor 1.0)
    const age = user ? user.getAge() : 30;

    // Get all exercises from database ordered by creation time
    // This assumes exercises are seeded in the same order as the JSON exerciseId indices
    const allExercises = await database
      .get<Exercise>('exercises')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.asc))
      .fetch();

    // Create mapping: exerciseId (1-based) -> database exercise ID
    const exerciseIdMap = new Map<number, string>();
    allExercises.forEach((exercise, index) => {
      // exerciseId in JSON is 1-based, array index is 0-based
      exerciseIdMap.set(index + 1, exercise.id);
    });

    // Group exercises by day
    const exercisesByDay = new Map<number, typeof exercises>();
    exercises.forEach((exercise) => {
      const day = exercise.day;
      if (!exercisesByDay.has(day)) {
        exercisesByDay.set(day, []);
      }
      exercisesByDay.get(day)!.push(exercise);
    });

    // Get unique days and sort them
    const days = Array.from(exercisesByDay.keys()).sort((a, b) => a - b);

    // Create workout template for each day
    const createdTemplates: WorkoutTemplate[] = [];

    for (const day of days) {
      const dayExercises = exercisesByDay.get(day)!;

      // Group exercises by exerciseId (in case same exercise appears multiple times)
      // We'll combine them into a single exercise entry with the sets/reps from the first occurrence
      const exerciseMap = new Map<number, (typeof exercises)[0]>();
      dayExercises.forEach((exercise) => {
        if (!exerciseMap.has(exercise.exerciseId)) {
          exerciseMap.set(exercise.exerciseId, exercise);
        }
      });

      // Convert to ExerciseInWorkout format
      const exercisesInWorkout: ExerciseInWorkout[] = [];
      for (const [exerciseId, exerciseData] of exerciseMap) {
        const databaseExerciseId = exerciseIdMap.get(exerciseId);
        if (!databaseExerciseId) {
          console.warn(`Exercise ID ${exerciseId} not found in database, skipping`);
          continue;
        }

        // Get exercise from database to determine if it's bodyweight
        const dbExercise = allExercises.find((ex) => ex.id === databaseExerciseId);
        if (!dbExercise) {
          console.warn(`Exercise with ID ${databaseExerciseId} not found, skipping`);
          continue;
        }

        const equipmentType = dbExercise.equipmentType?.toLowerCase() || '';
        const isBodyweight =
          equipmentType.includes('bodyweight') || equipmentType.includes('body weight');

        const Icon = isBodyweight ? User : Dumbbell;
        const iconBgColor = isBodyweight
          ? theme.colors.background.white5
          : theme.colors.accent.primary10;
        const iconColor = isBodyweight ? theme.colors.text.secondary : theme.colors.accent.primary;

        // Calculate suggested weight based on user profile and exercise characteristics
        const loadMultiplier = dbExercise.loadMultiplier ?? 1.0;
        const suggestedWeight = await this.calculateSuggestedWeight(
          userWeightKg,
          loadMultiplier,
          liftingExperience,
          age,
          isBodyweight
        );

        exercisesInWorkout.push({
          id: databaseExerciseId,
          label: dbExercise.name ?? '',
          description: `${exerciseData.sets} sets × ${exerciseData.reps} reps`,
          icon: Icon,
          iconBgColor,
          iconColor,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          weight: suggestedWeight,
          isBodyweight,
        });
      }

      if (exercisesInWorkout.length === 0) {
        console.warn(`No valid exercises for day ${day}, skipping template creation`);
        continue;
      }

      // Create workout template name
      const templateName = `${rawTemplate.title} - Day ${day}`;

      // Create the template using saveTemplate
      const template = await this.saveTemplate({
        name: templateName,
        description: rawTemplate.description,
        exercises: exercisesInWorkout,
        selectedDays: [], // No schedule days selected
      });

      createdTemplates.push(template);
    }

    return createdTemplates;
  }

  /**
   * Archive a workout template
   */
  static async archiveTemplate(templateId: string): Promise<void> {
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);
    await template.archive();
  }

  /**
   * Unarchive a workout template
   */
  static async unarchiveTemplate(templateId: string): Promise<void> {
    const template = await database.get<WorkoutTemplate>('workout_templates').find(templateId);
    await template.unarchive();
  }

  /**
   * Duplicate a workout template (create a copy)
   */
  static async duplicateTemplate(templateId: string): Promise<WorkoutTemplate> {
    return await database.write(async () => {
      // Get template with all details (sets and schedule)
      const { template, sets, schedule } = await this.getTemplateWithDetails(templateId);

      if (template.deletedAt) {
        throw new Error('Cannot duplicate deleted template');
      }

      const now = Date.now();

      // Create new template with "(Copy)" suffix
      const newTemplate = await database.get<WorkoutTemplate>('workout_templates').create((t) => {
        t.name = `${template.name} (Copy)`;
        t.description = template.description;
        t.volumeCalculationType = template.volumeCalculationType || 'standard';
        t.weekDaysJson = template.weekDaysJson || undefined;
        t.isArchived = false;
        t.createdAt = now;
        t.updatedAt = now;
      });

      // Copy all template sets
      const templateSetsCollection = database.get<WorkoutTemplateSet>('workout_template_sets');
      const preparedSets = sets.map((set) =>
        templateSetsCollection.prepareCreate((ts) => {
          ts.templateId = newTemplate.id;
          ts.exerciseId = set.exerciseId;
          ts.targetReps = set.targetReps;
          ts.targetWeight = set.targetWeight;
          ts.restTimeAfter = set.restTimeAfter;
          ts.setOrder = set.setOrder;
          ts.groupId = set.groupId;
          ts.isDropSet = set.isDropSet;
          ts.createdAt = now;
          ts.updatedAt = now;
        })
      );

      // Copy all schedule entries
      const schedulesCollection = database.get<Schedule>('schedules');
      const preparedSchedules = schedule.map((sched) =>
        schedulesCollection.prepareCreate((s) => {
          s.templateId = newTemplate.id;
          s.dayOfWeek = sched.dayOfWeek;
          s.reminderTime = sched.reminderTime;
          s.createdAt = now;
          s.updatedAt = now;
        })
      );

      // Batch commit all sets and schedules atomically
      await database.batch(...preparedSets, ...preparedSchedules);

      return newTemplate;
    });
  }

  /**
   * Get all archived templates with metadata
   */
  static async getArchivedTemplatesWithMetadata(): Promise<
    {
      id: string;
      name: string;
      description?: string;
      exerciseCount: number;
      lastCompleted?: string; // Formatted relative date string
      lastCompletedTimestamp?: number;
      duration?: string; // Formatted duration string
      image?: any;
    }[]
  > {
    // Fetch all archived templates
    const templates = await WorkoutTemplateRepository.getArchived().fetch();

    // Process each template to get metadata (same logic as getAllTemplatesWithMetadata)
    const templatesWithMetadata = await Promise.all(
      templates.map(async (template) => {
        // Get template sets to count exercises
        const sets = await database
          .get<WorkoutTemplateSet>('workout_template_sets')
          .query(Q.where('template_id', template.id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        // Get unique exercise count
        const uniqueExerciseIds = [...new Set(sets.map((set) => set.exerciseId))];
        const exerciseCount = uniqueExerciseIds.length;

        // Get last completed workout log for this template
        const workoutLogs = await database
          .get<WorkoutLog>('workout_logs')
          .query(
            Q.where('template_id', template.id),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('completed_at', Q.desc)
          )
          .fetch();

        const lastWorkoutLog = workoutLogs[0];

        let lastCompleted: string | undefined;
        let lastCompletedTimestamp: number | undefined;

        if (lastWorkoutLog?.completedAt) {
          lastCompletedTimestamp = lastWorkoutLog.completedAt;
          lastCompleted = this.formatRelativeDate(lastCompletedTimestamp);
        }

        return {
          id: template.id,
          name: template.name,
          description: template.description,
          exerciseCount,
          lastCompleted,
          lastCompletedTimestamp,
        };
      })
    );

    return templatesWithMetadata;
  }

  /**
   * Format timestamp to relative date string (e.g., "2 days ago", "1 week ago")
   */
  private static formatRelativeDate(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return i18n.t('common.today');
    }

    if (diffDays === 1) {
      return i18n.t('common.yesterday');
    }

    if (diffDays < 7) {
      return i18n.t('common.daysAgo', { count: diffDays });
    }

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      if (weeks === 1) {
        return i18n.t('common.oneWeekAgo');
      }

      return i18n.t('common.weeksAgo', { count: weeks });
    }

    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return i18n.t('common.monthsAgo', { count: months });
    }

    const years = Math.floor(diffDays / 365);
    return i18n.t('common.yearsAgo', { count: years });
  }

  /**
   * Delete workout template (soft delete)
   */
  static async deleteTemplate(id: string): Promise<void> {
    return await database.write(async (writer) => {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(id);
      // Use callWriter to avoid nested writes since markAsDeleted is a @writer method
      await writer.callWriter(() => template.markAsDeleted());

      // Also soft-delete all associated sets
      const sets = await database
        .get<WorkoutTemplateSet>('workout_template_sets')
        .query(Q.where('template_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const set of sets) {
        await writer.callWriter(() => set.markAsDeleted());
      }

      // Also soft-delete all associated schedules
      const schedules = await database
        .get<Schedule>('schedules')
        .query(Q.where('template_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      for (const schedule of schedules) {
        await writer.callWriter(() => schedule.markAsDeleted());
      }
    });
  }

  /**
   * Update workout template
   */
  static async updateTemplate(
    id: string,
    updates: {
      name?: string;
      description?: string;
      isArchived?: boolean;
    }
  ): Promise<WorkoutTemplate> {
    return await database.write(async () => {
      const template = await database.get<WorkoutTemplate>('workout_templates').find(id);

      if (template.deletedAt) {
        throw new Error('Cannot update deleted template');
      }

      await template.update((record) => {
        if (updates.name !== undefined) {
          record.name = updates.name;
        }
        if (updates.description !== undefined) {
          record.description = updates.description;
        }
        if (updates.isArchived !== undefined) {
          record.isArchived = updates.isArchived;
        }
        record.updatedAt = Date.now();
      });

      return template;
    });
  }
}
