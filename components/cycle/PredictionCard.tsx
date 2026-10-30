import { Calendar } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

type PredictionCardProps = {
  onOpenDetails: () => void;
};

const CONFIDENCE_KEYS = {
  none: 'cycle.prediction.confidence.none',
  low: 'cycle.prediction.confidence.low',
  moderate: 'cycle.prediction.confidence.moderate',
  high: 'cycle.prediction.confidence.high',
} as const;

const SUPPRESSED_KEYS = {
  hormonal: 'cycle.prediction.suppressed.hormonal',
  postpartum: 'cycle.prediction.suppressed.postpartum',
  no_bleeding: 'cycle.prediction.suppressed.no_bleeding',
  pregnancy: 'cycle.complete.stagePregnancyHint',
  pregnancy_loss: 'cycle.complete.stageLossHint',
  menopause: 'cycle.complete.stageMenopauseHint',
} as const;

/**
 * The next-period estimate as a range with its confidence, never a lone date. Each state says what
 * the app knows and why: not enough data, hidden by choice, not meaningful for the person's
 * situation, or simply later than their usual range (stated plainly, without alarm).
 */
export function PredictionCard({ onOpenDetails }: PredictionCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { cycleVariabilityHintDismissed } = useSettings();
  const { timeline, predictionStats, guidance } = useMenstrualCycle();
  const prediction = timeline?.prediction;
  const fertileWindow = timeline?.fertileEstimate ?? null;
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(ms);

  const setHidden = async (hidden: boolean) => {
    try {
      await SettingsService.set(SETTINGS.cycleShowPredictions, !hidden);
    } catch (error) {
      handleError(error, 'PredictionCard.setHidden', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  const dismissHint = async (hide: boolean) => {
    try {
      await SettingsService.set(SETTINGS.cycleVariabilityHintDismissed, true);
      if (hide) {
        await SettingsService.set(SETTINGS.cycleShowPredictions, false);
      }
    } catch (error) {
      handleError(error, 'PredictionCard.dismissHint', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  let headline: string;
  let detail: string | null = null;
  const state = prediction?.state ?? 'insufficient';
  if (state === 'insufficient') {
    headline = t('cycle.prediction.insufficient');
  } else if (state === 'hidden') {
    headline = t('cycle.prediction.hidden');
  } else if (state === 'suppressed') {
    headline = t('cycle.prediction.notShown');
    detail = guidance.suppressedReason ? t(SUPPRESSED_KEYS[guidance.suppressedReason]) : null;
  } else if (state === 'late') {
    const daysLate = prediction?.daysLate ?? 0;
    headline = t('cycle.late.title', { count: daysLate, days: formatInteger(daysLate) });
    detail = t('cycle.late.description');
  } else if (
    prediction?.earliest != null &&
    prediction.latest != null &&
    prediction.mostLikely != null
  ) {
    const spansDays = Math.round((prediction.latest - prediction.earliest) / MS_PER_SOLAR_DAY) >= 1;
    headline = spansDays
      ? t('cycle.prediction.likelyRange', {
          from: date(prediction.earliest),
          to: date(prediction.latest),
        })
      : t('cycle.prediction.likelyDate', { date: date(prediction.mostLikely) });
  } else {
    headline = t('cycle.prediction.insufficient');
  }

  const showsEstimate = state === 'upcoming' || state === 'window';
  const confidenceLine = showsEstimate
    ? t(CONFIDENCE_KEYS[predictionStats.confidence], {
        count: predictionStats.usableCount,
        cycles: formatInteger(predictionStats.usableCount),
      })
    : null;
  const showVariabilityHint =
    showsEstimate &&
    predictionStats.variability === 'highly_variable' &&
    !cycleVariabilityHintDismissed &&
    !guidance.variabilityIsExpected;

  return (
    <View className="mb-4 rounded-card border-2 border-ink/5 bg-bg-overlay p-5">
      <View className="mb-3 flex-row items-center gap-4">
        <View className="h-10 w-10 items-center justify-center rounded-control bg-bg-navActive">
          <Calendar size={20} color={theme.colors.accent.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold text-text-tertiary">{t('cycle.nextPeriod')}</Text>
          <Text className="text-lg font-semibold text-text-primary">{headline}</Text>
        </View>
      </View>

      {detail ? <Text className="mb-2 text-sm text-text-secondary">{detail}</Text> : null}
      {confidenceLine ? (
        <Text className="mb-1 text-xs text-text-tertiary">{confidenceLine}</Text>
      ) : null}
      {showsEstimate && guidance.predictionsCaveated ? (
        <Text className="mb-1 text-xs text-text-tertiary">{t('cycle.prediction.caveated')}</Text>
      ) : null}
      {showsEstimate && guidance.variabilityIsExpected ? (
        <Text className="mb-1 text-xs text-text-tertiary">
          {t('cycle.prediction.variabilityExpected')}
        </Text>
      ) : null}

      {showVariabilityHint ? (
        <View
          className="my-3 gap-2 rounded-control p-3"
          style={{ backgroundColor: theme.colors.status.warning10 }}
        >
          <Text className="text-sm text-text-primary">
            {t('cycle.prediction.variableHint', {
              low: formatInteger(predictionStats.rangeLow),
              high: formatInteger(predictionStats.rangeHigh),
            })}
          </Text>
          <View className="flex-row gap-3">
            <Button
              label={t('cycle.prediction.keepHidden')}
              variant="outline"
              width="flex-1"
              onPress={() => void dismissHint(true)}
            />
            <Button
              label={t('cycle.prediction.showRange')}
              variant="outline"
              width="flex-1"
              onPress={() => void dismissHint(false)}
            />
          </View>
        </View>
      ) : null}

      {fertileWindow ? (
        <View className="mt-2 gap-1">
          <Text className="text-sm font-semibold text-text-primary">
            {t('cycle.prediction.fertile', {
              from: date(fertileWindow.start),
              to: date(fertileWindow.end),
            })}
          </Text>
          <Text className="text-xs text-text-tertiary">{t('cycle.fertilityDisclaimer')}</Text>
        </View>
      ) : null}

      <View className="mt-3 flex-row flex-wrap items-center gap-x-4">
        {state !== 'insufficient' && state !== 'suppressed' ? (
          <TextButton label={t('cycle.prediction.howCalculated')} onPress={onOpenDetails} />
        ) : null}
        {state === 'hidden' ? (
          <TextButton label={t('cycle.prediction.show')} onPress={() => void setHidden(false)} />
        ) : null}
        {showsEstimate || state === 'late' ? (
          <TextButton
            label={t('cycle.prediction.hide')}
            tone="muted"
            onPress={() => void setHidden(true)}
          />
        ) : null}
      </View>
      <Text className="mt-2 text-xs text-text-tertiary">{t('cycle.predictionDisclaimer')}</Text>
    </View>
  );
}
