import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { isStaticExport } from '@/constants/platform';
import type { BirthControlType, MenstrualCycleUpdate } from '@/database/models';
import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import {
  EnergyLevel,
  MenstrualPhase,
  MenstrualService,
} from '@/database/services/MenstrualService';

export interface MenstrualCycleContextType {
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

const MenstrualCycleContext = createContext<MenstrualCycleContextType | undefined>(undefined);

export function MenstrualCycleProvider({ children }: { children: ReactNode }) {
  const [cycle, setCycle] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updateTick, setUpdateTick] = useState(0);

  useEffect(() => {
    if (isStaticExport) {
      setIsLoading(false);
      return;
    }

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

  const updateCycle = useCallback(
    async (data: MenstrualCycleUpdate): Promise<void> => {
      if (!cycle) {
        return;
      }
      await cycle.updateCycle(data);
    },
    [cycle]
  );

  const createNewCycle = useCallback(
    async (data: {
      avgCycleLength?: number;
      avgPeriodDuration?: number;
      useHormonalBirthControl?: boolean;
      birthControlType?: BirthControlType;
      lastPeriodStartDate?: number;
    }): Promise<void> => {
      await MenstrualCycleRepository.deactivateAll();
      await MenstrualCycleRepository.createNewCycle(data);
    },
    []
  );

  const deactivateTracking = useCallback(async (): Promise<void> => {
    if (cycle) {
      await cycle.updateCycle({ isActive: false });
    }
  }, [cycle]);

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

  const value = useMemo(
    () => ({
      cycle,
      isLoading,
      ...derivedValues,
      updateCycle,
      createNewCycle,
      deactivateTracking,
    }),
    [cycle, isLoading, derivedValues, updateCycle, createNewCycle, deactivateTracking]
  );

  return <MenstrualCycleContext.Provider value={value}>{children}</MenstrualCycleContext.Provider>;
}

export function useMenstrualCycleContext(): MenstrualCycleContextType {
  const context = useContext(MenstrualCycleContext);
  if (context === undefined) {
    throw new Error('useMenstrualCycleContext must be used within a MenstrualCycleProvider');
  }
  return context;
}
