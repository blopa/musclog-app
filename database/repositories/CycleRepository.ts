import { Q, type Query } from '@nozbe/watermelondb';
import { z } from 'zod';

import { decryptCyclePayload } from '@/database/cyclePayload';
import { database } from '@/database/database-instance';
import type CycleContext from '@/database/models/CycleContext';
import type CycleDayLog from '@/database/models/CycleDayLog';
import type CyclePeriod from '@/database/models/CyclePeriod';
import MenstrualCycle from '@/database/models/MenstrualCycle';
import type {
  ContraceptionMethod,
  CycleConfig,
  CycleContextDto,
  CycleDayLogDto,
  CycleLifeStage,
  CycleObservations,
  CyclePeriodDto,
} from '@/utils/cycle/types';

export const DEFAULT_CYCLE_CONFIG: CycleConfig = {
  fallbackCycleLength: 28,
  fallbackPeriodDuration: 5,
};

/** What each encrypted `payload` column holds. The services write exactly these shapes. */
export type PeriodPayload = Omit<CyclePeriodDto, 'id' | 'cycleId'>;
export type DayLogPayload = Omit<CycleDayLogDto, 'id'>;
export type ContextPayload = Omit<CycleContextDto, 'id' | 'cycleId'>;

/**
 * Decrypted JSON is checked before it becomes a DTO: a damaged or hand-edited row is skipped like
 * an undecryptable one instead of reaching the model with `NaN` dates. Deliberately lenient where
 * a NEWER build may have written something this one does not know (an extra key, a new life
 * stage): structure is enforced, vocabulary is not.
 */
const periodPayloadSchema = z.object({
  startDate: z.number().finite(),
  endDate: z.number().finite().nullable().optional(),
  endKind: z.enum(['open', 'logged', 'estimated', 'unknown']).optional(),
  timezone: z.string().optional(),
  excludedFromStats: z.boolean().optional(),
  confirmedLongCycle: z.boolean().optional(),
  note: z.string().optional(),
});
const dayLogPayloadSchema = z.object({
  date: z.number().finite(),
  timezone: z.string().optional(),
  bleeding: z
    .enum(['none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy'])
    .nullable()
    .optional(),
  symptoms: z
    .array(
      z.object({
        key: z.string(),
        severity: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .nullable()
          .optional(),
      })
    )
    .optional(),
  noSymptoms: z.boolean().optional(),
  pain: z.number().finite().nullable().optional(),
  energy: z.number().finite().nullable().optional(),
  note: z.string().optional(),
  observations: z.record(z.string(), z.unknown()).optional(),
});
const contextPayloadSchema = z.object({
  effectiveFrom: z.number().finite(),
  timezone: z.string().optional(),
  lifeStage: z.string(),
  contraception: z.string(),
  note: z.string().optional(),
});

// Decrypting a year of daily logs on every database emission would dominate the screen, and a
// cache also compares the ciphertext: two edits can share a millisecond timestamp. Each id
// keeps only its latest decrypted version.
const dtoCache = new Map<string, { payload: string; updatedAt: number; dto: unknown }>();

async function decryptCached<S extends z.ZodTypeAny, D>(
  record: { id: string; updatedAt: number; payload: string },
  schema: S,
  build: (payload: z.infer<S>) => D
): Promise<D | null> {
  const cached = dtoCache.get(record.id);
  if (cached && cached.payload === record.payload && cached.updatedAt === record.updatedAt) {
    return (cached.dto as D | null) ?? null;
  }

  const parsed = schema.safeParse(await decryptCyclePayload<object>(record.payload));
  const dto = parsed.success ? build(parsed.data) : null;
  dtoCache.set(record.id, { payload: record.payload, updatedAt: record.updatedAt, dto });

  return dto;
}

export function clearCycleDtoCache(): void {
  dtoCache.clear();
}

export function toPeriodDto(record: CyclePeriod): Promise<CyclePeriodDto | null> {
  return decryptCached(record, periodPayloadSchema, (p): CyclePeriodDto => {
    const endDate = p.endDate ?? null;

    return {
      id: record.id,
      cycleId: record.cycleId,
      startDate: p.startDate,
      endDate,
      endKind: p.endKind ?? (endDate == null ? 'open' : 'logged'),
      timezone: p.timezone ?? '',
      excludedFromStats: p.excludedFromStats === true,
      ...(p.confirmedLongCycle != null ? { confirmedLongCycle: p.confirmedLongCycle } : {}),
      note: p.note ?? '',
    };
  });
}

export function toDayLogDto(record: CycleDayLog): Promise<CycleDayLogDto | null> {
  return decryptCached(record, dayLogPayloadSchema, (p): CycleDayLogDto => ({
    id: record.id,
    date: p.date,
    timezone: p.timezone ?? '',
    bleeding: p.bleeding ?? null,
    symptoms: (p.symptoms ?? []).map((s) => ({ key: s.key, severity: s.severity ?? null })),
    noSymptoms: p.noSymptoms === true,
    pain: p.pain ?? null,
    energy: p.energy ?? null,
    note: p.note ?? '',
    ...(p.observations ? { observations: p.observations as CycleObservations } : {}),
  }));
}

export function toContextDto(record: CycleContext): Promise<CycleContextDto | null> {
  return decryptCached(record, contextPayloadSchema, (p): CycleContextDto => ({
    id: record.id,
    cycleId: record.cycleId,
    effectiveFrom: p.effectiveFrom,
    timezone: p.timezone ?? '',
    lifeStage: p.lifeStage as CycleLifeStage,
    contraception: p.contraception as ContraceptionMethod,
    note: p.note ?? '',
  }));
}

async function mapDtos<R, T extends object>(
  records: R[],
  map: (record: R) => Promise<T | null>
): Promise<T[]> {
  const dtos: (T | null)[] = await Promise.all(records.map(map));

  return dtos.filter((dto): dto is T => dto != null);
}

export const readPeriods = (records: CyclePeriod[]) => mapDtos(records, toPeriodDto);
export const readDayLogs = (records: CycleDayLog[]) => mapDtos(records, toDayLogDto);
export const readContexts = (records: CycleContext[]) => mapDtos(records, toContextDto);

export async function readCycleConfig(cycle: MenstrualCycle | null): Promise<CycleConfig> {
  const parsed = await decryptCyclePayload<Partial<CycleConfig>>(cycle?.config);

  return {
    ...parsed,
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
