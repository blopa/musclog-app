import { format } from 'date-fns';

import type { CycleDayLogDto, CycleHistoryEntry, CyclePeriodDto } from './types';

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
      ]);
    });

  return [header, ...lines].join(EOL) + EOL;
}

export function dayLogsCsv(dayLogs: CycleDayLogDto[]): string {
  const header = row([
    'date',
    'bleeding',
    'pain_0_10',
    'energy_1_5',
    'no_symptoms_logged',
    'symptoms',
    'note',
  ]);
  const lines = [...dayLogs]
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
      ])
    );

  return [header, ...lines].join(EOL) + EOL;
}
