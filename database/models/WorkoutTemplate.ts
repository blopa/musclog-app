import { Model, Q, Query } from '@nozbe/watermelondb';
import { field, children, writer } from '@nozbe/watermelondb/decorators';
import WorkoutTemplateSet from './WorkoutTemplateSet';
import Schedule from './Schedule';
import WorkoutLog from './WorkoutLog';
import WorkoutLogSet from './WorkoutLogSet';
import { database } from '../instance';

export default class WorkoutTemplate extends Model {
  static table = 'workout_templates';

  static associations = {
    workout_template_sets: { type: 'has_many' as const, foreignKey: 'template_id' },
    schedules: { type: 'has_many' as const, foreignKey: 'template_id' },
    workout_logs: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @field('name') name!: string;
  @field('description') description?: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_sets') templateSets!: Query<WorkoutTemplateSet>;
  @children('schedules') schedules!: Query<Schedule>;
  @children('workout_logs') workoutLogs!: Query<WorkoutLog>;

  static getActive(): Query<WorkoutTemplate> {
    return database
      .get<WorkoutTemplate>('workout_templates')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
  }

  @writer
  async startWorkout(): Promise<WorkoutLog> {
    const templateSets = await this.templateSets.fetch();
    const now = Date.now();

    // Create the workout log
    const workoutLogsCollection = this.collections.get<WorkoutLog>('workout_logs');
    const workoutLog = await workoutLogsCollection.create((log) => {
      log.workoutName = this.name;
      log.templateId = this.id;
      log.startedAt = now;
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
        logSet.restTime = 0;
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
}
