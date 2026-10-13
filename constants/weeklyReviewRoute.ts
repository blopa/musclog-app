/**
 * Where the Weekly Review lives. It reviews training AND nutrition, so it sits at the top level of
 * the app rather than under `/nutrition`, where it lit up the Food tab even when opened from
 * Workouts. `/app/nutrition/checkin-list` survives only as a deprecated redirect for saved or shared links
 * (queued notifications do not need it: their URL is built at tap time).
 */
export const WEEKLY_REVIEW_ROUTE = '/app/weekly-review';

/**
 * @deprecated The route the old check-in screen lived at. Documentation only: nothing imports it.
 * Delete it together with `app/app/nutrition/checkin-list.tsx`, whose doc block lists every file to
 * remove and how to verify the removal is safe.
 */
export const LEGACY_CHECKIN_ROUTE = '/app/nutrition/checkin-list';
