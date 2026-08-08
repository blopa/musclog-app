import type { Locale } from 'date-fns';

import { DEFAULT_LANG, LanguageKeys, LOCALE_MAP } from '@/lang/lang';

/** Resolves the date-fns locale for the active app language (same mapping as DatePickerModal). */
export function getDateFnsLocale(language?: string | null): Locale {
  const lang = (language || DEFAULT_LANG) as LanguageKeys;
  return LOCALE_MAP[lang] ?? LOCALE_MAP[DEFAULT_LANG];
}
