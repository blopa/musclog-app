import { Model, Database, Q } from '@nozbe/watermelondb';
import { field, relation, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import Workout from './Workout';
import WorkoutSession from './WorkoutSession';
import Exercise from './Exercise';

export default class WorkoutExercise extends Model {
  static table = 'workout_exercises';

  static associations: Associations = {
    workouts: { type: 'belongs_to', key: 'workout_id' },
    workout_sessions: { type: 'belongs_to', key: 'workout_id' },
    exercises: { type: 'belongs_to', key: 'exercise_id' },
    sets: { type: 'has_many', foreignKey: 'workout_exercise_id' },
  };

  @field('workout_id') workoutId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('sort_order') sortOrder!: number;
  @field('superset_id') supersetId?: string;
  @field('is_session') isSession!: boolean;

  @relation('exercises', 'exercise_id') exercise!: Exercise;

  @children('sets') sets!: any;

  /**
   * Get the associated workout or session based on isSession flag
   * @returns Promise resolving to Workout or WorkoutSession
   */
  async getWorkoutOrSession(): Promise<Workout | WorkoutSession | null> {
    if (this.isSession) {
      return this.collection.database.get<WorkoutSession>('workout_sessions').find(this.workoutId);
    } else {
      return this.collection.database.get<Workout>('workouts').find(this.workoutId);
    }
  }

  /**
   * Group multiple exercises into a superset by assigning the same UUID
   * Note: This method should be called with database instance passed as parameter
   * @param database Database instance
   * @param exerciseIds Array of WorkoutExercise IDs to group together
   * @returns Promise that resolves when all exercises are grouped
   */
  static async groupIntoSuperset(database: Database, exerciseIds: string[]): Promise<void> {
    if (exerciseIds.length < 2) {
      throw new Error('At least 2 exercises are required to create a superset');
    }

    const supersetId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    await database.write(async () => {
      const exercises = await database
        .get<WorkoutExercise>('workout_exercises')
        .query(Q.where('id', Q.oneOf(exerciseIds)))
        .fetch();

      await Promise.all(
        exercises.map((exercise: WorkoutExercise) =>
          exercise.update((record: WorkoutExercise) => {
            record.supersetId = supersetId;
          })
        )
      );
    });
  }

  /**
   * Ungroup this exercise from its superset by clearing the superset_id
   */
  async ungroupFromSuperset(): Promise<void> {
    await this.collection.database.write(async () => {
      await this.update((record) => {
        record.supersetId = undefined;
      });
    });
  }

  /**
   * Get all exercises in the same superset as this one
   * @returns Promise resolving to array of WorkoutExercise records
   */
  async getSupersetExercises(): Promise<WorkoutExercise[]> {
    if (!this.supersetId) {
      return [];
    }

    return this.collection.database
      .get<WorkoutExercise>('workout_exercises')
      .query(Q.where('superset_id', this.supersetId))
      .fetch();
  }
}
