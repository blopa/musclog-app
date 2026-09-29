export function computeEnergyBalance({
  tdee,
  consumedKcal,
}: {
  tdee: number;
  consumedKcal: number;
}) {
  const burned = tdee;
  const balance = Math.abs(tdee - consumedKcal);
  let direction: 'deficit' | 'surplus' | 'even' = 'even';
  if (tdee > consumedKcal) {
    direction = 'deficit';
  } else if (tdee < consumedKcal) {
    direction = 'surplus';
  }

  return { burned, eaten: consumedKcal, balance, direction };
}
