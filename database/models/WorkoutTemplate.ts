import { Model, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import Schedule from './Schedule';
import WorkoutLog from './WorkoutLog';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutTemplateSet from './WorkoutTemplateSet';

export default class WorkoutTemplate extends Model {
  static table = 'workout_templates';

  static associations = {
    workout_template_sets: { type: 'has_many' as const, foreignKey: 'template_id' },
    schedules: { type: 'has_many' as const, foreignKey: 'template_id' },
    workout_logs: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('volume_calculation_type') volumeCalculationType!: string;
  @json('week_days_json', (data: any) => {
    if (data === null || data === undefined) {
      return undefined; // Allow null/undefined (optional field)
    }

    if (!Array.isArray(data)) {
      throw new Error('week_days_json must be an array of day indices');
    }

    // Validate each day index is a number between 0 and 6
    for (const day of data) {
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error(
          'Each day in week_days_json must be an integer between 0 (Monday) and 6 (Sunday)'
        );
      }
    }

    // Remove duplicates and sort for consistency
    return [...new Set(data)].sort((a, b) => a - b);
  })
  weekDaysJson?: number[];
  @field('is_archived') isArchived!: boolean;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_sets') templateSets!: Query<WorkoutTemplateSet>;
  @children('schedules') schedules!: Query<Schedule>;
  @children('workout_logs') workoutLogs!: Query<WorkoutLog>;

  @writer
  async startWorkout(): Promise<WorkoutLog> {
    const templateSets = (await this.templateSets?.fetch()) ?? [];
    const now = Date.now();

    // Create the workout log
    const workoutLogsCollection = this.collections.get<WorkoutLog>('workout_logs');
    const workoutLog = await workoutLogsCollection.create((log) => {
      log.workoutName = this.name;
      log.templateId = this.id;
      log.startedAt = now;
      log.exhaustionLevel = undefined;
      log.workoutScore = undefined;
      log.createdAt = now;
      log.updatedAt = now;
    });

    // Prepare all log sets from template sets
    const logSetsCollection = this.collections.get<WorkoutLogSet>('workout_log_sets');
    const preparedSets = templateSets.map((templateSet: WorkoutTemplateSet) =>
      logSetsCollection.prepareCreate((logSet) => {
        logSet.workoutLogId = workoutLog.id;
        logSet.exerciseId = templateSet.exerciseId;
        logSet.reps = templateSet.targetReps;
        logSet.weight = templateSet.targetWeight;
        logSet.partials = 0;
        logSet.restTimeAfter = templateSet.restTimeAfter ?? 0;
        logSet.repsInReserve = 0;
        logSet.difficultyLevel = 0;
        logSet.isDropSet = false;
        logSet.setOrder = templateSet.setOrder;
        logSet.createdAt = now;
        logSet.updatedAt = now;
      })
    );

    // Batch commit all log sets atomically
    await this.collection.database.batch(...preparedSets);

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
