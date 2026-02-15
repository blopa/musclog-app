import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { MealItemCard } from '../../components/cards/MealItemCard';
import { FilterTabs } from '../../components/FilterTabs';
import { MasterLayout } from '../../components/MasterLayout';
import { AddMealModal } from '../../components/modals/AddMealModal';
import { CreateMealModal } from '../../components/modals/CreateMealModal';
import { LogMealModal } from '../../components/modals/LogMealModal';
import { MenuButton } from '../../components/theme/MenuButton';
import { TextInput } from '../../components/theme/TextInput';
import type { MealType } from '../../database/models';
import Meal from '../../database/models/Meal';
import { MealService , NutritionService } from '../../database/services';
import { useMeals } from '../../hooks/useMeals';
import { useTheme } from '../../hooks/useTheme';
import { FullScreenModal } from '../../components/modals/FullScreenModal';
import type { PersonalInfo } from '../../components/EditPersonalInfoBody';

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

// Wrapper component to handle async nutrient calculation for LogMealModal
function LogMealModalWrapper({
  visible,
  meal,
  onClose,
  onLogMeal,
}: {
  visible: boolean;
  meal: Meal;
  onClose: () => void;
  onLogMeal: (date: Date, mealType: MealType) => Promise<void>;
}) {
  const [nutrients, setNutrients] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null>(null);
  const [isLoadingNutrients, setIsLoadingNutrients] = useState(true);

  useEffect(() => {
    if (visible && meal) {
      const loadNutrients = async () => {
        setIsLoadingNutrients(true);
        try {
          const totalNutrients = await meal.getTotalNutrients();
          setNutrients({
            calories: Math.round(totalNutrients.calories),
            protein: Math.round(totalNutrients.protein),
            carbs: Math.round(totalNutrients.carbs),
            fat: Math.round(totalNutrients.fat),
          });
        } catch (error) {
          console.error('Error loading meal nutrients:', error);
          setNutrients({ calories: 0, protein: 0, carbs: 0, fat: 0 });
        } finally {
          setIsLoadingNutrients(false);
        }
      };
      loadNutrients();
    }
  }, [visible, meal]);

  if (!nutrients && isLoadingNutrients) {
    return null; // Don't render modal until nutrients are loaded
  }

  return (
    <LogMealModal
      visible={visible}
      onClose={onClose}
      meal={{
        // TODO: use translations here
        name: meal.name ?? 'Untitled Meal',
        type: 'Custom Meal',
        image: meal.imageUrl,
        calories: nutrients?.calories ?? 0,
        protein: nutrients?.protein ?? 0,
        carbs: nutrients?.carbs ?? 0,
        fat: nutrients?.fat ?? 0,
      }}
      onLogMeal={onLogMeal}
    />
  );
}

type MyMealsScreenProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MyMealsScreen({ visible, onClose }: MyMealsScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
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

  // Fetch meals from database
  const { meals, isLoading, refresh } = useMeals({
    mode: 'list',
    getAll: true,
    sortBy: 'name',
    sortOrder: 'asc',
  }) as { meals: Meal[]; isLoading: boolean; refresh: () => Promise<void> };

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

  const handleTrackMeal = async (mealId: string) => {
    const meal = mealsMap.get(mealId);
    if (!meal) {
      console.error('Meal not found:', mealId);
      return;
    }

    setSelectedMealForLogging(meal);
    setLogMealModalVisible(true);
  };

  const handleLogMeal = async (date: Date, mealType: MealType) => {
    if (!selectedMealForLogging) {
      return;
    }

    try {
      // Get meal with its foods
      const mealWithFoods = await MealService.getMealWithFoods(selectedMealForLogging.id);

      if (!mealWithFoods) {
        console.error('Failed to get meal foods');
        return;
      }

      // Log each food in the meal
      for (const mealFood of mealWithFoods.foods) {
        await NutritionService.logFood(
          mealFood.foodId,
          date,
          mealType,
          mealFood.amount,
          mealFood.portionId
        );
      }

      // Close modal and reset
      setLogMealModalVisible(false);
      setSelectedMealForLogging(null);
    } catch (error) {
      console.error('Error logging meal:', error);
    }
  };

  // Show loading state
  const showLoading = isLoading || isTransforming;

  return (
    <FullScreenModal visible={visible} onClose={onClose} title={t('meals.title')}>
      <View className="flex-1 bg-bg-primary">
        {/* Header */}
        <View className="px-6 pb-4 pt-6">
          <View className="mb-4 flex-row items-center justify-between">
            {/*TODO: move this button to FullScreenModal header*/}
            <MenuButton
              size="md"
              color={theme.colors.text.primary}
              onPress={() => setAddMealModalVisible(true)}
              className="h-10 w-10"
            />
          </View>

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
                  onTrackPress={() => handleTrackMeal(meal.id)}
                />
              ))}
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
          />
        ) : null}
        {/* CreateMealModal */}
        {createMealModalVisible ? (
          <CreateMealModal
            visible={createMealModalVisible}
            onClose={() => setCreateMealModalVisible(false)}
            onSave={() => {
              refresh();
            }}
          />
        ) : null}
        {/* LogMealModal */}
        {logMealModalVisible && selectedMealForLogging ? (
          <LogMealModalWrapper
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
