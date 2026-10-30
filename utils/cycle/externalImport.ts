import { parseCycleCsv, validateCycleTransfer } from './cycleTransfer';

export interface ImportColumns {
  date: string;
  end: string;
  flow: string;
  temperature: string;
  symptoms: string;
  note: string;
  dateOrder: 'iso' | 'dmy' | 'mdy';
  periods: boolean;
}
const ALIASES = {
  date: ['date', 'start_date', 'start date', 'period_start', 'period start'],
  end: ['end_date', 'end date', 'period_end'],
  flow: ['bleeding', 'flow', 'menstrual flow'],
  temperature: ['temperature', 'temperature_c', 'basal_body_temperature', 'bbt'],
  symptoms: ['symptoms', 'symptom'],
  note: ['note', 'notes'],
};
export function detectImportColumns(text: string): {
  columns: string[];
  mapping: ImportColumns;
  rows: number;
} {
  const rows = parseCycleCsv(text);
  if (!rows.length || rows.length > 30000) {
    throw new Error('invalid_external_csv');
  }

  const columns = Object.keys(rows[0]);
  const pick = (key: keyof typeof ALIASES) =>
    columns.find((c) => ALIASES[key].includes(c.trim().toLowerCase())) ?? '';
  return {
    columns,
    rows: rows.length,
    mapping: {
      date: pick('date'),
      end: pick('end'),
      flow: pick('flow'),
      temperature: pick('temperature'),
      symptoms: pick('symptoms'),
      note: pick('note'),
      dateOrder: 'iso',
      periods: columns.some((c) => /period.?start|start.?date/i.test(c)),
    },
  };
}

function importDate(value: string, order: ImportColumns['dateOrder']): string {
  if (order === 'iso') {
    return value.trim();
  }

  const parts = value.trim().split(/[/.\-]/);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) {
    throw new Error('invalid_external_date');
  }

  const [a, b, year] = parts;
  return `${year}-${(order === 'dmy' ? b : a).padStart(2, '0')}-${(order === 'dmy' ? a : b).padStart(2, '0')}`;
}

/** User-reviewed column mapping. Ambiguous flow labels and dates fail instead of being guessed. */
export function convertExternalCsv(text: string, mapping: ImportColumns, now = Date.now()): string {
  const rows = parseCycleCsv(text);
  if (!rows.length || rows.length > 30000 || !mapping.date || !(mapping.date in rows[0])) {
    throw new Error('invalid_external_mapping');
  }

  const periods: object[] = [];
  const days = new Map<
    string,
    {
      date: string;
      bleeding: string | null;
      symptoms: { key: string; severity: null }[];
      noSymptoms: boolean;
      pain: null;
      energy: null;
      note: string;
      observations: { temperatureC?: number };
    }
  >();
  for (const row of rows) {
    const date = importDate(row[mapping.date], mapping.dateOrder);
    if (mapping.periods) {
      const end = row[mapping.end] ? importDate(row[mapping.end], mapping.dateOrder) : null;
      periods.push({
        startDate: date,
        endDate: end,
        endKind: end ? 'logged' : 'unknown',
        excludedFromStats: false,
        note: row[mapping.note] ?? '',
      });
    }

    const day = days.get(date) ?? {
      date,
      bleeding: null,
      symptoms: [],
      noSymptoms: false,
      pain: null,
      energy: null,
      note: '',
      observations: {},
    };
    const flow = row[mapping.flow]?.trim().toLowerCase().replace(/[ -]/g, '_');
    if (flow) {
      if (!['none', 'spotting', 'light', 'medium', 'heavy', 'very_heavy'].includes(flow)) {
        throw new Error('unknown_external_flow');
      }

      day.bleeding = flow;
    }

    if (row[mapping.temperature]?.trim()) {
      day.observations.temperatureC = Number(row[mapping.temperature].replace(',', '.'));
    }

    for (const symptom of (row[mapping.symptoms] ?? '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      const key = `custom:${symptom}`;
      if (!day.symptoms.some((s) => s.key === key)) {
        day.symptoms.push({ key, severity: null });
      }
    }

    if (row[mapping.note]) {
      day.note = [day.note, row[mapping.note]].filter(Boolean).join('\n');
    }

    days.set(date, day);
  }

  const raw = {
    format: 'musclog-cycle',
    version: 1,
    periods,
    dayLogs: [...days.values()],
    contexts: [],
    moods: [],
  };
  validateCycleTransfer(raw, now);
  return JSON.stringify(raw);
}
