import type { WorkoutPlanCycleType } from '@/constants/workoutPlans';

export interface WorkoutPlanSummary {
  id: string;
  name: string;
  description?: string;
  cycleType: WorkoutPlanCycleType;
  icon?: string;
  difficulty?: string;
}

export interface PlanMembershipSummary {
  id?: string;
  planId: string;
  templateId: string;
  weekDays?: number[];
  position: number;
}

export interface WorkoutTemplateSummary {
  id: string;
  name: string;
  description?: string;
  type?: string;
  icon?: string;
  exerciseCount: number;
  lastCompleted?: string;
  lastCompletedTimestamp?: number;
  duration?: string;
}

export interface PlannedWorkout<T extends WorkoutTemplateSummary = WorkoutTemplateSummary> {
  template: T;
  membership: PlanMembershipSummary;
}

export interface PlanSection<T extends WorkoutTemplateSummary = WorkoutTemplateSummary> {
  plan: WorkoutPlanSummary;
  workouts: PlannedWorkout<T>[];
}

function templateMatches(template: WorkoutTemplateSummary, query: string): boolean {
  return (
    template.name.toLowerCase().includes(query) ||
    Boolean(template.description?.toLowerCase().includes(query))
  );
}

export function groupTemplatesByPlan<T extends WorkoutTemplateSummary>(
  plans: WorkoutPlanSummary[],
  memberships: PlanMembershipSummary[],
  templates: T[],
  searchQuery = ''
): { sections: PlanSection<T>[]; unplanned: T[] } {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const validPlanIds = new Set(plans.map((plan) => plan.id));
  const membershipsByPlan = new Map<string, PlanMembershipSummary[]>();
  const plannedTemplateIds = new Set<string>();

  for (const membership of memberships) {
    if (!templatesById.has(membership.templateId) || !validPlanIds.has(membership.planId)) {
      continue;
    }
    plannedTemplateIds.add(membership.templateId);
    const current = membershipsByPlan.get(membership.planId) ?? [];
    current.push(membership);
    membershipsByPlan.set(membership.planId, current);
  }

  const sections = plans.flatMap<PlanSection<T>>((plan) => {
    const planMatches = normalizedQuery ? plan.name.toLowerCase().includes(normalizedQuery) : false;
    const planMemberships = membershipsByPlan.get(plan.id) ?? [];
    const sorted = [...planMemberships].sort((left, right) => {
      if (plan.cycleType === 'rotating') {
        return left.position - right.position;
      }
      const leftDay = left.weekDays?.length ? Math.min(...left.weekDays) : Number.MAX_SAFE_INTEGER;
      const rightDay = right.weekDays?.length
        ? Math.min(...right.weekDays)
        : Number.MAX_SAFE_INTEGER;
      return leftDay - rightDay || left.position - right.position;
    });
    const workouts = sorted.flatMap<PlannedWorkout<T>>((membership) => {
      const template = templatesById.get(membership.templateId);
      if (
        !template ||
        (normalizedQuery && !planMatches && !templateMatches(template, normalizedQuery))
      ) {
        return [];
      }
      return [{ template, membership }];
    });
    return workouts.length > 0 ? [{ plan, workouts }] : [];
  });

  const unplanned = templates.filter(
    (template) =>
      !plannedTemplateIds.has(template.id) &&
      (!normalizedQuery || templateMatches(template, normalizedQuery))
  );

  return { sections, unplanned };
}
