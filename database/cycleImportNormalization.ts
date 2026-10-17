import { randomUUID } from 'expo-crypto';

import { convertLegacyCycleData, type LegacyMetric } from '@/utils/cycle/legacyConversion';
import { getCurrentTimezone } from '@/utils/timezone';

type ImportRow = Record<string, unknown>;

/** Exports before this version stored cycle data as plaintext period_logs + flow/symptom metrics. */
export const ENCRYPTED_CYCLE_EXPORT_VERSION = 36;

const LEGACY_METRIC_TYPES = new Set(['period_flow', 'period_symptoms']);

const isRow = (value: unknown): value is ImportRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rowsOf = (parsed: ImportRow, table: string): ImportRow[] => {
  const rows = parsed[table];

  return Array.isArray(rows) ? rows.filter(isRow) : [];
};

const isLive = (row: ImportRow) => row.deleted_at == null && row._status !== 'deleted';

/**
 * Translates a pre-v36 backup into the current cycle tables before validation, so restoring an
 * old export lands in encrypted records instead of resurrecting the plaintext ones. Uses the same
 * conversion as the on-device boot migration. Rows are emitted as `_decrypted` plaintext payloads;
 * the importer encrypts them with this device's key like every other sensitive table.
 */
export function normalizeCycleDataForImport(
  parsed: unknown,
  makeId: () => string = randomUUID
): void {
  if (
    !isRow(parsed) ||
    typeof parsed._exportVersion !== 'number' ||
    parsed._exportVersion >= ENCRYPTED_CYCLE_EXPORT_VERSION
  ) {
    return;
  }

  const now = Date.now();
  const timezone = getCurrentTimezone();
  const cycles = rowsOf(parsed, 'menstrual_cycles');
  const liveCycles = cycles.filter(isLive);

  const allMetrics = rowsOf(parsed, 'user_metrics').filter((m) =>
    LEGACY_METRIC_TYPES.has(String(m.type))
  );
  const metricIds = new Set(allMetrics.map((m) => String(m.id)));
  const notesByMetric = new Map<string, string>();
  for (const note of rowsOf(parsed, 'user_metrics_notes')) {
    if (isLive(note) && metricIds.has(String(note.user_metric_id))) {
      notesByMetric.set(String(note.user_metric_id), String(note.note ?? ''));
    }
  }

  const legacyMetrics: LegacyMetric[] = allMetrics.filter(isLive).map((m) => ({
    type: m.type as LegacyMetric['type'],
    date: Number(m.date),
    value: Number(m.value),
    note: notesByMetric.get(String(m.id)) ?? null,
    timezone: typeof m.timezone === 'string' && m.timezone ? m.timezone : null,
  }));

  const periodRows = rowsOf(parsed, 'period_logs').filter(isLive);
  const converted = convertLegacyCycleData({
    cycles: liveCycles.map((c) => ({
      id: String(c.id),
      avgCycleLength: Number(c.avg_cycle_length) || 28,
      avgPeriodDuration: Number(c.avg_period_duration) || 5,
      birthControlType: c.birth_control_type == null ? null : String(c.birth_control_type),
      lifeStage: c.life_stage == null ? null : String(c.life_stage),
      createdAt: Number(c.created_at) || now,
    })),
    periods: [
      ...periodRows.map((p) => ({
        cycleId: String(p.menstrual_cycle_id),
        startDate: Number(p.start_date),
        endDate: p.end_date == null ? null : Number(p.end_date),
        notes: p.notes == null ? null : String(p.notes),
        timezone: typeof p.timezone === 'string' && p.timezone ? p.timezone : null,
      })),
      // Installs that predate period_logs only carried the cached anchor on the cycle row.
      ...liveCycles
        .filter(
          (c) =>
            Number(c.last_period_start_date) > 0 &&
            !periodRows.some((p) => String(p.menstrual_cycle_id) === String(c.id))
        )
        .map((c) => ({
          cycleId: String(c.id),
          startDate: Number(c.last_period_start_date),
          endDate: null,
          notes: null,
          timezone: typeof c.timezone === 'string' && c.timezone ? c.timezone : null,
        })),
    ],
    metrics: legacyMetrics,
    fallbackTimezone: timezone,
    now,
  });

  const record = (payload: object, extra: ImportRow = {}): ImportRow => ({
    id: makeId(),
    payload: JSON.stringify(payload),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    _decrypted: true,
    ...extra,
  });

  const periods: ImportRow[] = [];
  const contexts: ImportRow[] = [];
  for (const cycle of liveCycles) {
    const result = converted.cycles.get(String(cycle.id));
    if (!result) {
      continue;
    }

    for (const period of result.periods) {
      periods.push(record(period, { cycle_id: String(cycle.id) }));
    }

    if (result.context) {
      contexts.push(record(result.context, { cycle_id: String(cycle.id) }));
    }

    cycle.config = JSON.stringify(result.config);
    cycle._decrypted = true;
  }

  // Blank the plaintext copies on every cycle row, deleted ones included.
  for (const cycle of cycles) {
    cycle.avg_cycle_length = 28;
    cycle.avg_period_duration = 5;
    cycle.use_hormonal_birth_control = false;
    cycle.birth_control_type = null;
    cycle.sync_goal = null;
    cycle.life_stage = null;
    cycle.last_period_start_date = 0;
  }

  parsed.cycle_periods = [...rowsOf(parsed, 'cycle_periods'), ...periods];
  parsed.cycle_contexts = [...rowsOf(parsed, 'cycle_contexts'), ...contexts];
  parsed.cycle_day_logs = [
    ...rowsOf(parsed, 'cycle_day_logs'),
    ...converted.dayLogs.map((d) => record(d)),
  ];

  delete parsed.period_logs;
  if (Array.isArray(parsed.user_metrics)) {
    parsed.user_metrics = parsed.user_metrics.filter(
      (m) => !(isRow(m) && LEGACY_METRIC_TYPES.has(String(m.type)))
    );
  }

  if (Array.isArray(parsed.user_metrics_notes)) {
    parsed.user_metrics_notes = parsed.user_metrics_notes.filter(
      (n) => !(isRow(n) && metricIds.has(String(n.user_metric_id)))
    );
  }
}
