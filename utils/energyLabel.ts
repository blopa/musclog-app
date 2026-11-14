import type { EnergyUnit } from '@/constants/settings';
import i18n from '@/lang/lang';

import { formatEnergyAmount } from './energyUnit';

/**
 * "2092 kJ" / "500 kcal" for code that has no hook (mappers, services). Takes kilocalories and
 * the unit to show; the language is the app's current one. Components use `useEnergyUnit`.
 */
export function formatEnergyWithUnitLabel(kcal: number, unit: EnergyUnit = 'kcal'): string {
  const locale = i18n.resolvedLanguage ?? i18n.language;

  return `${formatEnergyAmount(locale, kcal, unit)} ${i18n.t(
    unit === 'kj' ? 'common.energyUnit.kj' : 'common.energyUnit.kcal'
  )}`;
}
