import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MasterLayout } from '@/components/MasterLayout';
import { CheckinDetailsModal } from '@/components/modals/CheckinDetailsModal';
import CreateWorkoutModal from '@/components/modals/CreateWorkoutModal';
import { NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { WorkoutRecommendationList } from '@/components/workout/WorkoutRecommendationList';
import { NutritionCheckinService } from '@/database/services/NutritionCheckinService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import {
  nutritionTargetMode,
  type NutritionTargets,
  NutritionTargetService,
} from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useWeeklyReviewStatus } from '@/hooks/useWeeklyReviewStatus';
import { NotificationService } from '@/services/NotificationService';
import { formatDisplayWeightKg } from '@/utils/formatDisplayWeight';
import { getDecimalSeparator, parseLocalizedDecimalString } from '@/utils/localizedDecimalInput';
import { nutritionGoalsToInput, nutritionGoalToInitialValues } from '@/utils/nutritionGoals';

type Overview = Awaited<ReturnType<typeof WeeklyReviewService.overview>>;
const macroFields = ['totalCalories', 'protein', 'carbs', 'fats', 'fiber'] as const;

export default function CheckinListScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { units } = useSettings();
  const router = useRouter();
  const params = useLocalSearchParams<{
    reviewId?: string;
    checkinId?: string;
    reviewDay?: string;
  }>();
  const status = useWeeklyReviewStatus();
  const [selectedReview, setSelectedReview] = useState<string | undefined>(params.reviewId);
  const [requestedDay, setRequestedDay] = useState(params.reviewDay);
  const [legacyId, setLegacyId] = useState<string | null>(params.checkinId ?? null);
  const [legacy, setLegacy] = useState<
    Awaited<ReturnType<typeof NutritionCheckinService.getHistory>>
  >([]);
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(false);
  const [goalEditor, setGoalEditor] = useState(false);
  const [ruleEditor, setRuleEditor] = useState(false);
  const [reminder, setReminder] = useState(false);
  useEffect(() => {
    SettingsService.getNotificationsWeeklyReview().then(setReminder);
  }, []);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const formatDate = (value: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value);
  const formatNumber = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const reload = useCallback(async () => {
    try {
      const [next, old] = await Promise.all([
        WeeklyReviewService.overview(
          selectedReview,
          requestedDay && Number.isFinite(Number(requestedDay))
            ? new Date(Number(requestedDay))
            : undefined
        ),
        NutritionCheckinService.getHistory(30),
      ]);
      setLoadError(false);
      setData(next);
      setLegacy(old);
    } catch {
      setLoadError(true);
    }
  }, [selectedReview, requestedDay]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload, status?.reviewed, status?.next]);
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
  const openEditor = () => {
    if (!data?.nutrition) {
      return;
    }
    setDraft(
      Object.fromEntries(
        macroFields.map((field) => [
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
      macroFields.map((field) => [
        field,
        parseLocalizedDecimalString(draft[field] ?? '', getDecimalSeparator(locale)),
      ])
    ) as NutritionTargets;
  return (
    <MasterLayout>
      <KeyboardAwareScrollView
        bottomOffset={16}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-5" testID="weekly-review">
          <Text className="text-3xl font-bold text-text-primary">{t('weeklyReview.title')}</Text>
          {selectedReview || requestedDay ? (
            <Button
              label={t('weeklyReview.latest')}
              variant="outline"
              onPress={() => {
                setSelectedReview(undefined);
                setRequestedDay(undefined);
                setData(null);
              }}
            />
          ) : null}
          {!data && !loadError ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}
          {error || loadError ? (
            <View className="gap-2 rounded-xl bg-bg-card p-4">
              <Text accessibilityRole="alert" className="text-status-error">
                {t(error ? 'weeklyReview.error' : 'errors.somethingWentWrong')}
              </Text>
              <Button label={t('common.tryAgain')} onPress={reload} />
            </View>
          ) : null}
          {data ? (
            <>
              <Text className="text-sm text-text-secondary">
                {t('weeklyReview.period', {
                  start: formatDate(data.period.start),
                  end: formatDate(data.period.end - 1),
                })}
              </Text>
              <View className="gap-2">
                <Text className="text-sm text-text-secondary">{t('weeklyReview.weekday')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {Array.from({ length: 7 }, (_, day) => (
                    <Pressable
                      key={day}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: data.weekday === day }}
                      onPress={async () => {
                        await SettingsService.setReviewWeekday(day);
                        await NotificationService.scheduleWeeklyReviewNotification();
                        await reload();
                      }}
                      className={`min-h-12 justify-center rounded-xl px-3 ${data.weekday === day ? 'bg-accent-primary10' : 'bg-bg-cardElevated'}`}
                    >
                      <Text className="text-text-primary">
                        {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
                          new Date(2024, 0, 7 + day)
                        )}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View className="gap-4 rounded-2xl bg-bg-card p-4" testID="review-training">
                <Text className="text-xl font-bold text-text-primary">
                  {t('weeklyReview.training')}
                </Text>
                <Text className="text-text-primary">
                  {t('weeklyReview.trainingSummary', {
                    workouts: data.training.workouts.length,
                    sets: data.training.workingSets,
                    volume: formatNumber(data.training.volume),
                  })}
                </Text>
                {data.training.records.map((record, index) => (
                  <Text
                    key={`${record.exerciseId}-${record.type}-${index}`}
                    className="text-accent-primary"
                  >
                    {t('weeklyReview.pr', {
                      exercise: record.exerciseName,
                      type: t(`weeklyReview.prTypes.${record.type}`),
                      weight: formatDisplayWeightKg(locale, units, record.newRecord.weight),
                      reps: record.newRecord.reps,
                      unit: units === 'imperial' ? 'lb' : 'kg',
                    })}
                  </Text>
                ))}
                <Text className="text-sm text-text-secondary">
                  {t('weeklyReview.trainingHint')}
                </Text>
                {data.training.next ? (
                  <>
                    <Button
                      label={t('weeklyReview.nextWorkout', {
                        name: data.training.next.template.name,
                      })}
                      variant="outline"
                      onPress={() =>
                        router.push({
                          pathname: '/app/workout/workouts',
                          params: { previewTemplateId: data.training.next!.template.id },
                        })
                      }
                    />
                    <Button
                      label={t('progression.editPlan')}
                      variant="outline"
                      onPress={() => setRuleEditor(true)}
                    />
                    <WorkoutRecommendationList recommendations={data.training.targets} />
                  </>
                ) : (
                  <Text className="text-text-secondary">{t('weeklyReview.noWorkout')}</Text>
                )}
                <Button
                  label={t(
                    data.training.reviewedAt ? 'weeklyReview.reviewed' : 'weeklyReview.acknowledge'
                  )}
                  onPress={reviewTraining}
                  disabled={busy || !!data.training.reviewedAt}
                />
              </View>
              {!data.intuitive ? (
                <View className="gap-4 rounded-2xl bg-bg-card p-4" testID="review-nutrition">
                  <Text className="text-xl font-bold text-text-primary">
                    {t('weeklyReview.nutrition')}
                  </Text>
                  {data.goal && data.current ? (
                    <>
                      <Text className="text-sm text-accent-primary">
                        {t(`weeklyReview.modes.${nutritionTargetMode(data.goal)}`)}
                      </Text>
                      {data.trendWeight != null ? (
                        <Text className="text-text-primary">
                          {t('weeklyReview.trendWeight', {
                            weight: formatDisplayWeightKg(locale, units, data.trendWeight),
                            unit: units === 'imperial' ? 'lb' : 'kg',
                          })}
                        </Text>
                      ) : null}
                      <Text className="text-sm text-text-secondary">
                        {t('weeklyReview.coverage', {
                          food: data.nutrition?.foodDays ?? 0,
                          weight: data.nutrition?.weightDays ?? 0,
                        })}
                      </Text>
                      <View className="flex-row justify-between">
                        <Text className="text-text-secondary">{t('weeklyReview.current')}</Text>
                        <Text className="text-text-secondary">{t('weeklyReview.recommended')}</Text>
                      </View>
                      {macroFields.map((field) => (
                        <View key={field} className="flex-row justify-between gap-2">
                          <Text className="text-text-primary">
                            {t(`weeklyReview.macros.${field}`)}:{' '}
                            {formatNumber(data.current![field])}
                          </Text>
                          <Text className="font-semibold text-accent-primary">
                            {formatNumber(data.nutrition?.targets[field] ?? data.current![field])}
                          </Text>
                        </View>
                      ))}
                      <Text className="text-sm text-text-secondary">
                        {t(
                          !data.nutrition?.canApply
                            ? 'weeklyReview.collectData'
                            : data.nutrition.usedEmpiricalData
                              ? 'weeklyReview.empiricalReason'
                              : 'weeklyReview.baselineReason'
                        )}
                      </Text>
                      {data.review?.nutritionReviewedAt ? (
                        <View className="gap-2">
                          <Text className="font-semibold text-accent-primary">
                            {t(
                              data.review.nutritionDecision === 'apply'
                                ? 'weeklyReview.applied'
                                : 'weeklyReview.kept'
                            )}
                          </Text>
                          {data.accepted ? (
                            <Text className="text-text-primary">
                              {t('weeklyReview.acceptedTargets', {
                                calories: formatNumber(data.accepted.totalCalories),
                                protein: formatNumber(data.accepted.protein),
                                carbs: formatNumber(data.accepted.carbs),
                                fats: formatNumber(data.accepted.fats),
                                fiber: formatNumber(data.accepted.fiber),
                              })}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <>
                          {nutritionTargetMode(data.goal) !== 'weekly' ? (
                            <Button
                              label={t('weeklyReview.switchWeekly')}
                              variant="outline"
                              disabled={busy}
                              onPress={async () => {
                                setBusy(true);
                                try {
                                  await NutritionTargetService.switchMode(data.goal!.id, 'weekly');
                                  await reload();
                                } catch {
                                  setError(true);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            />
                          ) : (
                            <Button
                              label={t('weeklyReview.applyTomorrow')}
                              onPress={() => decide('apply')}
                              disabled={busy || !data.nutrition?.canApply}
                            />
                          )}
                          <Button
                            label={t('weeklyReview.keep')}
                            variant="outline"
                            onPress={() => decide('keep')}
                            disabled={busy}
                          />
                          <Button
                            label={t('weeklyReview.edit')}
                            variant="outline"
                            onPress={openEditor}
                            disabled={
                              busy ||
                              !data.nutrition?.canApply ||
                              nutritionTargetMode(data.goal) !== 'weekly'
                            }
                          />
                        </>
                      )}
                      {!data.nutrition?.canApply ? (
                        <View className="gap-2">
                          <Button
                            label={t('weeklyReview.logWeight')}
                            variant="outline"
                            onPress={() => router.push('/app/progress')}
                          />
                          <Button
                            label={t('weeklyReview.logFood')}
                            variant="outline"
                            onPress={() => router.push('/app/nutrition/food')}
                          />
                        </View>
                      ) : null}
                      <Button
                        label={t('weeklyReview.editGoal')}
                        variant="outline"
                        onPress={() => setGoalEditor(true)}
                      />
                    </>
                  ) : (
                    <Text className="text-text-secondary">{t('weeklyReview.noGoal')}</Text>
                  )}
                </View>
              ) : (
                <Text className="text-text-secondary">{t('weeklyReview.intuitive')}</Text>
              )}
              <ToggleInput
                items={[
                  {
                    key: 'weekly-review',
                    label: t('weeklyReview.reminder'),
                    value: reminder,
                    onValueChange: async (value) => {
                      await SettingsService.setNotificationsWeeklyReview(value);
                      setReminder(value);
                      await NotificationService.scheduleWeeklyReviewNotification();
                    },
                  },
                ]}
              />
              <Text className="text-xl font-bold text-text-primary">
                {t('weeklyReview.history')}
              </Text>
              {data.reviews.map((review) => (
                <Pressable
                  key={review.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setData(null);
                    setSelectedReview(review.id);
                  }}
                  className="min-h-16 justify-center rounded-xl bg-bg-card p-4"
                >
                  <Text className="font-semibold text-text-primary">
                    {formatDate(review.periodEnd)}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {t(
                      review.nutritionDecision === 'apply'
                        ? 'weeklyReview.applied'
                        : review.nutritionDecision === 'keep'
                          ? 'weeklyReview.kept'
                          : 'weeklyReview.training'
                    )}
                  </Text>
                </Pressable>
              ))}
              {legacy.map((review) => (
                <Pressable
                  key={review.id}
                  accessibilityRole="button"
                  onPress={() => setLegacyId(review.id)}
                  className="min-h-16 justify-center rounded-xl bg-bg-card p-4"
                >
                  <Text className="text-text-primary">
                    {t('weeklyReview.legacy')} · {formatDate(review.checkinDate)}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
      {goalEditor && data?.goal ? (
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
      ) : legacyId ? (
        <CheckinDetailsModal
          visible
          checkinId={legacyId}
          onClose={() => {
            setLegacyId(null);
            reload();
          }}
        />
      ) : editor ? (
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
            {macroFields.map((field) => (
              <TextInput
                key={field}
                label={t(`weeklyReview.macros.${field}`)}
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
      ) : ruleEditor && data?.training.next ? (
        <CreateWorkoutModal
          visible
          templateId={data.training.next.template.id}
          onClose={() => {
            setRuleEditor(false);
            reload();
          }}
        />
      ) : null}
    </MasterLayout>
  );
}
