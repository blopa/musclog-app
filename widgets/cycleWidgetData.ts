import { SETTINGS } from '@/constants/settingDefinitions';
import { database } from '@/database/database-instance';
import {
  CycleRepository,
  readContexts,
  readCycleConfig,
  readPeriods,
} from '@/database/repositories/CycleRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { buildCycleSnapshot } from '@/utils/cycle/cycleSnapshot';

import { type CycleWidgetInputs, cycleWidgetMayShowDay } from './cycleWidgetSnapshot';

/**
 * Reads what the cycle widget may show. The lock is read first and the encrypted records only when
 * the day count may be shown, so under a cycle or whole-app lock nothing is decrypted.
 */
export async function loadCycleWidgetInputs(): Promise<CycleWidgetInputs> {
  const lockScopes = await SettingsService.get(SETTINGS.appLockScopes);
  if (!cycleWidgetMayShowDay(lockScopes)) {
    return { lockScopes, elapsedDay: null };
  }

  const cycle = (await CycleRepository.cycles().fetch()).find((c) => c.isActive);
  if (!cycle) {
    return { lockScopes, elapsedDay: null };
  }

  const [periods, contexts, config] = await Promise.all([
    CycleRepository.periods(cycle.id).fetch().then(readPeriods),
    CycleRepository.contexts(cycle.id).fetch().then(readContexts),
    readCycleConfig(cycle),
  ]);
  // The day count does not depend on predictions, so none are computed for a surface that never
  // shows them.
  const { timeline } = buildCycleSnapshot({
    periods,
    contexts,
    config,
    nowMs: Date.now(),
    showPredictions: false,
    showFertility: false,
  });

  return { lockScopes, elapsedDay: timeline.elapsedDay };
}

/** Calls `listener` after any write to the tables the widget is derived from (imports included). */
export function subscribeToCycleChanges(listener: () => void): () => void {
  const subscription = database
    .withChangesForTables(['menstrual_cycles', 'cycle_periods', 'cycle_contexts'])
    .subscribe(listener);

  return () => subscription.unsubscribe();
}
