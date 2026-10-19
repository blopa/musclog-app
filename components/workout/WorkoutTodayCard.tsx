import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, Dumbbell, Play, TrendingUp, Warehouse } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { TextButton } from '@/components/theme/TextButton';
import { SETTINGS } from '@/constants/settingDefinitions';
import type WorkoutLog from '@/database/models/WorkoutLog';
import {
  type TodayWorkout,
  WorkoutTodayRepository,
} from '@/database/repositories/WorkoutTodayRepository';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useActiveGym } from '@/hooks/useActiveGym';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { isResolvedWorkoutSet } from '@/utils/workoutSetCompletion';

type ActiveSession = { log: WorkoutLog; done: number; total: number };

/**
 * "What do I train now?" at the top of Workouts (and, while a workout is running, on Home): resume
 * the session in progress, or start today's scheduled workout / the next one in a rotating plan.
 * The gym and whether starting targets are suggested sit underneath, because both change the numbers
 * the user is about to see.
 */
export function WorkoutTodayCard({
  activeOnly = false,
  onPreview,
  onDiscard,
  refreshKey = 0,
}: {
  activeOnly?: boolean;
  onPreview?: (templateId: string, planId?: string) => void;
  onDiscard?: () => void;
  /** Bump to reload the card while it stays focused (e.g. after the host discards the session). */
  refreshKey?: number;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { formatInteger } = useFormatAppNumber();
  const { gym } = useActiveGym();
  const [error, setError] = useState(false);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [upcoming, setUpcoming] = useState<TodayWorkout[]>([]);
  const [automatic, setAutomatic] = useState(false);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      const load = async () => {
        const [log, next, autonomy] = await Promise.all([
          WorkoutService.getActiveWorkout(),
          activeOnly ? Promise.resolve([]) : WorkoutTodayRepository.upcoming(),
          SettingsService.get(SETTINGS.workoutAutonomy),
        ]);
        let session: ActiveSession | null = null;
        if (log) {
          const { sets } = await WorkoutService.getWorkoutWithDetails(log.id);
          session = { log, done: sets.filter(isResolvedWorkoutSet).length, total: sets.length };
        }

        return { session, next, autonomy };
      };

      load()
        .then(({ session, next, autonomy }) => {
          if (live) {
            setActive(session);
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
    }, [activeOnly, refreshKey])
  );
  if (activeOnly && !active) {
    return null;
  }

  const open = (row: TodayWorkout) =>
    onPreview
      ? onPreview(row.template.id, row.planId)
      : router.push({
          pathname: '/app/workout/workouts',
          params: { previewTemplateId: row.template.id },
        });
  const resume = () =>
    active && router.push(`/app/workout/workout-session?workoutLogId=${active.log.id}`);

  // Context, not controls: plain muted text, because pills read as buttons that did nothing.
  const context = activeOnly ? null : (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <View className="flex-row items-center gap-1.5">
        <Warehouse size={theme.iconSize.xs} color={theme.colors.text.tertiary} />
        <Text className="text-xs text-text-tertiary">{gym?.name ?? t('trainingFlow.noGym')}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <TrendingUp size={theme.iconSize.xs} color={theme.colors.text.tertiary} />
        <Text className="text-xs text-text-tertiary">
          {t(automatic ? 'trainingFlow.guidanceOn' : 'trainingFlow.guidanceOff')}
        </Text>
      </View>
    </View>
  );

  if (active) {
    const fraction = active.total ? active.done / active.total : 0;
    return (
      <View
        className="gap-3 rounded-2xl border border-accent-primary bg-accent-primary/10 p-4"
        testID="workout-today"
      >
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full bg-accent-primary" />
          <Text className="text-xs font-bold text-accent-primary">
            {t('trainingFlow.activeWorkout')}
          </Text>
        </View>
        <View className="gap-1">
          <Text className="text-xl font-bold text-text-primary" numberOfLines={2}>
            {active.log.workoutName || t('freeTraining.title')}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('trainingFlow.progress', {
              done: formatInteger(active.done),
              total: formatInteger(active.total),
            })}
          </Text>
        </View>
        <View className="h-1.5 overflow-hidden rounded-full bg-bg-overlay">
          <View
            className="h-full rounded-full bg-accent-primary"
            style={{ width: `${fraction * 100}%` }}
          />
        </View>
        <Button
          label={t('trainingFlow.resumeWorkout')}
          icon={Play}
          variant="gradientCta"
          width="full"
          onPress={resume}
        />
        {onDiscard ? (
          <TextButton
            tone="danger"
            align="center"
            label={t('endWorkout.finishAndDiscard')}
            onPress={onDiscard}
          />
        ) : null}
      </View>
    );
  }

  const subtitleFor = (row: TodayWorkout) => {
    if (row.lastCompletedAt != null) {
      return t('trainingFlow.rotationNext', {
        date: new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(row.lastCompletedAt),
      });
    }

    if (row.planName) {
      return t(row.scheduled ? 'trainingFlow.scheduledIn' : 'trainingFlow.nextIn', {
        plan: row.planName,
      });
    }

    return t('trainingFlow.scheduledToday');
  };

  const [primary, ...others] = upcoming.filter((row) => !row.completedToday);
  const finished = upcoming.filter((row) => row.completedToday);
  return (
    <View
      className="gap-3 rounded-2xl border border-border-light bg-bg-card p-4"
      testID="workout-today"
    >
      <Text className="text-xs font-bold text-text-secondary">{t('trainingFlow.today')}</Text>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-status-error">
          {t('errors.somethingWentWrong')}
        </Text>
      ) : null}
      {primary ? (
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-accent-primary/10">
              <Dumbbell size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-bold text-text-primary" numberOfLines={2}>
                {primary.template.name}
              </Text>
              <Text className="text-sm text-text-secondary" numberOfLines={2}>
                {subtitleFor(primary)}
              </Text>
            </View>
          </View>
          <Button
            label={t('trainingFlow.previewAndStart')}
            icon={Play}
            variant="gradientCta"
            width="full"
            onPress={() => open(primary)}
          />
        </View>
      ) : null}
      {others.map((row) => (
        <ListRow
          key={`${row.planId ?? 'standalone'}-${row.template.id}`}
          title={row.template.name}
          onPress={() => open(row)}
          trailing={<Play size={theme.iconSize.sm} color={theme.colors.accent.primary} />}
        />
      ))}
      {finished.map((row) => (
        <View
          key={`done-${row.template.id}`}
          className="min-h-12 flex-row items-center gap-2 rounded-xl bg-accent-primary/10 px-4"
        >
          <CheckCircle2 size={theme.iconSize.md} color={theme.colors.accent.primary} />
          <Text className="flex-1 text-base font-medium text-text-primary" numberOfLines={1}>
            {t('trainingFlow.doneToday', { name: row.template.name })}
          </Text>
        </View>
      ))}
      {!primary && !finished.length ? (
        <Text className="text-sm text-text-secondary">{t('trainingFlow.restDay')}</Text>
      ) : null}
      {context}
    </View>
  );
}
