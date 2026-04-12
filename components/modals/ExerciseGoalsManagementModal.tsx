import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { CurrentExerciseGoalCard } from '@/components/cards/CurrentExerciseGoalCard';
import { ExerciseGoalHistoryCard } from '@/components/cards/ExerciseGoalHistoryCard';
import { Button } from '@/components/theme/Button';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { useExerciseGoals } from '@/hooks/useExerciseGoals';
import { useTheme } from '@/hooks/useTheme';

import ExerciseGoalCreationModal from './ExerciseGoalCreationModal';
import { FullScreenModal } from './FullScreenModal';

interface ExerciseGoalsManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ExerciseGoalsManagementModal({
  visible,
  onClose,
}: ExerciseGoalsManagementModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [creationModalVisible, setCreationModalVisible] = useState(false);

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

  const handleSaveGoal = async (data: any) => {
    try {
      await ExerciseGoalService.saveGoal(data);
      setCreationModalVisible(false);
    } catch (error) {
      console.error('Error saving exercise goal:', error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await ExerciseGoalService.deleteGoal(id);
    } catch (error) {
      console.error('Error deleting exercise goal:', error);
    }
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('exerciseGoals.title')}
    >
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="mb-6 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            {t('exerciseGoals.currentGoals')}
          </Text>
          <Button
            label={t('exerciseGoals.newGoal')}
            variant="ghost"
            size="sm"
            icon={Plus}
            onPress={() => setCreationModalVisible(true)}
          />
        </View>

        {activeGoals.length === 0 && !isLoadingActive ? (
          <View className="mb-8 rounded-2xl bg-surface-variant p-8 items-center">
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
              />
            ))}
          </View>
        )}

        {historyGoals.length > 0 && (
          <View>
            <Text className="mb-6 text-xs font-bold uppercase tracking-widest text-text-secondary">
              {t('exerciseGoals.history')}
            </Text>
            {historyGoals.map((goal, index) => (
              <ExerciseGoalHistoryCard
                key={goal.id}
                goal={goal}
                isLast={index === historyGoals.length - 1 && !hasMore}
              />
            ))}
            {hasMore && (
              <Button
                label={t('common.loadMore')}
                variant="ghost"
                onPress={loadMore}
                loading={isLoadingHistory}
              />
            )}
          </View>
        )}
      </ScrollView>

      <ExerciseGoalCreationModal
        visible={creationModalVisible}
        onClose={() => setCreationModalVisible(false)}
        onSave={handleSaveGoal}
      />
    </FullScreenModal>
  );
}
