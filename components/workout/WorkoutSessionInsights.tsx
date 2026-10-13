import { Flame, Moon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { InfoCard } from '@/components/cards/InfoCard';
import { insightSentence } from '@/components/cycle/insightCopy';
import { useAppLock } from '@/context/AppLockContext';
import { useCycleInsights } from '@/hooks/useCycleInsights';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useWorkoutFueling } from '@/hooks/useWorkoutFueling';
import { getDismissedInsights, setInsightDismissed } from '@/utils/activeWorkoutStorage';
import { localDayStartFromUtcMs } from '@/utils/calendarDate';
import { isNearPeriodStart } from '@/utils/cycle/cycleInsights';

export function WorkoutSessionInsights({ logId, startedAt }: { logId: string; startedAt: number }) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { isLocked } = useAppLock();
  const { periods, nextPeriodDate, nowMs } = useMenstrualCycle();
  const { insights } = useCycleInsights();
  const fueling = useWorkoutFueling(startedAt);
  const [dismissed, setDismissed] = useState({ cycle: false, fueling: false });
  useEffect(() => {
    let live = true;
    getDismissedInsights(logId).then((value) => {
      if (live) {
        setDismissed({ cycle: !!value.cycle, fueling: !!value.fueling });
      }
    });
    return () => {
      live = false;
    };
  }, [logId]);
  const dismiss = async (key: 'cycle' | 'fueling') => {
    await setInsightDismissed(logId, key);
    setDismissed((previous) => ({ ...previous, [key]: true }));
  };

  // A personal observation, shown only on a day it applies to and never while the cycle area is
  // locked: this card would otherwise show reproductive records on the workout screen.
  const workoutInsight = insights.find((i) => i.kind === 'workout_near_start');
  const showCycleInsight =
    workoutInsight != null &&
    !dismissed.cycle &&
    !isLocked('cycle') &&
    isNearPeriodStart(
      periods.map((p) => p.startDate),
      nextPeriodDate?.getTime() ?? null,
      localDayStartFromUtcMs(nowMs)
    );

  return (
    <View className="gap-2 pb-4">
      {showCycleInsight && workoutInsight ? (
        <InfoCard
          variant="success"
          icon={Moon}
          label={t('cycle.insights.title')}
          message={`${insightSentence(t, workoutInsight, formatInteger)} ${t('cycle.insights.basedOnRecords')}`}
          onDismiss={() => dismiss('cycle')}
        />
      ) : null}
      {fueling.status !== 'loading' && !dismissed.fueling ? (
        <InfoCard
          variant={fueling.status === 'low' ? 'warning' : 'success'}
          icon={Flame}
          label={t('workoutSession.fuelingInsight')}
          message={t(
            fueling.status === 'low'
              ? 'workoutSession.lowFuelingMessage'
              : 'workoutSession.fullyFueledMessage',
            { carbs: Math.round(fueling.totalCarbs), hours: Math.round(fueling.windowHours) }
          )}
          onDismiss={() => dismiss('fueling')}
        />
      ) : null}
    </View>
  );
}
