import { format } from 'date-fns';
import { Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { type EatingPhase } from '../../database/models';
import { NutritionGoalService } from '../../database/services';
import { useTheme } from '../../hooks/useTheme';
import { convertEatingPhaseToUI, type EatingPhaseUI } from '../../types/EatingPhaseUI';
import { CurrentGoalsCard } from '../cards/CurrentGoalsCard';
import { GoalHistoryCard } from '../cards/GoalHistoryCard';
import { Button } from '../theme/Button';
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

// TODO: implement a way to edit the current goal too, and also edit previous goals, and also remove previous goals, and also add a past goal (so add a goal and pick it's created at date, for example)
// we can probably use the NutritionGoalsModal by changing it to have a "edit" mode, where we can pass a NutritionGoal and it would be possible to edit and save it
// as on how to open this modal, we can add the MenuButton.tsx into the cards on this GoalsManagementModal modal, that when it's clicked, will load the
// NutritionGoalsModal in edit mode.
export default function GoalsManagementModal({ visible, onClose }: GoalsManagementModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [nutritionGoalsModalVisible, setNutritionGoalsModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState<CurrentGoal | null>(null);
  const [currentGoalsData, setCurrentGoalsData] = useState<Partial<NutritionGoals> | undefined>(
    undefined
  );
  const [goalsHistory, setGoalsHistory] = useState<GoalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load goals data
  useEffect(() => {
    if (visible) {
      loadGoalsData();
    }
  }, [visible]);

  // TODO: can't we use the existing useNutritionGoalDataLogs here?
  const loadGoalsData = async () => {
    setIsLoading(true);
    try {
      // Load current goal
      const current = await NutritionGoalService.getCurrent();
      if (current) {
        setCurrentGoal({
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
        });
        // Store full data for passing to NutritionGoalsModal
        setCurrentGoalsData({
          totalCalories: current.totalCalories,
          protein: current.protein,
          carbs: current.carbs,
          fats: current.fats,
          fiber: current.fiber,
          eatingPhase: current.eatingPhase as EatingPhase,
          targetWeight: current.targetWeight,
          targetBodyFat: current.targetBodyFat,
          targetBMI: current.targetBmi,
          targetFFMI: current.targetFfmi,
          targetDate: current.targetDate ?? null,
        });
      } else {
        setCurrentGoal(null);
        setCurrentGoalsData(undefined);
      }

      // Load history (all goals except current)
      const history = await NutritionGoalService.getHistory();
      const historyItems: GoalHistoryItem[] = history
        .filter((goal) => goal.effectiveUntil !== null) // Only past goals
        .map((goal, index) => {
          const startDate = new Date(goal.createdAt);
          const endDate = goal.effectiveUntil ? new Date(goal.effectiveUntil) : new Date();
          const dateRange =
            format(startDate, 'MMM d') === format(endDate, 'MMM d')
              ? format(startDate, 'MMM d, yyyy')
              : `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;

          return {
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
        });
      setGoalsHistory(historyItems);
    } catch (error) {
      console.error('Error loading goals data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewGoal = () => {
    setNutritionGoalsModalVisible(true);
  };

  const handleCloseNutritionGoalsModal = () => {
    setNutritionGoalsModalVisible(false);
  };

  const handleSaveNutritionGoals = async (goals: NutritionGoals) => {
    try {
      await NutritionGoalService.saveGoals({
        totalCalories: goals.totalCalories,
        protein: goals.protein,
        carbs: goals.carbs,
        fats: goals.fats,
        fiber: goals.fiber,
        eatingPhase: goals.eatingPhase,
        targetWeight: goals.targetWeight,
        targetBodyFat: goals.targetBodyFat,
        targetBMI: goals.targetBMI,
        targetFFMI: goals.targetFFMI,
        targetDate: goals.targetDate ?? null,
      });
      // Reload data after saving
      await loadGoalsData();
      setNutritionGoalsModalVisible(false);
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
    }
  };

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
            <View className="shrink-0 px-6 pb-6" />
            {/* Scrollable content */}
            <View className="flex-1 px-6 pb-32">
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
                  <CurrentGoalsCard goal={currentGoal} />
                </View>
              ) : null}

              {/* Goals History Section */}
              {goalsHistory.length > 0 ? (
                <View className="mb-6">
                  <Text
                    className="mb-6 font-bold uppercase tracking-widest text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xs }}
                  >
                    {t('goalsManagement.history')}
                  </Text>

                  <View>
                    {goalsHistory.map((goal, index) => {
                      const isLast = index === goalsHistory.length - 1;
                      return <GoalHistoryCard key={goal.id} goal={goal} isLast={isLast} />;
                    })}
                  </View>
                </View>
              ) : null}

              {/* Empty state */}
              {!currentGoal && goalsHistory.length === 0 ? (
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
        initialGoals={currentGoalsData}
      />
    </>
  );
}
