import { format, type Locale } from 'date-fns';
import type { TFunction } from 'i18next';

import { formatAppInteger } from './formatAppNumber';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_CUTOFF_DAYS = 7;

type FormatRelativeTimeOptions = {
  t: TFunction;
  /** `i18n.resolvedLanguage ?? i18n.language` — used for the numeric part. */
  locale: string;
  /** date-fns locale from `useDateFnsLocale()`, used for the absolute fallback. */
  dateFnsLocale: Locale;
  /** Injectable for deterministic tests. */
  now?: number;
};

/**
 * Compact "just now" / "5m ago" / "2h ago" / "3d ago" for the first week, then an absolute short
 * date. A week-old "168h ago" tells the user nothing, and date-fns' `formatDistanceToNow`
 * ("about 2 hours ago") is too long for a clamped card.
 *
 * `Intl.RelativeTimeFormat` is deliberately not used: it isn't part of Hermes' Android `Intl`
 * shim, and its narrow style renders at wildly different widths per locale.
 *
 * The numeric part goes through `formatAppInteger` and is interpolated as a pre-formatted
 * string, never a raw number (see `utils/formatAppNumber.ts`).
 */
export function formatRelativeTime(
  timestamp: number,
  { t, locale, dateFnsLocale, now = Date.now() }: FormatRelativeTimeOptions
): string {
  // Clamp future timestamps (clock skew) to "now" rather than rendering a negative age.
  const diff = Math.max(0, now - timestamp);

  if (diff < MINUTE_MS) {
    return t('common.relativeTime.now');
  }

  if (diff < HOUR_MS) {
    const value = formatAppInteger(locale, Math.floor(diff / MINUTE_MS));
    return t('common.relativeTime.minutes', { value });
  }

  if (diff < DAY_MS) {
    const value = formatAppInteger(locale, Math.floor(diff / HOUR_MS));
    return t('common.relativeTime.hours', { value });
  }

  const days = Math.floor(diff / DAY_MS);
  if (days < RELATIVE_CUTOFF_DAYS) {
    const value = formatAppInteger(locale, days);
    return t('common.relativeTime.days', { value });
  }

  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return format(timestamp, sameYear ? 'MMM d' : 'MMM d, yyyy', { locale: dateFnsLocale });
}
