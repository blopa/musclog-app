/**
 * A set's rated effort is stored in TWO columns: `reps_in_reserve` and `rir_recorded`. Reps in
 * reserve is optional, and an unrated set must never read as "0 in reserve" — that is failure, and
 * progression would deload on it. So the number is only meaningful when `rir_recorded` is true, and
 * an unrated set stores a 0 placeholder next to `rir_recorded = false`.
 *
 * This is the one place the two columns are written together. A write site that set them by hand
 * could pair a number with the wrong flag, and the app had six such sites with three different
 * defaults.
 */
export type SetEffortRecord = { repsInReserve: number; rirRecorded?: boolean };

/**
 * Writes a set's effort: a number rates it, `null` or `undefined` leaves it (or makes it) unrated.
 * Callers that mean "do not touch the rating" must not call this at all.
 */
export function writeSetEffort(
  record: SetEffortRecord,
  repsInReserve: number | null | undefined
): void {
  const rated = repsInReserve != null && Number.isFinite(repsInReserve);
  record.repsInReserve = rated ? repsInReserve : 0;
  record.rirRecorded = rated;
}
