import { PeriodRuleViolation } from './periodRules';

const KEYS = {
  period_date_in_future: 'cycle.errors.future',
  period_log_overlaps_existing: 'cycle.errors.overlap',
  period_end_before_start: 'cycle.errors.endBeforeStart',
} as const;

/** The translation key for a period-rule failure, or the generic one for anything else. */
export function periodErrorKey(error: unknown): string {
  return error instanceof PeriodRuleViolation ? KEYS[error.code] : 'errors.somethingWentWrong';
}
