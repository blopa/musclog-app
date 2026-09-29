export type EnergyDirection = 'deficit' | 'surplus' | 'even';

export type EnergyBalance = {
  /** Energy out for the day. Currently the user's TDEE estimate. */
  burned: number;
  eaten: number;
  /** Always non-negative; `direction` carries the sign. */
  balance: number;
  direction: EnergyDirection;
};

export function computeEnergyBalance({
  tdee,
  consumedKcal,
}: {
  tdee: number;
  consumedKcal: number;
}): EnergyBalance {
  let direction: EnergyDirection = 'even';
  if (tdee > consumedKcal) {
    direction = 'deficit';
  } else if (tdee < consumedKcal) {
    direction = 'surplus';
  }

  return {
    burned: tdee,
    eaten: consumedKcal,
    balance: Math.abs(tdee - consumedKcal),
    direction,
  };
}
