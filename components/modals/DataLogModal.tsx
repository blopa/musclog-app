import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useFoodDataLogs } from '../../hooks/useFoodDataLogs';
import { useMealDataLogs } from '../../hooks/useMealDataLogs';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { Button } from '../theme/Button';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';

// Base type that both MealDataDisplayItem and FoodDataDisplayItem satisfy
export type DataLogDisplayItem = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  isFavorite?: boolean; // Optional - only meals have this
};

export type DataLogModalData = {
  dayGroups: { date: string; dateTimestamp: number; items: DataLogDisplayItem[] }[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

type DataLogModalProps = {
  visible: boolean;
  onClose: () => void;
  variant: 'meal' | 'food';
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
} & DataLogModalData;

export function DataLogModal({
  visible,
  onClose,
  variant,
  searchQuery,
  onSearchQueryChange,
  dayGroups: typedDayGroups,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
}: DataLogModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [selectedItem, setSelectedItem] = useState<DataLogDisplayItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleItemPress = (item: DataLogDisplayItem) => {
    setSelectedItem(item);
    setShowMenu(true);
  };

  const getMenuItems = (): BottomPopUpMenuItem[] => {
    if (!selectedItem) {
      return [];
    }

    const EditIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="edit" {...props} />
    );
    const DuplicateIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="content-copy" {...props} />
    );
    const DeleteIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="delete" {...props} />
    );
    const FavoriteIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name={selectedItem.isFavorite ? 'star' : 'star-border'} {...props} />
    );

    const menuItems: BottomPopUpMenuItem[] = [];

    // Add Favorite toggle for meals only
    if (variant === 'meal') {
      menuItems.push({
        icon: FavoriteIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: selectedItem.isFavorite
          ? t('food.meals.manageMealData.removeFromFavorites')
          : t('food.meals.manageMealData.addToFavorites'),
        description: selectedItem.isFavorite
          ? t('food.meals.manageMealData.removeFromFavoritesDesc')
          : t('food.meals.manageMealData.addToFavoritesDesc'),
        onPress: () => {
          console.log('Toggle favorite:', selectedItem.name);
        },
      });
    }

    // Add common menu items
    menuItems.push(
      {
        icon: EditIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title:
          variant === 'meal'
            ? t('food.meals.manageMealData.editMeal')
            : t('food.manageFoodData.editFoodEntry'),
        description:
          variant === 'meal'
            ? t('food.meals.manageMealData.editMealDesc')
            : t('food.manageFoodData.editFoodEntryDesc'),
        onPress: () => {
          console.log('Edit:', selectedItem.name);
        },
      },
      {
        icon: DuplicateIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title:
          variant === 'meal'
            ? t('food.meals.manageMealData.duplicateMeal')
            : t('food.manageFoodData.duplicateEntry'),
        description:
          variant === 'meal'
            ? t('food.meals.manageMealData.duplicateMealDesc')
            : t('food.manageFoodData.duplicateEntryDesc'),
        onPress: () => {
          console.log('Duplicate:', selectedItem.name);
        },
      },
      {
        icon: DeleteIcon,
        iconColor: theme.colors.status.error50,
        iconBgColor: 'rgba(239, 68, 68, 0.1)',
        title:
          variant === 'meal'
            ? t('food.meals.manageMealData.deleteMeal')
            : t('food.manageFoodData.deleteEntry'),
        description:
          variant === 'meal'
            ? t('food.meals.manageMealData.deleteMealDesc')
            : t('food.manageFoodData.deleteEntryDesc'),
        onPress: () => {
          console.log('Delete:', selectedItem.name);
        },
      }
    );

    return menuItems;
  };

  const renderItem = (item: DataLogDisplayItem) => (
    <GenericCard key={item.id} variant="card" isPressable onPress={() => handleItemPress(item)}>
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1 flex-row items-center gap-4">
          <View
            className="size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.iconBgColor }}
          >
            <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-semibold leading-snug text-text-primary">
                {item.name}
              </Text>
              {variant === 'meal' && item.isFavorite ? (
                <MaterialIcons name="star" size={16} color={theme.colors.accent.secondary} />
              ) : null}
            </View>
            <Text className="text-sm font-medium tracking-wider text-text-secondary">
              {variant === 'meal'
                ? t('food.meals.manageMealData.caloriesMacrosFormat', {
                    calories: item.calories,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                  })
                : t('food.manageFoodData.caloriesMacrosFormat', {
                    calories: item.calories,
                    protein: item.protein,
                    carbs: item.carbs,
                    fat: item.fat,
                  })}
            </Text>
          </View>
        </View>
        <Pressable
          className="size-8 items-center justify-center rounded-full active:opacity-70"
          onPress={() => handleItemPress(item)}
        >
          <MaterialIcons name="more-vert" size={20} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </GenericCard>
  );

  const renderHeaderRight = () => (
    <Pressable
      className="flex size-10 items-center justify-center rounded-full active:bg-white/10"
      onPress={() => {
        console.log('More options pressed');
      }}
    >
      <MaterialIcons name="more-vert" size={theme.iconSize.md} color={theme.colors.text.primary} />
    </Pressable>
  );

  // Get variant-specific copy
  const title =
    variant === 'meal' ? t('food.meals.manageMealData.title') : t('food.manageFoodData.title');

  const searchPlaceholder =
    variant === 'meal'
      ? t('food.meals.manageMealData.searchPlaceholder')
      : t('food.manageFoodData.searchPlaceholder');

  const noItemsText =
    variant === 'meal'
      ? t('food.meals.manageMealData.noMeals', 'No meals yet')
      : t('food.manageFoodData.noLogs', 'No food logs yet');

  const noItemsDesc =
    variant === 'meal'
      ? t('food.meals.manageMealData.noMealsDesc', 'Create custom meals to see them here')
      : t('food.manageFoodData.noLogsDesc', 'Start tracking your meals to see them here');

  const endOfHistoryText =
    variant === 'meal'
      ? t('food.meals.manageMealData.endOfHistory')
      : t('food.manageFoodData.endOfHistory');

  const menuTitle =
    variant === 'meal'
      ? t('food.meals.manageMealData.mealOptions')
      : t('food.manageFoodData.foodOptions');

  // Unify load more button to size="md" and consistent labels
  const loadingLabel = isLoadingMore
    ? t('common.loading', 'Loading...')
    : t('bodyMetrics.history.loadMore', 'Load More');

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={title}
        headerRight={renderHeaderRight()}
        scrollable
      >
        <ScrollView className="mt-6 flex flex-col gap-3 px-4">
          {/* Search Bar */}
          <View className="relative">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              placeholder={searchPlaceholder}
              icon={<MaterialIcons name="search" size={20} color={theme.colors.text.tertiary} />}
            />
          </View>

          {/* Item List */}
          <View className="mt-6 flex flex-col gap-3">
            {isLoading ? (
              <View className="flex flex-col gap-4">
                <SkeletonLoader width={80} height={16} className="mb-2" />
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.colors.background.card,
                      borderColor: theme.colors.background.white5,
                    }}
                  >
                    <View className="flex-row items-center gap-4">
                      <SkeletonLoader width={40} height={40} borderRadius={20} />
                      <View className="flex-1 gap-2">
                        <SkeletonLoader width="70%" height={16} />
                        <SkeletonLoader width="50%" height={14} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : typedDayGroups.length === 0 ? (
              <View
                className="items-center justify-center py-12"
                style={{ backgroundColor: theme.colors.background.card }}
              >
                <MaterialIcons
                  name="restaurant-menu"
                  size={48}
                  color={theme.colors.text.tertiary}
                />
                <Text
                  className="mt-3 text-center text-base font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {noItemsText}
                </Text>
                <Text
                  className="mt-1 text-center text-sm"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {noItemsDesc}
                </Text>
              </View>
            ) : (
              typedDayGroups.map((dayData) => (
                <View
                  key={`${dayData.date}-${dayData.dateTimestamp}`}
                  className="flex flex-col gap-2"
                >
                  <View>
                    <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                      {dayData.date}
                    </Text>
                  </View>
                  <View className="flex flex-col gap-2">{dayData.items.map(renderItem)}</View>
                </View>
              ))
            )}

            {!isLoading && hasMore ? (
              <View className="py-4">
                <Button
                  label={loadingLabel}
                  variant="outline"
                  size="md"
                  width="full"
                  disabled={isLoadingMore}
                  loading={isLoadingMore}
                  onPress={loadMore}
                />
              </View>
            ) : null}
          </View>

          {/* End of history indicator */}
          {!isLoading && typedDayGroups.length > 0 && !hasMore ? (
            <View className="mt-12 flex flex-col items-center justify-center opacity-40">
              <MaterialIcons name="history" size={48} color={theme.colors.text.tertiary} />
              <Text className="mt-2 text-sm font-medium text-text-tertiary">
                {endOfHistoryText}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </FullScreenModal>

      {/* Item Menu */}
      <BottomPopUpMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={menuTitle}
        items={getMenuItems()}
      />
    </>
  );
}

// Wrapper: owns search state and calls only useMealDataLogs
type MealDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function MealDataModal({ visible, onClose }: MealDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore } = useMealDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="meal"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
    />
  );
}

// Wrapper: owns search state and calls only useFoodDataLogs
type FoodDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FoodDataModal({ visible, onClose }: FoodDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore } = useFoodDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="food"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
    />
  );
}
