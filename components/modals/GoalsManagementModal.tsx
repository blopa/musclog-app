import { format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { type EatingPhase } from '../../database/models';
import NutritionGoal from '../../database/models/NutritionGoal';
import { NutritionGoalService } from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useTheme } from '../../hooks/useTheme';
import { convertEatingPhaseToUI, type EatingPhaseUI } from '../../types/EatingPhaseUI';
import { CurrentGoalsCard } from '../cards/CurrentGoalsCard';
import { GoalHistoryCard } from '../cards/GoalHistoryCard';
import { Button } from '../theme/Button';
import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { NutritionGoals, NutritionGoalsModal } from './NutritionGoalsModal';

interface GoalHistoryItem {
  id: number;
  dateRange: string;
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat: number;
}

interface CurrentGoal {
  phase: EatingPhaseUI;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number;
  ffmi?: number;
  bmi?: number;
  goalDate?: string;
}

type GoalsManagementModalProps = {
  visible: boolean;
  onClose: () => void;
};

function goalToFormData(goal: NutritionGoal): Partial<NutritionGoals> {
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
  const [nutritionGoalsModalVisible, setNutritionGoalsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<NutritionGoal | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<NutritionGoal | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

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
        ? format(new Date(current.targetDate), 'MMM d, yyyy')
        : undefined,
    };
  }, [current]);

  const currentGoalsData = useMemo<Partial<NutritionGoals> | undefined>(() => {
    if (!current) {
      return undefined;
    }
    return goalToFormData(current);
  }, [current]);

  // Keep raw NutritionGoal alongside display data to enable edit/delete
  const historyWithRaw = useMemo(
    () =>
      goals
        .filter((goal) => goal.effectiveUntil !== null)
        .map((goal, index) => {
          const startDate = new Date(goal.createdAt);
          const endDate = goal.effectiveUntil ? new Date(goal.effectiveUntil) : new Date();
          const dateRange =
            format(startDate, 'MMM d') === format(endDate, 'MMM d')
              ? format(startDate, 'MMM d, yyyy')
              : `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;

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
    [goals]
  );

  const handleNewGoal = () => {
    setSelectedGoal(null);
    setIsEditing(false);
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
      } finally {
        setIsRegenerating(false);
      }
    }, 100);
  };

  const handleConfirmDelete = async () => {
    if (!goalToDelete) {
      return;
    }
    try {
      await NutritionGoalService.deleteGoal(goalToDelete.id);
      await refresh();
    } catch (error) {
      console.error('Error deleting nutrition goal:', error);
    }
  };

  const handleCloseNutritionGoalsModal = () => {
    setNutritionGoalsModalVisible(false);
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
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        if (startDate != null && startDate < todayStart.getTime()) {
          await NutritionGoalService.addGoalAtDate(input, startDate);
        } else {
          await NutritionGoalService.saveGoals(input);
        }
      }
      await refresh();
      setNutritionGoalsModalVisible(false);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
    }
  };

  const editModalInitialGoals =
    isEditing && selectedGoal ? goalToFormData(selectedGoal) : currentGoalsData;

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

      <NutritionGoalsModal
        visible={nutritionGoalsModalVisible}
        onClose={handleCloseNutritionGoalsModal}
        onSave={handleSaveNutritionGoals}
        initialGoals={editModalInitialGoals}
        isEditing={isEditing}
      />

      <ConfirmationModal
        visible={confirmDeleteVisible}
        onClose={() => setConfirmDeleteVisible(false)}
        onConfirm={handleConfirmDelete}
        title={t('goalsManagement.deleteGoal')}
        message={t('goalsManagement.deleteGoalMessage')}
        confirmLabel={t('common.delete')}
        variant="destructive"
      />
    </>
  );
}
