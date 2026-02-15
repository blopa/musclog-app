import { Q } from '@nozbe/watermelondb';
import { Dumbbell, User } from 'lucide-react-native';

import type { RawWorkoutTemplate } from '../../components/modals/BrowseTemplatesModal';
import { theme } from '../../theme';
import { indexToDayName, WEEKDAY_NAMES } from '../../utils/workout';
import { database } from '../index';
import Exercise from '../models/Exercise';
import Schedule from '../models/Schedule';
import WorkoutLog from '../models/WorkoutLog';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutTemplateSet from '../models/WorkoutTemplateSet';
import { WorkoutTemplateRepository } from '../repositories/WorkoutTemplateRepository';

export type ExerciseInWorkout = {
  id: string; // exerciseId
  label: string;
  description: string;
  icon: any;
  iconBgColor: string;
  iconColor: string;
  groupId?: string; // UI-only for grouping
  sets: number;
  reps: number;
  weight: number;
  isBodyweight: boolean;
  restTimeAfter?: number; // Rest time in seconds after completing this set
};

export interface SaveTemplateData {
  templateId?: string;
  name: string;
  description?: string;
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
      if (!exercise) return; // Skip if exercise not found

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
  static async getAllTemplatesWithMetadata(): Promise<
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
    // Fetch all active templates
    const templates = await WorkoutTemplateRepository.getActive().fetch();

    // Process each template to get metadata
    const templatesWithMetadata = await Promise.all(
      templates.map((template) => this.processTemplateMetadata(template))
    );

    // Sort by last completed (most recent first), then by creation date
    templatesWithMetadata.sort((a, b) => {
      // If one has lastCompleted and other doesn't, prioritize the one with lastCompleted
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) return -1;
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) return 1;
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
   * Get templates with metadata and pagination support
   */
  static async getTemplatesWithMetadataPaginated(
    limit?: number,
    offset?: number
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
    // Fetch templates with pagination
    let query = WorkoutTemplateRepository.getActive();

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
      if (a.lastCompletedTimestamp && !b.lastCompletedTimestamp) return -1;
      if (!a.lastCompletedTimestamp && b.lastCompletedTimestamp) return 1;
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

        exercisesInWorkout.push({
          id: databaseExerciseId,
          label: dbExercise.name ?? '',
          description: `${exerciseData.sets} sets × ${exerciseData.reps} reps`,
          icon: Icon,
          iconBgColor,
          iconColor,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          weight: 50, // TODO: calculate this based on the lifting experience, age and weight of the user
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
}
