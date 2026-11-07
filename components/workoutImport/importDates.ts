/** A calendar date for a past import's range, in the app's locale. */
export function formatImportRange(locale: string, ms: number): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(ms));
}
