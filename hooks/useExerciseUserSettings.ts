import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Units } from '@/constants/settings';
import type ExerciseUserSettings from '@/database/models/ExerciseUserSettings';
import { ExerciseUserSettingsService } from '@/database/services/ExerciseUserSettingsService';
import {
  isWeightUnitOverride,
  resolveWeightUnits,
  type WeightUnitOverride,
} from '@/utils/unitConversion';

const SETTINGS_COLUMNS = ['weight_unit', 'note', 'updated_at'];

export interface ExerciseSettingsView {
  weightUnit: WeightUnitOverride | undefined;
  note: string | undefined;
}

export interface UseExerciseUserSettingsResult {
  /** The settings of one exercise, or none. */
  get: (exerciseId: string | undefined) => ExerciseSettingsView;
  /** Every pinned weight unit by exercise id. */
  weightUnitByExerciseId: ReadonlyMap<string, WeightUnitOverride>;
  /**
   * The unit system an exercise's weights are shown in: its own override, else `gymUnit`, else the
   * account's. The one entry point for screens that convert several exercises' weights.
   */
  unitsFor: (exerciseId: string | undefined, account: Units, gymUnit?: unknown) => Units;
  isLoading: boolean;
}

const NO_SETTINGS: ExerciseSettingsView = { weightUnit: undefined, note: undefined };

/**
 * Per-exercise preferences, observed. The table is tiny (one row per exercise the user has
 * customised), so one subscription for all of them serves every screen — a row is updated in
 * place, which is why this uses `observeWithColumns` rather than `observe`.
 */
export function useExerciseUserSettings(): UseExerciseUserSettingsResult {
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

  const weightUnitByExerciseId = useMemo(() => {
    const map = new Map<string, WeightUnitOverride>();
    for (const row of rows) {
      if (isWeightUnitOverride(row.weightUnit)) {
        map.set(row.exerciseId, row.weightUnit);
      }
    }
    return map;
  }, [rows]);

  const unitsFor = useCallback(
    (exerciseId: string | undefined, account: Units, gymUnit?: unknown) =>
      resolveWeightUnits({
        account,
        gym: gymUnit,
        exercise: exerciseId ? weightUnitByExerciseId.get(exerciseId) : undefined,
      }),
    [weightUnitByExerciseId]
  );

  return useMemo(() => {
    const byExercise = new Map<string, ExerciseSettingsView>();
    for (const row of rows) {
      const weightUnit = isWeightUnitOverride(row.weightUnit) ? row.weightUnit : undefined;
      byExercise.set(row.exerciseId, { weightUnit, note: row.note ?? undefined });
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
