import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import WorkoutPlan from '@/database/models/WorkoutPlan';
import WorkoutPlanTemplate from '@/database/models/WorkoutPlanTemplate';

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
}
