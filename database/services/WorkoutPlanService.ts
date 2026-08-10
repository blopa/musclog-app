import { Model, Q } from '@nozbe/watermelondb';

import {
  DEFAULT_WORKOUT_PLAN_CYCLE_TYPE,
  type WorkoutPlanCycleType,
} from '@/constants/workoutPlans';
import { database } from '@/database/database-instance';
import WorkoutPlan from '@/database/models/WorkoutPlan';
import WorkoutPlanTemplate from '@/database/models/WorkoutPlanTemplate';
import { WorkoutPlanRepository } from '@/database/repositories/WorkoutPlanRepository';

export interface PlanMembershipInput {
  templateId: string;
  weekDays?: number[];
  position?: number;
}

export interface CreateWorkoutPlanData {
  name: string;
  description?: string;
  cycleType?: WorkoutPlanCycleType;
  icon?: string;
  difficulty?: string;
  memberships?: PlanMembershipInput[];
}

export interface UpdateWorkoutPlanData {
  name?: string;
  description?: string | null;
  cycleType?: WorkoutPlanCycleType;
  icon?: string | null;
  difficulty?: string | null;
}

export interface PlanWithMemberships {
  plan: WorkoutPlan;
  memberships: WorkoutPlanTemplate[];
}

function sameWeekDays(left?: number[], right?: number[]): boolean {
  const a = left ?? [];
  const b = right ?? [];
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

function normalizeWeekDays(
  cycleType: WorkoutPlanCycleType,
  weekDays?: number[]
): number[] | undefined {
  if (cycleType === 'rotating' || !weekDays || weekDays.length === 0) {
    return undefined;
  }
  return [...new Set(weekDays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function uniqueMembershipInputs(inputs: PlanMembershipInput[]): PlanMembershipInput[] {
  const seen = new Set<string>();
  return inputs.filter((input) => {
    if (!input.templateId || seen.has(input.templateId)) {
      return false;
    }
    seen.add(input.templateId);
    return true;
  });
}

export class WorkoutPlanService {
  static prepareCreatePlan(
    data: CreateWorkoutPlanData,
    now = Date.now()
  ): { plan: WorkoutPlan; records: Model[] } {
    const cycleType = data.cycleType ?? DEFAULT_WORKOUT_PLAN_CYCLE_TYPE;
    const memberships = uniqueMembershipInputs(data.memberships ?? []);
    const plan = database.get<WorkoutPlan>('workout_plans').prepareCreate((record) => {
      record.name = data.name.trim();
      record.description = data.description?.trim() || undefined;
      record.cycleType = cycleType;
      record.icon = data.icon;
      record.difficulty = data.difficulty;
      record.createdAt = now;
      record.updatedAt = now;
    });
    const membershipCollection = database.get<WorkoutPlanTemplate>('workout_plan_templates');
    const preparedMemberships = memberships.map((membership, index) =>
      membershipCollection.prepareCreate((record) => {
        record.planId = plan.id;
        record.templateId = membership.templateId;
        record.weekDays = normalizeWeekDays(cycleType, membership.weekDays);
        record.position = membership.position ?? index;
        record.createdAt = now;
        record.updatedAt = now;
      })
    );

    return { plan, records: [plan, ...preparedMemberships] };
  }

  static async createPlan(data: CreateWorkoutPlanData): Promise<WorkoutPlan> {
    return database.write(async () => {
      const { plan, records } = this.prepareCreatePlan(data);
      await database.batch(...records);
      return plan;
    });
  }

  static async savePlan(
    planId: string,
    patch: UpdateWorkoutPlanData,
    memberships: PlanMembershipInput[]
  ): Promise<void> {
    const normalizedInputs = uniqueMembershipInputs(memberships);
    await database.write(async () => {
      const plan = await database.get<WorkoutPlan>('workout_plans').find(planId);
      const existing = await WorkoutPlanRepository.getMembershipsForPlan(planId).fetch();
      const nextCycleType = patch.cycleType ?? plan.cycleType;
      const now = Date.now();
      const records: Model[] = [
        this.preparePlanUpdate(plan, patch, now),
        ...this.prepareMembershipChanges(planId, nextCycleType, existing, normalizedInputs, now),
      ];

      await database.batch(...records);
    });
  }

  static async updatePlan(planId: string, patch: UpdateWorkoutPlanData): Promise<void> {
    await database.write(async () => {
      const plan = await database.get<WorkoutPlan>('workout_plans').find(planId);
      const previousCycleType = plan.cycleType;
      const nextCycleType = patch.cycleType ?? plan.cycleType;
      const now = Date.now();
      const records: Model[] = [this.preparePlanUpdate(plan, patch, now)];

      if (previousCycleType === 'weekly' && nextCycleType === 'rotating') {
        const memberships = await WorkoutPlanRepository.getMembershipsForPlan(planId).fetch();
        for (const membership of memberships) {
          if (membership.weekDays?.length) {
            records.push(
              membership.prepareUpdate((record) => {
                record.weekDays = undefined;
                record.updatedAt = now;
              })
            );
          }
        }
      }

      await database.batch(...records);
    });
  }

  private static preparePlanUpdate(
    plan: WorkoutPlan,
    patch: UpdateWorkoutPlanData,
    now: number
  ): WorkoutPlan {
    return plan.prepareUpdate((record) => {
      if (patch.name !== undefined) {
        record.name = patch.name.trim();
      }
      if (patch.description !== undefined) {
        record.description = patch.description?.trim() || undefined;
      }
      if (patch.cycleType !== undefined) {
        record.cycleType = patch.cycleType;
      }
      if (patch.icon !== undefined) {
        record.icon = patch.icon || undefined;
      }
      if (patch.difficulty !== undefined) {
        record.difficulty = patch.difficulty || undefined;
      }
      record.updatedAt = now;
    });
  }

  static async deletePlan(planId: string): Promise<void> {
    const plan = await database.get<WorkoutPlan>('workout_plans').find(planId);
    await plan.markAsDeleted();
  }

  static async setPlanMemberships(
    planId: string,
    memberships: PlanMembershipInput[]
  ): Promise<void> {
    const normalizedInputs = uniqueMembershipInputs(memberships);
    await database.write(async () => {
      const plan = await database.get<WorkoutPlan>('workout_plans').find(planId);
      const existing = await WorkoutPlanRepository.getMembershipsForPlan(planId).fetch();
      const now = Date.now();
      const records = this.prepareMembershipChanges(
        planId,
        plan.cycleType,
        existing,
        normalizedInputs,
        now
      );

      if (records.length > 0) {
        await database.batch(...records);
      }
    });
  }

  private static prepareMembershipChanges(
    planId: string,
    cycleType: WorkoutPlanCycleType,
    existing: WorkoutPlanTemplate[],
    memberships: PlanMembershipInput[],
    now: number
  ): Model[] {
    const existingByTemplate = new Map(
      existing.map((membership) => [membership.templateId, membership])
    );
    const desiredTemplateIds = new Set(memberships.map((membership) => membership.templateId));
    const collection = database.get<WorkoutPlanTemplate>('workout_plan_templates');
    const records: Model[] = [];

    memberships.forEach((input, index) => {
      const position = input.position ?? index;
      const weekDays = normalizeWeekDays(cycleType, input.weekDays);
      const current = existingByTemplate.get(input.templateId);
      if (!current) {
        records.push(
          collection.prepareCreate((record) => {
            record.planId = planId;
            record.templateId = input.templateId;
            record.weekDays = weekDays;
            record.position = position;
            record.createdAt = now;
            record.updatedAt = now;
          })
        );
        return;
      }

      if (current.position !== position || !sameWeekDays(current.weekDays, weekDays)) {
        records.push(
          current.prepareUpdate((record) => {
            record.position = position;
            record.weekDays = weekDays;
            record.updatedAt = now;
          })
        );
      }
    });

    for (const membership of existing) {
      if (!desiredTemplateIds.has(membership.templateId)) {
        records.push(
          membership.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        );
      }
    }

    return records;
  }

  static async setTemplatePlans(templateId: string, planIds: string[]): Promise<void> {
    await database.write(async () => {
      const records = await this.prepareSyncTemplateMemberships(templateId, planIds, Date.now());
      if (records.length > 0) {
        await database.batch(...records);
      }
    });
  }

  static async prepareSyncTemplateMemberships(
    templateId: string,
    planIds: string[],
    now: number
  ): Promise<Model[]> {
    const desiredPlanIds = [...new Set(planIds.filter(Boolean))];
    const existing = await WorkoutPlanRepository.getMembershipsForTemplate(templateId).fetch();
    const existingByPlan = new Map(existing.map((membership) => [membership.planId, membership]));
    const records: Model[] = [];

    for (const membership of existing) {
      if (!desiredPlanIds.includes(membership.planId)) {
        records.push(
          membership.prepareUpdate((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          })
        );
      }
    }

    const missingPlanIds = desiredPlanIds.filter((planId) => !existingByPlan.has(planId));
    if (missingPlanIds.length === 0) {
      return records;
    }

    const activePlans = await database
      .get<WorkoutPlan>('workout_plans')
      .query(Q.where('id', Q.oneOf(missingPlanIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const validPlanIds = new Set(activePlans.map((plan) => plan.id));
    const planMemberships = await database
      .get<WorkoutPlanTemplate>('workout_plan_templates')
      .query(Q.where('plan_id', Q.oneOf(missingPlanIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const nextPositionByPlan = new Map<string, number>();
    for (const planId of missingPlanIds) {
      const positions = planMemberships
        .filter((membership) => membership.planId === planId)
        .map((membership) => membership.position);
      nextPositionByPlan.set(planId, positions.length > 0 ? Math.max(...positions) + 1 : 0);
    }

    const collection = database.get<WorkoutPlanTemplate>('workout_plan_templates');
    for (const planId of missingPlanIds) {
      if (!validPlanIds.has(planId)) {
        continue;
      }
      records.push(
        collection.prepareCreate((record) => {
          record.planId = planId;
          record.templateId = templateId;
          record.weekDays = undefined;
          record.position = nextPositionByPlan.get(planId) ?? 0;
          record.createdAt = now;
          record.updatedAt = now;
        })
      );
    }

    return records;
  }

  static async getPlansWithMemberships(): Promise<PlanWithMemberships[]> {
    const [plans, memberships] = await Promise.all([
      WorkoutPlanRepository.getAll().fetch(),
      WorkoutPlanRepository.getAllMemberships().fetch(),
    ]);
    return plans.map((plan) => ({
      plan,
      memberships: memberships.filter((membership) => membership.planId === plan.id),
    }));
  }
}
