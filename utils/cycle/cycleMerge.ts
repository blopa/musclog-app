import type { MoodPoint } from './cycleInsights';
import { type ConflictChoice, type CycleTransfer, mergeByDate } from './cycleTransfer';
import { isEmptyDayLog } from './dayLog';
import { assertValidPeriod } from './periodRules';
import { cycleConfigSchema } from './preferences';
import type { CycleConfig, CycleContextDto, CycleDayLogDto, CyclePeriodDto } from './types';

export interface CycleMergeExisting {
  config: CycleConfig;
  periods: CyclePeriodDto[];
  dayLogs: CycleDayLogDto[];
  contexts: CycleContextDto[];
  moods: (MoodPoint & { id: string })[];
}

/** Preview and commit share these rules; commit re-reads inside the writer. Existing dates win by default. */
export function planCycleMerge(
  incoming: CycleTransfer,
  existing: CycleMergeExisting,
  choice: ConflictChoice,
  restorePreferences: boolean
) {
  const periods = mergeByDate(incoming.periods, existing.periods, 'startDate', choice);
  let staged = [...existing.periods];
  let overlaps = 0;
  periods.update = periods.update.filter(({ id, value }) => {
    try {
      assertValidPeriod(staged, value, { ignoreIds: [id] });
    } catch {
      overlaps++;
      return false;
    }

    staged = staged.map((p) => (p.id === id ? { ...p, ...value } : p));
    return true;
  });
  periods.add = periods.add.filter((value, index) => {
    try {
      assertValidPeriod(staged, value);
    } catch {
      overlaps++;
      return false;
    }

    staged.push({ ...value, id: `new:${index}`, cycleId: '', timezone: '' });
    return true;
  });
  const dayLogs = mergeByDate(incoming.dayLogs, existing.dayLogs, 'date', choice);
  dayLogs.add = dayLogs.add.filter((log) => !isEmptyDayLog(log));
  const contexts = mergeByDate(incoming.contexts, existing.contexts, 'effectiveFrom', choice);
  const moods = mergeByDate(incoming.moods, existing.moods, 'date', choice);
  // Import field definitions even when preferences are kept, so their historic values stay readable.
  const fields = new Map((existing.config.customFields ?? []).map((f) => [f.id, f]));
  for (const field of incoming.config?.customFields ?? []) {
    const old = fields.get(field.id);
    if (
      old &&
      (old.kind !== field.kind ||
        old.label !== field.label ||
        old.min !== field.min ||
        old.max !== field.max)
    ) {
      throw new Error('custom_field_conflict');
    }

    fields.set(field.id, field);
  }

  const config = {
    ...existing.config,
    ...(restorePreferences ? incoming.config : {}),
    customFields: [...fields.values()],
    customSymptoms: [
      ...new Set([
        ...(existing.config.customSymptoms ?? []),
        ...(incoming.config?.customSymptoms ?? []),
        ...(incoming.config
          ? []
          : incoming.dayLogs.flatMap((d) =>
              d.symptoms.filter((s) => s.key.startsWith('custom:')).map((s) => s.key.slice(7))
            )),
      ]),
    ],
  };
  cycleConfigSchema.parse(config);
  const groups = [periods, dayLogs, contexts, moods];
  return {
    periods,
    dayLogs,
    contexts,
    moods,
    config,
    counts: {
      added: groups.reduce((sum, g) => sum + g.add.length, 0),
      updated: groups.reduce((sum, g) => sum + g.update.length, 0),
      skipped: groups.reduce((sum, g) => sum + g.skipped, 0),
      overlaps,
    },
  };
}
