import { useEffect, useMemo, useState } from 'react';

import type { BirthControlType, MenstrualCycleUpdate } from '../database/models';
import { MenstrualCycleRepository } from '../database/repositories/MenstrualCycleRepository';
import {
  EnergyLevel,
  MenstrualPhase,
  MenstrualService,
} from '../database/services/MenstrualService';

export interface UseMenstrualCycleResult {
  cycle: any | null;
  isLoading: boolean;
  isActive: boolean;
  isCurrentlyInPeriod: boolean;
  isCurrentlyInFertileWindow: boolean;
  nextPeriodDate: Date | null;
  fertileWindow: { start: Date; end: Date } | null;
  currentPhase: MenstrualPhase | null;
  energyLevel: EnergyLevel | null;
  intensityMultiplier: number;
  cycleDay: number;
  updateCycle: (data: MenstrualCycleUpdate) => Promise<void>;
  createNewCycle: (data: {
    avgCycleLength?: number;
    avgPeriodDuration?: number;
    useHormonalBirthControl?: boolean;
    birthControlType?: BirthControlType;
    lastPeriodStartDate?: number;
  }) => Promise<void>;
  deactivateTracking: () => Promise<void>;
}

export function useMenstrualCycle(): UseMenstrualCycleResult {
  const [cycle, setCycle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // WatermelonDB returns the same cached model instance after updates (mutated in place),
  // so React's setCycle bails out (Object.is equality). This tick forces a re-render and
  // ensures derivedValues useMemo recomputes with fresh field values.
  const [updateTick, setUpdateTick] = useState(0);

  useEffect(() => {
    // observeWithColumns ensures the subscription re-fires when any of these
    // fields change, not just when records enter/leave the query results.
    const subscription = MenstrualCycleRepository.getActive()
      .observeWithColumns([
        'avg_cycle_length',
        'avg_period_duration',
        'use_hormonal_birth_control',
        'birth_control_type',
        'last_period_start_date',
        'sync_goal',
        'is_active',
        'updated_at',
      ])
      .subscribe({
        next: (cycles) => {
          setCycle(cycles[0] || null);
          setUpdateTick((t) => t + 1);
          setIsLoading(false);
        },
        error: () => {
          setCycle(null);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const updateCycle = async (data: MenstrualCycleUpdate): Promise<void> => {
    if (!cycle) {
      return;
    }
    await cycle.updateCycle(data);
  };

  const createNewCycle = async (data: {
    avgCycleLength?: number;
    avgPeriodDuration?: number;
    useHormonalBirthControl?: boolean;
    birthControlType?: BirthControlType;
    lastPeriodStartDate?: number;
  }): Promise<void> => {
    await MenstrualCycleRepository.deactivateAll();
    await MenstrualCycleRepository.createNewCycle(data);
  };

  const deactivateTracking = async (): Promise<void> => {
    if (cycle) {
      await cycle.updateCycle({ isActive: false });
    }
  };

  // Memoize derived values
  const derivedValues = useMemo(() => {
    const isActive = cycle?.isActive ?? false;
    const isCurrentlyInPeriod = cycle?.isCurrentlyInPeriod() ?? false;
    const isCurrentlyInFertileWindow = cycle?.isCurrentlyInFertileWindow() ?? false;
    const nextPeriodDate = cycle?.getNextPeriodDate() ?? null;
    const fertileWindow = cycle?.getFertileWindow() ?? null;

    const currentPhase = cycle ? MenstrualService.calculateCurrentPhase(cycle) : null;
    const energyLevel = currentPhase ? MenstrualService.getEnergyLevel(currentPhase) : null;
    const intensityMultiplier =
      cycle && currentPhase
        ? MenstrualService.getIntensityMultiplier(currentPhase, cycle.syncGoal)
        : 1.0;
    const cycleDay = cycle ? MenstrualService.getCycleDay(cycle) : 0;

    return {
      isActive,
      isCurrentlyInPeriod,
      isCurrentlyInFertileWindow,
      nextPeriodDate,
      fertileWindow,
      currentPhase,
      energyLevel,
      intensityMultiplier,
      cycleDay,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, updateTick]);

  return useMemo(
    () => ({
      cycle,
      isLoading,
      ...derivedValues,
      updateCycle,
      createNewCycle,
      deactivateTracking,
    }),
    [cycle, isLoading, derivedValues, updateCycle, deactivateTracking]
  );
}
