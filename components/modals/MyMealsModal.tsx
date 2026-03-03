import { Pencil, Search, Trash2, Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';

import Meal from '../../database/models/Meal';
import { MealService } from '../../database/services';
import { useMeals, type UseMealsResultBasic } from '../../hooks/useMeals';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { MealItemCard } from '../cards/MealItemCard';
import { FilterTabs } from '../FilterTabs';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { TextInput } from '../theme/TextInput';
import { AddMealModal } from './AddMealModal';
import { CreateMealModal } from './CreateMealModal';
import { FoodMealDetailsModal } from './FoodMealDetailsModal';
import { FullScreenModal } from './FullScreenModal';

// Type for transformed meal data that matches MealItemCard props
type MealCardData = {
  id: string;
  title: string;
  tags: string[];
  calories: number;
  macros: {
    protein: string;
    carbs: string;
    fat: string;
  };
  image: any;
};

const deriveTags = (
  nutrients: { protein: number; carbs: number; fat: number },
  name: string,
  description?: string
): string[] => {
  const tags: string[] = [];

  // Check for high protein
  if (nutrients.protein >= 40) {
    tags.push('High Protein');
  }

  // Check for keto friendly (low carbs)
  if (nutrients.carbs < 20) {
    tags.push('Keto Friendly');
  }

  // Check for vegetarian keywords
  const fullText = `${name} ${description || ''}`.toLowerCase();
  if (
    fullText.includes('vegetarian') ||
    (fullText.includes('egg') && !fullText.includes('chicken') && !fullText.includes('salmon'))
  ) {
    tags.push('Vegetarian');
  }

  // Infer meal type from name
  const lowerName = name.toLowerCase();
  if (
    lowerName.includes('breakfast') ||
    lowerName.includes('oatmeal') ||
    lowerName.includes('toast')
  ) {
    tags.push('Breakfast');
  } else if (lowerName.includes('lunch') || lowerName.includes('bowl')) {
    tags.push('Lunch');
  } else if (lowerName.includes('dinner') || lowerName.includes('salad')) {
    tags.push('Dinner');
  }

  return tags;
};

type MyMealsModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MyMealsModal({ visible, onClose }: MyMealsModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isAiFeaturesEnabled } = useSettings();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const FILTER_TABS = [
    { id: 'all', label: t('meals.filters.all') },
    { id: 'high-protein', label: t('meals.filters.highProtein') },
    { id: 'breakfast', label: t('meals.filters.breakfast') },
    { id: 'lunch', label: t('meals.filters.lunch') },
  ];
  const [addMealModalVisible, setAddMealModalVisible] = useState(false);
  const [createMealModalVisible, setCreateMealModalVisible] = useState(false);
  const [logMealModalVisible, setLogMealModalVisible] = useState(false);
  const [selectedMealForLogging, setSelectedMealForLogging] = useState<Meal | null>(null);
  const [menuMealId, setMenuMealId] = useState<string | null>(null);
  const [editMealId, setEditMealId] = useState<string | null>(null);

  // Load only 10 meals initially with pagination
  const { meals, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useMeals({
    mode: 'list',
    initialLimit: 10,
    batchSize: 10,
    getAll: false,
    sortBy: 'name',
    sortOrder: 'asc',
  }) as UseMealsResultBasic;

  // State to store transformed meal data with nutrients
  const [mealCardsData, setMealCardsData] = useState<MealCardData[]>([]);
  const [isTransforming, setIsTransforming] = useState(false);

  // Map to store meal objects by ID for quick lookup
  const mealsMap = useMemo(() => {
    const map = new Map<string, Meal>();
    meals.forEach((meal) => {
      map.set(meal.id, meal);
    });
    return map;
  }, [meals]);

  // Transform meals to card data format
  useEffect(() => {
    const transformMeals = async () => {
      if (meals.length === 0) {
        setMealCardsData([]);
        return;
      }

      setIsTransforming(true);
      try {
        const transformedMeals = await Promise.all(
          meals.map(async (meal) => {
            const nutrients = await meal.getTotalNutrients();
            const tags = deriveTags(nutrients, meal.name ?? '', meal.description);

            return {
              id: meal.id,
              title: meal.name ?? 'Untitled Meal',
              tags,
              calories: Math.round(nutrients.calories),
              macros: {
                protein: Math.round(nutrients.protein) + 'g',
                carbs: Math.round(nutrients.carbs) + 'g',
                fat: Math.round(nutrients.fat) + 'g',
              },
              image: meal.imageUrl ? { uri: meal.imageUrl } : require('../../assets/icon.png'),
            };
          })
        );
        setMealCardsData(transformedMeals);
      } catch (error) {
        console.error('Error transforming meals:', error);
      } finally {
        setIsTransforming(false);
      }
    };

    transformMeals();
  }, [meals]);

  // Filter meals based on active filter and search query
  const filteredMeals = useMemo(() => {
    let filtered = mealCardsData;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((meal) => {
        return (
          meal.title.toLowerCase().includes(query) ||
          meal.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
    }

    // Apply category filter
    if (activeFilter !== 'all') {
      const lowerFilter = activeFilter.toLowerCase();
      filtered = filtered.filter((meal) => {
        if (lowerFilter === 'high-protein') {
          return meal.tags.some((tag) => tag.toLowerCase().includes('high protein'));
        }
        return meal.tags.some((tag) => tag.toLowerCase().includes(lowerFilter));
      });
    }

    return filtered;
  }, [mealCardsData, activeFilter, searchQuery]);

  // Handlers for AddMealModal options
  const handleCreateMeal = () => {
    setAddMealModalVisible(false);
    setTimeout(() => setCreateMealModalVisible(true), 300); // Wait for modal close animation
  };

  const handleGenerateMealAI = () => {
    setAddMealModalVisible(false);
    // Implement generate meal with AI logic
    console.log('Generate Meal with AI pressed');
  };

  const handleManageCategories = () => {
    setAddMealModalVisible(false);
    // Implement manage categories logic
    console.log('Manage Categories pressed');
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleOpenMenu = (mealId: string) => {
    setMenuMealId(mealId);
  };

  const handleTrackMeal = (mealId: string) => {
    const meal = mealsMap.get(mealId);
    if (!meal) {
      console.error('Meal not found:', mealId);
      return;
    }

    setSelectedMealForLogging(meal);
    setLogMealModalVisible(true);
  };

  const handleEditMeal = (mealId: string) => {
    setEditMealId(mealId);
  };

  const handleDeleteMeal = (mealId: string) => {
    // TODO: use ConfirmationModal instead
    Alert.alert(
      t('food.meals.manageMealData.deleteMeal'),
      t('food.meals.manageMealData.deleteMealWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await MealService.deleteMeal(mealId);
              await refresh();
            } catch (error) {
              console.error('Error deleting meal:', error);
            }
          },
        },
      ]
    );
  };

  // just clean up state here, do not log again.
  const handleLogMeal = useCallback(
    async (_data: { meal: string; date: Date }) => {
      await refresh();
      setLogMealModalVisible(false);
      setSelectedMealForLogging(null);
      onClose();
    },
    [onClose, refresh]
  );

  const showLoading = isLoading || isTransforming;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('meals.title')}
      headerRight={
        <MenuButton
          size="md"
          color={theme.colors.text.primary}
          onPress={() => setAddMealModalVisible(true)}
          className="h-10 w-10"
        />
      }
    >
      <View className="flex-1 bg-bg-primary">
        {/* Header */}
        <View className="px-6 pb-4 pt-6">
          {/* Search Input */}
          <TextInput
            label=""
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search meals..."
            icon={<Search size={theme.iconSize.md} color={theme.colors.text.secondary} />}
          />
        </View>

        {/* Filter Tabs */}
        <View className="mb-6">
          <FilterTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.xl }}
          />
        </View>

        {/* Meal List */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.padding.xl,
            gap: theme.spacing.gap.base,
          }}
        >
          {showLoading ? (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              <Text
                className="mt-4 font-medium"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                Loading meals...
              </Text>
            </View>
          ) : filteredMeals.length === 0 ? (
            <View className="flex-1 items-center justify-center py-12">
              <Text
                className="mb-2 font-bold"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.xl,
                }}
              >
                {searchQuery.trim()
                  ? 'No meals found'
                  : activeFilter === 'all'
                    ? 'No meals yet'
                    : 'No meals found'}
              </Text>
              <Text
                className="text-center font-medium"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {searchQuery.trim()
                  ? `No meals match "${searchQuery}"`
                  : activeFilter === 'all'
                    ? 'Create your first meal to get started'
                    : 'Try a different filter'}
              </Text>
            </View>
          ) : (
            <>
              {filteredMeals.map((meal) => (
                <MealItemCard
                  key={meal.id}
                  title={meal.title}
                  tags={meal.tags}
                  calories={meal.calories}
                  macros={meal.macros}
                  image={meal.image}
                  onMenuPress={() => handleOpenMenu(meal.id)}
                />
              ))}
              {/* Load More Button */}
              {hasMore ? (
                <View className="py-4">
                  <Button
                    label={isLoadingMore ? 'Loading more...' : 'Load More'}
                    onPress={loadMore}
                    size="sm"
                    variant="outline"
                    disabled={isLoadingMore}
                    loading={isLoadingMore}
                    width="full"
                  />
                </View>
              ) : null}
              {/* Bottom spacing for FAB and TabBar */}
              <View style={{ height: theme.size['120'] }} />
            </>
          )}
        </ScrollView>

        {/* AddMealModal */}
        {addMealModalVisible ? (
          <AddMealModal
            visible={addMealModalVisible}
            onClose={() => setAddMealModalVisible(false)}
            onCreateMeal={handleCreateMeal}
            onGenerateMealAI={handleGenerateMealAI}
            onManageCategories={handleManageCategories}
            isAiEnabled={isAiFeaturesEnabled}
          />
        ) : null}
        {/* CreateMealModal (create or edit) */}
        {createMealModalVisible || !!editMealId ? (
          <CreateMealModal
            visible={createMealModalVisible || !!editMealId}
            meal={editMealId ? mealsMap.get(editMealId) : undefined}
            onClose={() => {
              setCreateMealModalVisible(false);
              setEditMealId(null);
            }}
            onSave={() => {
              refresh();
            }}
          />
        ) : null}
        {/* Meal Options Menu */}
        {menuMealId ? (
          <BottomPopUpMenu
            visible={!!menuMealId}
            onClose={() => setMenuMealId(null)}
            title={t('food.meals.manageMealData.mealOptions')}
            items={[
              {
                icon: Utensils,
                iconColor: theme.colors.text.black,
                iconBgColor: theme.colors.accent.primary,
                title: t('food.actions.track'),
                description: t('meals.logMeal'),
                onPress: () => handleTrackMeal(menuMealId),
              },
              {
                icon: Pencil,
                iconColor: theme.colors.text.primary,
                iconBgColor: theme.colors.background.iconDarker,
                title: t('food.meals.manageMealData.editMeal'),
                description: t('food.meals.manageMealData.editMealDesc'),
                onPress: () => handleEditMeal(menuMealId),
              },
              {
                icon: Trash2,
                iconColor: theme.colors.status.error,
                iconBgColor: theme.colors.status.error20,
                title: t('food.meals.manageMealData.deleteMeal'),
                description: t('food.meals.manageMealData.deleteMealDesc'),
                titleColor: theme.colors.status.error,
                onPress: () => handleDeleteMeal(menuMealId),
              },
            ]}
          />
        ) : null}
        {/* FoodDetailsModal for Meal */}
        {logMealModalVisible && selectedMealForLogging ? (
          <FoodMealDetailsModal
            visible={logMealModalVisible}
            meal={selectedMealForLogging}
            onClose={() => {
              setLogMealModalVisible(false);
              setSelectedMealForLogging(null);
            }}
            onLogMeal={handleLogMeal}
          />
        ) : null}
      </View>
    </FullScreenModal>
  );
}
