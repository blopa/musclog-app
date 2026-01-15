import { Model, Q } from '@nozbe/watermelondb';
import { field, children, writer } from '@nozbe/watermelondb/decorators';
import WorkoutTemplateSet from './WorkoutTemplateSet';
import WorkoutLogSet from './WorkoutLogSet';

export default class Exercise extends Model {
  static table = 'exercises';

  static associations = {
    workout_template_sets: { type: 'has_many', foreignKey: 'exercise_id' },
    workout_log_sets: { type: 'has_many', foreignKey: 'exercise_id' },
  };

  @field('name') name!: string;
  @field('description') description!: string;
  @field('image_url') imageUrl?: string;
  @field('muscle_group') muscleGroup!: string;
  @field('equipment_type') equipmentType!: string;
  @field('mechanic_type') mechanicType!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_sets') templateSets!: Q.Query<WorkoutTemplateSet>;
  @children('workout_log_sets') logSets!: Q.Query<WorkoutLogSet>;

  @writer
  async markAsDeleted(): Promise<void> {
    // Check if exercise is referenced in any workout logs (historical data)
    const logSets = await this.logSets.fetch();

    // Filter out soft-deleted sets
    const activeLogSets = logSets.filter((set) => !set.deletedAt);

    if (activeLogSets.length > 0) {
      // Check if any of these sets belong to completed workouts (immutable historical data)
      const workoutLogIds = [...new Set(activeLogSets.map((set) => set.workoutLogId))];
      const workoutLogs = await this.collections
        .get('workout_logs')
        .query(Q.where('id', Q.oneOf(workoutLogIds)))
        .fetch();

      const hasCompletedWorkouts = workoutLogs.some((log: any) => log.completedAt !== null);

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
