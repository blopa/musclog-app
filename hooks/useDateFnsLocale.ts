import type { Locale } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getDateFnsLocale } from '../utils/dateFnsLocale';

/** date-fns locale object for the current i18n language (updates when language changes). */
export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation();
  return useMemo(() => getDateFnsLocale(i18n.language), [i18n.language]);
}
