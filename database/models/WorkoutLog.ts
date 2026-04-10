import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, field, relation, writer } from '@nozbe/watermelondb/decorators';

import {
  calculateWorkoutVolume,
  type ExerciseWithSets,
  getUserBodyWeightKgForVolume,
} from '@/utils/workoutCalculator';

import Exercise from './Exercise';
import WorkoutLogExercise from './WorkoutLogExercise';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplate from './WorkoutTemplate';

export default class WorkoutLog extends Model {
  static table = 'workout_logs';

  static associations = {
    workout_log_exercises: { type: 'has_many' as const, foreignKey: 'workout_log_id' },
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('template_id') templateId?: string;
  @field('external_id') externalId?: string;
  @field('workout_name') workoutName!: string;
  @field('started_at') startedAt!: number;
  @field('completed_at') completedAt?: number;
  @field('total_volume') totalVolume?: number;
  @field('calories_burned') caloriesBurned?: number;
  @field('icon') icon?: string;
  @field('type') type?: string;
  @field('exhaustion_level') exhaustionLevel?: number;
  @field('workout_score') workoutScore?: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_log_exercises') logExercises!: Query<WorkoutLogExercise>;
  @relation('workout_templates', 'template_id') template?: WorkoutTemplate;

  async getAllSets(): Promise<WorkoutLogSet[]> {
    const logExercises = await this.logExercises.fetch();
    const activeExercises = logExercises.filter((le) => !le.deletedAt);
    const exerciseIds = activeExercises.map((le) => le.id);

    if (exerciseIds.length === 0) {
      return [];
    }

    return await this.collections
      .get<WorkoutLogSet>('workout_log_sets')
      .query(Q.where('log_exercise_id', Q.oneOf(exerciseIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  async calculateVolume(): Promise<number> {
    const bodyWeightKg = await getUserBodyWeightKgForVolume();
    const logExercises = await this.logExercises.fetch();
    const active = logExercises.filter((le) => !le.deletedAt);
    if (active.length === 0) {
      return 0;
    }

    const exerciseIds = [...new Set(active.map((le) => le.exerciseId))];
    const exercises =
      exerciseIds.length > 0
        ? await this.collections
            .get<Exercise>('exercises')
            .query(Q.where('id', Q.oneOf(exerciseIds as string[])))
            .fetch()
        : [];
    const exerciseById = new Map(exercises.map((e) => [e.id, e]));

    // Fetch all sets in a single query (getAllSets already filters deleted)
    const allSets = await this.getAllSets();
    const setsByLogExId = new Map<string, WorkoutLogSet[]>();
    for (const set of allSets) {
      const id = set.logExerciseId;
      if (!setsByLogExId.has(id)) {
        setsByLogExId.set(id, []);
      }
      setsByLogExId.get(id)!.push(set);
    }

    const parts: ExerciseWithSets[] = active.map((le) => {
      const ex = exerciseById.get(le.exerciseId);
      const sets = setsByLogExId.get(le.id) ?? [];
      return {
        exercise: { equipmentType: ex?.equipmentType },
        sets: sets.map((s: WorkoutLogSet) => ({
          weight: s.weight,
          reps: s.reps,
          repsInReserve: s.repsInReserve,
        })),
      };
    });

    return calculateWorkoutVolume(parts, bodyWeightKg);
  }

  @writer
  async updateSet(
    setId: string,
    data: {
      reps?: number;
      weight?: number;
      partials?: number;
      restTimeAfter?: number;
      repsInReserve?: number;
      difficultyLevel?: number;
      isSkipped?: boolean;
      isDropSet?: boolean;
    }
  ): Promise<void> {
    const isOnlyRestTimeAfter = Object.keys(data).length === 1 && data.restTimeAfter !== undefined;
    if (this.completedAt && !isOnlyRestTimeAfter) {
      throw new Error('Cannot update sets in a completed workout');
    }

    const set = await this.collections.get<WorkoutLogSet>('workout_log_sets').find(setId);

    if (!set) {
      throw new Error(`Set with id ${setId} not found`);
    }

    const now = Date.now();

    await set.update((updatedSet: WorkoutLogSet) => {
      if (data.reps !== undefined) {
        updatedSet.reps = data.reps;
      }
      if (data.weight !== undefined) {
        updatedSet.weight = data.weight;
      }
      if (data.partials !== undefined) {
        updatedSet.partials = data.partials;
      }
      if (data.restTimeAfter !== undefined) {
        updatedSet.restTimeAfter = data.restTimeAfter;
      }
      if (data.repsInReserve !== undefined) {
        updatedSet.repsInReserve = data.repsInReserve;
      }
      if (data.isSkipped !== undefined) {
        updatedSet.isSkipped = data.isSkipped;
      }
      if (data.difficultyLevel !== undefined) {
        const isActuallySkipped = data.isSkipped ?? updatedSet.isSkipped;
        if (data.difficultyLevel === 0 && isActuallySkipped) {
          // Allow 0 only for skipped sets
        } else if (data.difficultyLevel < 1 || data.difficultyLevel > 10) {
          throw new Error('Difficulty level must be between 1 and 10');
        }
        updatedSet.difficultyLevel = data.difficultyLevel;
      }
      if (data.isDropSet !== undefined) {
        updatedSet.isDropSet = data.isDropSet;
      }
      updatedSet.updatedAt = now;
    });

    await this.update((log) => {
      log.updatedAt = now;
    });
  }

  @writer
  async addAdHocExercise(
    exerciseId: string,
    reps: number,
    weight: number,
    setOrder?: number,
    partials?: number
  ): Promise<WorkoutLogSet> {
    if (this.completedAt) {
      throw new Error('Cannot add exercises to a completed workout');
    }

    const now = Date.now();
    const allSets = await this.getAllSets();
    const maxSetOrder =
      allSets.length > 0 ? Math.max(...allSets.map((s: WorkoutLogSet) => s.setOrder ?? 0)) : 0;
    const newSetOrder = setOrder ?? maxSetOrder + 1;

    const logExercises = await this.logExercises.fetch();
    const maxExerciseOrder =
      logExercises.length > 0 ? Math.max(...logExercises.map((le) => le.exerciseOrder ?? 0)) : 0;

    const logExercisesCollection =
      this.collections.get<WorkoutLogExercise>('workout_log_exercises');
    const logSetsCollection = this.collections.get<WorkoutLogSet>('workout_log_sets');

    const logExercise = await logExercisesCollection.create((le) => {
      le.workoutLogId = this.id;
      le.exerciseId = exerciseId;
      le.exerciseOrder = maxExerciseOrder + 1;
      le.createdAt = now;
      le.updatedAt = now;
    });

    const newSet = await logSetsCollection.create((logSet) => {
      logSet.logExerciseId = logExercise.id;
      logSet.reps = reps;
      logSet.weight = weight;
      logSet.partials = partials ?? 0;
      logSet.restTimeAfter = 0;
      logSet.repsInReserve = 0;
      logSet.difficultyLevel = 0;
      logSet.isDropSet = false;
      logSet.setOrder = newSetOrder;
      logSet.createdAt = now;
      logSet.updatedAt = now;
    });

    await this.update((log) => {
      log.updatedAt = now;
    });

    return newSet;
  }

  @writer
  async addAdHocExerciseSets(
    exerciseId: string,
    numberOfSets: number,
    options?: { suggestedWeightKg?: number; suggestedReps?: number }
  ): Promise<WorkoutLogSet[]> {
    if (this.completedAt) {
      throw new Error('Cannot add exercises to a completed workout');
    }

    if (numberOfSets < 1) {
      throw new Error('numberOfSets must be at least 1');
    }

    const weight = options?.suggestedWeightKg !== undefined ? options.suggestedWeightKg : 30;
    const reps = options?.suggestedReps !== undefined ? options.suggestedReps : 10;

    const now = Date.now();
    const allSets = await this.getAllSets();
    const maxSetOrder =
      allSets.length > 0 ? Math.max(...allSets.map((s: WorkoutLogSet) => s.setOrder ?? 0)) : 0;

    const logExercises = await this.logExercises.fetch();
    const maxExerciseOrder =
      logExercises.length > 0 ? Math.max(...logExercises.map((le) => le.exerciseOrder ?? 0)) : 0;

    const logExercisesCollection =
      this.collections.get<WorkoutLogExercise>('workout_log_exercises');
    const logSetsCollection = this.collections.get<WorkoutLogSet>('workout_log_sets');

    const logExercise = logExercisesCollection.prepareCreate((le) => {
      le.workoutLogId = this.id;
      le.exerciseId = exerciseId;
      le.exerciseOrder = maxExerciseOrder + 1;
      le.createdAt = now;
      le.updatedAt = now;
    });

    const preparedSets = Array.from({ length: numberOfSets }, (_, i) =>
      logSetsCollection.prepareCreate((logSet) => {
        logSet.logExerciseId = logExercise.id;
        logSet.reps = reps;
        logSet.weight = weight;
        logSet.partials = 0;
        logSet.restTimeAfter = 60;
        logSet.repsInReserve = 0;
        logSet.difficultyLevel = 0;
        logSet.isSkipped = false;
        logSet.isDropSet = false;
        logSet.setOrder = maxSetOrder + i + 1;
        logSet.createdAt = now;
        logSet.updatedAt = now;
      })
    );

    await this.collection.database.batch(logExercise, ...preparedSets);

    await this.update((log) => {
      log.updatedAt = now;
    });

    const newOrderStart = maxSetOrder + 1;
    const refreshedSets = await this.getAllSets();
    return refreshedSets.filter(
      (s: WorkoutLogSet) => (s.setOrder ?? 0) >= newOrderStart && s.logExerciseId === logExercise.id
    );
  }

  @writer
  async removeSet(setId: string): Promise<void> {
    if (this.completedAt) {
      throw new Error('Cannot remove sets from a completed workout');
    }

    const set = await this.collections.get<WorkoutLogSet>('workout_log_sets').find(setId);

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

  @writer
  async updateFeedback(feedback: {
    exhaustionLevel?: number;
    workoutScore?: number;
  }): Promise<void> {
    const now = Date.now();
    await this.update((log) => {
      if (feedback.exhaustionLevel !== undefined) {
        log.exhaustionLevel = feedback.exhaustionLevel;
      }
      if (feedback.workoutScore !== undefined) {
        log.workoutScore = feedback.workoutScore;
      }
      log.updatedAt = now;
    });
  }
}
