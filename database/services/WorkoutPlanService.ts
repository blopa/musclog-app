import { Model, Q } from '@nozbe/watermelondb';

import {
  DEFAULT_WORKOUT_PLAN_CYCLE_TYPE,
  type WorkoutPlanCycleType,
} from '@/constants/workoutPlans';
import { database } from '@/database/database-instance';
import Schedule from '@/database/models/Schedule';
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

/**
 * Plans and the workouts filed under them.
 *
 * Two rules are enforced here rather than left to callers, because a caller that forgets either one
 * leaves the database in a state the readers cannot describe:
 *
 *  1. **Plan fields and the plan's full membership are one write.** `savePlan` is the only way to
 *     change an existing plan. There is deliberately no `updatePlan` + `setPlanMemberships` pair:
 *     splitting them lets a cycle-type change commit while the weekday clearing it implies does
 *     not, and the plan editor edits both at once anyway.
 *  2. **A workout has exactly one calendar owner.** The moment a workout gains a plan membership,
 *     its standalone `schedules` rows are soft-deleted in the SAME batch — see
 *     {@link WorkoutPlanService.prepareStandaloneScheduleCleanup}. Leaving them behind is not
 *     cosmetic: `resolveWorkoutSchedules` ignores them while a membership exists, so they are
 *     invisible right up until the workout leaves the plan and its old schedule silently returns.
 */
export class WorkoutPlanService {
  /**
   * Soft-deletes the standalone `schedules` of workouts that now belong to a plan.
   *
   * Called on every path that can create a membership. Passing a template that already had one
   * costs nothing — it has no active schedules left to find — so callers pass their whole
   * membership set rather than trying to work out which ones are new.
   */
  private static async prepareStandaloneScheduleCleanup(
    templateIds: string[],
    now: number
  ): Promise<Model[]> {
    if (templateIds.length === 0) {
      return [];
    }

    const schedules = await database
      .get<Schedule>('schedules')
      .query(Q.where('template_id', Q.oneOf(templateIds)), Q.where('deleted_at', Q.eq(null)))
      .fetch();

    return schedules.map((schedule) =>
      schedule.prepareUpdate((record) => {
        record.deletedAt = now;
        record.updatedAt = now;
      })
    );
  }

  /**
   * Returns UNSAVED prepared records — a caller inside a writer batches them itself, and
   * WatermelonDB writers must not nest.
   */
  static async prepareCreatePlan(
    data: CreateWorkoutPlanData,
    now = Date.now()
  ): Promise<{ plan: WorkoutPlan; records: Model[] }> {
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

    return {
      plan,
      // A brand-new plan has no existing memberships, so the same diff that powers `savePlan`
      // produces exactly the creates a bespoke loop used to.
      records: [
        plan,
        ...this.prepareMembershipChanges(plan.id, cycleType, [], memberships, now),
        ...(await this.prepareStandaloneScheduleCleanup(
          memberships.map((membership) => membership.templateId),
          now
        )),
      ],
    };
  }

  static async createPlan(data: CreateWorkoutPlanData): Promise<WorkoutPlan> {
    return database.write(async () => {
      const { plan, records } = await this.prepareCreatePlan(data);
      await database.batch(...records);
      return plan;
    });
  }

  /** The only way to change an existing plan: fields and full membership, in one batch. */
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

      await database.batch(
        this.preparePlanUpdate(plan, patch, now),
        ...this.prepareMembershipChanges(planId, nextCycleType, existing, normalizedInputs, now),
        ...(await this.prepareStandaloneScheduleCleanup(
          normalizedInputs.map((membership) => membership.templateId),
          now
        ))
      );
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

  /**
   * The membership diff for one plan. Pure record preparation — `normalizeWeekDays` is what makes
   * a switch to a rotating cycle drop every stored weekday, so no caller needs to do that itself.
   */
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
      const { records } = await this.prepareSyncTemplateMemberships(
        templateId,
        planIds,
        Date.now()
      );
      if (records.length > 0) {
        await database.batch(...records);
      }
    });
  }

  /**
   * Active plan ids a template currently belongs to. Callers use this to decide calendar
   * ownership: a template with at least one active membership takes its weekdays from that
   * membership, so it must not also carry standalone `schedules` rows.
   *
   * Memberships whose plan no longer exists are excluded — that plan cannot schedule anything, so
   * treating the workout as planned would strand it with no calendar owner at all.
   */
  static async getActivePlanIdsForTemplate(templateId: string): Promise<string[]> {
    const memberships = await WorkoutPlanRepository.getMembershipsForTemplate(templateId).fetch();
    return this.filterLivePlanIds(memberships.map((membership) => membership.planId));
  }

  /** The subset of `planIds` naming a plan that exists and is not deleted. */
  private static async filterLivePlanIds(planIds: string[]): Promise<string[]> {
    const unique = [...new Set(planIds.filter(Boolean))];
    if (unique.length === 0) {
      return [];
    }

    const plans = await database
      .get<WorkoutPlan>('workout_plans')
      .query(Q.where('id', Q.oneOf(unique)), Q.where('deleted_at', Q.eq(null)))
      .fetch();
    const live = new Set(plans.map((plan) => plan.id));
    return unique.filter((planId) => live.has(planId));
  }

  /**
   * Returns UNSAVED prepared records for the caller to `database.batch()` — it never opens a
   * writer itself, because `saveTemplate` already owns one and WatermelonDB writers must not nest.
   *
   * `activePlanIds` is the membership set the template will have once `records` are committed,
   * with plan ids that reference a deleted or missing plan already dropped — including ids that
   * an EXISTING junction row points at, whose memberships are soft-deleted here rather than left
   * to make the workout look planned to a plan that is gone.
   */
  static async prepareSyncTemplateMemberships(
    templateId: string,
    planIds: string[],
    now: number
  ): Promise<{ activePlanIds: string[]; records: Model[] }> {
    const existing = await WorkoutPlanRepository.getMembershipsForTemplate(templateId).fetch();
    const desiredPlanIds = [...new Set(planIds.filter(Boolean))];
    // One liveness query covering both halves of the diff: an id we are about to add and an id an
    // existing row already points at are equally worthless if the plan behind them is gone.
    const livePlanIds = new Set(
      await this.filterLivePlanIds([
        ...desiredPlanIds,
        ...existing.map((membership) => membership.planId),
      ])
    );
    const activePlanIds = desiredPlanIds.filter((planId) => livePlanIds.has(planId));
    const keep = new Set(activePlanIds);
    const records: Model[] = existing
      .filter((membership) => !keep.has(membership.planId))
      .map((membership) =>
        membership.prepareUpdate((record) => {
          record.deletedAt = now;
          record.updatedAt = now;
        })
      );

    const existingPlanIds = new Set(existing.map((membership) => membership.planId));
    const missingPlanIds = activePlanIds.filter((planId) => !existingPlanIds.has(planId));

    if (missingPlanIds.length > 0) {
      const siblings = await database
        .get<WorkoutPlanTemplate>('workout_plan_templates')
        .query(Q.where('plan_id', Q.oneOf(missingPlanIds)), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const collection = database.get<WorkoutPlanTemplate>('workout_plan_templates');

      for (const planId of missingPlanIds) {
        const positions = siblings
          .filter((membership) => membership.planId === planId)
          .map((membership) => membership.position);
        records.push(
          collection.prepareCreate((record) => {
            record.planId = planId;
            record.templateId = templateId;
            record.weekDays = undefined;
            record.position = positions.length > 0 ? Math.max(...positions) + 1 : 0;
            record.createdAt = now;
            record.updatedAt = now;
          })
        );
      }
    }

    if (activePlanIds.length > 0) {
      // The workout is planned, so the plan owns its calendar. See the class doc.
      records.push(...(await this.prepareStandaloneScheduleCleanup([templateId], now)));
    }

    return { activePlanIds, records };
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
