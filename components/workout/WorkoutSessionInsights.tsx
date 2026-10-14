import { Flame } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { InfoCard } from '@/components/cards/InfoCard';
import { useWorkoutFueling } from '@/hooks/useWorkoutFueling';
import { getDismissedInsights, setInsightDismissed } from '@/utils/activeWorkoutStorage';

/**
 * Context for the session. Deliberately no cycle card: the cycle observations ("your volume
 * was lower near your period") are pattern summaries for the cycle screen. Shown at the start
 * of a session they read as a prediction that today will go worse — a nudge the evidence does
 * not support (phase effects on strength are trivial and inconsistent; see RESEARCH.md).
 */
export function WorkoutSessionInsights({ logId, startedAt }: { logId: string; startedAt: number }) {
  const { t } = useTranslation();
  const fueling = useWorkoutFueling(startedAt);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let live = true;
    getDismissedInsights(logId).then((value) => {
      if (live) {
        setDismissed(!!value.fueling);
      }
    });
    return () => {
      live = false;
    };
  }, [logId]);

  const dismiss = async () => {
    await setInsightDismissed(logId, 'fueling');
    setDismissed(true);
  };

  if (fueling.status === 'loading' || dismissed) {
    return null;
  }

  return (
    <View className="gap-2 pb-4">
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
        onDismiss={() => void dismiss()}
      />
    </View>
  );
}
