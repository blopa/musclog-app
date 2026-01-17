import { Model, Q, Query } from '@nozbe/watermelondb';
import { field, children, relation, writer } from '@nozbe/watermelondb/decorators';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplate from './WorkoutTemplate';
import { database } from '../database-instance';

export default class WorkoutLog extends Model {
  static table = 'workout_logs';

  static associations = {
    workout_log_sets: { type: 'has_many' as const, foreignKey: 'workout_log_id' },
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('template_id') templateId?: string;
  @field('workout_name') workoutName!: string;
  @field('started_at') startedAt!: number;
  @field('completed_at') completedAt?: number;
  @field('total_volume') totalVolume?: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_log_sets') logSets!: Query<WorkoutLogSet>;
  @relation('workout_templates', 'template_id') template?: WorkoutTemplate;

  static getActive(): Query<WorkoutLog> {
    return database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.eq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );
  }

  static getCompleted(timeframe?: { startDate: number; endDate: number }): Query<WorkoutLog> {
    let query = database
      .get<WorkoutLog>('workout_logs')
      .query(
        Q.where('completed_at', Q.notEq(null)),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('started_at', Q.desc)
      );

    if (timeframe) {
      query = query.extend(
        Q.where('started_at', Q.gte(timeframe.startDate)),
        Q.where('started_at', Q.lte(timeframe.endDate))
      );
    }

    return query;
  }

  async calculateVolume(): Promise<number> {
    const sets = await this.logSets.fetch();
    return sets.reduce((total: number, set: WorkoutLogSet) => {
      return total + set.reps * set.weight;
    }, 0);
  }

  @writer
  async updateSet(
    setId: string,
    data: {
      reps?: number;
      weight?: number;
      restTime?: number;
      difficultyLevel?: number;
      isDropSet?: boolean;
    }
  ): Promise<void> {
    if (this.completedAt) {
      throw new Error('Cannot update sets in a completed workout');
    }

    const sets = await this.logSets.fetch();
    const set = sets.find((s: WorkoutLogSet) => s.id === setId);

    if (!set) {
      throw new Error(`Set with id ${setId} not found`);
    }

    await set.update((updatedSet: WorkoutLogSet) => {
      if (data.reps !== undefined) updatedSet.reps = data.reps;
      if (data.weight !== undefined) updatedSet.weight = data.weight;
      if (data.restTime !== undefined) updatedSet.restTime = data.restTime;
      if (data.difficultyLevel !== undefined) {
        if (data.difficultyLevel < 1 || data.difficultyLevel > 10) {
          throw new Error('Difficulty level must be between 1 and 10');
        }
        updatedSet.difficultyLevel = data.difficultyLevel;
      }
      if (data.isDropSet !== undefined) updatedSet.isDropSet = data.isDropSet;
      updatedSet.updatedAt = Date.now();
    });

    // Update parent log timestamp
    await this.update((log) => {
      log.updatedAt = Date.now();
    });
  }

  @writer
  async addAdHocExercise(
    exerciseId: string,
    reps: number,
    weight: number,
    setOrder?: number
  ): Promise<WorkoutLogSet> {
    if (this.completedAt) {
      throw new Error('Cannot add exercises to a completed workout');
    }

    const sets = await this.logSets.fetch();
    const maxOrder = sets.length > 0 ? Math.max(...sets.map((s: WorkoutLogSet) => s.setOrder)) : 0;
    const newOrder = setOrder ?? maxOrder + 1;

    const logSetsCollection = this.collections.get<WorkoutLogSet>('workout_log_sets');
    const now = Date.now();

    const newSet = await logSetsCollection.create((logSet) => {
      logSet.workoutLogId = this.id;
      logSet.exerciseId = exerciseId;
      logSet.reps = reps;
      logSet.weight = weight;
      logSet.restTime = 0;
      logSet.difficultyLevel = 0;
      logSet.isDropSet = false;
      logSet.setOrder = newOrder;
      logSet.createdAt = now;
      logSet.updatedAt = now;
    });

    await this.update((log) => {
      log.updatedAt = now;
    });

    return newSet;
  }

  @writer
  async removeSet(setId: string): Promise<void> {
    if (this.completedAt) {
      throw new Error('Cannot remove sets from a completed workout');
    }

    const sets = await this.logSets.fetch();
    const set = sets.find((s: WorkoutLogSet) => s.id === setId);

    if (!set) {
      throw new Error(`Set with id ${setId} not found`);
    }

    await set.markAsDeleted();

    await this.update((log) => {
      log.updatedAt = Date.now();
    });
  }

  @writer
  async completeWorkout(): Promise<void> {
    if (this.completedAt) {
      throw new Error('Workout is already completed');
    }

    const totalVolume = await this.calculateVolume();
    const now = Date.now();

    await this.update((log) => {
      log.completedAt = now;
      log.totalVolume = totalVolume;
      log.updatedAt = now;
    });
  }
}
