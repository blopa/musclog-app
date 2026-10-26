import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Dumbbell, Layers, ListPlus, PenLine, TrendingUp } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import {
  HEALTH_CONNECT_PROMPT_PENDING,
  PERSONALIZED_SETUP_DATA,
  TRAINING_SETUP_DATA,
} from '@/constants/misc';
import { getWorkoutTemplates, type RawWorkoutTemplate } from '@/data/workoutTemplates';
import type { LiftingExperience } from '@/database/models/User';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';
import {
  parseTrainingSetup,
  pickStarterTemplateIndex,
  type TrainingSetupData,
} from '@/utils/onboardingTraining';

const HOW_IT_WORKS_STEPS = [
  {
    Icon: ListPlus,
    titleKey: 'onboarding.firstWorkout.stepAddTitle',
    bodyKey: 'onboarding.firstWorkout.stepAddBody',
  },
  {
    Icon: PenLine,
    titleKey: 'onboarding.firstWorkout.stepLogTitle',
    bodyKey: 'onboarding.firstWorkout.stepLogBody',
  },
  {
    Icon: TrendingUp,
    titleKey: 'onboarding.firstWorkout.stepNextTitle',
    bodyKey: 'onboarding.firstWorkout.stepNextBody',
  },
] as const;

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
  const { formatInteger } = useFormatAppNumber();
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  // The last step of the quick (7) or personalized (10) setup; absent when opened directly.
  const totalSteps = mode === 'personalized' ? 10 : mode === 'quick' ? 7 : null;

  const [setup, setSetup] = useState<TrainingSetupData | null>(null);
  const [experience, setExperience] = useState<LiftingExperience>('beginner');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
    };

    void load();

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
    const perDay = new Map<number, number>();
    exercises.forEach((exercise) => {
      const day = exercise.day ?? 1;
      perDay.set(day, (perDay.get(day) ?? 0) + 1);
    });
    return {
      exerciseCount: exercises.length,
      dayCount: perDay.size,
      days: [...perDay.entries()].sort((a, b) => a[0] - b[0]),
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

  const handleAddPlan = async () => {
    if (!template) {
      return;
    }

    setIsBusy(true);
    try {
      await WorkoutTemplateService.createWorkoutsFromJsonTemplate(template);
      // The Workouts screen's Today card offers the plan's first workout with one "Start" tap, so
      // the new plan leads somewhere instead of leaving the person on Home to look for it.
      await finish('/app/workout/workouts', true);
    } catch (error) {
      handleError(error, 'firstWorkout.addPlan', {
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
      className="flex-row items-center gap-1.5 rounded-tag px-3 py-1.5"
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
        {totalSteps !== null ? (
          <QuickSetupProgressBar current={totalSteps} total={totalSteps} />
        ) : null}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 160 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-10">
            <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
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
                <View className="gap-2">
                  {stats.days.map(([day, count]) => (
                    <View
                      key={day}
                      className="flex-row items-center justify-between px-4 py-3"
                      style={{
                        backgroundColor: theme.colors.background.card,
                        borderRadius: theme.borderRadius.lg,
                      }}
                    >
                      <Text
                        className="font-semibold"
                        style={{
                          color: theme.colors.text.primary,
                          fontSize: theme.typography.fontSize.base,
                        }}
                      >
                        {t('onboarding.firstWorkout.dayLabel', { day: formatInteger(day) })}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.text.secondary,
                          fontSize: theme.typography.fontSize.sm,
                        }}
                      >
                        {t('onboarding.firstWorkout.dayExercises', { count })}
                      </Text>
                    </View>
                  ))}
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
            {template ? (
              <Text
                className="mt-6"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.fontSize.sm * 1.5,
                }}
              >
                {t('onboarding.firstWorkout.planHint', {
                  action: t('onboarding.firstWorkout.addPlan'),
                  later: t('onboarding.firstWorkout.notNow'),
                })}
              </Text>
            ) : null}
            {!template ? (
              <View className="mt-8 gap-3">
                <Text
                  className="font-bold"
                  style={{
                    color: theme.colors.text.tertiary,
                    fontSize: theme.typography.fontSize.xs,
                  }}
                >
                  {t('onboarding.firstWorkout.howTitle')}
                </Text>
                {HOW_IT_WORKS_STEPS.map(({ Icon, titleKey, bodyKey }) => (
                  <View
                    key={titleKey}
                    className="flex-row items-center gap-4 p-4"
                    style={{
                      backgroundColor: theme.colors.background.card,
                      borderRadius: theme.borderRadius.xl,
                    }}
                  >
                    <View
                      className="h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.colors.background.cardElevated }}
                    >
                      <Icon size={22} color={theme.colors.accent.primary} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text
                        className="font-bold"
                        style={{
                          color: theme.colors.text.primary,
                          fontSize: theme.typography.fontSize.base,
                        }}
                      >
                        {t(titleKey)}
                      </Text>
                      <Text
                        style={{
                          color: theme.colors.text.secondary,
                          fontSize: theme.typography.fontSize.sm,
                        }}
                      >
                        {t(bodyKey)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <BottomButtonWrapper>
          {template ? (
            <Button
              label={t('onboarding.firstWorkout.addPlan')}
              onPress={handleAddPlan}
              variant="gradientCta"
              size="md"
              width="full"
              disabled={isBusy}
              loading={isBusy}
            />
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
