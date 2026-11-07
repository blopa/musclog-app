/**
 * When the year-in-review card is offered. These dates are a product choice: the season opens in
 * December, when a year's training is nearly complete, and closes at the end of January so the
 * previous year stays reachable for a while.
 */
export const YEAR_REVIEW_SEASON_START_MONTH = 11; // December, 0-based
export const YEAR_REVIEW_SEASON_END_MONTH = 0; // January, 0-based

/**
 * `active` is true from 1 December to 31 January (local time). In December `year` is the current
 * year; in January it is the year that just ended. Outside the season `year` is the last completed
 * year, which the Settings replay uses.
 */
export function yearReviewSeason(now: Date): { active: boolean; year: number } {
  const month = now.getMonth();
  const currentYear = now.getFullYear();

  if (month === YEAR_REVIEW_SEASON_START_MONTH) {
    return { active: true, year: currentYear };
  }

  if (month === YEAR_REVIEW_SEASON_END_MONTH) {
    return { active: true, year: currentYear - 1 };
  }

  return { active: false, year: currentYear - 1 };
}
