import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { CurrentExerciseGoalCard } from '@/components/cards/CurrentExerciseGoalCard';
import { ExerciseGoalHistoryCard } from '@/components/cards/ExerciseGoalHistoryCard';
import { Button } from '@/components/theme/Button';
import type ExerciseGoal from '@/database/models/ExerciseGoal';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { useExerciseGoals } from '@/hooks/useExerciseGoals';

import { ExerciseGoalDetailModal } from './ExerciseGoalDetailModal';

interface FitnessGoalsTabContentProps {
  visible: boolean;
  onNewGoal: () => void;
}

export function FitnessGoalsTabContent({ visible, onNewGoal }: FitnessGoalsTabContentProps) {
  const { t } = useTranslation();
  const [detailGoal, setDetailGoal] = useState<ExerciseGoal | null>(null);

  const { goals: activeGoals, isLoading: isLoadingActive } = useExerciseGoals({
    mode: 'active',
    visible,
  });

  const {
    goals: historyGoals,
    isLoading: isLoadingHistory,
    hasMore,
    loadMore,
  } = useExerciseGoals({
    mode: 'history',
    visible,
  });

  const handleDeleteGoal = async (id: string) => {
    try {
      await ExerciseGoalService.deleteGoal(id);
    } catch (error) {
      console.error('Error deleting exercise goal:', error);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="flex-1 px-4 pb-32 pt-6">
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            {t('exerciseGoals.currentGoals')}
          </Text>
        </View>

        {activeGoals.length === 0 && !isLoadingActive ? (
          <View className="bg-surface-variant mb-8 items-center rounded-2xl p-8">
            <Text className="text-center text-sm text-text-secondary">
              {t('exerciseGoals.emptyState')}
            </Text>
          </View>
        ) : (
          <View className="mb-8">
            {activeGoals.map((goal) => (
              <CurrentExerciseGoalCard
                key={goal.id}
                goal={goal}
                onDelete={() => handleDeleteGoal(goal.id)}
                onViewDetails={() => setDetailGoal(goal)}
              />
            ))}
          </View>
        )}

        {historyGoals.length > 0 ? (
          <View>
            <Text className="mb-6 text-xs font-bold uppercase tracking-widest text-text-secondary">
              {t('exerciseGoals.history')}
            </Text>
            {historyGoals.map((goal, index) => (
              <ExerciseGoalHistoryCard
                key={goal.id}
                goal={goal}
                isLast={index === historyGoals.length - 1 ? !hasMore : false}
              />
            ))}
            {hasMore ? (
              <Button
                label={t('common.loadMore')}
                variant="outline"
                onPress={loadMore}
                loading={isLoadingHistory}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <ExerciseGoalDetailModal
        visible={detailGoal != null}
        goal={detailGoal}
        onClose={() => setDetailGoal(null)}
        onDelete={
          detailGoal
            ? () => {
                handleDeleteGoal(detailGoal.id);
                setDetailGoal(null);
              }
            : undefined
        }
      />
    </ScrollView>
  );
}
