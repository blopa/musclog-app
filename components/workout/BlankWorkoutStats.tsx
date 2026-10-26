import { BarChart3, Clock, Flame } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSessionTotalTime } from '@/hooks/useSessionTotalTime';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { NotificationService } from '@/services/NotificationService';
import { getWeightUnitI18nKey } from '@/utils/units';
import { formatDuration } from '@/utils/workout';

/** Duration, calories and volume of a free session that has no exercise yet. */
export function BlankWorkoutStats({
  startTime,
  workoutLogId,
}: {
  startTime: number;
  workoutLogId?: string;
}) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const theme = useTheme();
  const time = useSessionTotalTime({ startTime });
  const durationStr = formatDuration(time.hours, time.minutes, time.seconds);

  // Update notification with total time
  useEffect(() => {
    NotificationService.updateActiveWorkoutNotification(
      t('freeTraining.blankWorkout'),
      durationStr,
      undefined,
      workoutLogId
    );
  }, [durationStr, t, workoutLogId]);

  return (
    <View
      className="mt-10 flex-row justify-around rounded-control border border-border-default bg-bg-card py-4"
      style={{ borderColor: theme.colors.background.ink5 }}
    >
      <View className="items-center">
        <Clock size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.duration')}
        </Text>
        <Text className="mt-0.5 text-base font-semibold text-text-primary">{durationStr}</Text>
      </View>
      <View className="items-center">
        <Flame size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.calories')}
        </Text>
        <Text className="mt-0.5 text-base font-semibold text-text-primary">
          {formatInteger(0, { useGrouping: false })} {t('common.kcal')}
        </Text>
      </View>
      <View className="items-center">
        <BarChart3 size={theme.iconSize.md} color={theme.colors.text.secondary} />
        <Text
          className="mt-1 text-xs font-semibold text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {t('freeTraining.volume')}
        </Text>
        <Text className="mt-0.5 text-base font-semibold text-text-primary">
          {formatInteger(0, { useGrouping: false })} {t(weightUnitKey)}
        </Text>
      </View>
    </View>
  );
}
