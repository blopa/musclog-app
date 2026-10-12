import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';

export function WorkoutTodayCard({
  activeOnly = false,
  onPreview,
  onDiscard,
}: {
  activeOnly?: boolean;
  onPreview?: (templateId: string, planId?: string) => void;
  onDiscard?: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { gym } = useActiveGym();
  const [error, setError] = useState(false);
  const [active, setActive] = useState<WorkoutLog | null>(null);
  const [upcoming, setUpcoming] = useState<
    Awaited<ReturnType<typeof WorkoutTodayRepository.upcoming>>
  >([]);
  const [automatic, setAutomatic] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([
        WorkoutService.getActiveWorkout(),
        activeOnly ? Promise.resolve([]) : WorkoutTodayRepository.upcoming(),
        SettingsService.getWorkoutAutonomy(),
      ])
        .then(([log, next, autonomy]) => {
          if (live) {
            setActive(log);
            setUpcoming(next);
            setAutomatic(autonomy === 'suggest');
            setError(false);
          }
        })
        .catch(() => {
          if (live) {
            setError(true);
          }
        });
      return () => {
        live = false;
      };
    }, [activeOnly])
  );
  if (activeOnly && !active) {
    return null;
  }
  return (
    <View className="gap-3 rounded-2xl bg-bg-card p-4" testID="workout-today">
      {error ? (
        <Text accessibilityRole="alert" className="text-status-error">
          {t('errors.somethingWentWrong')}
        </Text>
      ) : null}
      <Text className="text-xl font-bold text-text-primary">
        {t(active ? 'trainingFlow.activeWorkout' : 'trainingFlow.today')}
      </Text>
      <Text className="text-sm text-text-secondary">
        {gym?.name ?? t('trainingFlow.noGym')} ·{' '}
        {t(automatic ? 'trainingFlow.guidanceOn' : 'trainingFlow.guidanceOff')}
      </Text>
      {active && onDiscard ? (
        <Button label={t('endWorkout.finishAndDiscard')} variant="outline" onPress={onDiscard} />
      ) : null}
      {active ? (
        <Button
          label={t('trainingFlow.resume', { name: active.workoutName })}
          onPress={() => router.push(`/app/workout/workout-session?workoutLogId=${active.id}`)}
        />
      ) : upcoming.length ? (
        upcoming.map((row) => (
          <Button
            key={`${row.planId}-${row.template.id}`}
            label={row.template.name}
            variant="outline"
            onPress={() =>
              onPreview
                ? onPreview(row.template.id, row.planId)
                : router.push({
                    pathname: '/app/workout/workouts',
                    params: {
                      previewTemplateId: row.template.id,
                      ...(row.planId ? { previewPlanId: row.planId } : {}),
                    },
                  })
            }
          />
        ))
      ) : (
        <Text className="text-sm text-text-secondary">{t('trainingFlow.restDay')}</Text>
      )}
    </View>
  );
}
