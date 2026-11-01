/** A failed/disabled mirror leaves local ownership intact and can be retried safely. */
export type NutritionHealthWriteResult =
  { status: 'written'; externalId: string } | { status: 'not-written' };
