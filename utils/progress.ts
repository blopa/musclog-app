
export interface MetricPoint {
  date: number;
  value: number;
}

export interface EmpiricalTDEEWindow {
  empiricalStart: number;
  empiricalEnd: number;
  initialWeight: number;
  finalWeight: number;
  initialFat?: number;
  finalFat?: number;
  empiricalDays: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculates the tracking window and anchor values for empirical TDEE.
 * It prioritizes days where both weight and body fat are recorded.
 * If > 14 such days exist, it uses weekly averages (first/last 7 days) to smooth fluctuations.
 */
export function calculateEmpiricalTDEEWindow(
  weightPoints: MetricPoint[],
  fatPoints: MetricPoint[],
  startDate: number,
  endDate: number
): EmpiricalTDEEWindow {
  const weightByDay = new Map<number, number>();
  for (const p of weightPoints) {
    const day = new Date(p.date).setHours(0, 0, 0, 0);
    weightByDay.set(day, p.value);
  }

  const fatByDay = new Map<number, number>();
  for (const p of fatPoints) {
    const day = new Date(p.date).setHours(0, 0, 0, 0);
    fatByDay.set(day, p.value);
  }

  const commonDays = Array.from(weightByDay.keys())
    .filter((day) => fatByDay.has(day))
    .sort((a, b) => a - b);

  let empiricalStart: number;
  let empiricalEnd: number;
  let initialWeight: number;
  let finalWeight: number;
  let initialFat: number | undefined;
  let finalFat: number | undefined;

  if (commonDays.length > 14) {
    // Use weekly averages for start and end to smooth fluctuations
    const startPoints = commonDays.slice(0, 7);
    const endPoints = commonDays.slice(-7);

    empiricalStart = startPoints.reduce((a, b) => a + b, 0) / 7;
    empiricalEnd = endPoints.reduce((a, b) => a + b, 0) / 7;

    initialWeight = startPoints.reduce((sum, day) => sum + weightByDay.get(day)!, 0) / 7;
    finalWeight = endPoints.reduce((sum, day) => sum + weightByDay.get(day)!, 0) / 7;

    initialFat = startPoints.reduce((sum, day) => sum + fatByDay.get(day)!, 0) / 7;
    finalFat = endPoints.reduce((sum, day) => sum + fatByDay.get(day)!, 0) / 7;
  } else if (commonDays.length >= 2) {
    empiricalStart = commonDays[0];
    empiricalEnd = commonDays[commonDays.length - 1];
    initialWeight = weightByDay.get(empiricalStart)!;
    finalWeight = weightByDay.get(empiricalEnd)!;
    initialFat = fatByDay.get(empiricalStart);
    finalFat = fatByDay.get(empiricalEnd);
  } else {
    // Fallback: use the weight measurement window and take whatever BF is closest (handled by calculateTDEE)
    const hasWeightData = weightPoints.length >= 2;
    empiricalStart = hasWeightData ? weightPoints[0].date : startDate;
    empiricalEnd = hasWeightData ? weightPoints[weightPoints.length - 1].date : endDate;
    initialWeight = weightPoints[0]?.value || 0;
    finalWeight = weightPoints[weightPoints.length - 1]?.value || 0;
    initialFat = fatPoints[0]?.value;
    finalFat = fatPoints[fatPoints.length - 1]?.value;
  }

  const empiricalDays = Math.max(0, Math.ceil((empiricalEnd - empiricalStart) / MS_PER_DAY));

  return {
    empiricalStart,
    empiricalEnd,
    initialWeight,
    finalWeight,
    initialFat,
    finalFat,
    empiricalDays,
  };
}
