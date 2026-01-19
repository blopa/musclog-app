import { database } from '../index';
import WorkoutTemplate from '../models/WorkoutTemplate';
import WorkoutTemplateSet from '../models/WorkoutTemplateSet';
import Schedule from '../models/Schedule';
import Exercise from '../models/Exercise';
import { Q } from '@nozbe/watermelondb';
import { Dumbbell, User } from 'lucide-react-native';
import { theme } from '../../theme';

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
      .query(Q.where('id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    // Create map for quick lookup
    const exerciseMap = new Map<string, Exercise>();
    exercises.forEach((ex) => exerciseMap.set(ex.id, ex));

    // Group sets by exercise
    const exerciseGroups = new Map<string, WorkoutTemplateSet[]>();
    sets.forEach((set) => {
      if (!exerciseGroups.has(set.exerciseId)) {
        exerciseGroups.set(set.exerciseId, []);
      }
      exerciseGroups.get(set.exerciseId)!.push(set);
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
        label: exercise.name,
        description,
        icon: Icon,
        iconBgColor,
        iconColor,
        groupId: undefined, // Groups are UI-only, start with undefined
        sets: setsCount,
        reps: firstSet.targetReps,
        weight: firstSet.targetWeight,
        isBodyweight,
      });
    });

    // Sort by set_order of first set in each group
    exercisesInWorkout.sort((a, b) => {
      const aSets = exerciseGroups.get(a.id)!;
      const bSets = exerciseGroups.get(b.id)!;
      const aOrder = aSets[0].setOrder;
      const bOrder = bSets[0].setOrder;
      return aOrder - bOrder;
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
          t.description = data.description || null;
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
          t.description = data.description || null;
          t.createdAt = now;
          t.updatedAt = now;
        });
      }

      // Create template sets
      const templateSetsCollection = database.get<WorkoutTemplateSet>('workout_template_sets');
      const preparedSets: WorkoutTemplateSet[] = [];

      // Calculate set_order based on exercise order and grouping
      let currentOrder = 0;
      data.exercises.forEach((exercise, index) => {
        // Check if this exercise is grouped with the previous one
        const isGroupedWithPrevious =
          exercise.groupId && index > 0 && data.exercises[index - 1]?.groupId === exercise.groupId;

        if (!isGroupedWithPrevious) {
          // Start new sequence for this exercise (or new group)
          // Increment by 1 to start a new order sequence
          currentOrder++;
        }

        // Create sets for this exercise
        // All sets for this exercise will have sequential order starting from currentOrder
        for (let set = 1; set <= exercise.sets; set++) {
          preparedSets.push(
            templateSetsCollection.prepareCreate((ts) => {
              ts.templateId = template.id;
              ts.exerciseId = exercise.id;
              ts.targetReps = exercise.reps;
              ts.targetWeight = exercise.isBodyweight ? 0 : exercise.weight;
              ts.setOrder = currentOrder;
              ts.createdAt = now;
              ts.updatedAt = now;
            })
          );
          // Increment order for each set
          currentOrder++;
        }
      });

      // Batch create all template sets
      if (preparedSets.length > 0) {
        await database.batch(...preparedSets);
      }

      // Create schedule entries
      // WeekdayPicker indices: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
      const dayNames = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];
      const schedulesCollection = database.get<Schedule>('schedules');
      const preparedSchedules: Schedule[] = [];

      data.selectedDays.forEach((dayIndex) => {
        if (dayIndex >= 0 && dayIndex < dayNames.length) {
          preparedSchedules.push(
            schedulesCollection.prepareCreate((s) => {
              s.templateId = template.id;
              s.dayOfWeek = dayNames[dayIndex];
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
}
