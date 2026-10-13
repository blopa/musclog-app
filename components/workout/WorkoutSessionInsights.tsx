import { Flame, Moon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { InfoCard } from '@/components/cards/InfoCard';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useWorkoutFueling } from '@/hooks/useWorkoutFueling';
import { getDismissedInsights, setInsightDismissed } from '@/utils/activeWorkoutStorage';

export function WorkoutSessionInsights({ logId, startedAt }: { logId: string; startedAt: number }) {
  const { t, i18n } = useTranslation();
  const cycle = useMenstrualCycle();
  const fueling = useWorkoutFueling(startedAt);
  const [dismissed, setDismissed] = useState({ hormonal: false, fueling: false });
  useEffect(() => {
    let live = true;
    getDismissedInsights(logId).then((value) => {
      if (live) {
        setDismissed({ hormonal: !!value.hormonal, fueling: !!value.fueling });
      }
    });
    return () => {
      live = false;
    };
  }, [logId]);
  const dismiss = async (key: 'hormonal' | 'fueling') => {
    await setInsightDismissed(logId, key);
    setDismissed((previous) => ({ ...previous, [key]: true }));
  };

  const message =
    cycle.currentPhase === 'ovulatory'
      ? t('workoutSession.ovulationInsight')
      : cycle.currentPhase === 'menstrual'
        ? t('workoutSession.menstrualInsight')
        : t('workoutSession.phaseInsight', {
            phase: cycle.currentPhase,
            multiplier: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(
              cycle.intensityMultiplier
            ),
          });
  return (
    <View className="gap-2 pb-4">
      {cycle.isActive && !dismissed.hormonal ? (
        <InfoCard
          variant="success"
          icon={Moon}
          label={t('workoutSession.hormonalInsight')}
          message={message}
          onDismiss={() => dismiss('hormonal')}
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
