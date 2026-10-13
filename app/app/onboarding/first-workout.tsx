import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Clock, Dumbbell, Layers } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { Button } from '@/components/theme/Button';
import {
  HEALTH_CONNECT_PROMPT_PENDING,
  PERSONALIZED_SETUP_DATA,
  TRAINING_SETUP_DATA,
} from '@/constants/misc';
import { getWorkoutTemplates, type RawWorkoutTemplate } from '@/data/workoutTemplates';
import type { LiftingExperience } from '@/database/models/User';
import { ActiveWorkoutExistsError, WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';
import {
  parseTrainingSetup,
  pickStarterTemplateIndex,
  type TrainingSetupData,
} from '@/utils/onboardingTraining';

const isExperience = (value: unknown): value is LiftingExperience =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

/**
 * Where onboarding ends for anyone who answered the training questions: a concrete first workout
 * rather than an empty Home. Plans exist only for gym equipment, so home/minimal trainers are
 * offered an empty workout instead of a plan they could not do.
 */
export default function FirstWorkoutScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const [setup, setSetup] = useState<TrainingSetupData | null>(null);
  const [experience, setExperience] = useState<LiftingExperience>('beginner');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawTraining, rawPersonalized] = await Promise.all([
          AsyncStorage.getItem(TRAINING_SETUP_DATA),
          AsyncStorage.getItem(PERSONALIZED_SETUP_DATA),
        ]);
        const parsed = parseTrainingSetup(rawTraining);
        if (cancelled) {
          return;
        }
        if (!parsed) {
          router.replace('/app');
          return;
        }

        let personalizedExperience: unknown;
        try {
          personalizedExperience = rawPersonalized
            ? JSON.parse(rawPersonalized).liftingExperience
            : undefined;
        } catch {
          personalizedExperience = undefined;
        }
        setExperience(
          parsed.experience ??
            (isExperience(personalizedExperience) ? personalizedExperience : 'beginner')
        );
        setSetup(parsed);
      } catch (error) {
        handleError(error, 'firstWorkout.load');
        router.replace('/app');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const template: RawWorkoutTemplate | null = useMemo(() => {
    if (!setup) {
      return null;
    }
    const index = pickStarterTemplateIndex(setup.location, experience, setup.daysPerWeek);
    return index === null
      ? null
      : (getWorkoutTemplates(i18n.resolvedLanguage ?? i18n.language)[index] ?? null);
  }, [setup, experience, i18n.resolvedLanguage, i18n.language]);

  const stats = useMemo(() => {
    const exercises = Array.isArray(template?.exercises) ? template.exercises : [];
    return {
      exerciseCount: exercises.length,
      dayCount: new Set(exercises.map((exercise) => exercise.day)).size,
    };
  }, [template]);

  // The prompt for health data waits for this moment: a finished first workout gives it a reason.
  const finish = async (destination: string, afterFirstWorkout: boolean) => {
    try {
      await AsyncStorage.removeItem(TRAINING_SETUP_DATA);
      if (afterFirstWorkout && Platform.OS !== 'web') {
        await AsyncStorage.setItem(HEALTH_CONNECT_PROMPT_PENDING, 'true');
      }
    } catch (error) {
      handleError(error, 'firstWorkout.finish');
    }
    router.replace(destination as never);
  };

  const handleStartPlan = async (startNow: boolean) => {
    if (!template) {
      return;
    }
    setIsBusy(true);
    try {
      const created = await WorkoutTemplateService.createWorkoutsFromJsonTemplate(template);
      const first = created.templates[0];
      if (startNow && first) {
        const workoutLog = await WorkoutService.startWorkoutFromTemplate(
          first.id,
          created.plan?.id
        );
        await finish(`/app/workout/workout-session?workoutLogId=${workoutLog.id}`, true);
        return;
      }
      await finish('/app', true);
    } catch (error) {
      if (error instanceof ActiveWorkoutExistsError) {
        await finish('/app', true);
        return;
      }
      handleError(error, 'firstWorkout.startPlan', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartEmpty = async () => {
    setIsBusy(true);
    try {
      const workoutLog = await WorkoutService.startFreeWorkout(t('freeTraining.workoutName'));
      await finish(`/app/workout/workout-session?workoutLogId=${workoutLog.id}`, true);
    } catch (error) {
      handleError(error, 'firstWorkout.startEmpty', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading || !setup) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  const chip = (icon: React.ReactNode, label: string) => (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ backgroundColor: theme.colors.background.cardElevated }}
    >
      {icon}
      <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}>
        {label}
      </Text>
    </View>
  );

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-10">
            <Text
              className="mb-1 text-3xl font-black tracking-tight"
              style={{ color: theme.colors.text.primary }}
            >
              {t('onboarding.firstWorkout.title')}
            </Text>
            <Text
              className="mb-8"
              style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}
            >
              {template
                ? t('onboarding.firstWorkout.subtitlePlan')
                : t('onboarding.firstWorkout.subtitleEmpty')}
            </Text>

            {template ? (
              <View
                className="gap-4 p-5"
                style={{
                  backgroundColor: theme.colors.background.cardElevated,
                  borderRadius: theme.borderRadius.xl,
                  borderWidth: 1.5,
                  borderColor: theme.colors.accent.primary,
                }}
              >
                <Text
                  className="font-bold"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.xl,
                  }}
                >
                  {template.title}
                </Text>
                {template.description ? (
                  <Text
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                    }}
                  >
                    {template.description}
                  </Text>
                ) : null}
                <View className="flex-row flex-wrap gap-2">
                  {chip(
                    <Layers size={14} color={theme.colors.text.secondary} />,
                    t('onboarding.firstWorkout.days', { count: stats.dayCount })
                  )}
                  {chip(
                    <Dumbbell size={14} color={theme.colors.text.secondary} />,
                    t('onboarding.firstWorkout.exercises', { count: stats.exerciseCount })
                  )}
                  {template.duration
                    ? chip(
                        <Clock size={14} color={theme.colors.text.secondary} />,
                        t('onboarding.firstWorkout.minutes', { count: Number(template.duration) })
                      )
                    : null}
                </View>
                <Text
                  style={{
                    color: theme.colors.text.tertiary,
                    fontSize: theme.typography.fontSize.xs,
                  }}
                >
                  {t('onboarding.firstWorkout.editHint')}
                </Text>
              </View>
            ) : (
              <View
                className="gap-2 p-5"
                style={{
                  backgroundColor: theme.colors.background.cardElevated,
                  borderRadius: theme.borderRadius.xl,
                }}
              >
                <Text
                  className="font-bold"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.lg,
                  }}
                >
                  {t('onboarding.firstWorkout.emptyTitle')}
                </Text>
                <Text
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {t('onboarding.firstWorkout.emptyDescription')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          {template ? (
            <>
              <Button
                label={t('onboarding.firstWorkout.startNow')}
                onPress={() => handleStartPlan(true)}
                variant="gradientCta"
                size="md"
                width="full"
                disabled={isBusy}
                loading={isBusy}
              />
              <View style={{ height: theme.spacing.margin.sm }} />
              <Button
                label={t('onboarding.firstWorkout.addPlan')}
                onPress={() => handleStartPlan(false)}
                variant="outline"
                size="sm"
                width="full"
                disabled={isBusy}
              />
            </>
          ) : (
            <Button
              label={t('onboarding.firstWorkout.startEmpty')}
              onPress={handleStartEmpty}
              variant="gradientCta"
              size="md"
              width="full"
              disabled={isBusy}
              loading={isBusy}
            />
          )}
          <MaybeLaterButton
            onPress={() => finish('/app', true)}
            text={t('onboarding.firstWorkout.notNow')}
          />
        </BottomButtonWrapper>
      </SafeAreaView>
    </MasterLayout>
  );
}
