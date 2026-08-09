import type { WorkoutPlanCycleType } from '@/constants/workoutPlans';

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface SchedulePlanSummary {
  id: string;
  cycleType: WorkoutPlanCycleType;
}

export interface ScheduleMembershipSummary {
  planId: string;
  templateId: string;
  weekDays?: number[];
}

export interface StandaloneScheduleSummary {
  templateId: string;
  dayOfWeek: string;
  reminderTime?: string;
}

export interface ResolvedWorkoutSchedule {
  templateId: string;
  planId?: string;
  dayIndex: number;
  reminderTime: string;
}

export function resolveWorkoutLogPlanId(
  explicitPlanId: string | undefined,
  memberships: { planId: string; deletedAt?: number | null }[]
): string | undefined {
  if (explicitPlanId) {
    return explicitPlanId;
  }
  const activeMemberships = memberships.filter((membership) => !membership.deletedAt);
  return activeMemberships.length === 1 ? activeMemberships[0].planId : undefined;
}

export function resolveWorkoutSchedules(
  plans: SchedulePlanSummary[],
  memberships: ScheduleMembershipSummary[],
  standaloneSchedules: StandaloneScheduleSummary[]
): ResolvedWorkoutSchedule[] {
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const validMemberships = memberships.filter((membership) => planById.has(membership.planId));
  const plannedTemplateIds = new Set(validMemberships.map((membership) => membership.templateId));
  const resolved: ResolvedWorkoutSchedule[] = [];

  for (const membership of validMemberships) {
    const plan = planById.get(membership.planId);
    if (plan?.cycleType !== 'weekly') {
      continue;
    }
    for (const dayIndex of membership.weekDays ?? []) {
      resolved.push({
        templateId: membership.templateId,
        planId: membership.planId,
        dayIndex,
        reminderTime: '08:00',
      });
    }
  }

  for (const schedule of standaloneSchedules) {
    if (plannedTemplateIds.has(schedule.templateId)) {
      continue;
    }
    const dayIndex = WEEKDAY_NAMES.indexOf(schedule.dayOfWeek as (typeof WEEKDAY_NAMES)[number]);
    if (dayIndex >= 0) {
      resolved.push({
        templateId: schedule.templateId,
        dayIndex,
        reminderTime: schedule.reminderTime || '08:00',
      });
    }
  }

  const unique = new Map<string, ResolvedWorkoutSchedule>();
  for (const schedule of resolved) {
    const key = `${schedule.templateId}:${schedule.dayIndex}:${schedule.reminderTime}`;
    if (!unique.has(key)) {
      unique.set(key, schedule);
    }
  }
  return [...unique.values()];
}
