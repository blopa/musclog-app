import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

import WorkoutLog from './WorkoutLog';
import WorkoutLogExercise from './WorkoutLogExercise';
import WorkoutTemplateExercise from './WorkoutTemplateExercise';

// Two vocabularies coexist in `muscle_group` and both must stay in this union.
// The bundled catalogue and `CreateExerciseModal` write the coarse names
// (declared by the generated entries in `data/exercisesData.json`);
// exercises migrated from the legacy database carry the fine-grained ones.
// Anything reading `muscleGroup` has to handle both — see the group sets in
// `utils/workoutEnergyCalculator.ts`.
export type MuscleGroup =
  // coarse — bundled catalogue and user-created exercises
  | 'abdomen'
  | 'arms'
  | 'back'
  | 'chest'
  | 'core'
  | 'full_body'
  | 'glutes'
  | 'legs'
  | 'shoulders'
  // fine-grained — legacy migrated exercises
  | 'abs'
  | 'biceps'
  | 'calves'
  | 'cardio'
  | 'forearms'
  | 'hamstrings'
  | 'other'
  | 'quads'
  | 'triceps';

export type EquipmentType =
  | 'dumbbell'
  | 'barbell'
  | 'bodyweight'
  | 'plate_machine'
  | 'cable'
  | 'kettlebell'
  | 'smith_machine'
  | 'medicine_ball'
  | 'pneumatic_machine'
  | 'cardio'
  | 'resistance_band'
  | 'other';

export type MechanicType =
  'compound' | 'isolation' | 'cardio' | 'mobility' | 'stretching' | 'plyometric' | 'other';

export type ExerciseSource = 'app' | 'user';

export default class Exercise extends Model {
  static table = 'exercises';

  static associations = {
    workout_template_exercises: { type: 'has_many' as const, foreignKey: 'exercise_id' },
    workout_log_exercises: { type: 'has_many' as const, foreignKey: 'exercise_id' },
  };

  @field('name') declare name: string;
  @field('description') declare description: string;
  @field('image_url') imageUrl?: string;
  @field('muscle_group') declare muscleGroup: MuscleGroup;
  @field('equipment_type') declare equipmentType: EquipmentType;
  @field('mechanic_type') declare mechanicType: MechanicType;
  @field('source') source?: ExerciseSource;
  @field('load_multiplier') declare loadMultiplier: number;
  @field('order_index') orderIndex?: number;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_exercises') declare templateExercises: Query<WorkoutTemplateExercise>;
  @children('workout_log_exercises') declare logExercises: Query<WorkoutLogExercise>;

  @writer
  async markAsDeleted(): Promise<void> {
    if (this.source === 'app') {
      throw new Error('Cannot delete a built-in app exercise.');
    }

    const logExercises = await this.logExercises.fetch();
    const activeLogExercises = logExercises.filter((le: WorkoutLogExercise) => !le.deletedAt);

    if (activeLogExercises.length > 0) {
      const workoutLogIds = [
        ...new Set(activeLogExercises.map((le: WorkoutLogExercise) => le.workoutLogId)),
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

    const now = Date.now();
    await this.update((exercise) => {
      exercise.deletedAt = now;
      exercise.updatedAt = now;
    });
  }
}
