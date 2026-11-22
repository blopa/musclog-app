import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/theme';
import { formatMediumDate } from '@/utils/formatMediumDate';
import { PREMIUM_WARNING_PCT } from '@/utils/premium/premiumUiState';

export type PremiumUsageTone = 'normal' | 'warning' | 'error';

/** Colour is never the only signal: the text under the bar says the same thing at each tone. */
export function usageTone(usedPct: number): PremiumUsageTone {
  if (usedPct >= 100) {
    return 'error';
  }

  if (usedPct >= PREMIUM_WARNING_PCT) {
    return 'warning';
  }

  return 'normal';
}

/** The renewal date in the app language, or null when the stored instant is missing or unreadable. */
export function formatRenewalDate(iso: string | null, locale: string): string | null {
  return formatMediumDate(iso, locale);
}

function fillColorFor(tone: PremiumUsageTone, theme: Theme): string {
  switch (tone) {
    case 'error':
      return theme.colors.status.error;
    case 'warning':
      return theme.colors.status.warning;
    default:
      return theme.colors.accent.primary;
  }
}

type PremiumUsageBarProps = {
  usedPct: number;
  resetsAt: string | null;
};

export function PremiumUsageBar({ usedPct, resetsAt }: PremiumUsageBarProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const tone = usageTone(usedPct);
  const fill = Math.min(Math.max(usedPct, 0), 100);
  const fillColor = fillColorFor(tone, theme);
  const renews = formatRenewalDate(resetsAt, locale);
  const pctText = formatInteger(Math.round(usedPct));

  return (
    <View className="gap-2">
      <Text
        className="text-sm font-medium"
        style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.sm }}
      >
        {t('premium.usage.used', { pct: pctText })}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('premium.usage.used', { pct: pctText })}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fill) }}
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: theme.colors.background.ink10 }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${fill}%`, backgroundColor: fillColor }}
        />
      </View>
      {/* The warning and the full state are the modal's notice (one message, not two). */}
      {renews ? (
        <Text
          style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
        >
          {t('premium.usage.renews', { date: renews })}
        </Text>
      ) : null}
    </View>
  );
}
