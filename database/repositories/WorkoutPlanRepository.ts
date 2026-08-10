import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import Schedule from '@/database/models/Schedule';
import WorkoutPlan from '@/database/models/WorkoutPlan';
import WorkoutPlanTemplate from '@/database/models/WorkoutPlanTemplate';
import {
  type ResolvedWorkoutSchedule,
  resolveWorkoutSchedules,
} from '@/utils/workoutScheduleOwnership';

export class WorkoutPlanRepository {
  static getAll(): Query<WorkoutPlan> {
    return database
      .get<WorkoutPlan>('workout_plans')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('created_at', Q.desc));
  }

  static getMembershipsForPlan(planId: string): Query<WorkoutPlanTemplate> {
    return database
      .get<WorkoutPlanTemplate>('workout_plan_templates')
      .query(
        Q.where('plan_id', planId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('position', Q.asc)
      );
  }

  static getMembershipsForTemplate(templateId: string): Query<WorkoutPlanTemplate> {
    return database
      .get<WorkoutPlanTemplate>('workout_plan_templates')
      .query(Q.where('template_id', templateId), Q.where('deleted_at', Q.eq(null)));
  }

  static getAllMemberships(): Query<WorkoutPlanTemplate> {
    return database
      .get<WorkoutPlanTemplate>('workout_plan_templates')
      .query(Q.where('deleted_at', Q.eq(null)), Q.sortBy('position', Q.asc));
  }

  /**
   * Every weekday a workout is due on, from BOTH calendar stores, with plan membership winning —
   * see `resolveWorkoutSchedules`.
   *
   * Lives here because the read is the interesting part: which three tables are consulted is the
   * ownership rule itself, and `NotificationService` and `WorkoutService.getUpcomingScheduledWorkouts`
   * had a copy each. Two copies of "which stores decide the calendar" is two places for that rule
   * to drift, in code whose entire point is that it must not.
   */
  static async getResolvedSchedules(): Promise<ResolvedWorkoutSchedule[]> {
    const [plans, memberships, standaloneSchedules] = await Promise.all([
      this.getAll().fetch(),
      this.getAllMemberships().fetch(),
      database
        .get<Schedule>('schedules')
        .query(Q.where('deleted_at', Q.eq(null)))
        .fetch(),
    ]);

    return resolveWorkoutSchedules(plans, memberships, standaloneSchedules);
  }
}
