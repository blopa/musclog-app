import { differenceInCalendarDays, format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { CurrentGoalsCard } from '@/components/cards/CurrentGoalsCard';
import { GoalHistoryCard } from '@/components/cards/GoalHistoryCard';
import { Button } from '@/components/theme/Button';
import { type EatingPhase } from '@/database/models';
import NutritionGoal from '@/database/models/NutritionGoal';
import { NutritionGoalService } from '@/database/services';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useDefaultNutritionGoals } from '@/hooks/useDefaultNutritionGoals';
import { useTheme } from '@/hooks/useTheme';
import { convertEatingPhaseToUI, type EatingPhaseUI } from '@/types/EatingPhaseUI';
import { localDayStartMs } from '@/utils/calendarDate';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import {
  calculateMacros,
  fiberFromCalories,
  getEffectiveKcalPerKgGain,
  getEffectiveKcalPerKgWeightLoss,
  getMinCalories,
} from '@/utils/nutritionCalculator';
import { captureException } from '@/utils/sentry';
import { showSnackbar } from '@/utils/snackbarService';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { GoalCreationMethodModal } from './GoalCreationMethodModal';
import { GoalWizardModal } from './GoalWizardModal';
import {
  NutritionGoals,
  NutritionGoalsInitialValues,
  NutritionGoalsModal,
} from './NutritionGoalsModal';

interface GoalHistoryItem {
  id: number;
  dateRange: string;
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat?: number | null;
}

interface CurrentGoal {
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number | null;
  ffmi?: number | null;
  bmi?: number | null;
  goalDate?: string;
}

type GoalsManagementModalProps = {
  visible: boolean;
  onClose: () => void;
};

function goalToFormData(goal: NutritionGoal): NutritionGoalsInitialValues {
  return {
    totalCalories: goal.totalCalories,
    protein: goal.protein,
    carbs: goal.carbs,
    fats: goal.fats,
    fiber: goal.fiber,
    eatingPhase: goal.eatingPhase as EatingPhase,
    targetWeight: goal.targetWeight,
    targetBodyFat: goal.targetBodyFat,
    targetBMI: goal.targetBmi,
    targetFFMI: goal.targetFfmi,
    targetDate: goal.targetDate ?? null,
  };
}

export default function GoalsManagementModal({ visible, onClose }: GoalsManagementModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const [creationMethodModalVisible, setCreationMethodModalVisible] = useState(false);
  const [wizardModalVisible, setWizardModalVisible] = useState(false);
  const [nutritionGoalsModalVisible, setNutritionGoalsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<NutritionGoal | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<NutritionGoal | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pendingWizardPrefill, setPendingWizardPrefill] = useState<Partial<NutritionGoals> | null>(
    null
  );

  useEffect(() => {
    if (!visible) {
      setCreationMethodModalVisible(false);
      setWizardModalVisible(false);
      setNutritionGoalsModalVisible(false);
      setConfirmDeleteVisible(false);
      setSelectedGoal(null);
    }
  }, [visible]);

  const { goals, current, isLoading, refresh } = useCurrentNutritionGoal({
    mode: 'history',
    visible,
  });

  const currentGoal = useMemo<CurrentGoal | null>(() => {
    if (!current) {
      return null;
    }

    return {
      phase: convertEatingPhaseToUI(current.eatingPhase),
      calories: current.totalCalories,
      protein: current.protein,
      carbs: current.carbs,
      fat: current.fats,
      targetWeight: current.targetWeight,
      bodyFat: current.targetBodyFat,
      bmi: current.targetBmi,
      ffmi: current.targetFfmi,
      goalDate: current.targetDate
        ? format(new Date(current.targetDate), 'MMM d, yyyy', { locale: dateFnsLocale })
        : undefined,
    };
  }, [current, dateFnsLocale]);

  const currentGoalsData = useMemo<NutritionGoalsInitialValues | undefined>(() => {
    if (!current) {
      return undefined;
    }
    return goalToFormData(current);
  }, [current]);

  const defaultEatingPhase =
    pendingWizardPrefill?.eatingPhase ?? currentGoalsData?.eatingPhase ?? 'maintain';
  const { defaults: computedDefaults, planData } = useDefaultNutritionGoals(defaultEatingPhase);

  // Keep raw NutritionGoal alongside display data to enable edit/delete
  const historyWithRaw = useMemo(
    () =>
      goals
        .filter((goal) => goal.effectiveUntil !== null)
        .map((goal, index) => {
          const startDate = new Date(goal.createdAt);
          const endDate = goal.effectiveUntil ? new Date(goal.effectiveUntil) : new Date();
          const dateRange =
            format(startDate, 'MMM d', { locale: dateFnsLocale }) ===
            format(endDate, 'MMM d', { locale: dateFnsLocale })
              ? format(startDate, 'MMM d, yyyy', { locale: dateFnsLocale })
              : `${format(startDate, 'MMM d', { locale: dateFnsLocale })} - ${format(endDate, 'MMM d, yyyy', { locale: dateFnsLocale })}`;

          const display: GoalHistoryItem = {
            id: parseInt(goal.id, 10) || index,
            dateRange,
            phase: convertEatingPhaseToUI(goal.eatingPhase),
            calories: goal.totalCalories,
            protein: goal.protein,
            carbs: goal.carbs,
            fat: goal.fats,
            weight: goal.targetWeight,
            bodyFat: goal.targetBodyFat,
          };

          return { display, raw: goal };
        }),
    [goals, dateFnsLocale]
  );

  const handleNewGoal = () => {
    setSelectedGoal(null);
    setIsEditing(false);
    setCreationMethodModalVisible(true);
  };

  const handleSelectManualCreation = () => {
    setCreationMethodModalVisible(false);
    setNutritionGoalsModalVisible(true);
  };

  const handleSelectAutoCalculate = () => {
    setCreationMethodModalVisible(false);
    setSelectedGoal(null);
    setIsEditing(false);
    setPendingWizardPrefill(computedDefaults);
    setNutritionGoalsModalVisible(true);
  };

  const handleSelectGuidedCreation = () => {
    setCreationMethodModalVisible(false);
    setWizardModalVisible(true);
  };

  const handleWizardComplete = (prefill: Partial<NutritionGoals>) => {
    setWizardModalVisible(false);
    // Merge wizard answers into the form's initial goals (but don't overwrite
    // any values that are already set from a previous goal).
    setSelectedGoal(null);
    setIsEditing(false);
    // Pass prefill via currentGoalsData override — achieved by storing it temporarily
    // in selectedGoal's form data. We use a local state for the one-shot prefill.
    setPendingWizardPrefill(prefill);
    setNutritionGoalsModalVisible(true);
  };

  const handleEditGoal = (goal: NutritionGoal) => {
    setSelectedGoal(goal);
    setIsEditing(true);
    setNutritionGoalsModalVisible(true);
  };

  const handleDeleteGoal = (goal: NutritionGoal) => {
    setGoalToDelete(goal);
    setConfirmDeleteVisible(true);
  };

  const handleRegenerateCheckins = async (goal: NutritionGoal) => {
    setIsRegenerating(true);
    // Use setTimeout to ensure the UI has time to update the loading state
    // and show the loading indicator before starting the heavy DB operations
    setTimeout(async () => {
      try {
        await NutritionGoalService.regenerateCheckins(goal.id);
      } catch (error) {
        console.error('Error regenerating check-ins:', error);
        captureException(error, {
          data: { context: 'GoalsManagementModal.handleRegenerateCheckins' },
        });
        showSnackbar('error', t('errors.somethingWentWrong'));
      } finally {
        setIsRegenerating(false);
      }
    }, 100);
  };

  const handleConfirmDelete = async () => {
    if (!goalToDelete) {
      return;
    }

    setIsDeletingGoal(true);
    await flushLoadingPaint();
    try {
      await NutritionGoalService.deleteGoal(goalToDelete.id);
      await refresh();
    } catch (error) {
      console.error('Error deleting nutrition goal:', error);
      captureException(error, { data: { context: 'GoalsManagementModal.handleConfirmDelete' } });
      showSnackbar('error', t('errors.somethingWentWrong'));
    } finally {
      setIsDeletingGoal(false);
      setGoalToDelete(null);
    }
  };

  const handleCloseNutritionGoalsModal = () => {
    setNutritionGoalsModalVisible(false);
    setPendingWizardPrefill(null);
  };

  const handleSaveNutritionGoals = async (nutritionGoals: NutritionGoals) => {
    const input = {
      totalCalories: nutritionGoals.totalCalories,
      protein: nutritionGoals.protein,
      carbs: nutritionGoals.carbs,
      fats: nutritionGoals.fats,
      fiber: nutritionGoals.fiber,
      eatingPhase: nutritionGoals.eatingPhase,
      targetWeight: nutritionGoals.targetWeight ?? undefined,
      targetBodyFat: nutritionGoals.targetBodyFat ?? undefined,
      targetBMI: nutritionGoals.targetBMI ?? undefined,
      targetFFMI: nutritionGoals.targetFFMI ?? undefined,
      targetDate: nutritionGoals.targetDate ?? null,
    };

    try {
      if (isEditing && selectedGoal) {
        await NutritionGoalService.updateGoal(selectedGoal.id, input);
      } else {
        const startDate = nutritionGoals.goalStartDate;
        const todayStartMs = localDayStartMs(new Date());
        if (startDate != null && startDate < todayStartMs) {
          await NutritionGoalService.addGoalAtDate(input, startDate);
        } else {
          await NutritionGoalService.saveGoals(input);
        }
      }
      await refresh();
      setNutritionGoalsModalVisible(false);
      setPendingWizardPrefill(null);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      captureException(error, {
        data: { context: 'GoalsManagementModal.handleSaveNutritionGoals' },
      });
      showSnackbar('error', t('errors.somethingWentWrong'));
    }
  };

  // TODO: should this be its own hook?
  const editModalInitialGoals = useMemo(() => {
    if (isEditing && selectedGoal) {
      return goalToFormData(selectedGoal);
    }

    if (pendingWizardPrefill) {
      const base = { ...computedDefaults, ...pendingWizardPrefill };

      // If the wizard supplied a target weight + date, compute the required daily
      // calorie deficit/surplus synchronously using already-loaded plan data (TDEE,
      // current weight, etc.). This avoids a race condition where the async hook
      // hasn't finished recomputing by the time the modal opens.
      const { targetWeight, targetDate, eatingPhase } = pendingWizardPrefill;
      if (
        targetWeight != null &&
        targetDate != null &&
        eatingPhase != null &&
        eatingPhase !== 'maintain' &&
        planData != null &&
        planData.tdee > 0
      ) {
        const daysToGoal = differenceInCalendarDays(new Date(targetDate), new Date());
        const weightDeltaKg = targetWeight - planData.currentWeightKg;

        if (daysToGoal > 0 && Math.abs(weightDeltaKg) >= 0.1) {
          let dateAwareCalories: number;

          if (weightDeltaKg < 0) {
            const fatMassKg =
              planData.bodyFatPercent != null
                ? planData.currentWeightKg * (planData.bodyFatPercent / 100)
                : planData.currentWeightKg * 0.25;
            const kcalPerKg = getEffectiveKcalPerKgWeightLoss(fatMassKg, weightDeltaKg);
            const dailyDeficit = (Math.abs(weightDeltaKg) * kcalPerKg) / daysToGoal;
            const minCals = getMinCalories(planData.gender, planData.bmr);
            dateAwareCalories = Math.max(minCals, Math.round(planData.tdee - dailyDeficit));
          } else {
            const kcalPerKg = getEffectiveKcalPerKgGain(planData.liftingExperience);
            const dailySurplus = Math.min(
              (weightDeltaKg * kcalPerKg) / daysToGoal,
              1000 // cap at +1000 kcal/day
            );
            dateAwareCalories = Math.round(planData.tdee + dailySurplus);
          }

          const macros = calculateMacros(dateAwareCalories, planData.fitnessGoal);
          return {
            ...base,
            totalCalories: dateAwareCalories,
            protein: macros.protein,
            carbs: macros.carbs,
            fats: macros.fats,
            fiber: fiberFromCalories(dateAwareCalories),
          };
        }
      }

      return base;
    }

    return currentGoalsData ?? computedDefaults;
  }, [isEditing, selectedGoal, pendingWizardPrefill, currentGoalsData, computedDefaults, planData]);

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('goalsManagement.title')}
        headerRight={
          <Button
            label={t('goalsManagement.newGoal')}
            icon={Plus}
            iconPosition="left"
            variant="gradientCta"
            size="sm"
            onPress={handleNewGoal}
          />
        }
        scrollable={false}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="shrink-0 px-4 pb-6" />
            {/* Scrollable content */}
            <View className="flex-1 px-4 pb-32">
              {/* Current Goals Section */}
              {currentGoal ? (
                <View className="mb-8">
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text
                      className="font-bold uppercase tracking-widest text-text-secondary"
                      style={{ fontSize: theme.typography.fontSize.xs }}
                    >
                      {t('goalsManagement.currentGoals')}
                    </Text>
                    <View
                      className="rounded-full border px-2"
                      style={{
                        backgroundColor: theme.colors.accent.primary10,
                        borderColor: theme.colors.accent.primary20,
                        paddingVertical: theme.spacing.padding.xsHalf,
                      }}
                    >
                      <Text
                        className="font-bold text-accent-primary"
                        style={{ fontSize: theme.typography.fontSize.xs }}
                      >
                        {t('goalsManagement.active')}
                      </Text>
                    </View>
                  </View>

                  {/* Current Goal Card */}
                  <CurrentGoalsCard
                    goal={currentGoal}
                    onEdit={current ? () => handleEditGoal(current) : undefined}
                    onRegenerateCheckins={
                      current ? () => handleRegenerateCheckins(current) : undefined
                    }
                    onDelete={current ? () => handleDeleteGoal(current) : undefined}
                    isRegenerating={isRegenerating}
                  />
                </View>
              ) : null}

              {/* Goals History Section */}
              {historyWithRaw.length > 0 ? (
                <View className="mb-6">
                  <Text
                    className="mb-6 font-bold uppercase tracking-widest text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}
                  >
                    {t('goalsManagement.history')}
                  </Text>

                  <View>
                    {historyWithRaw.map(({ display, raw }, index) => {
                      const isLast = index === historyWithRaw.length - 1;
                      return (
                        <GoalHistoryCard
                          key={display.id}
                          goal={display}
                          isLast={isLast}
                          onEdit={() => handleEditGoal(raw)}
                          onRegenerateCheckins={() => handleRegenerateCheckins(raw)}
                          onDelete={() => handleDeleteGoal(raw)}
                          isRegenerating={isRegenerating}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Empty state */}
              {!currentGoal && historyWithRaw.length === 0 ? (
                <View className="flex-1 items-center justify-center py-16">
                  <Text className="text-center text-text-secondary">
                    {t('goalsManagement.subtitle')}
                  </Text>
                  <Text className="mt-2 text-center text-xs text-text-tertiary">
                    {t('goalsManagement.emptyStateMessage')}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bottom spacing for navigation */}
            <View style={{ height: theme.size['24'] }} />
          </ScrollView>
        )}
      </FullScreenModal>

      <GoalCreationMethodModal
        visible={creationMethodModalVisible}
        onClose={() => setCreationMethodModalVisible(false)}
        onSelectManual={handleSelectManualCreation}
        onSelectGuided={handleSelectGuidedCreation}
        onSelectAutoCalculate={handleSelectAutoCalculate}
      />

      <GoalWizardModal
        visible={wizardModalVisible}
        onClose={() => setWizardModalVisible(false)}
        onComplete={handleWizardComplete}
      />

      <NutritionGoalsModal
        visible={nutritionGoalsModalVisible}
        onClose={handleCloseNutritionGoalsModal}
        onSave={handleSaveNutritionGoals}
        initialGoals={editModalInitialGoals}
        isEditing={isEditing}
      />

      <ConfirmationModal
        visible={confirmDeleteVisible}
        onClose={() => {
          setConfirmDeleteVisible(false);
          setGoalToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t('goalsManagement.deleteGoal')}
        message={t('goalsManagement.deleteGoalMessage')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isDeletingGoal}
      />
    </>
  );
}
