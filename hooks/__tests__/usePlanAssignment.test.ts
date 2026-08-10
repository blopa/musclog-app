/**
 * @jest-environment jsdom
 */

/**
 * Behaviour of the shared "which plans is this workout in?" flow.
 *
 * Lives under `hooks/__tests__` rather than beside the hook because jest.config.js routes tests to
 * the jsdom project by path (`**\/hooks\/**\/*.test.ts`), and this one needs a DOM to render.
 *
 * The picker and the plan editor are replaced with prop recorders, so what is under test is the
 * wiring the workout library and the create-workout form used to own a copy of each: merging a
 * newly created plan into the selection, seeding a new plan with the workout that opened it, and
 * whether confirming closes the picker.
 */

import { render } from '@testing-library/react';
import { act, createElement, type ReactNode } from 'react';

import { usePlanAssignment } from '@/components/workout/usePlanAssignment';

const pickerProps: any[] = [];
const editorProps: any[] = [];

jest.mock('@/components/modals/WorkoutPlanPickerModal', () => ({
  WorkoutPlanPickerModal: (props: any) => {
    pickerProps.push(props);
    return null;
  },
}));

jest.mock('@/components/modals/CreateEditPlanModal', () => ({
  CreateEditPlanModal: (props: any) => {
    editorProps.push(props);
    return null;
  },
}));

jest.mock('@/hooks/useWorkoutPlans', () => ({
  useWorkoutPlans: () => ({
    isLoading: false,
    memberships: [],
    plans: [{ cycleType: 'weekly', id: 'plan-1', name: 'PPL' }],
  }),
}));

/** Renders the hook and keeps its `modals` mounted, which the prop recorders depend on. */
function renderFlow(options: Parameters<typeof usePlanAssignment>[0]) {
  const captured: { current: ReturnType<typeof usePlanAssignment> | null } = { current: null };

  function Host(): ReactNode {
    const assignment = usePlanAssignment(options);
    captured.current = assignment;
    return assignment.modals;
  }

  const view = render(createElement(Host));
  return {
    captured,
    rerender: () => view.rerender(createElement(Host)),
    latestPicker: () => pickerProps[pickerProps.length - 1],
    latestEditor: () => editorProps[editorProps.length - 1],
  };
}

describe('usePlanAssignment', () => {
  beforeEach(() => {
    pickerProps.length = 0;
    editorProps.length = 0;
  });

  it('keeps the plan editor unmounted until the picker asks for it', () => {
    const flow = renderFlow({
      onChange: jest.fn(),
      onConfirm: jest.fn(),
      selectedPlanIds: [],
    });

    expect(flow.latestPicker().visible).toBe(false);
    expect(editorProps).toHaveLength(0);

    act(() => flow.captured.current!.openPicker());
    expect(flow.latestPicker().visible).toBe(true);

    act(() => flow.latestPicker().onCreatePlan());
    // Creating a plan replaces the picker rather than stacking on it.
    expect(flow.latestPicker().visible).toBe(false);
    expect(flow.latestEditor().visible).toBe(true);
  });

  it('seeds a plan created from the picker with the workout that opened it', () => {
    // The membership has to be part of `createPlan`, not a follow-up write: a second transaction
    // can fail on its own and leave an empty plan behind while the editor reports success.
    const flow = renderFlow({
      onChange: jest.fn(),
      onConfirm: jest.fn(),
      selectedPlanIds: [],
      templateId: 'template-7',
    });

    act(() => flow.captured.current!.openPicker());
    act(() => flow.latestPicker().onCreatePlan());

    expect(flow.latestEditor().initialTemplateIds).toEqual(['template-7']);
  });

  it('seeds nothing when the workout does not exist yet', () => {
    // The create-workout form has no template id until its own Save runs.
    const flow = renderFlow({
      onChange: jest.fn(),
      onConfirm: jest.fn(),
      selectedPlanIds: [],
    });

    act(() => flow.captured.current!.openPicker());
    act(() => flow.latestPicker().onCreatePlan());

    expect(flow.latestEditor().initialTemplateIds).toBeUndefined();
  });

  it('merges a newly created plan into the selection without duplicating it', () => {
    const onChange = jest.fn();
    const flow = renderFlow({
      onChange,
      onConfirm: jest.fn(),
      selectedPlanIds: ['plan-1'],
    });

    act(() => flow.captured.current!.openPicker());
    act(() => flow.latestPicker().onCreatePlan());
    act(() => flow.latestEditor().onSaved('plan-2'));

    expect(onChange).toHaveBeenCalledWith(['plan-1', 'plan-2']);

    // Saving unmounts the editor: a further render records the picker again but not the editor.
    const editorRenders = editorProps.length;
    const pickerRenders = pickerProps.length;
    act(() => flow.rerender());
    expect(editorProps.length).toBe(editorRenders);
    expect(pickerProps.length).toBeGreaterThan(pickerRenders);
  });

  it('closes the picker once confirming resolves', async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined);
    const flow = renderFlow({ onChange: jest.fn(), onConfirm, selectedPlanIds: [] });

    act(() => flow.captured.current!.openPicker());
    await act(async () => {
      await flow.latestPicker().onSave();
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(flow.latestPicker().visible).toBe(false);
  });

  it('leaves the picker open when confirming fails, so the selection survives a retry', async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error('write failed'));
    const flow = renderFlow({ onChange: jest.fn(), onConfirm, selectedPlanIds: [] });

    act(() => flow.captured.current!.openPicker());
    await act(async () => {
      await expect(flow.latestPicker().onSave()).rejects.toThrow('write failed');
    });

    expect(flow.latestPicker().visible).toBe(true);
  });
});
