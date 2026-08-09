import {
  groupTemplatesByPlan,
  type PlanMembershipSummary,
  type WorkoutPlanSummary,
  type WorkoutTemplateSummary,
} from '@/utils/workoutPlanGrouping';

const plans: WorkoutPlanSummary[] = [
  { id: 'weekly', name: 'Push Pull Legs', cycleType: 'weekly' },
  { id: 'rotating', name: 'Rotation', cycleType: 'rotating' },
];
const templates: WorkoutTemplateSummary[] = [
  { id: 'push', name: 'Push', exerciseCount: 4 },
  { id: 'pull', name: 'Pull', exerciseCount: 5 },
  { id: 'legs', name: 'Legs', exerciseCount: 6 },
  { id: 'cardio', name: 'Cardio', description: 'Easy run', exerciseCount: 1 },
];

describe('groupTemplatesByPlan', () => {
  it('places many-to-many templates in every matching section and leaves zero-membership templates unplanned', () => {
    const memberships: PlanMembershipSummary[] = [
      { planId: 'weekly', templateId: 'push', weekDays: [0], position: 0 },
      { planId: 'rotating', templateId: 'push', position: 1 },
      { planId: 'rotating', templateId: 'pull', position: 0 },
    ];

    const result = groupTemplatesByPlan(plans, memberships, templates);

    expect(result.sections[0].workouts.map(({ template }) => template.id)).toEqual(['push']);
    expect(result.sections[1].workouts.map(({ template }) => template.id)).toEqual([
      'pull',
      'push',
    ]);
    expect(result.unplanned.map((template) => template.id)).toEqual(['legs', 'cardio']);
  });

  it('sorts weekly days first and unscheduled members last', () => {
    const memberships: PlanMembershipSummary[] = [
      { planId: 'weekly', templateId: 'push', weekDays: [4], position: 0 },
      { planId: 'weekly', templateId: 'pull', position: 1 },
      { planId: 'weekly', templateId: 'legs', weekDays: [1], position: 2 },
    ];

    const result = groupTemplatesByPlan(plans, memberships, templates);

    expect(result.sections[0].workouts.map(({ template }) => template.id)).toEqual([
      'legs',
      'push',
      'pull',
    ]);
  });

  it('drops dangling memberships and empty plan sections', () => {
    const result = groupTemplatesByPlan(
      plans,
      [{ planId: 'weekly', templateId: 'deleted', position: 0 }],
      templates
    );

    expect(result.sections).toEqual([]);
    expect(result.unplanned).toEqual(templates);
  });

  it('treats a template with only an orphaned plan membership as unplanned', () => {
    const result = groupTemplatesByPlan(
      plans,
      [{ planId: 'deleted-plan', templateId: 'push', position: 0 }],
      templates
    );

    expect(result.unplanned).toContainEqual(templates[0]);
  });

  it('matches a plan name by returning all of that plan workouts', () => {
    const memberships: PlanMembershipSummary[] = [
      { planId: 'weekly', templateId: 'push', weekDays: [0], position: 0 },
      { planId: 'weekly', templateId: 'legs', weekDays: [2], position: 1 },
    ];

    const result = groupTemplatesByPlan(plans, memberships, templates, 'ppl');
    expect(result.sections).toEqual([]);

    const namedResult = groupTemplatesByPlan(
      [{ ...plans[0], name: 'PPL' }],
      memberships,
      templates,
      'ppl'
    );
    expect(namedResult.sections[0].workouts).toHaveLength(2);
  });

  it('matches workout names/descriptions and searches unplanned workouts', () => {
    const result = groupTemplatesByPlan(plans, [], templates, 'easy');
    expect(result.sections).toEqual([]);
    expect(result.unplanned.map((template) => template.id)).toEqual(['cardio']);
  });
});
