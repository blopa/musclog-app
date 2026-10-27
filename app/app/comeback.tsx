import { useFocusEffect, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import {
  ComebackDeficitOffer,
  isDeficitOfferDue,
} from '@/components/comeback/ComebackDeficitOffer';
import { ComebackReflection } from '@/components/comeback/ComebackReflection';
import { ComebackSetupModal } from '@/components/comeback/ComebackSetupModal';
import { ComebackTips } from '@/components/comeback/ComebackTips';
import { AreaLockGate } from '@/components/lock/AreaLockGate';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { ListRow } from '@/components/theme/ListRow';
import { ScreenHeader } from '@/components/theme/ScreenHeader';
import { SectionLabel } from '@/components/theme/SectionLabel';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { WEEKLY_REVIEW_ROUTE } from '@/constants/weeklyReviewRoute';
import { useSnackbar } from '@/context/SnackbarContext';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import {
  type ComebackProgress,
  ComebackProgressService,
} from '@/database/services/ComebackProgressService';
import { ComebackService } from '@/database/services/ComebackService';
import { useComebackState } from '@/hooks/useComebackState';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { planWeeks } from '@/utils/comeback/comebackPlanSummary';
import { checkpointsDue } from '@/utils/comeback/comebackProgram';
import {
  type ComebackTrackingDepth,
  tracksNutrition,
  tracksWorkouts,
} from '@/utils/comeback/comebackState';
import { minimumDayKey, rampEndsAt } from '@/utils/comeback/comebackTransitions';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { handleError } from '@/utils/handleError';
import { getWeightUnitI18nKey } from '@/utils/units';

/** The comeback holds counts of workouts, food and weight, so either area's lock holds the screen. */
const COMEBACK_LOCK_AREAS = ['workout', 'nutrition'] as const;

/** '+' / '−' / '' so a change in weight reads with its direction. */
function signOf(change: number): string {
  if (change > 0) {
    return '+';
  }

  return change < 0 ? '−' : '';
}

export default function ComebackScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { units } = useSettings();
  const { locale } = useFormatAppNumber();
  const { state, phase, week, rampWeeks, today, isLoading } = useComebackState();
  const [progress, setProgress] = useState<ComebackProgress | null>(null);
  const [depth, setDepth] = useState<ComebackTrackingDepth>('full');
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summary, currentDepth] = await Promise.all([
        ComebackProgressService.summarize(state),
        ComebackNutritionService.currentTrackingDepth(),
      ]);
      setProgress(summary);
      setDepth(currentDepth);
    } catch (error) {
      void handleError(error, 'comebackScreen.load');
    }
  }, [state]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      await handleError(error, 'comebackScreen', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  const running = phase === 'ramp' || phase === 'graduated';
  const due = checkpointsDue(state, today);
  const reviewCheckpoints = due.filter((entry) => entry <= 4);
  const reflections = due.filter((entry) => entry > 4);
  const doneToday = state.minimumDays.includes(minimumDayKey(today));
  const rows = planWeeks(state.answers);
  const endsAt = rampEndsAt(state, rampWeeks);
  const dateLabel = (value: number) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
      month: 'short',
      day: 'numeric',
    }).format(value);

  let subline: string | null = null;
  if (phase === 'graduated') {
    subline = t('comeback.screen.graduatedBody');
  } else if (endsAt !== null) {
    subline = t('comeback.screen.endsOn', { date: dateLabel(endsAt) });
  }

  const weightLine = (() => {
    if (!progress?.weight) {
      return null;
    }

    const change = progress.weight.nowKg - progress.weight.startKg;
    const sign = signOf(change);

    return t('comeback.screen.weightChange', {
      change: `${sign}${formatDisplayWeightKg(locale, units, Math.abs(change))}`,
      unit: t(getWeightUnitI18nKey(units)),
    });
  })();

  const toggleDepth = (target: ComebackTrackingDepth, on: boolean) =>
    run(async () => {
      await ComebackNutritionService.setTrackingDepth(on ? target : 'full');
      setDepth(on ? target : 'full');
    });

  let endControl: ReactNode;
  if (phase === 'graduated') {
    endControl = (
      <Button
        label={t('comeback.screen.finish')}
        variant="accent"
        size="md"
        width="full"
        loading={busy}
        onPress={() => void run(() => ComebackService.end())}
      />
    );
  } else if (confirmEnd) {
    endControl = (
      <View className="gap-2 rounded-control border border-border-light bg-bg-card p-3">
        <Text className="text-sm text-text-primary">{t('comeback.screen.endConfirm')}</Text>
        <View className="flex-row gap-3">
          <Button
            label={t('comeback.screen.endConfirmYes')}
            variant="outline"
            size="md"
            width="flex-1"
            loading={busy}
            onPress={() =>
              void run(async () => {
                await ComebackService.end();
                setConfirmEnd(false);
                showSnackbar('success', t('comeback.screen.ended'));
              })
            }
          />
          <Button
            label={t('comeback.screen.endConfirmNo')}
            variant="outline"
            size="md"
            width="flex-1"
            onPress={() => setConfirmEnd(false)}
          />
        </View>
      </View>
    );
  } else {
    endControl = (
      <TextButton
        label={t('comeback.screen.end')}
        tone="danger"
        onPress={() => setConfirmEnd(true)}
      />
    );
  }

  return (
    <MasterLayout>
      <ScreenHeader title={t('comeback.title')} lockArea={COMEBACK_LOCK_AREAS} />
      <AreaLockGate area={COMEBACK_LOCK_AREAS}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6 px-4 pt-4">
            {!isLoading && !running ? (
              <View className="gap-4">
                <Text className="text-base text-text-primary">
                  {t(
                    phase === 'ended'
                      ? 'comeback.screen.endedBody'
                      : 'comeback.screen.notStartedBody'
                  )}
                </Text>
                <Button
                  label={t('comeback.screen.startPlan')}
                  variant="accent"
                  size="md"
                  width="full"
                  onPress={() => setSetupOpen(true)}
                  testID="comeback-screen-start"
                />
              </View>
            ) : null}
            {!isLoading && running ? (
              <>
                <View className="gap-3">
                  <SectionLabel tone="accent">{t('comeback.screen.thisWeek')}</SectionLabel>
                  <Text className="text-2xl font-bold text-text-primary">
                    {phase === 'graduated'
                      ? t('comeback.screen.graduatedTitle')
                      : t('comeback.card.week', { week, total: rampWeeks })}
                  </Text>
                  {subline ? <Text className="text-sm text-text-secondary">{subline}</Text> : null}
                  <Button
                    label={doneToday ? t('comeback.card.minimumDone') : t('comeback.card.minimum')}
                    variant={doneToday ? 'outline' : 'accent'}
                    size="md"
                    width="full"
                    icon={doneToday ? Check : undefined}
                    loading={busy}
                    onPress={() =>
                      void run(() =>
                        doneToday
                          ? ComebackService.undoMinimumDay(today)
                          : ComebackService.logMinimumDay(today)
                      )
                    }
                  />
                  <Text className="text-xs text-text-tertiary">
                    {t('comeback.card.minimumHint')}
                  </Text>
                </View>

                {reviewCheckpoints.length > 0 ? (
                  <ListRow
                    variant="card"
                    title={t('comeback.screen.checkpointTitle', { week: reviewCheckpoints[0] })}
                    subtitle={t('comeback.screen.checkpointBody')}
                    onPress={() => router.push(WEEKLY_REVIEW_ROUTE)}
                    testID="comeback-checkpoint-link"
                  />
                ) : null}

                {reflections.map((entry) => (
                  <ComebackReflection
                    key={entry}
                    week={entry}
                    answers={state.answers}
                    includesNutrition={tracksNutrition(state.track)}
                  />
                ))}

                {isDeficitOfferDue(state, week) ? <ComebackDeficitOffer state={state} /> : null}

                {tracksWorkouts(state.track) ? (
                  <View className="gap-2">
                    <SectionLabel>{t('comeback.screen.program')}</SectionLabel>
                    {rows.map((row) => {
                      const current = phase === 'ramp' && row.week === week;

                      return (
                        <View
                          key={row.week}
                          className={`rounded-control border p-3 ${current ? 'border-accent-primary bg-accent-primary/10' : 'border-border-light bg-bg-card'}`}
                        >
                          <Text className="text-sm font-semibold text-text-primary">
                            {t('comeback.plan.weekLabel', { week: row.week })}
                          </Text>
                          <Text className="text-sm text-text-secondary">
                            {row.sets === null
                              ? t('comeback.plan.weekRowPlanSets', {
                                  rir: row.rir,
                                  percent: row.percent,
                                })
                              : t('comeback.plan.weekRow', {
                                  count: row.sets,
                                  rir: row.rir,
                                  percent: row.percent,
                                })}
                          </Text>
                        </View>
                      );
                    })}
                    <Text className="text-xs text-text-tertiary">
                      {t('comeback.screen.programFootnote')}
                    </Text>
                  </View>
                ) : null}

                <View className="gap-2">
                  <SectionLabel>{t('comeback.screen.sinceTitle')}</SectionLabel>
                  <View className="gap-1 rounded-control border border-border-light bg-bg-card p-3">
                    {tracksWorkouts(state.track) ? (
                      <Text className="text-sm tabular-nums text-text-primary">
                        {t('comeback.screen.sinceWorkouts', { count: progress?.workouts ?? 0 })}
                      </Text>
                    ) : null}
                    {tracksNutrition(state.track) ? (
                      <Text className="text-sm tabular-nums text-text-primary">
                        {t('comeback.screen.sinceFood', { count: progress?.foodDays ?? 0 })}
                      </Text>
                    ) : null}
                    <Text className="text-sm tabular-nums text-text-primary">
                      {t('comeback.screen.sinceMinimum', { count: progress?.minimumDays ?? 0 })}
                    </Text>
                    {weightLine ? (
                      <Text className="text-sm tabular-nums text-text-primary">{weightLine}</Text>
                    ) : null}
                  </View>
                  <Text className="text-xs text-text-tertiary">
                    {t('comeback.screen.sinceFootnote')}
                  </Text>
                </View>

                {tracksNutrition(state.track) ? (
                  <View className="gap-3">
                    <SectionLabel>{t('comeback.screen.eatingTitle')}</SectionLabel>
                    <ComebackTips answers={state.answers} />
                    <ToggleInput
                      items={[
                        {
                          key: 'mealsOnly',
                          label: t('comeback.screen.toggleMealsOnly'),
                          subtitle: t('comeback.screen.toggleMealsOnlyHint'),
                          value: depth === 'mealsOnly',
                          onValueChange: (on) => void toggleDepth('mealsOnly', on),
                          disabled: busy,
                        },
                        {
                          key: 'proteinOnly',
                          label: t('comeback.screen.toggleProteinOnly'),
                          subtitle: t('comeback.screen.toggleProteinOnlyHint'),
                          value: depth === 'caloriesProtein',
                          onValueChange: (on) => void toggleDepth('caloriesProtein', on),
                          disabled: busy,
                        },
                      ]}
                    />
                  </View>
                ) : null}

                <View className="gap-2">
                  <ListRow
                    variant="card"
                    title={t('comeback.screen.edit')}
                    onPress={() => setSetupOpen(true)}
                    testID="comeback-edit"
                  />
                  {endControl}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
        {setupOpen ? (
          <ComebackSetupModal
            visible={setupOpen}
            onClose={() => setSetupOpen(false)}
            mode={running ? 'edit' : 'start'}
            initialAnswers={running ? state.answers : undefined}
            initialTrack={running ? state.track : undefined}
            onDone={(result) => {
              setSetupOpen(false);
              if (result) {
                showSnackbar(
                  result.failures.length > 0 ? 'error' : 'success',
                  t(
                    result.failures.length > 0
                      ? 'comeback.card.setupPartial'
                      : 'comeback.card.setupDone'
                  )
                );
              }
            }}
          />
        ) : null}
      </AreaLockGate>
    </MasterLayout>
  );
}
