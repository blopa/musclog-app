/**
 * Month names for the year story's charts, from `Intl` in the app language. A poster asks for the
 * same list on every render, so each locale and style is built once.
 */
export type MonthNameStyle = 'long' | 'short' | 'narrow';

const cache = new Map<string, readonly string[]>();

/** The twelve month names, January first. */
export function monthNames(locale: string, style: MonthNameStyle): readonly string[] {
  const key = `${locale}|${style}`;
  let names = cache.get(key);
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { month: style });
    names = Array.from({ length: 12 }, (_, index) => format.format(new Date(2000, index, 1)));
    cache.set(key, names);
  }

  return names;
}
