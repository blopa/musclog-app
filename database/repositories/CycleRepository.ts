import { Q, type Query } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { decryptCyclePayload } from '@/database/cyclePayload';
import type CycleContext from '@/database/models/CycleContext';
import type CycleDayLog from '@/database/models/CycleDayLog';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import type {
  CycleConfig,
  CycleContextDto,
  CycleDayLogDto,
  CyclePeriodDto,
} from '@/utils/cycle/types';

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  fallbackCycleLength: 28,
  fallbackPeriodDuration: 5,
};

type PeriodPayload = Omit<CyclePeriodDto, 'id' | 'cycleId'>;
type DayLogPayload = Omit<CycleDayLogDto, 'id'>;
type ContextPayload = Omit<CycleContextDto, 'id' | 'cycleId'>;

// Decrypting a year of daily logs on every database emission would dominate the screen, and a
// row's payload only changes together with its updated_at, so (id, updated_at) is a safe key.
const dtoCache = new Map<string, unknown>();

async function decryptCached<T extends object>(
  record: { id: string; updatedAt: number; payload: string },
  build: (payload: T) => unknown
): Promise<unknown | null> {
  const key = `${record.id}:${record.updatedAt}`;
  if (dtoCache.has(key)) {
    return dtoCache.get(key) ?? null;
  }

  const payload = await decryptCyclePayload<T>(record.payload);
  const dto = payload ? build(payload) : null;
  dtoCache.set(key, dto);

  return dto;
}

export function clearCycleDtoCache(): void {
  dtoCache.clear();
}

export async function toPeriodDto(record: CyclePeriod): Promise<CyclePeriodDto | null> {
  return (await decryptCached<PeriodPayload>(record, (p) => ({
    ...p,
    endDate: p.endDate ?? null,
    id: record.id,
    cycleId: record.cycleId,
    note: p.note ?? '',
    excludedFromStats: p.excludedFromStats === true,
  }))) as CyclePeriodDto | null;
}

export async function toDayLogDto(record: CycleDayLog): Promise<CycleDayLogDto | null> {
  return (await decryptCached<DayLogPayload>(record, (p) => ({
    ...p,
    id: record.id,
    bleeding: p.bleeding ?? null,
    symptoms: p.symptoms ?? [],
    noSymptoms: p.noSymptoms === true,
    pain: p.pain ?? null,
    energy: p.energy ?? null,
    note: p.note ?? '',
  }))) as CycleDayLogDto | null;
}

export async function toContextDto(record: CycleContext): Promise<CycleContextDto | null> {
  return (await decryptCached<ContextPayload>(record, (p) => ({
    ...p,
    id: record.id,
    cycleId: record.cycleId,
    note: p.note ?? '',
  }))) as CycleContextDto | null;
}

async function mapDtos<R, T extends object>(
  records: R[],
  map: (record: R) => Promise<T | null>
): Promise<T[]> {
  const dtos = await Promise.all(records.map(map));

  return dtos.filter((dto): dto is NonNullable<typeof dto> => dto != null) as T[];
}

export const readPeriods = (records: CyclePeriod[]) => mapDtos(records, toPeriodDto);
export const readDayLogs = (records: CycleDayLog[]) => mapDtos(records, toDayLogDto);
export const readContexts = (records: CycleContext[]) => mapDtos(records, toContextDto);

export async function readCycleConfig(cycle: MenstrualCycle | null): Promise<CycleConfig> {
  const parsed = await decryptCyclePayload<Partial<CycleConfig>>(cycle?.config);

  return {
    fallbackCycleLength: parsed?.fallbackCycleLength ?? DEFAULT_CYCLE_CONFIG.fallbackCycleLength,
    fallbackPeriodDuration:
      parsed?.fallbackPeriodDuration ?? DEFAULT_CYCLE_CONFIG.fallbackPeriodDuration,
  };
}

const live = Q.where('deleted_at', Q.eq(null));

export class CycleRepository {
  /** Every cycle row, newest first. The active one is the one with `is_active`. */
  static cycles(): Query<MenstrualCycle> {
    return database
      .get<MenstrualCycle>('menstrual_cycles')
      .query(live, Q.sortBy('created_at', Q.desc));
  }

  static periods(cycleId: string): Query<CyclePeriod> {
    return database.get<CyclePeriod>('cycle_periods').query(Q.where('cycle_id', cycleId), live);
  }

  static allPeriods(): Query<CyclePeriod> {
    return database.get<CyclePeriod>('cycle_periods').query(live);
  }

  static dayLogs(): Query<CycleDayLog> {
    return database.get<CycleDayLog>('cycle_day_logs').query(live);
  }

  static contexts(cycleId: string): Query<CycleContext> {
    return database.get<CycleContext>('cycle_contexts').query(Q.where('cycle_id', cycleId), live);
  }
}
