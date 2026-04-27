import { differenceInCalendarDays } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/theme/Button';
import { type EatingPhase } from '@/database/models';
import NutritionGoal from '@/database/models/NutritionGoal';
import { ExerciseGoalService, NutritionGoalService } from '@/database/services';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useDefaultNutritionGoals } from '@/hooks/useDefaultNutritionGoals';
import { localDayStartMs } from '@/utils/calendarDate';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { handleError } from '@/utils/handleError';
import {
  calculateMacros,
  fiberFromCalories,
  getEffectiveKcalPerKgGain,
  getEffectiveKcalPerKgWeightLoss,
  getMinCalories,
} from '@/utils/nutritionCalculator';
import { showSnackbar } from '@/utils/snackbarService';

import { ConfirmationModal } from './ConfirmationModal';
import ExerciseGoalCreationModal from './ExerciseGoalCreationModal';
import { FitnessGoalsTabContent } from './FitnessGoalsTabContent';
import { FullScreenModal } from './FullScreenModal';
import { GoalCreationMethodModal } from './GoalCreationMethodModal';
import { GoalWizardModal } from './GoalWizardModal';
import {
  NutritionGoals,
  NutritionGoalsInitialValues,
  NutritionGoalsModal,
} from './NutritionGoalsModal';
import { NutritionGoalsTabContent } from './NutritionGoalsTabContent';

interface GoalsManagementModalProps {
  visible: boolean;
  onClose: () => void;
  tab: 'nutrition' | 'fitness';
}

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

export default function GoalsManagementModal({ visible, onClose, tab }: GoalsManagementModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'nutrition' | 'fitness'>('nutrition');
  const [creationMethodModalVisible, setCreationMethodModalVisible] = useState(false);
  const [wizardModalVisible, setWizardModalVisible] = useState(false);
  const [nutritionGoalsModalVisible, setNutritionGoalsModalVisible] = useState(false);
  const [exerciseGoalCreationModalVisible, setExerciseGoalCreationModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<NutritionGoal | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<NutritionGoal | null>(null);
  const [isDeletingGoal, setIsDeletingGoal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pendingWizardPrefill, setPendingWizardPrefill] = useState<Partial<NutritionGoals> | null>(
    null
  );

  const refreshNutritionRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (visible) {
      setActiveTab(tab);
    } else {
      setCreationMethodModalVisible(false);
      setWizardModalVisible(false);
      setNutritionGoalsModalVisible(false);
      setExerciseGoalCreationModalVisible(false);
      setConfirmDeleteVisible(false);
      setSelectedGoal(null);
    }
  }, [visible, tab]);

  const nutritionGoalResult = useCurrentNutritionGoal({
    mode: 'history',
    visible,
  });

  const currentNutritionGoal =
    'current' in nutritionGoalResult ? nutritionGoalResult.current : null;

  const currentGoalsData = useMemo<NutritionGoalsInitialValues | undefined>(() => {
    if (!currentNutritionGoal) {
      return undefined;
    }
    return goalToFormData(currentNutritionGoal);
  }, [currentNutritionGoal]);

  const defaultEatingPhase =
    pendingWizardPrefill?.eatingPhase ?? currentGoalsData?.eatingPhase ?? 'maintain';
  const { defaults: computedDefaults, planData } = useDefaultNutritionGoals(defaultEatingPhase);

  const handleNewGoal = () => {
    if (activeTab === 'nutrition') {
      setSelectedGoal(null);
      setIsEditing(false);
      setCreationMethodModalVisible(true);
    } else {
      setExerciseGoalCreationModalVisible(true);
    }
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
    setSelectedGoal(null);
    setIsEditing(false);
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
    setTimeout(async () => {
      try {
        await NutritionGoalService.regenerateCheckins(goal.id);
      } catch (error) {
        handleError(error, 'GoalsManagementModal.handleRegenerateCheckins', {
          snackbarMessage: t('errors.somethingWentWrong'),
        });
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
      if (refreshNutritionRef.current) {
        await refreshNutritionRef.current();
      }
    } catch (error) {
      handleError(error, 'GoalsManagementModal.handleConfirmDelete', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
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
        await NutritionGoalService.updateGoal(selectedGoal.id, input, true);
      } else {
        const startDate = nutritionGoals.goalStartDate;
        const todayStartMs = localDayStartMs(new Date());

        let savedGoalId: string;
        if (startDate != null && startDate < todayStartMs) {
          savedGoalId = (await NutritionGoalService.addGoalAtDate(input, startDate)).id;
        } else {
          savedGoalId = (await NutritionGoalService.saveGoals(input)).id;
        }

        await NutritionGoalService.regenerateCheckins(savedGoalId);
      }

      if (refreshNutritionRef.current) {
        await refreshNutritionRef.current();
      }

      setNutritionGoalsModalVisible(false);
      setPendingWizardPrefill(null);
    } catch (error) {
      handleError(error, 'GoalsManagementModal.handleSaveNutritionGoals', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    }
  };

  const handleSaveExerciseGoal = async (data: any) => {
    try {
      await ExerciseGoalService.saveGoal(data);
      setExerciseGoalCreationModalVisible(false);
    } catch (error) {
      console.error('Error saving exercise goal:', error);
      showSnackbar('error', t('errors.somethingWentWrong'));
    }
  };

  const editModalInitialGoals = useMemo(() => {
    if (isEditing && selectedGoal) {
      return goalToFormData(selectedGoal);
    }

    if (pendingWizardPrefill) {
      const base = { ...computedDefaults, ...pendingWizardPrefill };
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
            const dailySurplus = Math.min((weightDeltaKg * kcalPerKg) / daysToGoal, 1000);
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
          } as NutritionGoalsInitialValues;
        }
      }

      return base;
    }

    return currentGoalsData ?? computedDefaults;
  }, [isEditing, selectedGoal, pendingWizardPrefill, currentGoalsData, computedDefaults, planData]);

  return (
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
      <View className="border-border-light flex-row border-b px-4">
        <Pressable
          onPress={() => setActiveTab('nutrition')}
          className={`mr-6 py-4 ${activeTab === 'nutrition' ? 'border-accent-primary border-b-2' : ''}`}
        >
          <Text
            className={`text-sm font-semibold ${activeTab === 'nutrition' ? 'text-accent-primary' : 'text-text-tertiary'}`}
          >
            {t('goalsManagement.nutritionAndBodyTab')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('fitness')}
          className={`py-4 ${activeTab === 'fitness' ? 'border-accent-primary border-b-2' : ''}`}
        >
          <Text
            className={`text-sm font-semibold ${activeTab === 'fitness' ? 'text-accent-primary' : 'text-text-tertiary'}`}
          >
            {t('goalsManagement.fitnessAndExerciseTab')}
          </Text>
        </Pressable>
      </View>

      {activeTab === 'nutrition' ? (
        <NutritionGoalsTabContent
          visible={visible ? activeTab === 'nutrition' : false}
          onEditGoal={handleEditGoal}
          onDeleteGoal={handleDeleteGoal}
          onRegenerateCheckins={handleRegenerateCheckins}
          isRegenerating={isRegenerating}
          refreshRef={refreshNutritionRef}
        />
      ) : (
        <FitnessGoalsTabContent
          visible={visible ? activeTab === 'fitness' : false}
          onNewGoal={() => setExerciseGoalCreationModalVisible(true)}
        />
      )}

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

      <ExerciseGoalCreationModal
        visible={exerciseGoalCreationModalVisible}
        onClose={() => setExerciseGoalCreationModalVisible(false)}
        onSave={handleSaveExerciseGoal}
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
    </FullScreenModal>
  );
}
