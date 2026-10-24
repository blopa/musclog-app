import { FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { shareAppointmentSummary, type SummaryRangeMonths } from '@/services/cycleExport';
import { handleError } from '@/utils/handleError';

const RANGES: SummaryRangeMonths[] = [3, 6, 12];

/**
 * The appointment summary on its own: pick a range, create the PDF. Reached from the care card on
 * the cycle screen and from cycle settings — the card used to open the whole settings modal and
 * leave the person to find the summary near the bottom of it.
 */
export function AppointmentSummarySheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { periods, history, predictionStats, dayLogs, contexts, moods, moodsLoading, moodsError } =
    useMenstrualCycle();
  const [months, setMonths] = useState<SummaryRangeMonths>(6);
  const [isCreating, setIsCreating] = useState(false);

  const create = async () => {
    setIsCreating(true);
    try {
      await shareAppointmentSummary({
        t,
        locale: i18n.resolvedLanguage ?? i18n.language,
        months,
        nowMs: Date.now(),
        data: { periods, history, stats: predictionStats, dayLogs, contexts, moods },
      });
      onClose();
    } catch (error) {
      handleError(error, 'AppointmentSummarySheet.create', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('cycle.settings.summaryTitle')}
      headerIcon={<FileText size={theme.iconSize.md} color={theme.colors.accent.primary} />}
      footer={
        <Button
          label={t('cycle.settings.summaryCreate')}
          variant="accent"
          width="full"
          loading={isCreating}
          disabled={moodsLoading || moodsError}
          onPress={() => void create()}
        />
      }
    >
      <View className="gap-3 pb-2">
        <Text className="text-sm text-text-secondary">{t('cycle.settings.summaryHint')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {RANGES.map((range) => (
            <Chip
              key={range}
              label={t('cycle.settings.summaryRange', { count: range })}
              selected={months === range}
              onPress={() => setMonths(range)}
            />
          ))}
        </View>
      </View>
    </BottomPopUp>
  );
}
