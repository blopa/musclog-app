import { type ReactNode, useCallback, useState } from 'react';

import { CreateEditPlanModal } from '@/components/modals/CreateEditPlanModal';
import { WorkoutPlanPickerModal } from '@/components/modals/WorkoutPlanPickerModal';
import type WorkoutPlan from '@/database/models/WorkoutPlan';
import { useWorkoutPlans } from '@/hooks/useWorkoutPlans';

interface PlanAssignmentOptions {
  /** Plans the workout is currently filed under. */
  selectedPlanIds: string[];
  onChange: (planIds: string[]) => void;
  /**
   * Confirming the picker. The workout library persists here; the create/edit workout form does
   * nothing and lets its own Save write the membership.
   *
   * The picker closes once this resolves. Throwing keeps it open, which is how a failed write
   * leaves the user's selection on screen to retry instead of silently discarding it.
   */
  onConfirm: () => void | Promise<void>;
  /**
   * The workout being filed, when it already exists. A plan created from the picker starts out
   * containing it — one `createPlan` call, so there is no window where the plan exists empty.
   * Omitted for a workout that has not been saved yet; the form files it on save instead.
   */
  templateId?: string;
}

interface PlanAssignment {
  plans: WorkoutPlan[];
  openPicker: () => void;
  /** The picker and the plan editor it can open. Render once, anywhere in the host's tree. */
  modals: ReactNode;
}

/**
 * "Which plans is this workout in?", as one reusable flow.
 *
 * The workout library and the create/edit workout form both need the same three things — the plan
 * list, a picker, and a way to create a plan without leaving the picker — and had a copy each,
 * down to the merge-the-new-id-into-the-selection step. They differ only in what confirming means,
 * which is `onConfirm`.
 */
export function usePlanAssignment({
  selectedPlanIds,
  onChange,
  onConfirm,
  templateId,
}: PlanAssignmentOptions): PlanAssignment {
  const { plans } = useWorkoutPlans();
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  const openPicker = useCallback(() => setIsPickerVisible(true), []);

  const handleConfirm = useCallback(async () => {
    await onConfirm();
    setIsPickerVisible(false);
  }, [onConfirm]);

  const handlePlanCreated = useCallback(
    (createdPlanId: string) => {
      onChange([...new Set([...selectedPlanIds, createdPlanId])]);
      setIsEditorVisible(false);
    },
    [onChange, selectedPlanIds]
  );

  return {
    openPicker,
    plans,
    modals: (
      <>
        <WorkoutPlanPickerModal
          visible={isPickerVisible}
          plans={plans}
          selectedPlanIds={selectedPlanIds}
          onChange={onChange}
          onClose={() => setIsPickerVisible(false)}
          onSave={handleConfirm}
          onCreatePlan={() => {
            setIsPickerVisible(false);
            setIsEditorVisible(true);
          }}
        />
        {isEditorVisible ? (
          <CreateEditPlanModal
            visible={true}
            initialTemplateIds={templateId ? [templateId] : undefined}
            onClose={() => setIsEditorVisible(false)}
            onSaved={handlePlanCreated}
          />
        ) : null}
      </>
    ),
  };
}
