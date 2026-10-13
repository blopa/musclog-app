import type { Model, Query } from '@nozbe/watermelondb';
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
import { useSettingsContext } from '@/context/SettingsContext';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import {
  CycleRepository,
  DEFAULT_CYCLE_CONFIG,
  readContexts,
  readCycleConfig,
  readDayLogs,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { type ContextInput, CycleContextService } from '@/database/services/CycleContextService';
import { CycleDayLogService, type DayLogInput } from '@/database/services/CycleDayLogService';
import {
  CyclePeriodService,
  type NewPeriod,
  type PeriodPatch,
} from '@/database/services/CyclePeriodService';
import { CycleTrackingService, type NewCycleInput } from '@/database/services/CycleTrackingService';
import { NotificationService } from '@/services/NotificationService';
import type { ContextGuidance } from '@/utils/cycle/contraception';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';
import type { PredictionStats } from '@/utils/cycle/cycleStats';
import type { CyclePhase, CycleTimeline, PredictionState } from '@/utils/cycle/cycleTimeline';
import type {
  CycleConfig,
  CycleContextDto,
  CycleDayLogDto,
  CycleHistoryEntry,
  CyclePeriodDto,
  PredictionConfidence,
} from '@/utils/cycle/types';

export interface MenstrualCycleContextType {
  /** The active cycle, or null when tracking was never set up or is paused. */
  cycle: MenstrualCycle | null;
  /** A cycle whose tracking was switched off. Its history is kept so tracking can resume. */
  pausedCycle: MenstrualCycle | null;
  isLoading: boolean;
  isActive: boolean;
  config: CycleConfig;
  periods: CyclePeriodDto[];
  dayLogs: CycleDayLogDto[];
  contexts: CycleContextDto[];
  activeContext: CycleContextDto | null;
  guidance: ContextGuidance;
  history: CycleHistoryEntry[];
  predictionStats: PredictionStats;
  /** The single phase/prediction model; the wheel, cards and reminders all read it. */
  timeline: CycleTimeline | null;
  predictionState: PredictionState;
  predictionConfidence: PredictionConfidence;
  activePeriod: CyclePeriodDto | null;
  isCurrentlyInPeriod: boolean;
  isCurrentlyInFertileWindow: boolean;
  isIrregular: boolean;
  nextPeriodDate: Date | null;
  nextPeriodEarliest: Date | null;
  nextPeriodLatest: Date | null;
  fertileWindow: { start: Date; end: Date } | null;
  currentPhase: CyclePhase | null;
  /** Days since the last logged period start. Never wraps. */
  cycleDay: number | null;
  /** Current timestamp refreshed every minute; use for time-sensitive display values. */
  nowMs: number;
  createCycle: (input: NewCycleInput) => Promise<void>;
  updateConfig: (config: CycleConfig) => Promise<void>;
  startPeriod: (startDate: number) => Promise<void>;
  endPeriod: (endDate: number) => Promise<void>;
  addPastPeriod: (period: NewPeriod) => Promise<void>;
  updatePeriod: (id: string, patch: PeriodPatch) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  restorePeriod: (id: string) => Promise<void>;
  saveDayLog: (input: DayLogInput) => Promise<void>;
  setContext: (input: ContextInput) => Promise<void>;
  removeContext: (id: string) => Promise<void>;
  deactivateTracking: () => Promise<void>;
  resumeTracking: () => Promise<void>;
  deleteAllData: () => Promise<void>;
}

const MenstrualCycleContext = createContext<MenstrualCycleContextType | undefined>(undefined);

const PAYLOAD_COLUMNS = ['payload', 'updated_at', 'deleted_at'];
const EMPTY: never[] = [];

/**
 * Observes a query and decrypts every emission. A token drops a result that finished after a
 * newer one started, since decryption is async and emissions can overlap.
 */
function useDecryptedQuery<R extends Model, T>(
  query: Query<R> | null,
  read: (records: R[]) => Promise<T[]>,
  deps: unknown[]
): T[] {
  const [value, setValue] = useState<T[]>([]);

  useEffect(() => {
    if (isStaticExport || !query) {
      return;
    }

    let latest = 0;
    const subscription = query.observeWithColumns(PAYLOAD_COLUMNS).subscribe({
      next: (records) => {
        const token = ++latest;
        void read(records)
          .then((dtos) => {
            if (token === latest) {
              setValue(dtos);
            }
          })
          .catch(() => {
            if (token === latest) {
              setValue([]);
            }
          });
      },
      error: () => setValue([]),
    });

    return () => {
      latest += 1;
      subscription.unsubscribe();
    };
    // `query` is rebuilt per render; `deps` carries the identity the caller actually means.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // With nothing to observe the answer is empty, whatever the previous query last emitted.
  return isStaticExport || !query ? EMPTY : value;
}

export function MenstrualCycleProvider({ children }: { children: ReactNode }) {
  const { cycleShowPredictions, cycleShowFertility } = useSettingsContext();
  const [cycle, setCycle] = useState<MenstrualCycle | null>(null);
  const [pausedCycle, setPausedCycle] = useState<MenstrualCycle | null>(null);
  const [config, setConfig] = useState<CycleConfig>(DEFAULT_CYCLE_CONFIG);
  // isStaticExport is a build-time constant — no async loading on static export
  const [isLoading, setIsLoading] = useState(!isStaticExport);
  // Refreshed every minute to trigger re-derivation of time-sensitive values without a
  // WatermelonDB subscription event.
  const [nowMs, setNowMs] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Observe every cycle row; the active one drives the app, a paused one is kept for resuming.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const subscription = CycleRepository.cycles()
      .observeWithColumns(['is_active', 'config', 'updated_at', 'deleted_at'])
      .subscribe({
        next: (cycles) => {
          const active = cycles.find((c) => c.isActive) ?? null;
          setCycle(active);
          setPausedCycle(active ? null : (cycles[0] ?? null));
          setIsLoading(false);
        },
        error: () => {
          setCycle(null);
          setPausedCycle(null);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  const trackedCycle = cycle ?? pausedCycle;
  const trackedConfigCipher = trackedCycle?.config ?? null;
  useEffect(() => {
    let cancelled = false;
    void readCycleConfig(trackedCycle).then((next) => {
      if (!cancelled) {
        setConfig(next);
      }
    });

    return () => {
      cancelled = true;
    };
    // The cipher changes whenever the config does; the model identity alone would not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedCycle?.id, trackedConfigCipher]);

  const trackedCycleId = trackedCycle?.id ?? null;
  const periods = useDecryptedQuery(
    trackedCycleId ? CycleRepository.periods(trackedCycleId) : null,
    readPeriods,
    [trackedCycleId]
  );
  const contexts = useDecryptedQuery(
    trackedCycleId ? CycleRepository.contexts(trackedCycleId) : null,
    readContexts,
    [trackedCycleId]
  );
  const dayLogs = useDecryptedQuery(CycleRepository.dayLogs(), readDayLogs, []);

  const afterWrite = useCallback(() => {
    void NotificationService.scheduleMenstrualCycleNotifications();
  }, []);

  const requireCycle = useCallback((): string => {
    if (!cycle) {
      throw new Error('cycle_tracking_not_active');
    }

    return cycle.id;
  }, [cycle]);

  const actions = useMemo(
    () => ({
      createCycle: async (input: NewCycleInput) => {
        await CycleTrackingService.create(input);
        afterWrite();
      },
      updateConfig: async (next: CycleConfig) => {
        if (trackedCycle) {
          await CycleTrackingService.updateConfig(trackedCycle, next);
          afterWrite();
        }
      },
      startPeriod: async (startDate: number) => {
        await CyclePeriodService.start(requireCycle(), startDate);
        afterWrite();
      },
      endPeriod: async (endDate: number) => {
        await CyclePeriodService.end(requireCycle(), endDate);
        afterWrite();
      },
      addPastPeriod: async (period: NewPeriod) => {
        await CyclePeriodService.create(requireCycle(), period);
        afterWrite();
      },
      updatePeriod: async (id: string, patch: PeriodPatch) => {
        await CyclePeriodService.update(id, patch);
        afterWrite();
      },
      removePeriod: async (id: string) => {
        await CyclePeriodService.remove(id);
        afterWrite();
      },
      restorePeriod: async (id: string) => {
        await CyclePeriodService.restore(id);
        afterWrite();
      },
      saveDayLog: async (input: DayLogInput) => {
        await CycleDayLogService.save(input);
      },
      setContext: async (input: ContextInput) => {
        await CycleContextService.set(requireCycle(), input);
        afterWrite();
      },
      removeContext: async (id: string) => {
        await CycleContextService.remove(id);
        afterWrite();
      },
      deactivateTracking: async () => {
        if (cycle) {
          await CycleTrackingService.setActive(cycle, false);
          afterWrite();
        }
      },
      resumeTracking: async () => {
        if (pausedCycle) {
          await CycleTrackingService.setActive(pausedCycle, true);
          afterWrite();
        }
      },
      deleteAllData: async () => {
        await CycleTrackingService.deleteAll();
        afterWrite();
      },
    }),
    [afterWrite, cycle, pausedCycle, trackedCycle, requireCycle]
  );

  const derived = useMemo(() => {
    const snapshot = buildCycleSnapshot({
      periods,
      contexts,
      config,
      nowMs,
      showPredictions: cycleShowPredictions,
      showFertility: cycleShowFertility,
    });
    const timeline = cycle ? snapshot.timeline : null;
    const prediction = timeline?.prediction;
    const fertile = timeline?.fertileEstimate ?? null;

    return {
      ...snapshot,
      timeline,
      fertileWindow: fertile
        ? { start: new Date(fertile.start), end: new Date(fertile.end) }
        : null,
      nextPeriodDate: prediction?.mostLikely != null ? new Date(prediction.mostLikely) : null,
      nextPeriodEarliest: prediction?.earliest != null ? new Date(prediction.earliest) : null,
      nextPeriodLatest: prediction?.latest != null ? new Date(prediction.latest) : null,
    };
  }, [contexts, periods, config, cycle, nowMs, cycleShowPredictions, cycleShowFertility]);

  const value = useMemo<MenstrualCycleContextType>(
    () => ({
      cycle,
      pausedCycle,
      isLoading,
      isActive: cycle?.isActive ?? false,
      config,
      periods: trackedCycle ? periods : [],
      dayLogs,
      contexts,
      activeContext: derived.activeContext,
      guidance: derived.guidance,
      history: derived.history,
      predictionStats: derived.stats,
      timeline: derived.timeline,
      predictionState: derived.timeline?.prediction.state ?? 'insufficient',
      predictionConfidence: derived.stats.confidence,
      activePeriod: derived.activePeriod,
      isCurrentlyInPeriod: derived.activePeriod != null,
      isCurrentlyInFertileWindow:
        derived.fertileWindow != null &&
        nowMs >= derived.fertileWindow.start.getTime() &&
        nowMs <= derived.fertileWindow.end.getTime(),
      isIrregular: derived.stats.variability !== 'regular',
      nextPeriodDate: derived.nextPeriodDate,
      nextPeriodEarliest: derived.nextPeriodEarliest,
      nextPeriodLatest: derived.nextPeriodLatest,
      fertileWindow: derived.fertileWindow,
      currentPhase: derived.timeline?.currentPhase ?? null,
      cycleDay: derived.timeline?.elapsedDay ?? null,
      nowMs,
      ...actions,
    }),
    [
      cycle,
      pausedCycle,
      trackedCycle,
      isLoading,
      config,
      periods,
      dayLogs,
      contexts,
      derived,
      nowMs,
      actions,
    ]
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
