import { type ReactNode, useCallback, useState } from 'react';

import { CreateEditPlanModal } from '@/components/modals/CreateEditPlanModal';
import { WorkoutPlanPickerModal } from '@/components/modals/WorkoutPlanPickerModal';
import type WorkoutPlan from '@/database/models/WorkoutPlan';
import { useWorkoutPlans } from '@/hooks/useWorkoutPlans';

interface PlanAssignmentOptions {
  /**
   * Confirming the picker. The workout library persists here; the create/edit workout form does
   * nothing and lets its own Save write the membership.
   *
   * Return `false` to keep the picker open, which is how a failed write leaves the user's selection
   * on screen to retry instead of silently discarding it. Returning nothing means success.
   *
   * Deliberately NOT "throw to stay open": this is reached from a `Pressable`'s `onPress`, which
   * neither awaits nor catches, so a rejected promise crossing back out of here is an unhandled
   * rejection that only happens to produce the right UI.
   */
  onConfirm: (planIds: string[]) => boolean | Promise<boolean | void> | void;
  /**
   * The plans the workout is currently filed under, when the host tracks that itself — the
   * create/edit workout form does, because it renders the names and its own Save writes them.
   *
   * Omit it when the host has nowhere to put the answer: the picker keeps its own working copy
   * either way, so a host that persists on confirm (the workout library) would otherwise need a
   * state slot it never reads.
   */
  selectedPlanIds?: string[];
  /** Called with the confirmed selection, and when a plan created from the picker joins it. */
  onChange?: (planIds: string[]) => void;
  /**
   * The workout being filed, when it already exists. A plan created from the picker starts out
   * containing it — one `createPlan` call, so there is no window where the plan exists empty.
   * Omitted for a workout that has not been saved yet; the form files it on save instead.
   */
  templateId?: string;
}

interface PlanAssignment {
  plans: WorkoutPlan[];
  openPicker: (initialPlanIds?: readonly string[]) => void;
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
  onConfirm,
  selectedPlanIds,
  onChange,
  templateId,
}: PlanAssignmentOptions): PlanAssignment {
  const { plans } = useWorkoutPlans();
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [draftPlanIds, setDraftPlanIds] = useState<string[]>(selectedPlanIds ?? []);

  const openPicker = useCallback(
    (initialPlanIds: readonly string[] = selectedPlanIds ?? []) => {
      setDraftPlanIds([...initialPlanIds]);
      setIsPickerVisible(true);
    },
    [selectedPlanIds]
  );

  const handleConfirm = useCallback(async () => {
    // A throwing `onConfirm` is treated as a refusal rather than allowed to escape: see the
    // `onConfirm` doc for why nothing may reject out of here.
    const committed = await Promise.resolve()
      .then(() => onConfirm(draftPlanIds))
      .then((result) => result !== false)
      .catch(() => false);

    if (!committed) {
      return;
    }

    onChange?.(draftPlanIds);
    setIsPickerVisible(false);
  }, [draftPlanIds, onChange, onConfirm]);

  const handlePlanCreated = useCallback(
    (createdPlanId: string) => {
      onChange?.([...new Set([...(selectedPlanIds ?? []), createdPlanId])]);
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
          selectedPlanIds={draftPlanIds}
          onChange={setDraftPlanIds}
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
