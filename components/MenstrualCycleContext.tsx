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
import { AppState } from 'react-native';

import { isStaticExport } from '@/constants/platform';
import { useSettingsContext } from '@/context/SettingsContext';
import { waitForDbReady } from '@/database/dbReady';
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
import { useCycleMoods } from '@/hooks/useCycleMoods';
import { useLocalToday } from '@/hooks/useLocalToday';
import { CycleNotificationService } from '@/services/CycleNotificationService';
import type { ContextGuidance } from '@/utils/cycle/contraception';
import type { MoodPoint } from '@/utils/cycle/cycleInsights';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';
import type { PredictionStats } from '@/utils/cycle/cycleStats';
import type { CycleTimeline } from '@/utils/cycle/cycleTimeline';
import type { CycleTrackingMode } from '@/utils/cycle/trackingMode';
import type {
  CycleConfig,
  CycleConfigUpdate,
  CycleContextDto,
  CycleDayLogDto,
  CycleHistoryEntry,
  CyclePeriodDto,
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
  /**
   * Shared mood (the `user_metrics` mood the Home prompt writes), observed once here for every
   * cycle surface. Each of them used to open its own subscription and decrypt every mood again.
   */
  moods: MoodPoint[];
  moodsLoading: boolean;
  moodsError: boolean;
  activeContext: CycleContextDto | null;
  guidance: ContextGuidance;
  history: CycleHistoryEntry[];
  predictionStats: PredictionStats;
  /**
   * The single phase/prediction model; the wheel, cards and reminders all read it. Its
   * `elapsedDay`, `currentPhase` and `prediction` are the cycle day, phase and next-period
   * estimate: read them here rather than through a copy.
   */
  timeline: CycleTimeline | null;
  /** The period the user said is still going (the same predicate the timeline's phase uses). */
  activePeriod: CyclePeriodDto | null;
  /** Local midnight ms of today; changes only when the calendar day does. */
  today: number;
  createCycle: (input: NewCycleInput) => Promise<void>;
  updateConfig: (update: CycleConfigUpdate) => Promise<void>;
  startPeriod: (startDate: number) => Promise<void>;
  endPeriod: (endDate: number) => Promise<void>;
  addPastPeriod: (period: NewPeriod) => Promise<void>;
  updatePeriod: (id: string, patch: PeriodPatch) => Promise<void>;
  removePeriod: (id: string) => Promise<void>;
  restorePeriod: (id: string) => Promise<void>;
  patchDayLog: (
    date: number,
    update: (existing: CycleDayLogDto | undefined) => DayLogInput
  ) => Promise<DayLogInput>;
  saveDayLog: (input: DayLogInput, mood?: number | null) => Promise<void>;
  setContext: (input: ContextInput) => Promise<void>;
  removeContext: (id: string) => Promise<void>;
  deactivateTracking: () => Promise<void>;
  resumeTracking: () => Promise<void>;
  setTrackingMode: (mode: CycleTrackingMode) => Promise<void>;
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
  // Models mutate in place; capture the cipher at emission time so config-only
  // writes have an immutable state identity and trigger decryption immediately.
  const [tracked, setTracked] = useState<{
    cycle: MenstrualCycle | null;
    pausedCycle: MenstrualCycle | null;
    configCipher: string | null;
  }>({ cycle: null, pausedCycle: null, configCipher: null });
  const { cycle, pausedCycle, configCipher: trackedConfigCipher } = tracked;
  const [config, setConfig] = useState<CycleConfig>(DEFAULT_CYCLE_CONFIG);
  // isStaticExport is a build-time constant — no async loading on static export
  const [isLoading, setIsLoading] = useState(!isStaticExport);
  const today = useLocalToday();

  // Observe every cycle row; the active one drives the app, a paused one is kept for resuming.
  // A new install mounts this provider while first-run seeding still resets the database, and a
  // query observed in that window errors once and never emits again, so the cycle that setup
  // creates would stay invisible until the app restarted. Subscribe only once the database is ready.
  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    let cancelled = false;
    let subscription: { unsubscribe: () => void } | undefined;
    const showNoCycle = () => {
      setTracked({ cycle: null, pausedCycle: null, configCipher: null });
      setIsLoading(false);
    };

    const subscribeWhenDbReady = async () => {
      try {
        await waitForDbReady();
      } catch {
        if (!cancelled) {
          showNoCycle();
        }

        return;
      }

      if (cancelled) {
        return;
      }

      subscription = CycleRepository.cycles()
        .observeWithColumns(['is_active', 'config', 'updated_at', 'deleted_at'])
        .subscribe({
          next: (cycles) => {
            const active = cycles.find((c) => c.isActive) ?? null;
            const paused = active ? null : (cycles[0] ?? null);
            setTracked({
              cycle: active,
              pausedCycle: paused,
              configCipher: (active ?? paused)?.config ?? null,
            });
            setIsLoading(false);
          },
          error: showNoCycle,
        });
    };

    void subscribeWhenDbReady();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const trackedCycle = cycle ?? pausedCycle;
  useEffect(() => {
    let cancelled = false;
    void readCycleConfig(trackedCycle)
      .catch(() => DEFAULT_CYCLE_CONFIG)
      .then((next) => {
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
  // Day logs carry no cycle id (they survive a pause/resume), but with no cycle at all there is
  // nothing to show them on, so nothing is observed or decrypted.
  const dayLogs = useDecryptedQuery(
    trackedCycleId ? CycleRepository.dayLogs() : null,
    readDayLogs,
    [trackedCycleId != null]
  );
  const {
    moods,
    isLoading: moodsLoading,
    error: moodsError,
  } = useCycleMoods(trackedCycleId != null);

  const afterWrite = useCallback(() => {
    void CycleNotificationService.scheduleMenstrualCycleNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        afterWrite();
      }
    });
    afterWrite();
    return () => subscription.remove();
  }, [afterWrite]);

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
      updateConfig: async (next: CycleConfigUpdate) => {
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
      patchDayLog: (date: number, update: (existing: CycleDayLogDto | undefined) => DayLogInput) =>
        CycleDayLogService.patch(date, update),
      saveDayLog: async (input: DayLogInput, mood?: number | null) => {
        await CycleDayLogService.save(input, mood);
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
      setTrackingMode: async (mode: CycleTrackingMode) => {
        if (trackedCycle) {
          await CycleTrackingService.setTrackingMode(trackedCycle, mode);
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

  const snapshot = useMemo(
    () =>
      buildCycleSnapshot({
        periods,
        contexts,
        config,
        nowMs: today,
        showPredictions: cycleShowPredictions,
        showFertility: cycleShowFertility,
      }),
    [contexts, periods, config, today, cycleShowPredictions, cycleShowFertility]
  );

  const value = useMemo<MenstrualCycleContextType>(
    () => ({
      cycle,
      pausedCycle,
      isLoading,
      isActive: cycle != null,
      config,
      periods,
      dayLogs,
      contexts,
      moods,
      moodsLoading,
      moodsError,
      activeContext: snapshot.activeContext,
      guidance: snapshot.guidance,
      history: snapshot.history,
      predictionStats: snapshot.stats,
      timeline: cycle ? snapshot.timeline : null,
      activePeriod: snapshot.activePeriod,
      today,
      ...actions,
    }),
    [
      cycle,
      pausedCycle,
      isLoading,
      config,
      periods,
      dayLogs,
      contexts,
      moods,
      moodsLoading,
      moodsError,
      snapshot,
      today,
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
