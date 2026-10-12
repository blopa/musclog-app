import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MasterLayout } from '@/components/MasterLayout';
import AddUserMetricEntryModal from '@/components/modals/AddUserMetricEntryModal';
import { CheckinDetailsModal } from '@/components/modals/CheckinDetailsModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import { NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import {
  MACRO_FIELDS,
  MACRO_LABEL_KEYS,
  NutritionReviewSection,
} from '@/components/weeklyReview/NutritionReviewSection';
import { TrainingReviewSection } from '@/components/weeklyReview/TrainingReviewSection';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { type NutritionTargets } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyReviewOverview } from '@/hooks/useWeeklyReviewOverview';
import { NotificationService } from '@/services/NotificationService';
import { formatLocalCalendarDayIso } from '@/utils/calendarDate';
import { getDecimalSeparator, parseLocalizedDecimalString } from '@/utils/localizedDecimalInput';
import { nutritionGoalsToInput, nutritionGoalToInitialValues } from '@/utils/nutritionGoals';

/** Old check-ins shown before "Show all": the history should not bury everything above it. */
const LEGACY_HISTORY_PREVIEW = 4;

const historyLabelKey = (decision?: string | null) => {
  if (decision === 'apply') {
    return 'weeklyReview.applied';
  }
  return decision === 'keep' ? 'weeklyReview.kept' : 'weeklyReview.trainingOnly';
};

export default function CheckinListScreen() {
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
  const [legacyId, setLegacyId] = useState<string | null>(params.checkinId ?? null);
  const { data, legacy, loadError, reload, clear } = useWeeklyReviewOverview(
    selectedReview,
    requestedDay
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(false);
  const [goalEditor, setGoalEditor] = useState(false);
  const [ruleEditor, setRuleEditor] = useState(false);
  /** Local midnight of the reviewed day a weigh-in is being added for, while that entry is open. */
  const [weightDay, setWeightDay] = useState<number | null>(null);
  const [reminder, setReminder] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  useEffect(() => {
    SettingsService.getNotificationsWeeklyReview().then(setReminder);
  }, []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formatDate = (value: number) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(value);
  const decide = async (decision: 'apply' | 'keep', edited?: NutritionTargets) => {
    if (!data || busy) {
      return;
    }

    setBusy(true);
    setError(false);
    try {
      await WeeklyReviewService.decide({
        period: data.period,
        goalId: data.goal?.id,
        section: 'nutrition',
        decision,
        recommendation: data.nutrition ?? undefined,
        accepted:
          decision === 'apply' ? (edited ?? data.nutrition?.targets) : (data.current ?? undefined),
      });

      setEditor(false);
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const reviewTraining = async () => {
    if (!data || busy) {
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await WeeklyReviewService.decide({
        period: data.period,
        goalId: data.goal?.id,
        section: 'training',
      });
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const switchWeekly = async () => {
    if (!data?.goal || busy) {
      return;
    }
    setBusy(true);
    setError(false);
    try {
      await NutritionGoalService.updateGoal(data.goal.id, { targetMode: 'weekly' });
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const changeWeekday = async (day: number) => {
    setError(false);
    try {
      await SettingsService.setReviewWeekday(day);
      await NotificationService.scheduleWeeklyReviewNotification();
      await reload();
    } catch {
      setError(true);
    }
  };

  const toggleReminder = async (value: boolean) => {
    setReminder(value);
    try {
      await SettingsService.setNotificationsWeeklyReview(value);
      await NotificationService.scheduleWeeklyReviewNotification();
    } catch {
      setReminder(!value);
      setError(true);
    }
  };

  const openEditor = () => {
    if (!data?.nutrition) {
      return;
    }
    setDraft(
      Object.fromEntries(
        MACRO_FIELDS.map((field) => [
          field,
          new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 }).format(
            data.nutrition!.targets[field]
          ),
        ])
      )
    );
    setEditor(true);
  };

  const editedTargets = () =>
    Object.fromEntries(
      MACRO_FIELDS.map((field) => [
        field,
        parseLocalizedDecimalString(draft[field] ?? '', getDecimalSeparator(locale)),
      ])
    ) as NutritionTargets;

  const progressDone = [
    !!data?.training.reviewedAt,
    !data || data.intuitive || !data.goal || !!data.review?.nutritionReviewedAt,
  ];

  // One modal at a time: sibling modals break presentation on iOS (see FIXES.md).
  let modal: ReactNode = null;
  if (goalEditor && data?.goal) {
    modal = (
      <NutritionGoalsModal
        visible
        initialGoals={{ ...nutritionGoalToInitialValues(data.goal), ...data.current }}
        onClose={() => setGoalEditor(false)}
        onSave={async (goals) => {
          await NutritionGoalService.saveGoals(nutritionGoalsToInput(goals));
          setGoalEditor(false);
          await reload();
        }}
      />
    );
  } else if (legacyId) {
    modal = (
      <CheckinDetailsModal
        visible
        checkinId={legacyId}
        onClose={() => {
          setLegacyId(null);
          reload();
        }}
      />
    );
  } else if (editor) {
    modal = (
      <BottomPopUp
        visible
        onClose={() => {
          if (!busy) {
            setEditor(false);
          }
        }}
        title={t('weeklyReview.edit')}
        footer={
          <View className="gap-3">
            <Button
              label={t('weeklyReview.applyTomorrow')}
              disabled={busy}
              onPress={() => decide('apply', editedTargets())}
            />
            <Button
              label={t('common.cancel')}
              variant="outline"
              disabled={busy}
              onPress={() => setEditor(false)}
            />
          </View>
        }
      >
        <View className="gap-3 pb-4">
          {MACRO_FIELDS.map((field) => (
            <TextInput
              key={field}
              label={t(MACRO_LABEL_KEYS[field])}
              value={draft[field] ?? ''}
              onChangeText={(value) => setDraft({ ...draft, [field]: value })}
              inputMode="decimal"
              keyboardType="numeric"
            />
          ))}
          {error ? (
            <Text accessibilityRole="alert" className="text-status-error">
              {t('weeklyReview.error')}
            </Text>
          ) : null}
        </View>
      </BottomPopUp>
    );
  } else if (weightDay != null) {
    modal = (
      <AddUserMetricEntryModal
        visible
        initialDate={new Date(weightDay)}
        onClose={() => setWeightDay(null)}
        onSave={reload}
      />
    );
  } else if (ruleEditor && data?.training.next) {
    modal = (
      <CreateWorkoutModal
        visible
        templateId={data.training.next.template.id}
        onClose={() => {
          setRuleEditor(false);
          reload();
        }}
      />
    );
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
          {selectedReview || requestedDay ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelectedReview(undefined);
                setRequestedDay(undefined);
                clear();
              }}
              className="min-h-11 flex-row items-center gap-1 self-start rounded-full bg-bg-overlay px-4"
            >
              <ChevronLeft size={theme.iconSize.sm} color={theme.colors.text.primary} />
              <Text className="text-sm font-semibold text-text-primary">
                {t('weeklyReview.latest')}
              </Text>
            </Pressable>
          ) : null}
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
              <View className="flex-row gap-2">
                {[t('weeklyReview.training'), t('weeklyReview.nutrition')].map((label, index) => (
                  <View
                    key={label}
                    className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-2 ${progressDone[index] ? 'bg-accent-primary/10' : 'bg-bg-overlay'}`}
                  >
                    {progressDone[index] ? (
                      <CheckCircle2 size={theme.iconSize.sm} color={theme.colors.accent.primary} />
                    ) : (
                      <Circle size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                    )}
                    <Text
                      className={`text-sm font-semibold ${progressDone[index] ? 'text-accent-primary' : 'text-text-secondary'}`}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <TrainingReviewSection
                data={data}
                busy={busy}
                onAcknowledge={reviewTraining}
                onPreviewNext={() =>
                  data.training.next &&
                  router.push({
                    pathname: '/app/workout/workouts',
                    params: { previewTemplateId: data.training.next.template.id },
                  })
                }
                onEditPlan={() => setRuleEditor(true)}
              />

              <NutritionReviewSection
                data={data}
                busy={busy}
                onApply={() => decide('apply')}
                onKeep={() => decide('keep')}
                onEdit={openEditor}
                onSwitchWeekly={switchWeekly}
                onEditGoal={() => setGoalEditor(true)}
                onLogWeight={setWeightDay}
                onLogFood={(day) =>
                  router.push({
                    pathname: '/app/nutrition/food',
                    params: { date: formatLocalCalendarDayIso(new Date(day)) },
                  })
                }
              />

              <View className="gap-3 rounded-2xl border border-border-light bg-bg-card p-4">
                <Text className="text-base font-bold text-text-primary">
                  {t('weeklyReview.settings')}
                </Text>
                <Text className="text-sm text-text-secondary">{t('weeklyReview.weekday')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {Array.from({ length: 7 }, (_, offset) => (offset + 1) % 7).map((day) => (
                    <Pressable
                      key={day}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: data.weekday === day }}
                      onPress={() => changeWeekday(day)}
                      className={`min-h-11 min-w-11 items-center justify-center rounded-full px-3 ${data.weekday === day ? 'bg-accent-primary' : 'bg-bg-overlay'}`}
                    >
                      <Text
                        className={`text-sm font-semibold ${data.weekday === day ? 'text-text-on-accent' : 'text-text-primary'}`}
                      >
                        {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
                          new Date(2024, 0, 7 + day)
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
                    <Pressable
                      key={review.id}
                      accessibilityRole="button"
                      onPress={() => {
                        clear();
                        setSelectedReview(review.id);
                      }}
                      className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border-light bg-bg-card px-4 py-3"
                    >
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold text-text-primary">
                          {t('weeklyReview.period', {
                            start: formatDate(review.periodStart),
                            end: formatDate(review.periodEnd - 1),
                          })}
                        </Text>
                        <Text className="text-sm text-text-secondary">
                          {t(historyLabelKey(review.nutritionDecision))}
                        </Text>
                      </View>
                      <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                    </Pressable>
                  ))}
                  {(showAllHistory ? legacy : legacy.slice(0, LEGACY_HISTORY_PREVIEW)).map(
                    (review) => (
                      <Pressable
                        key={review.id}
                        accessibilityRole="button"
                        onPress={() => setLegacyId(review.id)}
                        className="min-h-14 flex-row items-center gap-3 rounded-xl border border-border-light bg-bg-card px-4 py-3"
                      >
                        <Text className="flex-1 text-text-primary">
                          {t('weeklyReview.legacy')} · {formatDate(review.checkinDate)}
                        </Text>
                        <ChevronRight size={theme.iconSize.sm} color={theme.colors.text.tertiary} />
                      </Pressable>
                    )
                  )}
                  {legacy.length > LEGACY_HISTORY_PREVIEW ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllHistory }}
                      onPress={() => setShowAllHistory(!showAllHistory)}
                      className="min-h-11 justify-center"
                    >
                      <Text className="text-sm font-semibold text-accent-primary">
                        {showAllHistory
                          ? t('weeklyReview.showFewer')
                          : t('weeklyReview.showAll', { count: formatInteger(legacy.length) })}
                      </Text>
                    </Pressable>
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
