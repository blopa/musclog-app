import { useTranslation } from 'react-i18next';
import { Switch, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { TextButton } from '@/components/theme/TextButton';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { evaluatePredictions } from '@/utils/cycle/historyAnalysis';
import { handleError } from '@/utils/handleError';

type PredictionDetailsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * What the estimate rests on: how many cycles, their median and range, and each cycle with
 * whether it was used and why not. A cycle can be switched out of the calculation (a mislogged
 * one should not distort every later estimate), and switching it back in is just as easy.
 */
export function PredictionDetailsSheet({ visible, onClose }: PredictionDetailsSheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { predictionStats: stats, history, periods, config, updatePeriod } = useMenstrualCycle();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const date = (ms: number) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms);
  const evaluation = evaluatePredictions(periods, history, config);
  const periodAt = new Map(periods.map((p) => [p.startDate, p]));
  const rows = [...history].filter((h) => h.status !== 'in_progress').reverse();

  const toggle = async (start: number, use: boolean) => {
    const period = periodAt.get(start);
    if (!period) {
      return;
    }

    try {
      await updatePeriod(period.id, { excludedFromStats: !use });
    } catch (error) {
      handleError(error, 'PredictionDetailsSheet.toggle', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  return (
    <BottomPopUp visible={visible} onClose={onClose} title={t('cycle.prediction.detailsTitle')}>
      <View className="gap-4 pb-4">
        <Text className="text-sm text-text-secondary">
          {stats.usableCount > 0
            ? t('cycle.prediction.basis', {
                count: stats.usableCount,
                cycles: formatInteger(stats.usableCount),
                median: formatInteger(stats.medianLength),
                low: formatInteger(stats.rangeLow),
                high: formatInteger(stats.rangeHigh),
              })
            : t('cycle.prediction.basisNone', { days: formatInteger(stats.medianLength) })}
        </Text>
        {stats.usableCount > 0 && stats.predictedLength !== stats.medianLength ? (
          <Text className="text-sm text-text-secondary">
            {t('cycle.prediction.recentWeighted', {
              days: formatInteger(stats.predictedLength),
            })}
          </Text>
        ) : null}
        <Text className="text-xs text-text-secondary">{t('cycle.complete.rangeHeuristic')}</Text>
        {evaluation.checked > 0 ? (
          <Text className="text-sm text-text-secondary">
            {t('cycle.complete.backtest', {
              hits: formatInteger(evaluation.hits),
              checked: formatInteger(evaluation.checked),
              error: formatInteger(Math.round(evaluation.meanErrorDays!)),
            })}
          </Text>
        ) : null}
        {stats.basis.excluded > 0 ? (
          <Text className="text-sm text-text-secondary">
            {t('cycle.prediction.excludedCount', {
              count: stats.basis.excluded,
              cycles: formatInteger(stats.basis.excluded),
            })}
          </Text>
        ) : null}

        {rows.map((row) => {
          const period = periodAt.get(row.start);
          const userExcluded = row.reason === 'user_excluded';
          const canToggle = period != null && (row.status === 'used' || userExcluded);

          return (
            <View
              key={row.start}
              className="flex-row items-center justify-between gap-3 rounded-control bg-bg-card p-3"
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary">
                  {date(row.start)}
                  {row.lengthDays != null
                    ? ` · ${t('cycle.history.days', { count: row.lengthDays, days: formatInteger(row.lengthDays) })}`
                    : ''}
                </Text>
                <Text className="text-xs text-text-tertiary">
                  {row.status === 'used'
                    ? t('cycle.prediction.cycleUsed')
                    : t('cycle.history.notUsed', {
                        reason: t(`cycle.history.reason.${row.reason}`),
                      })}
                </Text>
              </View>
              {row.reason === 'possible_missed_period' && period ? (
                <TextButton
                  label={t('cycle.complete.confirmLong')}
                  onPress={() => {
                    void updatePeriod(period.id, { confirmedLongCycle: true }).catch((error) =>
                      handleError(error, 'PredictionDetailsSheet.confirm', {
                        sendToSentry: false,
                        snackbarMessage: t('errors.somethingWentWrong'),
                      })
                    );
                  }}
                />
              ) : null}
              {period?.confirmedLongCycle ? (
                <TextButton
                  label={t('cycle.complete.reviewLong')}
                  onPress={() => {
                    void updatePeriod(period.id, { confirmedLongCycle: false }).catch((error) =>
                      handleError(error, 'PredictionDetailsSheet.review', {
                        sendToSentry: false,
                        snackbarMessage: t('errors.somethingWentWrong'),
                      })
                    );
                  }}
                />
              ) : null}
              {canToggle ? (
                <Switch
                  value={row.status === 'used'}
                  onValueChange={(use) => void toggle(row.start, use)}
                  accessibilityLabel={t('cycle.prediction.useForPredictions')}
                  trackColor={{ true: theme.colors.accent.primary }}
                />
              ) : null}
            </View>
          );
        })}
        <Text className="text-xs text-text-tertiary">{t('cycle.prediction.evidenceNote')}</Text>
      </View>
    </BottomPopUp>
  );
}
