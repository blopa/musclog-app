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
import type {
  BirthControlType,
  LifeStage,
  MenstrualCycleUpdate,
  SyncGoal,
} from '@/database/models';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import PeriodLog, { type PeriodLogCreate } from '@/database/models/PeriodLog';
import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import { PeriodLogRepository } from '@/database/repositories/PeriodLogRepository';
import {
  CycleStats,
  EnergyLevel,
  MenstrualPhase,
  MenstrualService,
  PredictionConfidence,
} from '@/database/services/MenstrualService';

export interface MenstrualCycleContextType {
  cycle: MenstrualCycle | null;
  periodLogs: PeriodLog[];
  activePeriodLog: PeriodLog | null;
  cycleStats: CycleStats | null;
  isLoading: boolean;
  isActive: boolean;
  isCurrentlyInPeriod: boolean;
  isCurrentlyInFertileWindow: boolean;
  isIrregular: boolean;
  predictionConfidence: PredictionConfidence;
  nextPeriodDate: Date | null;
  nextPeriodEarliest: Date | null;
  nextPeriodLatest: Date | null;
  fertileWindow: { start: Date; end: Date } | null;
  currentPhase: MenstrualPhase | null;
  energyLevel: EnergyLevel | null;
  intensityMultiplier: number;
  cycleDay: number | null;
  updateCycle: (data: MenstrualCycleUpdate) => Promise<void>;
  createNewCycle: (data: {
    avgCycleLength?: number;
    avgPeriodDuration?: number;
    useHormonalBirthControl?: boolean;
    birthControlType?: BirthControlType;
    lastPeriodStartDate?: number | null;
    syncGoal?: SyncGoal;
    lifeStage?: LifeStage;
  }) => Promise<void>;
  logPeriodStart: (data: Omit<PeriodLogCreate, 'menstrualCycleId'>) => Promise<PeriodLog | null>;
  logPeriodEnd: (endDate: number) => Promise<void>;
  addPastPeriod: (data: Omit<PeriodLogCreate, 'menstrualCycleId'>) => Promise<PeriodLog | null>;
  deactivateTracking: () => Promise<void>;
}

const MenstrualCycleContext = createContext<MenstrualCycleContextType | undefined>(undefined);

export function MenstrualCycleProvider({ children }: { children: ReactNode }) {
  const [cycle, setCycle] = useState<MenstrualCycle | null>(null);
  const [periodLogs, setPeriodLogs] = useState<PeriodLog[]>([]);
  // isStaticExport is a build-time constant — no async loading on static export
  const [isLoading, setIsLoading] = useState(!isStaticExport);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Subscribe to the active menstrual cycle
  useEffect(() => {
    if (isStaticExport) {
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
        'life_stage',
        'is_active',
        'updated_at',
      ])
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

  // Subscribe to period_logs for the active cycle
  useEffect(() => {
    if (isStaticExport || !cycle) {
      return;
    }

    const subscription = PeriodLogRepository.getForCycle(cycle.id)
      .observeWithColumns(['start_date', 'end_date', 'notes', 'deleted_at', 'updated_at'])
      .subscribe({
        next: (logs) => setPeriodLogs(logs),
        error: () => setPeriodLogs([]),
      });

    return () => subscription.unsubscribe();
  }, [cycle?.id]);

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
      lastPeriodStartDate?: number | null;
      syncGoal?: SyncGoal;
      lifeStage?: LifeStage;
    }): Promise<void> => {
      await MenstrualCycleRepository.deactivateAll();
      await MenstrualCycleRepository.createNewCycle(data);
    },
    []
  );

  const logPeriodStart = useCallback(
    async (data: Omit<PeriodLogCreate, 'menstrualCycleId'>): Promise<PeriodLog | null> => {
      if (!cycle) {
        return null;
      }

      return await PeriodLogRepository.createWithCycleAnchor(
        { ...data, menstrualCycleId: cycle.id },
        cycle,
        true
      );
    },
    [cycle]
  );

  const logPeriodEnd = useCallback(
    async (endDate: number): Promise<void> => {
      const active = MenstrualService.getActivePeriodLog(periodLogs);
      if (!active) {
        return;
      }

      await active.endPeriod(endDate);
    },
    [periodLogs]
  );

  const addPastPeriod = useCallback(
    async (data: Omit<PeriodLogCreate, 'menstrualCycleId'>): Promise<PeriodLog | null> => {
      if (!cycle) {
        return null;
      }

      const updateAnchor =
        !cycle.lastPeriodStartDate || data.startDate > cycle.lastPeriodStartDate;

      return await PeriodLogRepository.createWithCycleAnchor(
        { ...data, menstrualCycleId: cycle.id },
        cycle,
        updateAnchor
      );
    },
    [cycle]
  );

  const deactivateTracking = useCallback(async (): Promise<void> => {
    if (cycle) {
      await cycle.updateCycle({ isActive: false });
    }
  }, [cycle]);

  const value = useMemo(() => {
    const stats = cycle ? MenstrualService.calculateCycleStats(periodLogs) : null;
    const activePeriodLog = stats ? MenstrualService.getActivePeriodLog(periodLogs) : null;
    const currentPhase =
      cycle && stats
        ? MenstrualService.calculateCurrentPhase(periodLogs, stats, cycle.timezone)
        : null;
    const nextPeriodPrediction =
      cycle && stats ? MenstrualService.predictNextPeriod(periodLogs, stats) : null;
    const fertileWindow =
      cycle && stats ? MenstrualService.getFertileWindow(periodLogs, stats) : null;

    return {
      cycle,
      periodLogs: isStaticExport || !cycle ? [] : periodLogs,
      isLoading,
      isActive: cycle?.isActive ?? false,
      activePeriodLog,
      cycleStats: stats,
      currentPhase,
      energyLevel: currentPhase ? MenstrualService.getEnergyLevel(currentPhase) : null,
      intensityMultiplier:
        cycle && currentPhase
          ? MenstrualService.getIntensityMultiplier(currentPhase, cycle.syncGoal ?? undefined)
          : 1.0,
      cycleDay:
        cycle && stats ? MenstrualService.getCycleDay(periodLogs, stats, cycle.timezone) : null,
      nextPeriodDate: nextPeriodPrediction?.date ?? null,
      nextPeriodEarliest: nextPeriodPrediction?.earliest ?? null,
      nextPeriodLatest: nextPeriodPrediction?.latest ?? null,
      fertileWindow,
      isCurrentlyInPeriod: activePeriodLog != null,
      isCurrentlyInFertileWindow:
        fertileWindow != null &&
        now >= fertileWindow.start.getTime() &&
        now <= fertileWindow.end.getTime(),
      isIrregular: stats?.isIrregular ?? false,
      predictionConfidence: stats?.confidence ?? ('none' as const),
      updateCycle,
      createNewCycle,
      logPeriodStart,
      logPeriodEnd,
      addPastPeriod,
      deactivateTracking,
    };
  }, [
    cycle,
    now,
    periodLogs,
    isLoading,
    updateCycle,
    createNewCycle,
    logPeriodStart,
    logPeriodEnd,
    addPastPeriod,
    deactivateTracking,
  ]);

  return <MenstrualCycleContext.Provider value={value}>{children}</MenstrualCycleContext.Provider>;
}

export function useMenstrualCycleContext(): MenstrualCycleContextType {
  const context = useContext(MenstrualCycleContext);
  if (context === undefined) {
    throw new Error('useMenstrualCycleContext must be used within a MenstrualCycleProvider');
  }

  return context;
}
