import { Model, type Relation } from '@nozbe/watermelondb';
import { field, immutableRelation, json, writer } from '@nozbe/watermelondb/decorators';

import { sanitizeWeekDaysJson } from './weekDaysJson';
import WorkoutPlan from './WorkoutPlan';
import WorkoutTemplate from './WorkoutTemplate';

export default class WorkoutPlanTemplate extends Model {
  static table = 'workout_plan_templates';

  static associations = {
    workout_plans: { type: 'belongs_to' as const, key: 'plan_id' },
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('plan_id') declare planId: string;
  @field('template_id') declare templateId: string;
  @json('week_days_json', sanitizeWeekDaysJson) weekDays?: number[];
  @field('position') declare position: number;
  @field('created_at') declare createdAt: number;
  @field('updated_at') declare updatedAt: number;
  @field('deleted_at') deletedAt?: number;

  @immutableRelation('workout_plans', 'plan_id') declare plan: Relation<WorkoutPlan>;
  @immutableRelation('workout_templates', 'template_id')
  declare template: Relation<WorkoutTemplate>;

  @writer
  async markAsDeleted(): Promise<void> {
    const now = Date.now();
    await this.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
  }
}
