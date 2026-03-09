import { useEffect, useMemo, useState } from 'react';

import type { BirthControlType, MenstrualCycleUpdate } from '../database/models';
import { MenstrualCycleRepository } from '../database/repositories/MenstrualCycleRepository';
import {
  MenstrualPhase,
  EnergyLevel,
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

  useEffect(() => {
    const subscription = MenstrualCycleRepository.getActive()
      .observe()
      .subscribe({
        next: (cycles) => {
          setCycle(cycles[0] || null);
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
      cycle && currentPhase ? MenstrualService.getIntensityMultiplier(currentPhase, cycle.syncGoal) : 1.0;
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
  }, [cycle]);

  return useMemo(
    () => ({
      cycle,
      isLoading,
      ...derivedValues,
      updateCycle,
      createNewCycle,
      deactivateTracking,
    }),
    [cycle, isLoading, derivedValues]
  );
}
