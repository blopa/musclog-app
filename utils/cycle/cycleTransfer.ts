import { z } from 'zod';

import { csvDate } from './cycleCsv';
import type { MoodPoint } from './cycleInsights';
import { BLEEDING_LEVELS } from './dayLog';
import { assertValidPeriod } from './periodRules';
import { cycleConfigSchema, observationsSchema } from './preferences';
import type { CycleConfig, CycleContextDto, CycleDayLogDto, CyclePeriodDto } from './types';
import { CONTRACEPTION_METHOD_KEYS, CYCLE_LIFE_STAGES } from './types';

/** Wire dates are local calendar dates, never instants tied to the exporting device's timezone. */
export function parseCycleDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('invalid_cycle_date');
  }

  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (y < 1900 || csvDate(date.getTime()) !== value) {
    throw new Error('invalid_cycle_date');
  }

  return date.getTime();
}

const date = z.string().transform(parseCycleDate);
const note = z.string().max(500);
export const periodTransferSchema = z
  .object({
    startDate: date,
    endDate: date.nullable(),
    endKind: z.enum(['open', 'logged', 'estimated', 'unknown']),
    excludedFromStats: z.boolean(),
    confirmedLongCycle: z.boolean().optional(),
    note,
  })
  .strict()
  .superRefine((p, ctx) => {
    const hasEnd = p.endDate != null;
    if (
      (p.endKind === 'logged' || p.endKind === 'estimated') !== hasEnd ||
      (hasEnd && p.endDate! < p.startDate)
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalid_period_end' });
    }
  });
const dayTransferSchema = z
  .object({
    date,
    bleeding: z
      .enum(BLEEDING_LEVELS as [(typeof BLEEDING_LEVELS)[number], ...typeof BLEEDING_LEVELS])
      .nullable(),
    symptoms: z
      .array(
        z
          .object({
            key: z.string().min(1).max(100),
            severity: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
          })
          .strict()
      )
      .max(100),
    noSymptoms: z.boolean(),
    pain: z.number().min(0).max(10).nullable(),
    energy: z.number().int().min(1).max(5).nullable(),
    note,
    observations: observationsSchema.optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      (d.noSymptoms && d.symptoms.length) ||
      new Set(d.symptoms.map((s) => s.key)).size !== d.symptoms.length
    ) {
      ctx.addIssue({ code: 'custom', message: 'contradictory_symptoms' });
    }
  });
const contextTransferSchema = z
  .object({
    effectiveFrom: date,
    lifeStage: z.enum(CYCLE_LIFE_STAGES),
    contraception: z.enum(CONTRACEPTION_METHOD_KEYS),
    note,
  })
  .strict();
const transferSchema = z
  .object({
    format: z.literal('musclog-cycle'),
    version: z.literal(1),
    config: cycleConfigSchema.optional(),
    periods: z.array(periodTransferSchema).max(2000),
    dayLogs: z.array(dayTransferSchema).max(30000),
    contexts: z.array(contextTransferSchema).max(2000),
    moods: z.array(z.object({ date, value: z.number().int().min(0).max(4) }).strict()).max(30000),
  })
  .strict();
export type CycleTransfer = z.infer<typeof transferSchema>;

export function serializeCycleTransfer(input: {
  config: CycleConfig;
  periods: CyclePeriodDto[];
  dayLogs: CycleDayLogDto[];
  contexts: CycleContextDto[];
  moods: MoodPoint[];
}): string {
  return JSON.stringify(
    {
      format: 'musclog-cycle',
      version: 1,
      config: input.config,
      periods: input.periods.map(
        ({ startDate, endDate, endKind, excludedFromStats, confirmedLongCycle, note }) => ({
          startDate: csvDate(startDate),
          endDate: endDate == null ? null : csvDate(endDate),
          endKind,
          excludedFromStats,
          confirmedLongCycle,
          note,
        })
      ),
      dayLogs: input.dayLogs.map(
        ({ date, bleeding, symptoms, noSymptoms, pain, energy, note, observations }) => ({
          date: csvDate(date),
          bleeding,
          symptoms,
          noSymptoms,
          pain,
          energy,
          note,
          observations,
        })
      ),
      contexts: input.contexts.map(({ effectiveFrom, lifeStage, contraception, note }) => ({
        effectiveFrom: csvDate(effectiveFrom),
        lifeStage,
        contraception,
        note,
      })),
      moods: input.moods.map(({ date, value }) => ({ date: csvDate(date), value })),
    },
    null,
    2
  );
}

export function validateCycleTransfer(raw: unknown, now = Date.now()): CycleTransfer {
  const result = transferSchema.parse(raw);
  for (const [key, dates] of [
    ['startDate', result.periods.map((p) => p.startDate)],
    ['date', result.dayLogs.map((d) => d.date)],
    ['effectiveFrom', result.contexts.map((c) => c.effectiveFrom)],
    ['date', result.moods.map((m) => m.date)],
  ] as const) {
    if (new Set(dates).size !== dates.length) {
      throw new Error('duplicate_cycle_dates');
    }

    if ((key === 'startDate' || key === 'effectiveFrom') && dates.some((d) => d > now)) {
      throw new Error('future_cycle_date');
    }
  }

  const sorted = [...result.periods].sort((a, b) => a.startDate - b.startDate);
  sorted.forEach((p, i) => {
    assertValidPeriod(
      sorted.slice(0, i).map((r, n) => ({ ...r, id: String(n) })),
      p,
      { now }
    );
    if (p.endDate != null && p.endDate > now) {
      throw new Error('future_cycle_date');
    }
  });
  const fields = result.config?.customFields ?? [];
  if (new Set(fields.map((f) => f.id)).size !== fields.length) {
    throw new Error('duplicate_custom_fields');
  }

  return result;
}

/** RFC 4180 parser: quoted commas, newlines and escaped quotes; fail on malformed input. */
export function parseCycleCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
        closed = true;
      } else {
        cell += ch;
      }
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (ch !== ',') {
        if (ch === '\r' && text[i + 1] === '\n') {
          i++;
        }

        rows.push(row);
        row = [];
      }
    } else if (ch === '"' && !cell && !closed) {
      quoted = true;
    } else {
      if (closed || ch === '"') {
        throw new Error('invalid_csv');
      }

      cell += ch;
    }
  }

  if (quoted) {
    throw new Error('invalid_csv');
  }

  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, '')) ?? [];
  if (!headers.length || new Set(headers).size !== headers.length) {
    throw new Error('invalid_csv');
  }

  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => {
      if (r.length !== headers.length) {
        throw new Error('invalid_csv');
      }

      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    });
}

const undoCsvEscape = (value: string) => value.replace(/^'(?=[=+\-@\t\r])/, '');
const numberOrNull = (value: string | undefined) => (value ? Number(value) : null);
const boolean = (value: string) => {
  if (value !== 'true' && value !== 'false') {
    throw new Error('invalid_boolean');
  }

  return value === 'true';
};

export function parseCycleTransfer(text: string): CycleTransfer {
  if (text.length > 5_000_000) {
    throw new Error('cycle_file_too_large');
  }

  if (text.trimStart().startsWith('{')) {
    return validateCycleTransfer(JSON.parse(text));
  }

  const rows = parseCycleCsv(text);
  const first = rows[0];
  if (!first) {
    throw new Error('empty_cycle_file');
  }

  const data: Record<string, unknown> = {
    format: 'musclog-cycle',
    version: 1,
    periods: [],
    dayLogs: [],
    contexts: [],
    moods: [],
  };
  if ('start_date' in first) {
    data.periods = rows.map((r) => ({
      startDate: r.start_date,
      endDate: r.end_date || null,
      endKind: r.end_kind || (r.end_date ? 'logged' : 'unknown'),
      excludedFromStats: r.excluded_from_stats
        ? boolean(r.excluded_from_stats)
        : r.not_used_reason === 'user_excluded',
      confirmedLongCycle: r.confirmed_long_cycle ? boolean(r.confirmed_long_cycle) : undefined,
      note: undoCsvEscape(r.note ?? ''),
    }));
  } else if ('effective_from' in first) {
    data.contexts = rows.map((r) => ({
      effectiveFrom: r.effective_from,
      lifeStage: r.life_stage,
      contraception: r.contraception,
      note: undoCsvEscape(r.note ?? ''),
    }));
  } else if ('date' in first && 'bleeding' in first) {
    data.dayLogs = rows.map((r) => ({
      date: r.date,
      bleeding: r.bleeding || null,
      pain: numberOrNull(r.pain_0_10),
      energy: numberOrNull(r.energy_1_5),
      noSymptoms: boolean(r.no_symptoms_logged),
      symptoms: r.symptoms_json
        ? JSON.parse(undoCsvEscape(r.symptoms_json))
        : undoCsvEscape(r.symptoms || '')
            .split(';')
            .filter(Boolean)
            .map((s) => {
              const index = s.lastIndexOf(':');
              return { key: s.slice(0, index), severity: numberOrNull(s.slice(index + 1)) };
            }),
      note: undoCsvEscape(r.note ?? ''),
      observations: r.observations_json
        ? JSON.parse(undoCsvEscape(r.observations_json))
        : undefined,
    }));
    data.moods = rows
      .filter((r) => r.mood_0_4)
      .map((r) => ({ date: r.date, value: Number(r.mood_0_4) }));
  } else {
    throw new Error('unsupported_cycle_csv');
  }

  return validateCycleTransfer(data);
}

export type ConflictChoice = 'keep' | 'replace';
export interface MergeRows<T> {
  add: T[];
  update: { id: string; value: T }[];
  skipped: number;
}
export function mergeByDate<T>(
  incoming: T[],
  existing: (T & { id: string })[],
  key: keyof T,
  choice: ConflictChoice
): MergeRows<T> {
  const add: T[] = [];
  const update: { id: string; value: T }[] = [];
  let skipped = 0;
  for (const value of incoming) {
    const match = existing.find((r) => r[key] === value[key]);
    if (!match) {
      add.push(value);
    } else if (choice === 'replace') {
      update.push({ id: match.id, value });
    } else {
      skipped++;
    }
  }

  return { add, update, skipped };
}
