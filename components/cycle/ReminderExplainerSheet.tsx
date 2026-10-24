import { Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { REMINDER_LABEL_KEYS } from '@/utils/cycle/cycleReminderCopy';
import { CYCLE_REMINDER_BASIS, type CycleReminderKind } from '@/utils/cycle/cycleReminders';

type ReminderExplainerSheetProps = {
  kind: CycleReminderKind | null;
  onClose: () => void;
  onChangeReminders: () => void;
};

/**
 * "Why did I get this?", opened by tapping a cycle reminder: which setting sent it, what its date
 * rests on (the person's logged cycles and how much they vary, or a time they chose), and one tap
 * to change or stop it. A reminder that cannot explain itself is one people switch off wholesale.
 */
export function ReminderExplainerSheet({
  kind,
  onClose,
  onChangeReminders,
}: ReminderExplainerSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { predictionStats, config } = useMenstrualCycle();

  let basis = '';
  if (kind && CYCLE_REMINDER_BASIS[kind] === 'estimate') {
    basis =
      predictionStats.usableCount > 0
        ? t(
            predictionStats.rangeLow === predictionStats.rangeHigh
              ? 'cycle.reminders.why.estimateFromSteadyCycles'
              : 'cycle.reminders.why.estimateFromCycles',
            {
              cycles: formatInteger(predictionStats.usableCount),
              low: formatInteger(predictionStats.rangeLow),
              high: formatInteger(predictionStats.rangeHigh),
            }
          )
        : t('cycle.reminders.why.estimateFromSetup');
  } else if (kind) {
    basis = t('cycle.reminders.why.routine');
  }

  const pillBreak = kind === 'pill' && (config.reminders?.pill?.breakDays ?? 0) > 0;

  return (
    <BottomPopUp
      visible={kind != null}
      onClose={onClose}
      title={t('cycle.reminders.why.title')}
      headerIcon={<Info size={theme.iconSize.md} color={theme.colors.accent.primary} />}
      footer={
        <Button
          label={t('cycle.reminders.why.change')}
          variant="outline"
          width="full"
          onPress={onChangeReminders}
        />
      }
    >
      {kind ? (
        <View className="gap-3 pb-2">
          <Text className="text-sm text-text-primary">
            {t('cycle.reminders.why.setting', { reminder: t(REMINDER_LABEL_KEYS[kind]) })}
          </Text>
          <Text className="text-sm text-text-secondary">{basis}</Text>
          {pillBreak ? (
            <Text className="text-sm text-text-secondary">
              {t('cycle.reminders.why.pillBreak')}
            </Text>
          ) : null}
          {kind === 'period-late' ? (
            <Text className="text-sm text-text-secondary">{t('cycle.reminders.why.late')}</Text>
          ) : null}
        </View>
      ) : null}
    </BottomPopUp>
  );
}
