import type { EnergyBalance, EnergyDirection } from '@/utils/energyBalance';

/**
 * Which of the strip's cells carries meaning in color. Only the day's conclusion is
 * tinted; the raw inputs it is derived from stay neutral so the tint reads as a verdict
 * rather than as decoration.
 */
export type StatTone = 'neutral' | 'good' | 'caution';

export type DailyStatCell = {
  key: 'steps' | 'burned' | 'eaten' | 'balance';
  /** Suffix under `home.dailyStats.` — the cell's label. */
  labelKey: string;
  value: number;
  tone: StatTone;
  /** Every energy cell states its unit; the step count is not in kcal. */
  showsUnit: boolean;
};

const DIRECTION_TONE: Record<EnergyDirection, StatTone> = {
  deficit: 'good',
  surplus: 'caution',
  even: 'neutral',
};

/**
 * The stat strip under the daily summary card, as data.
 *
 * Steps come from the platform health sync and are absent on web and on a phone that
 * has not granted the permission; the energy cells are absent when the user has no
 * calorie goal (intuitive-eating mode). Either half can therefore be missing, and the
 * strip renders whatever remains rather than collapsing entirely.
 */
export function buildDailyStatCells({
  steps,
  energyBalance,
}: {
  steps: null | number;
  energyBalance: EnergyBalance | null;
}): DailyStatCell[] {
  const cells: DailyStatCell[] = [];

  if (steps !== null) {
    cells.push({
      key: 'steps',
      labelKey: 'steps',
      value: steps,
      tone: 'neutral',
      showsUnit: false,
    });
  }

  if (energyBalance) {
    cells.push(
      {
        key: 'burned',
        labelKey: 'burned',
        value: energyBalance.burned,
        tone: 'neutral',
        showsUnit: true,
      },
      {
        key: 'eaten',
        labelKey: 'eaten',
        value: energyBalance.eaten,
        tone: 'neutral',
        showsUnit: true,
      },
      {
        key: 'balance',
        labelKey: energyBalance.direction,
        value: energyBalance.balance,
        tone: DIRECTION_TONE[energyBalance.direction],
        showsUnit: true,
      }
    );
  }

  return cells;
}
