import { useRouter } from 'expo-router';
import { Check, ChevronRight, HeartHandshake, RotateCcw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ComebackSetupModal } from '@/components/comeback/ComebackSetupModal';
import { LoggyPose } from '@/components/LoggyPose';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { COMEBACK_ROUTE } from '@/constants/comebackRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import { ComebackService } from '@/database/services/ComebackService';
import { useComebackOffer } from '@/hooks/useComebackOffer';
import { useComebackState } from '@/hooks/useComebackState';
import { useIsCramped } from '@/hooks/useIsCramped';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyWorkoutProgress } from '@/hooks/useWeeklyWorkoutProgress';
import type { ComebackSetupResult } from '@/services/comebackSetup';
import { checkpointsDue } from '@/utils/comeback/comebackProgram';
import {
  type ComebackTrack,
  tracksNutrition,
  tracksWorkouts,
} from '@/utils/comeback/comebackState';
import { minimumDayKey } from '@/utils/comeback/comebackTransitions';
import { isComebackStalled } from '@/utils/comeback/lapse';
import { handleError } from '@/utils/handleError';
import { yearReviewSeason } from '@/utils/yearInReview/season';

/**
 * Home's way into comeback mode. It says nothing at all unless it has something to say:
 *  - after a long break, an OFFER to ease back in (nothing changes until it is accepted);
 *  - during the ramp, the week, the workouts so far and a one-tap "I did my minimum today";
 *  - when a running comeback has gone quiet, a gentle "pick up where you left off".
 * The graduation message lives on the workout summary, so it appears once, where it is earned.
 */
const OFFER_POSE_HEIGHT = 88;

const OFFER_BODY_KEYS: Record<ComebackTrack, string> = {
  workout: 'comeback.offer.bodyWorkout',
  nutrition: 'comeback.offer.bodyFood',
  both: 'comeback.offer.bodyBoth',
};

export function ComebackCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const cramped = useIsCramped();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { state, phase, week, rampWeeks, today, isLoading } = useComebackState();
  const { lapse, shouldOffer, refresh } = useComebackOffer();
  const { workoutsThisWeek } = useWeeklyWorkoutProgress();
  const [setupOpen, setSetupOpen] = useState(false);
  // Fixed for the screen's life, like the year card's own read of the date.
  const yearCardSeason = useMemo(() => yearReviewSeason(new Date()).active, []);
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
      mode={state.status === 'active' ? 'tailor' : 'start'}
      initialAnswers={state.status === 'active' ? state.answers : undefined}
      initialTrack={state.status === 'active' ? state.track : undefined}
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
            {/* Stacked, not side by side: the two long translations ("Начать неделю 1 заново") do not
                fit a row beside each other at large text, and a row's flex-1 buttons cannot shrink
                below their words, so the restart button hung out of the card. */}
            <View className="gap-3">
              <Button
                label={t('comeback.card.stalledContinue')}
                variant="accent"
                size="md"
                width="full"
                onPress={() => router.push(COMEBACK_ROUTE)}
              />
              <Button
                label={t('comeback.card.stalledRestart')}
                variant="outline"
                size="md"
                width="full"
                icon={RotateCcw}
                loading={pending}
                onPress={() => void run(() => ComebackService.restartWeekOne())}
              />
            </View>
          </View>
        );
      }

      const doneToday = state.minimumDays.includes(minimumDayKey(today));
      // Offered in week 1 to someone whose food questions are still unanswered (onboarding asks only
      // about training); once they answer them, or the first week passes, it goes away.
      const canTailor =
        week === 1 &&
        tracksNutrition(state.track) &&
        state.answers.eating === undefined &&
        state.answers.nutritionGoal === undefined;
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
            {/* Decoration gives way on a narrow or large-text screen, so the week line keeps the row
                and "Возвращение," is not broken across lines. The pressable keeps its label. */}
            {cramped ? null : (
              <View className="h-11 w-11 items-center justify-center rounded-control bg-bg-overlay">
                <HeartHandshake size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
            )}
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
            {cramped ? null : (
              <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
            )}
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
          {canTailor ? (
            <TextButton
              label={t('comeback.card.tailor')}
              onPress={() => setSetupOpen(true)}
              testID="comeback-tailor"
            />
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
          {/* Loggy only on the offer: a welcome back without a word about the gap. The running
              ramp and the stalled card stay plain, since a face there would read as watching. In
              the year-in-review season the year card sits right below with its own Loggy, and one
              screen shows him once, so the offer is plain then. */}
          <View className="flex-row items-center gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-base font-semibold text-text-primary">
                {t('comeback.offer.title')}
              </Text>
              <Text className="text-sm text-text-secondary">{t(bodyKey, { count: days })}</Text>
            </View>
            {yearCardSeason ? null : <LoggyPose pose="coffee" height={OFFER_POSE_HEIGHT} />}
          </View>
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
