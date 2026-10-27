import { useRouter } from 'expo-router';
import { Check, ChevronRight, HeartHandshake, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ComebackSetupModal } from '@/components/comeback/ComebackSetupModal';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { COMEBACK_ROUTE } from '@/constants/comebackRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import { ComebackService } from '@/database/services/ComebackService';
import { useComebackOffer } from '@/hooks/useComebackOffer';
import { useComebackState } from '@/hooks/useComebackState';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyWorkoutProgress } from '@/hooks/useWeeklyWorkoutProgress';
import type { ComebackSetupResult } from '@/services/comebackSetup';
import { checkpointsDue } from '@/utils/comeback/comebackProgram';
import { type ComebackTrack, tracksWorkouts } from '@/utils/comeback/comebackState';
import { minimumDayKey } from '@/utils/comeback/comebackTransitions';
import { isComebackStalled } from '@/utils/comeback/lapse';
import { handleError } from '@/utils/handleError';

/**
 * Home's way into comeback mode. It says nothing at all unless it has something to say:
 *  - after a long break, an OFFER to ease back in (nothing changes until it is accepted);
 *  - during the ramp, the week, the workouts so far and a one-tap "I did my minimum today";
 *  - when a running comeback has gone quiet, a gentle "pick up where you left off".
 * The graduation message lives on the workout summary, so it appears once, where it is earned.
 */
const OFFER_BODY_KEYS: Record<ComebackTrack, string> = {
  workout: 'comeback.offer.bodyWorkout',
  nutrition: 'comeback.offer.bodyFood',
  both: 'comeback.offer.bodyBoth',
};

export function ComebackCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { state, phase, week, rampWeeks, today, isLoading } = useComebackState();
  const { lapse, shouldOffer, refresh } = useComebackOffer();
  const { workoutsThisWeek } = useWeeklyWorkoutProgress();
  const [setupOpen, setSetupOpen] = useState(false);
  // True while a tap's write is in flight, so a second tap cannot race it.
  const [pending, setPending] = useState(false);

  const showAfterSetup = (result: ComebackSetupResult | null) => {
    setSetupOpen(false);
    void refresh();
    if (!result) {
      return;
    }

    if (result.failures.length > 0) {
      showSnackbar('error', t('comeback.card.setupPartial'));
    } else {
      showSnackbar('success', t('comeback.card.setupDone'));
    }
  };

  const run = async (work: () => Promise<unknown>) => {
    setPending(true);
    try {
      await work();
    } catch (error) {
      await handleError(error, 'comebackCard', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setPending(false);
    }
  };

  const modal = (
    <ComebackSetupModal
      visible={setupOpen}
      onClose={() => setSetupOpen(false)}
      mode="start"
      workoutGapDays={lapse?.workoutGapDays ?? null}
      foodGapDays={lapse?.foodGapDays ?? null}
      suggestedTrack={lapse?.suggestedTrack ?? null}
      detectedBreak={lapse?.breakLength}
      onDone={showAfterSetup}
    />
  );

  const renderBody = () => {
    // 1. A running comeback.
    if (phase === 'ramp' && week !== null) {
      const stalled = lapse !== null && isComebackStalled(state, lapse, today);
      const target = state.answers.daysPerWeek ?? null;

      if (stalled) {
        return (
          <View
            className="gap-3 rounded-card border border-border-light bg-bg-card p-4"
            testID="comeback-card-stalled"
          >
            <Text className="text-base font-semibold text-text-primary">
              {t('comeback.card.stalledTitle')}
            </Text>
            <Text className="text-sm text-text-secondary">{t('comeback.card.stalledBody')}</Text>
            <View className="flex-row gap-3">
              <Button
                label={t('comeback.card.stalledContinue')}
                variant="accent"
                size="md"
                width="flex-1"
                onPress={() => router.push(COMEBACK_ROUTE)}
              />
              <Button
                label={t('comeback.card.stalledRestart')}
                variant="outline"
                size="md"
                width="flex-1"
                icon={RotateCcw}
                loading={pending}
                onPress={() => void run(() => ComebackService.restartWeekOne())}
              />
            </View>
          </View>
        );
      }

      const doneToday = state.minimumDays.includes(minimumDayKey(today));
      const checkpointWaiting = checkpointsDue(state, today).some((due) => due <= 4);

      return (
        <View
          className="gap-3 rounded-card border border-border-light bg-bg-card p-4"
          testID="comeback-card-active"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('comeback.card.open')}
            onPress={() => router.push(COMEBACK_ROUTE)}
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <View className="h-11 w-11 items-center justify-center rounded-control bg-bg-overlay">
              <HeartHandshake size={theme.iconSize.md} color={theme.colors.accent.primary} />
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-base font-semibold text-text-primary">
                {t('comeback.card.week', { week, total: rampWeeks })}
              </Text>
              <Text className="text-sm tabular-nums text-text-secondary">
                {target !== null && tracksWorkouts(state.track)
                  ? t('comeback.card.sessions', { done: workoutsThisWeek, target })
                  : t('comeback.card.minimumHint')}
              </Text>
              {checkpointWaiting ? (
                <Text className="text-xs font-semibold text-accent-primary">
                  {t('comeback.card.checkpointWaiting')}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          </Pressable>
          <Button
            label={doneToday ? t('comeback.card.minimumDone') : t('comeback.card.minimum')}
            variant={doneToday ? 'outline' : 'accent'}
            size="md"
            width="full"
            icon={doneToday ? Check : undefined}
            loading={pending}
            onPress={() =>
              void run(() =>
                doneToday
                  ? ComebackService.undoMinimumDay(today)
                  : ComebackService.logMinimumDay(today)
              )
            }
            testID="comeback-minimum"
          />
          {!doneToday ? (
            <Text className="text-xs text-text-tertiary">{t('comeback.card.minimumHint')}</Text>
          ) : null}
        </View>
      );
    }

    // 2. An offer after a long break.
    if (shouldOffer && lapse !== null) {
      const days = Math.max(lapse.workoutGapDays ?? 0, lapse.foodGapDays ?? 0);
      const bodyKey = OFFER_BODY_KEYS[lapse.suggestedTrack ?? 'both'];

      return (
        <View
          className="gap-3 rounded-card border border-border-light bg-bg-card p-4"
          testID="comeback-card-offer"
        >
          <Text className="text-base font-semibold text-text-primary">
            {t('comeback.offer.title')}
          </Text>
          <Text className="text-sm text-text-secondary">{t(bodyKey, { count: days })}</Text>
          <View className="flex-row items-center gap-3">
            <Button
              label={t('comeback.offer.start')}
              variant="accent"
              size="md"
              width="flex-1"
              onPress={() => setSetupOpen(true)}
              testID="comeback-offer-start"
            />
            <TextButton
              label={t('comeback.offer.notNow')}
              tone="muted"
              onPress={() =>
                void run(async () => {
                  await ComebackService.dismissOffer(lapse.lastActivityAt ?? Date.now());
                })
              }
              testID="comeback-offer-dismiss"
            />
          </View>
        </View>
      );
    }

    return null;
  };

  if (isLoading) {
    return null;
  }

  return (
    <>
      {renderBody()}
      {setupOpen ? modal : null}
    </>
  );
}
