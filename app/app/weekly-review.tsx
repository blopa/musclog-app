import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, Circle } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MasterLayout } from '@/components/MasterLayout';
import AddUserMetricEntryModal from '@/components/modals/AddUserMetricEntryModal';
import { CheckinDetailsModal } from '@/components/modals/CheckinDetailsModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { ListRow } from '@/components/theme/ListRow';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { WeekdayChoiceChips } from '@/components/WeekdayChoiceChips';
import { NutritionReviewSection } from '@/components/weeklyReview/NutritionReviewSection';
import { TargetsEditorSheet } from '@/components/weeklyReview/TargetsEditorSheet';
import { historyLabelKeys } from '@/components/weeklyReview/trainingDecisionCopy';
import { TrainingReviewSection } from '@/components/weeklyReview/TrainingReviewSection';
import { WeeklyReviewWelcome } from '@/components/weeklyReview/WeeklyReviewWelcome';
import { SETTINGS } from '@/constants/settingDefinitions';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { type NutritionTargets } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyReviewOverview } from '@/hooks/useWeeklyReviewOverview';
import { NutritionNotificationService } from '@/services/NutritionNotificationService';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import { nutritionGoalsToInput, nutritionGoalToInitialValues } from '@/utils/nutritionGoals';
import type { TrainingDecision } from '@/utils/trainingWeekDecision';
import { hasWeeklyActivity, shouldShowWeeklyReviewWelcome } from '@/utils/weeklyReviewEmptyState';

/** Old check-ins shown before "Show all": the history should not bury everything above it. */
const LEGACY_HISTORY_PREVIEW = 4;

/**
 * The one sheet or modal open over the review. One value instead of a flag per sheet: two of them
 * could never be up at once anyway (sibling modals break presentation on iOS, see FIXES.md), and a
 * union makes "which one is open" a single question with a single answer.
 */
type ReviewPanel =
  | { kind: 'editTargets' }
  | { kind: 'editGoal' }
  | { kind: 'editRules' }
  | { kind: 'fitnessGoals' }
  | { kind: 'logWeight'; day: number }
  | { kind: 'legacyCheckin'; id: string };

export default function WeeklyReviewScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const router = useRouter();
  const params = useLocalSearchParams<{
    reviewId?: string;
    checkinId?: string;
    reviewDay?: string;
  }>();
  const [selectedReview, setSelectedReview] = useState<string | undefined>(params.reviewId);
  const [requestedDay, setRequestedDay] = useState(params.reviewDay);
  const { data, legacy, loadError, reload } = useWeeklyReviewOverview(selectedReview, requestedDay);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<ReviewPanel | null>(
    params.checkinId ? { kind: 'legacyCheckin', id: params.checkinId } : null
  );
  const closePanel = () => setPanel(null);
  const [reminder, setReminder] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  /** `null` until read, so the welcome cannot flash for someone who already dismissed it. */
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  useEffect(() => {
    SettingsService.get(SETTINGS.notificationsWeeklyReview)
      .then(setReminder)
      .catch(() => setReminder(false));
    SettingsService.get(SETTINGS.weeklyReviewWelcomeSeen)
      .then(setWelcomeSeen)
      .catch(() => setWelcomeSeen(true));
  }, []);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formatDate = (value: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(value);
  /**
   * Every decision on this screen is one write followed by a reload, behind the same busy flag and
   * the same error banner. `afterSuccess` runs only once the write went through.
   */
  const run = async (work: () => Promise<unknown>, afterSuccess?: () => void) => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(false);
    try {
      await work();
      afterSuccess?.();
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  /** Applies the recommendation (or the user's edit of it); only possible when there is one. */
  const apply = (edited?: NutritionTargets) => {
    const goal = data?.goal;
    const recommendation = data?.nutrition;
    if (!data || !goal || !recommendation) {
      return;
    }

    void run(
      () =>
        WeeklyReviewService.decide({
          period: data.period,
          goalId: goal.id,
          section: 'nutrition',
          decision: 'apply',
          recommendation,
          accepted: edited ?? recommendation.targets,
        }),
      closePanel
    );
  };

  /** Keeps the current targets: the review is closed and nothing changes. */
  const keep = () => {
    const goal = data?.goal;
    if (!data || !goal) {
      return;
    }

    void run(
      () =>
        WeeklyReviewService.decide({
          period: data.period,
          goalId: goal.id,
          section: 'nutrition',
          decision: 'keep',
          recommendation: data.nutrition ?? undefined,
          accepted: data.current ?? undefined,
        }),
      closePanel
    );
  };

  const reviewTraining = (decision: TrainingDecision) =>
    data &&
    run(() =>
      WeeklyReviewService.decide({
        period: data.period,
        goalId: data.goal?.id,
        section: 'training',
        training: { decision, ...data.training.proposal },
      })
    );

  const changeConsistencyGoal = (sessionsPerWeek: number) =>
    run(() =>
      ExerciseGoalService.saveGoal({
        goalType: 'consistency',
        targetSessionsPerWeek: sessionsPerWeek,
      })
    );

  const switchWeekly = () =>
    data?.goal &&
    run(() => NutritionGoalService.updateGoal(data.goal!.id, { targetMode: 'weekly' }));

  const changeWeekday = async (day: number) => {
    setError(false);
    try {
      await SettingsService.set(SETTINGS.reviewWeekday, day);
      await NutritionNotificationService.scheduleWeeklyReviewNotification();
      await reload();
    } catch {
      setError(true);
    }
  };

  const toggleReminder = async (value: boolean) => {
    setReminder(value);
    try {
      await SettingsService.set(SETTINGS.notificationsWeeklyReview, value);
      await NutritionNotificationService.scheduleWeeklyReviewNotification();
    } catch {
      setReminder(!value);
      setError(true);
    }
  };

  const openEditor = () => {
    if (data?.nutrition) {
      setError(false);
      setPanel({ kind: 'editTargets' });
    }
  };

  /** Where each half of the review stands; a status line, not a control. */
  const progress = [
    {
      key: 'training',
      label: t('weeklyReview.training'),
      done: !!data?.training.reviewedAt || !data?.activity.everWorkout,
    },
    {
      key: 'nutrition',
      label: t('weeklyReview.nutrition'),
      done: !data || data.intuitive || !data.goal || !!data.review?.nutritionReviewedAt,
    },
  ];

  const viewingLatest = !selectedReview && !requestedDay;
  const reviewable = !!data && hasWeeklyActivity(data.activity);
  const dismissWelcome = () => {
    setWelcomeSeen(true);
    SettingsService.set(SETTINGS.weeklyReviewWelcomeSeen, true).catch(() => {});
  };

  /** The sheet or modal for the open panel; `null` when its data has gone away underneath it. */
  const renderPanel = (open: ReviewPanel): ReactNode => {
    switch (open.kind) {
      case 'editGoal':
        return data?.goal ? (
          <NutritionGoalsModal
            visible
            initialGoals={{ ...nutritionGoalToInitialValues(data.goal), ...data.current }}
            onClose={closePanel}
            onSave={async (goals) => {
              await NutritionGoalService.saveGoals(nutritionGoalsToInput(goals));
              closePanel();
              await reload();
            }}
          />
        ) : null;
      case 'legacyCheckin':
        return (
          <CheckinDetailsModal
            visible
            checkinId={open.id}
            onClose={() => {
              closePanel();
              reload();
            }}
          />
        );
      case 'editTargets':
        return data?.nutrition ? (
          <TargetsEditorSheet
            initial={data.nutrition.targets}
            busy={busy}
            saveFailed={error}
            onApply={apply}
            onClose={closePanel}
          />
        ) : null;
      case 'logWeight':
        return (
          <AddUserMetricEntryModal
            visible
            initialDate={new Date(open.day)}
            onClose={closePanel}
            onSave={reload}
          />
        );
      case 'fitnessGoals':
        return (
          <GoalsManagementModal
            visible
            tab="fitness"
            onClose={() => {
              closePanel();
              reload();
            }}
          />
        );
      case 'editRules':
        return data?.training.next ? (
          <CreateWorkoutModal
            visible
            templateId={data.training.next.template.id}
            onClose={() => {
              closePanel();
              reload();
            }}
          />
        ) : null;
    }
  };

  // One modal at a time: sibling modals break presentation on iOS (see FIXES.md).
  let modal: ReactNode = null;
  if (
    data &&
    welcomeSeen !== null &&
    shouldShowWeeklyReviewWelcome({ seen: welcomeSeen, activity: data.activity, viewingLatest })
  ) {
    modal = (
      <WeeklyReviewWelcome
        weekdayLabel={new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(data.period.next)}
        onClose={dismissWelcome}
      />
    );
  } else if (panel) {
    modal = renderPanel(panel);
  }

  return (
    <MasterLayout>
      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5" testID="weekly-review">
          <View className="gap-1">
            <Text className="text-3xl font-bold text-text-primary">{t('weeklyReview.title')}</Text>
            {data ? (
              <>
                <Text className="text-base font-semibold text-text-secondary">
                  {t('weeklyReview.period', {
                    start: formatDate(data.period.start),
                    end: formatDate(data.period.end - 1),
                  })}
                </Text>
                <Text className="text-xs text-text-tertiary">{t('weeklyReview.periodHint')}</Text>
              </>
            ) : null}
          </View>
          {viewingLatest ? null : (
            <Chip
              variant="solid"
              role="button"
              icon={ChevronLeft}
              label={t('weeklyReview.latest')}
              onPress={() => {
                setSelectedReview(undefined);
                setRequestedDay(undefined);
              }}
            />
          )}
          {!data && !loadError ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}
          {error || loadError ? (
            <View className="gap-3 rounded-2xl border border-status-error bg-bg-card p-4">
              <Text accessibilityRole="alert" className="text-sm text-status-error">
                {t(error ? 'weeklyReview.error' : 'errors.somethingWentWrong')}
              </Text>
              <Button label={t('common.tryAgain')} variant="outline" onPress={reload} />
            </View>
          ) : null}
          {data ? (
            <>
              {reviewable ? (
                // Plain status, deliberately not pill-shaped: filled pills read as tabs, and these
                // cannot be tapped.
                <View
                  className="flex-row flex-wrap items-center gap-x-4 gap-y-1"
                  accessibilityRole="summary"
                >
                  {progress.map((half) => (
                    <View key={half.key} className="flex-row items-center gap-1.5">
                      {half.done ? (
                        <CheckCircle2
                          size={theme.iconSize.sm}
                          color={theme.colors.accent.primary}
                        />
                      ) : (
                        <Circle size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                      )}
                      <Text
                        className={`text-sm ${half.done ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                      >
                        {t(
                          half.done
                            ? 'weeklyReview.halfStatus.done'
                            : 'weeklyReview.halfStatus.open',
                          { half: half.label }
                        )}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {!reviewable && viewingLatest && !data.reviews.length ? (
                // Nothing logged in the reviewed week and no review yet: say when there will be.
                <Text className="text-sm text-text-secondary" testID="review-first-date">
                  {t('weeklyReview.empty.firstReviewOn', {
                    date: new Intl.DateTimeFormat(locale, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    }).format(data.period.next),
                  })}
                </Text>
              ) : null}

              <TrainingReviewSection
                data={data}
                busy={busy}
                onDecide={reviewTraining}
                onChangeConsistencyGoal={changeConsistencyGoal}
                onOpenGoals={() => setPanel({ kind: 'fitnessGoals' })}
                onPreviewNext={() =>
                  data.training.next &&
                  router.push({
                    pathname: '/app/workout/workouts',
                    params: { previewTemplateId: data.training.next.template.id },
                  })
                }
                onEditPlan={() => setPanel({ kind: 'editRules' })}
                onLogWorkout={() => router.push('/app/workout/workouts')}
              />

              <NutritionReviewSection
                data={data}
                busy={busy}
                onApply={() => apply()}
                onKeep={keep}
                onEdit={openEditor}
                onSwitchWeekly={switchWeekly}
                onEditGoal={() => setPanel({ kind: 'editGoal' })}
                onLogWeight={(day) => setPanel({ kind: 'logWeight', day })}
                onLogFood={(day) =>
                  router.push({
                    pathname: '/app/nutrition/food',
                    params: { date: formatLocalCalendarDayIso(new Date(day)) },
                  })
                }
                onLogFirstMeal={() => router.push('/app/nutrition/food')}
              />

              <View className="gap-3 rounded-2xl border border-border-light bg-bg-card p-4">
                <Text className="text-base font-bold text-text-primary">
                  {t('weeklyReview.settings')}
                </Text>
                <Text className="text-sm text-text-secondary">{t('weeklyReview.weekday')}</Text>
                <WeekdayChoiceChips value={data.weekday} onChange={changeWeekday} />
                <ToggleInput
                  items={[
                    {
                      key: 'weekly-review',
                      label: t('weeklyReview.reminder'),
                      value: reminder,
                      onValueChange: toggleReminder,
                    },
                  ]}
                />
              </View>

              {data.reviews.length || legacy.length ? (
                <View className="gap-2">
                  <Text className="text-lg font-bold text-text-primary">
                    {t('weeklyReview.history')}
                  </Text>
                  {data.reviews.map((review) => (
                    <ListRow
                      key={review.id}
                      variant="card"
                      title={t('weeklyReview.period', {
                        start: formatDate(review.periodStart),
                        end: formatDate(review.periodEnd - 1),
                      })}
                      subtitle={historyLabelKeys(review)
                        .map((key) => t(key))
                        .join(' · ')}
                      onPress={() => setSelectedReview(review.id)}
                    />
                  ))}
                  {(showAllHistory ? legacy : legacy.slice(0, LEGACY_HISTORY_PREVIEW)).map(
                    (review) => (
                      <ListRow
                        key={review.id}
                        variant="card"
                        title={`${t('weeklyReview.legacy')} · ${formatDate(review.checkinDate)}`}
                        onPress={() => setPanel({ kind: 'legacyCheckin', id: review.id })}
                      />
                    )
                  )}
                  {legacy.length > LEGACY_HISTORY_PREVIEW ? (
                    <TextButton
                      accessibilityState={{ expanded: showAllHistory }}
                      onPress={() => setShowAllHistory(!showAllHistory)}
                      label={
                        showAllHistory
                          ? t('weeklyReview.showFewer')
                          : t('weeklyReview.showAll', { count: formatInteger(legacy.length) })
                      }
                    />
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
      {modal}
    </MasterLayout>
  );
}
