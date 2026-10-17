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

import { type CycleWidgetInputs, cycleWidgetNeedsRecords } from './cycleWidgetSnapshot';

/**
 * Reads what the cycle widget may show. The lock and the style are read first and the encrypted
 * records only when they would be used, so with the defaults (discreet) nothing is decrypted.
 */
export async function loadCycleWidgetInputs(): Promise<CycleWidgetInputs> {
  const [lockMode, style] = await Promise.all([
    SettingsService.get(SETTINGS.appLockMode),
    SettingsService.get(SETTINGS.cycleNotificationStyle),
  ]);
  if (!cycleWidgetNeedsRecords(lockMode, style)) {
    return { lockMode, style, cycle: null };
  }

  const cycle = (await CycleRepository.cycles().fetch()).find((c) => c.isActive);
  if (!cycle) {
    return { lockMode, style, cycle: null };
  }

  const [periods, contexts, config, showPredictions, showFertility] = await Promise.all([
    CycleRepository.periods(cycle.id).fetch().then(readPeriods),
    CycleRepository.contexts(cycle.id).fetch().then(readContexts),
    readCycleConfig(cycle),
    SettingsService.get(SETTINGS.cycleShowPredictions),
    SettingsService.get(SETTINGS.cycleShowFertility),
  ]);
  const { timeline, activePeriod } = buildCycleSnapshot({
    periods,
    contexts,
    config,
    nowMs: Date.now(),
    showPredictions,
    showFertility,
  });

  return { lockMode, style, cycle: { timeline, activePeriod } };
}

/** Calls `listener` after any write to the tables the widget is derived from (imports included). */
export function subscribeToCycleChanges(listener: () => void): () => void {
  const subscription = database
    .withChangesForTables(['menstrual_cycles', 'cycle_periods', 'cycle_contexts'])
    .subscribe(listener);

  return () => subscription.unsubscribe();
}
