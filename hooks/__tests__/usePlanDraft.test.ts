/**
 * @jest-environment jsdom
 */

/**
 * The plan editor seeds its form ONCE per plan.
 *
 * It used to seed from the `useWorkoutPlans()` subscription with `memberships` in its effect's
 * dependencies, so every membership write anywhere in the app re-ran it and threw away the user's
 * half-typed name, chosen icon and reordered workouts. `initialTemplateIds` — a fresh array literal
 * from every caller — did the same on each parent render. The symptom had already been patched for
 * the workout picker's page count alone; these tests pin the fix for the whole form.
 */

import { render } from '@testing-library/react';
import { act, createElement, type ReactNode } from 'react';

import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';
import { type PlanDraft, usePlanDraft } from '@/hooks/usePlanDraft';

jest.mock('@/database/services/WorkoutPlanService', () => ({
  WorkoutPlanService: { getPlanSnapshot: jest.fn() },
}));

const mockGetPlanSnapshot = WorkoutPlanService.getPlanSnapshot as jest.Mock;

/** Renders the hook and keeps the latest draft reachable, re-rendering on demand. */
function renderDraft(planId?: string, initialTemplateIds?: string[]) {
  const captured: { current: PlanDraft | null } = { current: null };

  function Host(): ReactNode {
    // A fresh array literal each render, exactly as every real caller passes it.
    captured.current = usePlanDraft(
      planId,
      initialTemplateIds ? [...initialTemplateIds] : undefined
    );
    return null;
  }

  const view = render(createElement(Host));
  return {
    draft: () => captured.current!,
    rerender: () => view.rerender(createElement(Host)),
  };
}

describe('usePlanDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlanSnapshot.mockResolvedValue(null);
  });

  it('reads the plan once and keeps edits across unrelated re-renders', async () => {
    mockGetPlanSnapshot.mockResolvedValue({
      plan: { id: 'p1', name: 'Stored name', description: 'Stored', cycleType: 'weekly' },
      memberships: [
        { templateId: 'w2', position: 1, weekDays: [3] },
        { templateId: 'w1', position: 0, weekDays: [1] },
      ],
    });

    const flow = renderDraft('p1');
    await act(async () => {});

    expect(flow.draft().name).toBe('Stored name');
    expect(flow.draft().savedCycleType).toBe('weekly');
    // Memberships arrive in position order regardless of how the query returned them.
    expect(flow.draft().members).toEqual([
      { templateId: 'w1', weekDays: [1] },
      { templateId: 'w2', weekDays: [3] },
    ]);

    act(() => flow.draft().setName('Half typed'));
    act(() => flow.draft().setMembers((current) => current.slice(0, 1)));
    act(() => flow.rerender());
    await act(async () => {});

    expect(flow.draft().name).toBe('Half typed');
    expect(flow.draft().members).toEqual([{ templateId: 'w1', weekDays: [1] }]);
    // One read for the whole edit: a second is a second chance to clobber the form.
    expect(mockGetPlanSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not re-seed when the caller rebuilds initialTemplateIds each render', async () => {
    const flow = renderDraft(undefined, ['w1']);
    await act(async () => {});

    expect(flow.draft().members).toEqual([{ templateId: 'w1', weekDays: [] }]);
    expect(flow.draft().isLoading).toBe(false);

    act(() =>
      flow.draft().setMembers((current) => [...current, { templateId: 'w2', weekDays: [2] }])
    );
    act(() => flow.rerender());
    await act(async () => {});

    expect(flow.draft().members).toEqual([
      { templateId: 'w1', weekDays: [] },
      { templateId: 'w2', weekDays: [2] },
    ]);
    // A new plan has nothing to read.
    expect(mockGetPlanSnapshot).not.toHaveBeenCalled();
  });

  it('reloads only when the plan being edited changes', async () => {
    mockGetPlanSnapshot.mockImplementation(async (planId: string) => ({
      plan: { id: planId, name: `Plan ${planId}`, cycleType: 'rotating' },
      memberships: [],
    }));

    const captured: { current: PlanDraft | null } = { current: null };
    const host = (planId: string) => {
      function Host(): ReactNode {
        captured.current = usePlanDraft(planId);
        return null;
      }
      return createElement(Host);
    };

    const view = render(host('p1'));
    await act(async () => {});
    expect(captured.current!.name).toBe('Plan p1');

    view.rerender(host('p2'));
    await act(async () => {});

    expect(captured.current!.name).toBe('Plan p2');
    expect(captured.current!.savedCycleType).toBe('rotating');
    expect(mockGetPlanSnapshot).toHaveBeenCalledTimes(2);
  });

  it('surfaces a load failure instead of leaving the form spinning', async () => {
    const failure = new Error('read failed');
    mockGetPlanSnapshot.mockRejectedValue(failure);

    const flow = renderDraft('p1');
    await act(async () => {});

    expect(flow.draft().isLoading).toBe(false);
    expect(flow.draft().loadError).toBe(failure);
  });

  it('does not publish a stale read over a newer plan', async () => {
    // Switching plans mid-read: the first snapshot must not land after the second.
    const resolvers: ((value: unknown) => void)[] = [];
    mockGetPlanSnapshot.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));

    const captured: { current: PlanDraft | null } = { current: null };
    const host = (planId: string) => {
      function Host(): ReactNode {
        captured.current = usePlanDraft(planId);
        return null;
      }
      return createElement(Host);
    };

    const view = render(host('p1'));
    view.rerender(host('p2'));

    await act(async () => {
      resolvers[1]({ plan: { id: 'p2', name: 'Second', cycleType: 'weekly' }, memberships: [] });
      resolvers[0]({ plan: { id: 'p1', name: 'First', cycleType: 'weekly' }, memberships: [] });
    });

    expect(captured.current!.name).toBe('Second');
  });
});
