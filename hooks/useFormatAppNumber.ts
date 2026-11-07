import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatAppDecimal,
  formatAppGroupedInteger,
  formatAppInteger,
  formatAppNumber,
  formatAppRoundedDecimal,
} from '@/utils/formatAppNumber';

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

  const formatGroupedInteger = useCallback(
    (value: number) => formatAppGroupedInteger(locale, value),
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

  const formatRoundedDecimal = useCallback(
    (value: number, fractionDigits: number, options?: Intl.NumberFormatOptions) =>
      formatAppRoundedDecimal(locale, value, fractionDigits, options),
    [locale]
  );

  return {
    locale,
    formatInteger,
    formatGroupedInteger,
    formatDecimal,
    formatNumber,
    formatRoundedDecimal,
  };
}
