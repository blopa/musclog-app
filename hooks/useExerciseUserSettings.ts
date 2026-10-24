import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Units } from '@/constants/settings';
import type ExerciseUserSettings from '@/database/models/ExerciseUserSettings';
import {
  ExerciseUserSettingsService,
  weightUnitOverridesOf,
} from '@/database/services/ExerciseUserSettingsService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useSettings } from '@/hooks/useSettings';
import { type BodyweightRepCeiling, storedRepCeiling } from '@/utils/bodyweightRepCeiling';
import {
  isWeightUnitOverride,
  resolveWeightUnits,
  type WeightUnitOverride,
} from '@/utils/unitConversion';

const SETTINGS_COLUMNS = ['weight_unit', 'note', 'rep_ceiling', 'updated_at'];

export interface ExerciseSettingsView {
  weightUnit: WeightUnitOverride | undefined;
  note: string | undefined;
  /**
   * The reps the user picked for an unloaded bodyweight exercise to climb to, or `undefined` when
   * they have not picked one — the default depends on the movement (`defaultRepCeilingFor`), which
   * this hook does not know.
   */
  repCeiling: BodyweightRepCeiling | undefined;
}

export interface UseExerciseUserSettingsResult {
  /** The settings of one exercise, or none. */
  get: (exerciseId: string | undefined) => ExerciseSettingsView;
  /** Every pinned weight unit by exercise id. */
  weightUnitByExerciseId: ReadonlyMap<string, WeightUnitOverride>;
  /**
   * The unit system an exercise's weights are shown and entered in: its own override, else the
   * active gym's, else the account's. The ONE way a screen resolves it — the gym and the account
   * are read here, so no screen can forget one of them (`undefined` gives the gym/account unit).
   * `ExerciseUserSettingsService.getWeightUnitsResolver` is the service-side twin.
   */
  unitsFor: (exerciseId: string | undefined) => Units;
  isLoading: boolean;
}

const NO_SETTINGS: ExerciseSettingsView = {
  weightUnit: undefined,
  note: undefined,
  repCeiling: undefined,
};

/**
 * Per-exercise preferences, observed. The table is tiny (one row per exercise the user has
 * customised), so one subscription for all of them serves every screen — a row is updated in
 * place, which is why this uses `observeWithColumns` rather than `observe`.
 */
export function useExerciseUserSettings(): UseExerciseUserSettingsResult {
  const { units: accountUnits } = useSettings();
  const { gym } = useActiveGym();
  const gymUnit = gym?.weightUnit;
  const [rows, setRows] = useState<ExerciseUserSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = ExerciseUserSettingsService.settingsQuery()
      .observeWithColumns(SETTINGS_COLUMNS)
      .subscribe({
        next: (next) => {
          setRows(next);
          setIsLoading(false);
        },
        error: (error: Error) => {
          console.error('Error observing exercise settings:', error);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const weightUnitByExerciseId = useMemo(() => weightUnitOverridesOf(rows), [rows]);

  const unitsFor = useCallback(
    (exerciseId: string | undefined) =>
      resolveWeightUnits({
        account: accountUnits,
        gym: gymUnit,
        exercise: exerciseId ? weightUnitByExerciseId.get(exerciseId) : undefined,
      }),
    [accountUnits, gymUnit, weightUnitByExerciseId]
  );

  return useMemo(() => {
    const byExercise = new Map<string, ExerciseSettingsView>();
    for (const row of rows) {
      const weightUnit = isWeightUnitOverride(row.weightUnit) ? row.weightUnit : undefined;
      byExercise.set(row.exerciseId, {
        weightUnit,
        note: row.note ?? undefined,
        repCeiling: storedRepCeiling(row.repCeiling),
      });
    }

    return {
      get: (exerciseId: string | undefined) =>
        (exerciseId ? byExercise.get(exerciseId) : undefined) ?? NO_SETTINGS,
      weightUnitByExerciseId,
      unitsFor,
      isLoading,
    };
  }, [rows, weightUnitByExerciseId, unitsFor, isLoading]);
}
