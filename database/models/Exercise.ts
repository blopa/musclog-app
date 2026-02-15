import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

import WorkoutLog from './WorkoutLog';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplateSet from './WorkoutTemplateSet';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full_body'
  | 'cardio'
  | 'other';

export type EquipmentType =
  | 'dumbbell'
  | 'barbell'
  | 'bodyweight'
  | 'machine'
  | 'cable'
  | 'kettlebell'
  | 'resistance_band'
  | 'other';

export type MechanicType = 'compound' | 'isolation';

export default class Exercise extends Model {
  static table = 'exercises';

  static associations = {
    workout_template_sets: { type: 'has_many' as const, foreignKey: 'exercise_id' },
    workout_log_sets: { type: 'has_many' as const, foreignKey: 'exercise_id' },
  };

  @field('name') name!: string;
  @field('description') description!: string;
  @field('image_url') imageUrl?: string;
  @field('muscle_group') muscleGroup!: MuscleGroup;
  @field('equipment_type') equipmentType!: EquipmentType;
  @field('mechanic_type') mechanicType!: MechanicType;
  @field('load_multiplier') loadMultiplier!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_sets') templateSets!: Query<WorkoutTemplateSet>;
  @children('workout_log_sets') logSets!: Query<WorkoutLogSet>;

  @writer
  async markAsDeleted(): Promise<void> {
    // Check if exercise is referenced in any workout logs (historical data)
    const logSets = await this.logSets.fetch();

    // Filter out soft-deleted sets
    const activeLogSets = logSets.filter((set: WorkoutLogSet) => !set.deletedAt);

    if (activeLogSets.length > 0) {
      // Check if any of these sets belong to completed workouts (immutable historical data)
      const workoutLogIds = [
        ...new Set(activeLogSets.map((set: WorkoutLogSet) => set.workoutLogId)),
      ];
      const workoutLogs = await this.collections
        .get<WorkoutLog>('workout_logs')
        .query(Q.where('id', Q.oneOf(workoutLogIds as string[])))
        .fetch();

      const hasCompletedWorkouts = workoutLogs.some((log: WorkoutLog) => log.completedAt !== null);

      if (hasCompletedWorkouts) {
        throw new Error(
          'Cannot delete exercise that is referenced in completed workout logs. Historical data must be preserved.'
        );
      }
    }

    // Safe to soft delete
    const now = Date.now();
    await this.update((exercise) => {
      exercise.deletedAt = now;
      exercise.updatedAt = now;
    });
  }
}
