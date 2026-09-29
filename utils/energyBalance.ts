export type EnergyDirection = 'deficit' | 'surplus' | 'even';

export type EnergyBalance = {
  /**
   * Always non-negative; `direction` carries the sign. Reads as "so far today" for the same
   * reason `burned` does.
   */
  balance: number;
  /**
   * Energy out **so far today**, not the whole day's expenditure.
   *
   * A whole-day TDEE sitting under a "Burned" label reads as energy the user has already
   * spent, so at 8am it overstated the day by roughly 2000 kcal and turned an untouched
   * diary into a large apparent deficit. The caller supplies the elapsed figure —
   * `circadianBurnedKcal` in `utils/circadianBurn.ts`, via `useCircadianBurn` — and this
   * function takes kcal already burned rather than a TDEE so no caller can pass the
   * full-day number by mistake.
   */
  burned: number;
  eaten: number;
  direction: EnergyDirection;
};

export function computeEnergyBalance({
  burnedKcal,
  consumedKcal,
}: {
  burnedKcal: number;
  consumedKcal: number;
}): EnergyBalance {
  let direction: EnergyDirection = 'even';
  if (burnedKcal > consumedKcal) {
    direction = 'deficit';
  } else if (burnedKcal < consumedKcal) {
    direction = 'surplus';
  }

  return {
    balance: Math.abs(burnedKcal - consumedKcal),
    burned: burnedKcal,
    direction,
    eaten: consumedKcal,
  };
}
