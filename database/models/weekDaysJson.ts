export function sanitizeWeekDaysJson(data: unknown): number[] | undefined {
  if (data === null || data === undefined) {
    return undefined;
  }

  if (!Array.isArray(data)) {
    throw new Error('week_days_json must be an array of day indices');
  }

  for (const day of data) {
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) {
      throw new Error(
        'Each day in week_days_json must be an integer between 0 (Monday) and 6 (Sunday)'
      );
    }
  }

  return [...new Set(data)].sort((a, b) => a - b);
}
