/**
 * Where the Weekly Review lives. It reviews training AND nutrition, so it sits at the top level of
 * the app rather than under `/nutrition`, where it lit up the Food tab even when opened from
 * Workouts. `/app/nutrition/checkin-list` survives only as a redirect, because notifications already
 * scheduled on users' phones (and the legacy check-in links) still point at it.
 */
export const WEEKLY_REVIEW_ROUTE = '/app/weekly-review';

/** The route the old check-in screen lived at; kept as a redirect to {@link WEEKLY_REVIEW_ROUTE}. */
export const LEGACY_CHECKIN_ROUTE = '/app/nutrition/checkin-list';
