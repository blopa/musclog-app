import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { formatAppDecimal, formatAppInteger, formatAppNumber } from '../utils/formatAppNumber';

/**
 * Stable formatters keyed to i18n locale for user-visible numbers.
 */
export function useFormatAppNumber() {
  const { i18n } = useTranslation();
  const locale = useMemo(
    () => i18n.resolvedLanguage ?? i18n.language,
    [i18n.resolvedLanguage, i18n.language]
  );

  const formatInteger = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatAppInteger(locale, value, options),
    [locale]
  );

  const formatDecimal = useCallback(
    (value: number, maxFractionDigits: number, options?: Intl.NumberFormatOptions) =>
      formatAppDecimal(locale, value, maxFractionDigits, options),
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options: Intl.NumberFormatOptions) => formatAppNumber(locale, value, options),
    [locale]
  );

  return { locale, formatInteger, formatDecimal, formatNumber };
}
