import { Model, Q, Query } from '@nozbe/watermelondb';
import { children, field, json, writer } from '@nozbe/watermelondb/decorators';

import { DEFAULT_WORKOUT_TYPE } from '@/constants/workoutTypes';
import { getCurrentTimezone } from '@/utils/timezone';
import { resolveWorkoutLogPlanId } from '@/utils/workoutScheduleOwnership';

import Schedule from './Schedule';
import { sanitizeWeekDaysJson } from './weekDaysJson';
import WorkoutLog from './WorkoutLog';
import WorkoutLogExercise from './WorkoutLogExercise';
import WorkoutLogSet from './WorkoutLogSet';
import WorkoutPlanTemplate from './WorkoutPlanTemplate';
import WorkoutTemplateExercise from './WorkoutTemplateExercise';
import WorkoutTemplateSet from './WorkoutTemplateSet';

export default class WorkoutTemplate extends Model {
  static table = 'workout_templates';

  static associations = {
    workout_template_exercises: { type: 'has_many' as const, foreignKey: 'template_id' },
    schedules: { type: 'has_many' as const, foreignKey: 'template_id' },
    workout_logs: { type: 'has_many' as const, foreignKey: 'template_id' },
    workout_plan_templates: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @field('name') declare name: string;
  @field('description') description?: string;
  @field('workout_insights_type') workoutInsightsType?: string;
  @field('icon') icon?: string;
  @field('type') type?: string;
  @json('week_days_json', sanitizeWeekDaysJson) weekDaysJson?: number[];
  @field('is_archived') declare isArchived: boolean;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_template_exercises') declare templateExercises: Query<WorkoutTemplateExercise>;
  @children('schedules') declare schedules: Query<Schedule>;
  @children('workout_logs') declare workoutLogs: Query<WorkoutLog>;
  @children('workout_plan_templates') declare planMemberships: Query<WorkoutPlanTemplate>;

  @writer
  async startWorkout(planId?: string): Promise<WorkoutLog> {
    const templateExercises = (await this.templateExercises?.fetch()) ?? [];
    const activeTemplateExercises = templateExercises.filter(
      (te: WorkoutTemplateExercise) => !te.deletedAt
    );
    const now = Date.now();
    const memberships = planId ? [] : ((await this.planMemberships?.fetch()) ?? []);
    const resolvedPlanId = resolveWorkoutLogPlanId(planId, memberships);

    // Create the workout log
    const workoutLogsCollection = this.collections.get<WorkoutLog>('workout_logs');
    const workoutLog = await workoutLogsCollection.create((log) => {
      log.workoutName = this.name;
      log.templateId = this.id;
      log.planId = resolvedPlanId;
      log.type = this.type ?? DEFAULT_WORKOUT_TYPE;
      log.icon = this.icon ?? undefined;
      log.startedAt = now;
      log.timezone = getCurrentTimezone();
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
        ls.setType = templateSet.setType ?? 'normal';
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
