import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { type MealDataDisplayItem, useMealDataLogs } from '../../hooks/useMealDataLogs';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { Button } from '../theme/Button';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { TextInput } from '../theme/TextInput';
import { FullScreenModal } from './FullScreenModal';

type MealDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function MealDataModal({ visible, onClose }: MealDataModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMealItem, setSelectedMealItem] = useState<MealDataDisplayItem | null>(null);
  const [showMealMenu, setShowMealMenu] = useState(false);

  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useMealDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  const handleMealItemPress = (item: MealDataDisplayItem) => {
    setSelectedMealItem(item);
    setShowMealMenu(true);
  };

  const getMealMenuItems = () => {
    if (!selectedMealItem) {
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
      <MaterialIcons name={selectedMealItem.isFavorite ? 'star' : 'star-border'} {...props} />
    );

    return [
      {
        icon: FavoriteIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: selectedMealItem.isFavorite
          ? t('meals.manageMealData.removeFromFavorites')
          : t('meals.manageMealData.addToFavorites'),
        description: selectedMealItem.isFavorite
          ? t('meals.manageMealData.removeFromFavoritesDesc')
          : t('meals.manageMealData.addToFavoritesDesc'),
        onPress: () => {
          console.log('Toggle favorite:', selectedMealItem.name);
        },
      },
      {
        icon: EditIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: t('meals.manageMealData.editMeal'),
        description: t('meals.manageMealData.editMealDesc'),
        onPress: () => {
          console.log('Edit meal:', selectedMealItem.name);
        },
      },
      {
        icon: DuplicateIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: t('meals.manageMealData.duplicateMeal'),
        description: t('meals.manageMealData.duplicateMealDesc'),
        onPress: () => {
          console.log('Duplicate meal:', selectedMealItem.name);
        },
      },
      {
        icon: DeleteIcon,
        iconColor: theme.colors.status.error50,
        iconBgColor: 'rgba(239, 68, 68, 0.1)',
        title: t('meals.manageMealData.deleteMeal'),
        description: t('meals.manageMealData.deleteMealDesc'),
        onPress: () => {
          console.log('Delete meal:', selectedMealItem.name);
        },
      },
    ];
  };

  const renderMealItem = (item: MealDataDisplayItem) => (
    <GenericCard key={item.id} variant="card" isPressable onPress={() => handleMealItemPress(item)}>
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1 flex-row items-center gap-4">
          <View
            className="size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.iconBgColor }}
          >
            <MaterialIcons name={item.icon} size={20} color={item.iconColor} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-semibold leading-snug text-text-primary">
                {item.name}
              </Text>
              {item.isFavorite ? (
                <MaterialIcons name="star" size={16} color={theme.colors.accent.secondary} />
              ) : null}
            </View>
            <Text className="text-sm font-medium tracking-wider text-text-secondary">
              {t('meals.manageMealData.caloriesMacrosFormat', {
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
          onPress={() => handleMealItemPress(item)}
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

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('meals.manageMealData.title')}
        headerRight={renderHeaderRight()}
        scrollable
      >
        <ScrollView className="mt-6 flex flex-col gap-3 px-4">
          {/* Search Bar */}
          <View className="relative">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('meals.manageMealData.searchPlaceholder')}
              icon={<MaterialIcons name="search" size={20} color={theme.colors.text.tertiary} />}
            />
          </View>

          {/* Meal List */}
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
            ) : dayGroups.length === 0 ? (
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
                  {t('meals.manageMealData.noMeals', 'No meals yet')}
                </Text>
                <Text
                  className="mt-1 text-center text-sm"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {t('meals.manageMealData.noMealsDesc', 'Create custom meals to see them here')}
                </Text>
              </View>
            ) : (
              dayGroups.map((dayData) => (
                <View
                  key={`${dayData.date}-${dayData.dateTimestamp}`}
                  className="flex flex-col gap-2"
                >
                  <View>
                    <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                      {dayData.date}
                    </Text>
                  </View>
                  <View className="flex flex-col gap-2">{dayData.items.map(renderMealItem)}</View>
                </View>
              ))
            )}

            {!isLoading && hasMore ? (
              <View className="py-4">
                <Button
                  label={
                    isLoadingMore
                      ? t('common.loading', 'Loading...')
                      : t('bodyMetrics.history.loadMore', 'Load More')
                  }
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
          {!isLoading && dayGroups.length > 0 && !hasMore ? (
            <View className="mt-12 flex flex-col items-center justify-center opacity-40">
              <MaterialIcons name="history" size={48} color={theme.colors.text.tertiary} />
              <Text className="mt-2 text-sm font-medium text-text-tertiary">
                {t('meals.manageMealData.endOfHistory')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </FullScreenModal>

      {/* Meal Item Menu */}
      <BottomPopUpMenu
        visible={showMealMenu}
        onClose={() => setShowMealMenu(false)}
        title={t('meals.manageMealData.mealOptions')}
        items={getMealMenuItems()}
      />
    </>
  );
}
