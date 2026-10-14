import { format } from 'date-fns';

import type { CycleContextDto, CycleDayLogDto, CycleHistoryEntry, CyclePeriodDto } from './types';

/**
 * A cell for RFC 4180 CSV. Quoted when it holds a comma, quote or newline. A leading = + - @ is
 * defused so a free-text note opened in a spreadsheet cannot run as a formula.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) {
    return '';
  }

  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (cells: (string | number | boolean | null | undefined)[]) =>
  cells.map(csvCell).join(',');

/** ISO calendar date of a stored local-midnight instant: locale-independent on purpose. */
export const csvDate = (ms: number | null | undefined) =>
  ms == null ? '' : format(new Date(ms), 'yyyy-MM-dd');

const EOL = '\r\n';

export function periodsCsv(periods: CyclePeriodDto[], history: CycleHistoryEntry[]): string {
  const byStart = new Map(history.map((h) => [h.start, h]));
  const header = row([
    'start_date',
    'end_date',
    'end_kind',
    'duration_days',
    'cycle_length_days',
    'used_for_predictions',
    'not_used_reason',
    'note',
    'excluded_from_stats',
    'confirmed_long_cycle',
  ]);
  const lines = [...periods]
    .sort((a, b) => a.startDate - b.startDate)
    .map((p) => {
      const h = byStart.get(p.startDate);

      return row([
        csvDate(p.startDate),
        csvDate(p.endDate),
        p.endKind,
        h?.durationDays ?? '',
        h?.lengthDays ?? '',
        h ? h.status === 'used' : '',
        h?.reason ?? '',
        p.note,
        p.excludedFromStats,
        p.confirmedLongCycle ?? false,
      ]);
    });

  return [header, ...lines].join(EOL) + EOL;
}

export function dayLogsCsv(
  dayLogs: CycleDayLogDto[],
  moods: { date: number; value: number }[] = []
): string {
  const header = row([
    'date',
    'bleeding',
    'pain_0_10',
    'energy_1_5',
    'no_symptoms_logged',
    'symptoms',
    'note',
    'mood_0_4',
    'observations_json',
    'symptoms_json',
  ]);
  const byDate = new Map(dayLogs.map((d) => [d.date, d]));
  for (const mood of moods) {
    if (!byDate.has(mood.date)) {
      byDate.set(mood.date, {
        id: '',
        timezone: '',
        date: mood.date,
        bleeding: null,
        symptoms: [],
        noSymptoms: false,
        pain: null,
        energy: null,
        note: '',
      });
    }
  }

  const moodByDate = new Map(moods.map((m) => [m.date, m.value]));
  const lines = [...byDate.values()]
    .sort((a, b) => a.date - b.date)
    .map((d) =>
      row([
        csvDate(d.date),
        d.bleeding ?? '',
        d.pain,
        d.energy,
        d.noSymptoms,
        // "key:severity" pairs; severity 1 mild, 2 moderate, 3 severe, empty when not rated.
        d.symptoms.map((s) => `${s.key}:${s.severity ?? ''}`).join(';'),
        d.note,
        moodByDate.get(d.date),
        d.observations ? JSON.stringify(d.observations) : '',
        JSON.stringify(d.symptoms),
      ])
    );

  return [header, ...lines].join(EOL) + EOL;
}

export function contextsCsv(contexts: CycleContextDto[]): string {
  return (
    [
      row(['effective_from', 'life_stage', 'contraception', 'note']),
      ...[...contexts]
        .sort((a, b) => a.effectiveFrom - b.effectiveFrom)
        .map((c) => row([csvDate(c.effectiveFrom), c.lifeStage, c.contraception, c.note])),
    ].join(EOL) + EOL
  );
}
