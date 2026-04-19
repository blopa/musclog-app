import { MoreVertical, Trash2, Utensils } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { GenericCard } from '@/components/cards/GenericCard';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { SavedForLaterGroup, SavedForLaterItem } from '@/database/models';
import { SavedForLaterService } from '@/database/services';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { formatLocalCalendarDayIso, localCalendarDayDateFromDayKeyMs } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

import { EmptyStateCard } from '../theme/EmptyStateCard';
import { MoveCopyMealModal } from './MoveCopyMealModal';

type SavedForLaterModalProps = {
  visible: boolean;
  onClose: () => void;
  onTracked?: () => void;
  initialMealType?: string;
  initialDate?: Date;
};

type GroupWithNutrients = {
  group: SavedForLaterGroup;
  nutrients: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

export function SavedForLaterModal({
  visible,
  onClose,
  onTracked,
  initialMealType,
  initialDate,
}: SavedForLaterModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const [groups, setGroups] = useState<GroupWithNutrients[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithNutrients | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isTrackModalVisible, setIsTrackModalVisible] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const allGroups = await SavedForLaterService.getAllGroups();
      const resolvedGroups = await Promise.all(
        allGroups.map(async (group) => {
          const items: SavedForLaterItem[] = await group.items.fetch();
          const nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          for (const item of items) {
            const itemNutrients = await item.getNutrients();
            nutrients.calories += itemNutrients.calories;
            nutrients.protein += itemNutrients.protein;
            nutrients.carbs += itemNutrients.carbs;
            nutrients.fat += itemNutrients.fat;
          }
          return { group, nutrients };
        })
      );
      setGroups(resolvedGroups);
    } catch (error) {
      handleError(error, 'SavedForLaterModal.fetchGroups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchGroups();
    } else {
      setIsMenuVisible(false);
      setIsDeleteConfirmationVisible(false);
      setIsTrackModalVisible(false);
    }
  }, [visible]);

  const handleTrackPress = () => {
    setIsMenuVisible(false);
    setIsTrackModalVisible(true);
  };

  const handleDeletePress = () => {
    setIsMenuVisible(false);
    setIsDeleteConfirmationVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedGroup) return;
    setIsActionLoading(true);
    try {
      await SavedForLaterService.deleteGroup(selectedGroup.group.id);
      await fetchGroups();
      setIsDeleteConfirmationVisible(false);
      setSelectedGroup(null);
    } catch (error) {
      handleError(error, 'SavedForLaterModal.handleConfirmDelete');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmTrack = async (targetDate: Date, targetMealType: any) => {
    if (!selectedGroup) return;
    setIsActionLoading(true);
    try {
      await SavedForLaterService.trackGroup(selectedGroup.group.id, targetDate, targetMealType);
      onTracked?.();
      onClose();
    } catch (error) {
      handleError(error, 'SavedForLaterModal.handleConfirmTrack');
    } finally {
      setIsActionLoading(false);
      setIsTrackModalVisible(false);
      setSelectedGroup(null);
    }
  };

  const renderItem = ({ item }: { item: GroupWithNutrients }) => {
    const originalDate = formatLocalCalendarDayIso(
      new Date(localCalendarDayDateFromDayKeyMs(item.group.originalDate))
    );
    const mealTypeLabel = t(`food.meals.${item.group.originalMealType as any}`);

    return (
      <View className="mb-4">
        <GenericCard variant="card">
          <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 pr-4">
            <Text className="text-lg font-bold text-text-primary" numberOfLines={1}>
              {item.group.name}
            </Text>
            <Text className="text-xs text-text-secondary">
              {originalDate} • {mealTypeLabel}
            </Text>
            <View className="mt-2 flex-row flex-wrap gap-x-3 gap-y-1">
              <Text className="text-sm font-semibold text-accent-primary">
                {formatInteger(Math.round(item.nutrients.calories))} kcal
              </Text>
              <Text className="text-xs text-text-secondary">
                {Math.round(item.nutrients.protein)}g P
              </Text>
              <Text className="text-xs text-text-secondary">
                {Math.round(item.nutrients.carbs)}g C
              </Text>
              <Text className="text-xs text-text-secondary">
                {Math.round(item.nutrients.fat)}g F
              </Text>
            </View>
            </View>
            <MenuButton
            onPress={() => {
              setSelectedGroup(item);
              setIsMenuVisible(true);
            }}
          />
          </View>
        </GenericCard>
      </View>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.mealGroup.savedForLaterModal.title')}
      subtitle={t('food.mealGroup.savedForLaterModal.subtitle')}
    >
      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonLoader key={i} width="100%" height={100} borderRadius={theme.borderRadius.lg} />
            ))}
          </View>
        ) : groups.length === 0 ? (
          <EmptyStateCard
            icon={Utensils}
            title={t('food.mealGroup.savedForLaterModal.noSavedMeals')}
            description={t('food.mealGroup.savedForLaterModal.noSavedMealsDesc')}
            buttonLabel={t('common.close')}
            onButtonPress={onClose}
            buttonVariant="secondary"
          />
        ) : (
          <FlatList
            data={groups}
            renderItem={renderItem}
            keyExtractor={(item) => item.group.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}
      </View>

      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={selectedGroup?.group.name || ''}
        items={[
          {
            icon: Utensils,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('food.mealGroup.savedForLaterModal.trackThisMeal'),
            description: t('food.mealGroup.savedForLaterModal.trackThisMealDesc'),
            onPress: handleTrackPress,
          },
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('food.mealGroup.savedForLaterModal.deleteMeal'),
            description: t('food.mealGroup.savedForLaterModal.deleteMealDesc'),
            onPress: handleDeletePress,
            titleColor: theme.colors.status.error,
          },
        ]}
      />

      <ConfirmationModal
        visible={isDeleteConfirmationVisible}
        onClose={() => setIsDeleteConfirmationVisible(false)}
        onConfirm={handleConfirmDelete}
        title={t('food.mealGroup.savedForLaterModal.deleteMeal')}
        message={t('food.mealGroup.deleteGroupWarning')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isActionLoading}
      />

      {isTrackModalVisible && selectedGroup ? (
        <MoveCopyMealModal
          visible={isTrackModalVisible}
          onClose={() => setIsTrackModalVisible(false)}
          onConfirm={handleConfirmTrack}
          mode="copy"
          title={t('food.mealGroup.savedForLaterModal.trackThisMeal')}
          sourceMealType={(initialMealType as any) || selectedGroup.group.originalMealType}
          sourceDate={initialDate || new Date()}
          isLoading={isActionLoading}
        />
      ) : null}
    </FullScreenModal>
  );
}
