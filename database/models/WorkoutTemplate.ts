import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import { DEFAULT_WORKOUT_TYPE } from '../../constants/workoutTypes';
import Schedule from './Schedule';
import WorkoutLog from './WorkoutLog';
import WorkoutLogExercise from './WorkoutLogExercise';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplateExercise from './WorkoutTemplateExercise';
import WorkoutTemplateSet from './WorkoutTemplateSet';

export default class WorkoutTemplate extends Model {
  static table = 'workout_templates';

  static associations = {
    workout_template_exercises: { type: 'has_many' as const, foreignKey: 'template_id' },
    schedules: { type: 'has_many' as const, foreignKey: 'template_id' },
    workout_logs: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('workout_insights_type') workoutInsightsType?: string;
  @field('icon') icon?: string;
  @field('type') type?: string;
  @json('week_days_json', (data: any) => {
    if (data === null || data === undefined) {
      return undefined;
    }

    if (!Array.isArray(data)) {
      throw new Error('week_days_json must be an array of day indices');
    }

    for (const day of data) {
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error(
          'Each day in week_days_json must be an integer between 0 (Monday) and 6 (Sunday)'
        );
      }
    }

    return [...new Set(data)].sort((a, b) => a - b);
  })
  weekDaysJson?: number[];
  @field('is_archived') isArchived!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_exercises') templateExercises!: Query<WorkoutTemplateExercise>;
  @children('schedules') schedules!: Query<Schedule>;
  @children('workout_logs') workoutLogs!: Query<WorkoutLog>;

  @writer
  async startWorkout(): Promise<WorkoutLog> {
    const templateExercises = (await this.templateExercises?.fetch()) ?? [];
    const activeTemplateExercises = templateExercises.filter(
      (te: WorkoutTemplateExercise) => !te.deletedAt
    );
    const now = Date.now();

    // Create the workout log
    const workoutLogsCollection = this.collections.get<WorkoutLog>('workout_logs');
    const workoutLog = await workoutLogsCollection.create((log) => {
      log.workoutName = this.name;
      log.templateId = this.id;
      log.type = this.type ?? DEFAULT_WORKOUT_TYPE;
      log.icon = this.icon ?? undefined;
      log.startedAt = now;
      log.exhaustionLevel = undefined;
      log.workoutScore = undefined;
      log.createdAt = now;
      log.updatedAt = now;
    });

    // Create log exercises from template exercises
    const logExercisesCollection =
      this.collections.get<WorkoutLogExercise>('workout_log_exercises');
    const logSetsCollection = this.collections.get<WorkoutLogSet>('workout_log_sets');

    const preparedLogExercises: WorkoutLogExercise[] = [];
    const preparedLogSets: WorkoutLogSet[] = [];

    // Track mapping from template exercise ID to log exercise for set creation
    const templateExerciseToLogExercise = new Map<string, WorkoutLogExercise>();

    // First, prepare all log exercises
    for (const templateExercise of activeTemplateExercises) {
      const logExercise = logExercisesCollection.prepareCreate((le) => {
        le.workoutLogId = workoutLog.id;
        le.exerciseId = templateExercise.exerciseId;
        le.templateExerciseId = templateExercise.id;
        le.notes = templateExercise.notes;
        le.exerciseOrder = templateExercise.exerciseOrder;
        le.groupId = templateExercise.groupId;
        le.createdAt = now;
        le.updatedAt = now;
      });
      preparedLogExercises.push(logExercise);
      templateExerciseToLogExercise.set(templateExercise.id, logExercise);
    }

    // Fetch all template sets for these exercises
    const templateExerciseIds = activeTemplateExercises.map((te) => te.id);
    const templateSets =
      templateExerciseIds.length > 0
        ? await this.collections
            .get<WorkoutTemplateSet>('workout_template_sets')
            .query(
              Q.where('template_exercise_id', Q.oneOf(templateExerciseIds)),
              Q.where('deleted_at', Q.eq(null))
            )
            .fetch()
        : [];

    // Prepare all log sets from template sets
    for (const templateSet of templateSets) {
      const logExercise = templateExerciseToLogExercise.get(templateSet.templateExerciseId);
      if (!logExercise) {
        continue;
      }

      const logSet = logSetsCollection.prepareCreate((ls) => {
        ls.logExerciseId = logExercise.id;
        ls.reps = templateSet.targetReps;
        ls.weight = templateSet.targetWeight;
        ls.partials = 0;
        ls.restTimeAfter = templateSet.restTimeAfter ?? 0;
        ls.repsInReserve = 0;
        ls.difficultyLevel = 0;
        ls.isDropSet = templateSet.isDropSet;
        ls.setOrder = templateSet.setOrder;
        ls.createdAt = now;
        ls.updatedAt = now;
      });
      preparedLogSets.push(logSet);
    }

    // Batch commit all log exercises and log sets atomically
    await this.collection.database.batch(...preparedLogExercises, ...preparedLogSets);

    return workoutLog;
  }

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((template) => {
      template.deletedAt = now;
      template.updatedAt = now;
    });
    // Note: We don't delete related template sets or schedules to preserve historical data
  }

  @writer
  async archive(): Promise<void> {
    const now = Date.now();
    await this.update((template) => {
      template.isArchived = true;
      template.updatedAt = now;
    });
  }

  @writer
  async unarchive(): Promise<void> {
    const now = Date.now();
    await this.update((template) => {
      template.isArchived = false;
      template.updatedAt = now;
    });
  }
}
