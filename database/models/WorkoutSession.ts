import { Model } from '@nozbe/watermelondb';
import { field, children, relation } from '@nozbe/watermelondb/decorators';
import { Q } from '@nozbe/watermelondb';
import type { Associations } from '@nozbe/watermelondb/Model';
import WorkoutExercise from './WorkoutExercise';
import Workout from './Workout';
import Set from './Set';

export default class WorkoutSession extends Model {
  static table = 'workout_sessions';

  static associations: Associations = {
    workouts: { type: 'belongs_to', key: 'workout_id' },
    workout_exercises: { type: 'has_many', foreignKey: 'workout_id' },
  };

  @field('workout_id') workoutId?: string;
  @field('name') name!: string;
  @field('started_at') startedAt!: number;
  @field('completed_at') completedAt?: number;
  @field('duration') duration?: number;
  @field('difficulty') difficulty?: number;
  @field('exhaustion') exhaustion?: number;
  @field('enjoyment') enjoyment?: number;
  @field('total_volume') totalVolume?: number;

  @relation('workouts', 'workout_id') workout?: Workout;
  @children('workout_exercises') workoutExercises!: any;

  /**
   * Calculate total volume based on completed sets
   * Supports different calculation methods stored in the referenced workout template
   */
  async calculateTotalVolume(): Promise<number> {
    const exercises = await this.collection.database
      .get<WorkoutExercise>('workout_exercises')
      .query(Q.where('workout_id', this.id), Q.where('is_session', true))
      .fetch();

    let totalVolume = 0;

    for (const exercise of exercises) {
      const sets = await exercise.sets.fetch();
      const completedSets = sets.filter((set: Set) => set.isCompleted);

      for (const set of completedSets) {
        const weight = (set.isBodyweight ? set.extraWeight || 0 : set.weight || 0) as number;
        const reps = set.reps + (set.partialReps || 0);

        // Default calculation: weight × reps
        totalVolume += weight * reps;
      }
    }

    // If workout template exists, check for custom volume calculation method
    if (this.workoutId) {
      const workout = await this.collection.database.get<Workout>('workouts').find(this.workoutId);
      if (workout?.volumeCalcMethod) {
        // For now, use default calculation
        // Future: implement different calculation methods based on volumeCalcMethod
      }
    }

    return totalVolume;
  }

  /**
   * Getter for total volume (computed property)
   * Returns stored value or calculates if not set
   */
  get totalVolumeComputed(): number {
    return this.totalVolume || 0;
  }
}
