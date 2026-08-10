import { useEffect, useRef, useState } from 'react';

import type { WorkoutPlanCycleType } from '@/constants/workoutPlans';
import { WorkoutPlanService } from '@/database/services/WorkoutPlanService';

/**
 * One row of a plan's membership: which workout, and (for a weekly plan) which days.
 *
 * Membership, order and schedule are ONE concept and so are one piece of state: the array order is
 * the plan order, presence in the array is selection, and `weekDays` rides along. Holding them as
 * three parallel structures — a selected-id set, an ordered-id list and an id → days record — meant
 * every read had to re-intersect them, and the intersection was written out twice.
 */
export interface PlanMemberDraft {
  templateId: string;
  weekDays: number[];
}

export interface PlanDraft {
  name: string;
  description: string;
  cycleType: WorkoutPlanCycleType;
  icon?: string;
  members: PlanMemberDraft[];
  /** The cycle type as STORED, so Save can tell the user switched it and warn about the days. */
  savedCycleType?: WorkoutPlanCycleType;
  isLoading: boolean;
  loadError?: unknown;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setCycleType: (cycleType: WorkoutPlanCycleType) => void;
  setIcon: (icon: string | undefined) => void;
  setMembers: (update: (current: PlanMemberDraft[]) => PlanMemberDraft[]) => void;
}

/**
 * The plan editor's editable state, seeded ONCE per plan.
 *
 * The editor used to seed itself from the `useWorkoutPlans()` subscription with `memberships` in
 * its effect's dependencies, so any membership write anywhere in the app re-ran it and replaced the
 * user's half-typed name, chosen icon and reordered workouts with whatever was on disk.
 * `initialTemplateIds` — a fresh array literal from every caller — did the same on every parent
 * render. A form is not a live view of the database: read it when it opens, and let Save be the
 * only thing that puts it back.
 *
 * Its own hook rather than six `useState`s inside the modal so this contract is testable without
 * rendering ~350 lines of React Native JSX, and so the modal is left holding only presentation.
 *
 * Keyed on `planId` alone: switching which plan is edited reloads, and nothing else can.
 */
export function usePlanDraft(planId?: string, initialTemplateIds?: string[]): PlanDraft {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cycleType, setCycleType] = useState<WorkoutPlanCycleType>('weekly');
  const [icon, setIcon] = useState<string | undefined>();
  const [members, setMembers] = useState<PlanMemberDraft[]>([]);
  const [savedCycleType, setSavedCycleType] = useState<undefined | WorkoutPlanCycleType>();
  const [isLoading, setIsLoading] = useState(Boolean(planId));
  const [loadError, setLoadError] = useState<unknown>();

  /**
   * Read at mount only. `initialTemplateIds` is an INITIAL value — the name says so — and every
   * caller builds it inline (`templateId ? [templateId] : undefined`), so depending on it would
   * re-seed the form on each parent render.
   */
  const seedTemplateIdsRef = useRef(initialTemplateIds);

  useEffect(() => {
    // Synchronous state updates go through named helpers rather than bare setState calls in the
    // effect body: `react-hooks/set-state-in-effect` is an error in this repo, and this is the
    // wrapper idiom it already uses (`useCopyDaySource`, `CoachQuickSettingsModal`). Don't inline
    // them. The updates inside `.then()`/`.catch()` are async continuations and need no wrapper.
    const seedBlankPlan = () => {
      setName('');
      setDescription('');
      setCycleType('weekly');
      setIcon(undefined);
      setSavedCycleType(undefined);
      setLoadError(undefined);
      setMembers(
        (seedTemplateIdsRef.current ?? []).map((templateId) => ({ templateId, weekDays: [] }))
      );
      setIsLoading(false);
    };
    const markLoading = () => {
      setLoadError(undefined);
      setIsLoading(true);
    };

    if (!planId) {
      seedBlankPlan();
      return;
    }

    let cancelled = false;
    markLoading();
    WorkoutPlanService.getPlanSnapshot(planId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }
        setName(snapshot?.plan.name ?? '');
        setDescription(snapshot?.plan.description ?? '');
        setCycleType(snapshot?.plan.cycleType ?? 'weekly');
        setIcon(snapshot?.plan.icon);
        setSavedCycleType(snapshot?.plan.cycleType);
        setMembers(
          [...(snapshot?.memberships ?? [])]
            .sort((left, right) => left.position - right.position)
            .map((membership) => ({
              templateId: membership.templateId,
              weekDays: membership.weekDays ?? [],
            }))
        );
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setLoadError(error);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  return {
    cycleType,
    description,
    icon,
    isLoading,
    loadError,
    members,
    name,
    savedCycleType,
    setCycleType,
    setDescription,
    setIcon,
    setMembers,
    setName,
  };
}
