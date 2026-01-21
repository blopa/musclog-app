import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Pencil, Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutService } from '../database/services/WorkoutService';
import { transformWorkoutToDetailData, type WorkoutDetailData } from '../utils/workoutDetail';
import type { BottomPopUpMenuItem } from '../components/BottomPopUpMenu';

export interface UsePastWorkoutDetailParams {
  visible: boolean;
  workoutId?: string;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
}

export function usePastWorkoutDetail({
  visible,
  workoutId,
  onEdit,
  onShare,
  onDelete,
}: UsePastWorkoutDetailParams) {
  const { t } = useTranslation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [workout, setWorkout] = useState<WorkoutDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadWorkoutData = useCallback(async () => {
    if (!workoutId) return;

    setIsLoading(true);
    try {
      const { workoutLog, sets, exercises } = await WorkoutService.getWorkoutWithDetails(workoutId);
      const transformedData = await transformWorkoutToDetailData(workoutLog, sets, exercises, t);
      setWorkout(transformedData);
    } catch (error) {
      console.error('Error loading workout details:', error);
      setWorkout(null);
    } finally {
      setIsLoading(false);
    }
  }, [workoutId, t]);

  useEffect(() => {
    if (visible && workoutId) {
      loadWorkoutData();
    } else {
      setWorkout(null);
    }
  }, [visible, workoutId, loadWorkoutData]);

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.edit'),
      description: t('workoutDetails.editDescription'),
      onPress: () => {
        setIsMenuVisible(false);
        onEdit?.();
      },
    },
    {
      icon: Share2,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.share'),
      description: t('workoutDetails.shareDescription'),
      onPress: () => {
        setIsMenuVisible(false);
        onShare?.();
      },
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('workoutDetails.delete'),
      description: t('workoutDetails.deleteDescription'),
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => {
        setIsMenuVisible(false);
        onDelete?.();
      },
    },
  ];

  return {
    workout,
    isLoading,
    isMenuVisible,
    menuItems,
    setIsMenuVisible,
  };
}
