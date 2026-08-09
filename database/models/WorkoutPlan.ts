import { Model, type Query } from '@nozbe/watermelondb';
import { children, field, writer } from '@nozbe/watermelondb/decorators';

import type { WorkoutPlanCycleType } from '@/constants/workoutPlans';

import WorkoutLog from './WorkoutLog';
import WorkoutPlanTemplate from './WorkoutPlanTemplate';

export default class WorkoutPlan extends Model {
  static table = 'workout_plans';

  static associations = {
    workout_plan_templates: { type: 'has_many' as const, foreignKey: 'plan_id' },
    workout_logs: { type: 'has_many' as const, foreignKey: 'plan_id' },
  };

  @field('name') declare name: string;
  @field('description') description?: string;
  @field('cycle_type') declare cycleType: WorkoutPlanCycleType;
  @field('icon') icon?: string;
  @field('difficulty') difficulty?: string;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @children('workout_plan_templates') declare memberships: Query<WorkoutPlanTemplate>;
  @children('workout_logs') declare workoutLogs: Query<WorkoutLog>;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    const memberships = await this.memberships.fetch();
    const records = [
      this.prepareUpdate((plan) => {
        plan.deletedAt = now;
        plan.updatedAt = now;
      }),
      ...memberships
        .filter((membership) => !membership.deletedAt)
        .map((membership) =>
          membership.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        ),
    ];

    await this.collection.database.batch(...records);
  }
}
