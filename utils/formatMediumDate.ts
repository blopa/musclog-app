/**
 * An ISO instant as a medium date in the given locale (`dateStyle: 'medium'`), or `null` when the
 * value is missing, unreadable or the locale is not supported.
 */
export function formatMediumDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  } catch {
    return null;
  }
}
