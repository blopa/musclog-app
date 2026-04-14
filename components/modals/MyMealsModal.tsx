import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Pencil, Search, Share2, Trash2, Utensils } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { MealItemCard } from '@/components/cards/MealItemCard';
import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/theme/Button';
import { MenuButton } from '@/components/theme/MenuButton';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { database } from '@/database';
import type { MealType } from '@/database/models';
import Food from '@/database/models/Food';
import Meal from '@/database/models/Meal';
import { FoodService, MealService, NutritionService } from '@/database/services';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMeals, type UseMealsResultBasic } from '@/hooks/useMeals';
import { useNativeShareText } from '@/hooks/useNativeShareText';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import i18n from '@/lang/lang';
import AiService from '@/services/AiService';
import { trackMeal } from '@/utils/coachAI';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';
import { captureException } from '@/utils/sentry';

import { AddMealModal } from './AddMealModal';
import { AINutritionTrackingContextModal } from './AINutritionTrackingContextModal';
import { ConfirmationModal } from './ConfirmationModal';
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
    tags.push(i18n.t('meals.tags.highProtein'));
  }

  // Check for keto friendly (low carbs)
  if (nutrients.carbs < 20) {
    tags.push(i18n.t('meals.tags.ketoFriendly'));
  }

  // Check for vegetarian keywords
  const fullText = `${name} ${description || ''}`.toLowerCase();
  if (
    fullText.includes('vegetarian') ||
    (fullText.includes('egg') && !fullText.includes('chicken') && !fullText.includes('salmon'))
  ) {
    tags.push(i18n.t('meals.tags.vegetarian'));
  }

  // Infer meal type from name
  const lowerName = name.toLowerCase();
  if (
    lowerName.includes('breakfast') ||
    lowerName.includes('oatmeal') ||
    lowerName.includes('toast')
  ) {
    tags.push(i18n.t('meals.tags.breakfast'));
  } else if (lowerName.includes('lunch') || lowerName.includes('bowl')) {
    tags.push(i18n.t('meals.tags.lunch'));
  } else if (lowerName.includes('dinner') || lowerName.includes('salad')) {
    tags.push(i18n.t('meals.tags.dinner'));
  }

  return tags;
};

type MyMealsModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Pre-selected meal type to use when logging a meal. */
  initialMealType?: MealType;
};

export default function MyMealsModal({ visible, onClose, initialMealType }: MyMealsModalProps) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const theme = useTheme();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { shareText } = useNativeShareText();
  const { isAiConfigured } = useSettings();
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
  const [deleteMealId, setDeleteMealId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingMealAI, setIsGeneratingMealAI] = useState(false);
  const [generateMealContextVisible, setGenerateMealContextVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAddMealModalVisible(false);
      setCreateMealModalVisible(false);
      setLogMealModalVisible(false);
      setSelectedMealForLogging(null);
      setMenuMealId(null);
      setEditMealId(null);
      setDeleteMealId(null);
      setGenerateMealContextVisible(false);
    }
  }, [visible]);

  // Keep screen awake during AI meal generation
  useEffect(() => {
    if (isGeneratingMealAI) {
      activateKeepAwakeAsync('my-meals-ai-generation').catch(() => {});
    } else {
      deactivateKeepAwake('my-meals-ai-generation').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('my-meals-ai-generation').catch(() => {});
    };
  }, [isGeneratingMealAI]);

  // Load only 10 meals initially with pagination
  const { meals, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useMeals({
    mode: 'list',
    initialLimit: 10,
    batchSize: 10,
    getAll: false,
    sortBy: 'name',
    sortOrder: 'asc',
    visible, // avoid loading while modal is hidden
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
              title: meal.name ?? t('meals.untitledMeal'),
              tags,
              calories: nutrients.calories,
              macros: {
                protein: t('common.weightFormatG', {
                  value: formatRoundedDecimal(nutrients.protein, 2),
                }),
                carbs: t('common.weightFormatG', {
                  value: formatRoundedDecimal(nutrients.carbs, 2),
                }),
                fat: t('common.weightFormatG', {
                  value: formatRoundedDecimal(nutrients.fat, 2),
                }),
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
  }, [meals, t, formatRoundedDecimal]);

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

  const handleGenerateMealAI = useCallback(() => {
    if (isGeneratingMealAI) {
      return;
    }

    setAddMealModalVisible(false);
    setTimeout(() => setGenerateMealContextVisible(true), 300);
  }, [isGeneratingMealAI]);

  const handleGenerateMealAIWithContext = useCallback(
    async (context: { description: string; tags: string[] }) => {
      const aiConfig = await AiService.getAiConfig();
      if (!aiConfig) {
        showSnackbar('error', t('meals.generateAI.aiNotConfigured'));
        return;
      }

      setIsGeneratingMealAI(true);
      try {
        const userContent = [
          context.description.trim(),
          context.tags.length > 0
            ? `${i18n.t('meals.generateAI.preferencesLabel')}: ${context.tags.join(', ')}`
            : '',
        ]
          .filter(Boolean)
          .join('. ');

        const result = await trackMeal(aiConfig, userContent);
        if (!result || result.meals.length === 0) {
          showSnackbar('error', t('meals.generateAI.errorMessage'));
          return;
        }

        // Merge all ingredients across returned meal types into one meal template.
        // Normalize first: for ingredients matched to foundation foods (foodId present),
        // the LLM returns 0 macros and expects us to look up the real values from the DB.
        const allIngredients = result.meals.flatMap((m) => m.ingredients);
        const normalized = await NutritionService.normalizeAiMealIngredients(allIngredients);
        const foodItems = await Promise.all(
          normalized.map(async (ingredient) => {
            // Reuse the existing food when the LLM matched one; create custom otherwise
            if (ingredient.foodId) {
              try {
                await database.get<Food>('foods').find(ingredient.foodId);
                return { foodId: ingredient.foodId, amount: ingredient.grams };
              } catch (error) {
                captureException(error, {
                  data: { context: 'MyMealsModal.handleGenerateMealAIWithContext' },
                });
              }
            }

            const food = await FoodService.createCustomFood(ingredient.name, {
              calories: roundToDecimalPlaces((ingredient.kcal / ingredient.grams) * 100),
              protein: roundToDecimalPlaces((ingredient.protein / ingredient.grams) * 100),
              carbs: roundToDecimalPlaces((ingredient.carbs / ingredient.grams) * 100),
              fat: roundToDecimalPlaces((ingredient.fat / ingredient.grams) * 100),
              fiber: roundToDecimalPlaces(((ingredient.fiber ?? 0) / ingredient.grams) * 100),
            });
            return { foodId: food.id, amount: ingredient.grams };
          })
        );

        const mealName = context.description.trim() || context.tags.join(', ');
        await MealService.createMealFromFoods(
          mealName,
          foodItems,
          context.description.trim(),
          true
        );

        await refresh();
        showSnackbar('success', t('meals.generateAI.successMessage'));
      } catch {
        showSnackbar('error', t('meals.generateAI.errorMessage'));
      } finally {
        setIsGeneratingMealAI(false);
      }
    },
    [refresh, showSnackbar, t]
  );

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
    setMenuMealId(null);
    setDeleteMealId(mealId);
  };

  const handleShareMealAsRecipe = useCallback(
    async (mealId: string) => {
      setMenuMealId(null);
      try {
        const data = await MealService.getMealWithFoods(mealId);
        if (!data) {
          showSnackbar('error', t('errors.somethingWentWrong'));
          return;
        }

        const { meal, foods } = data;
        const ingredientLines: string[] = [];

        for (const mealFood of foods) {
          const grams = await mealFood.getGramWeight();
          const food = await mealFood.food;
          const name = food?.name?.trim() || t('food.unknownFood');
          const gramsStr = formatRoundedDecimal(grams, 2);
          ingredientLines.push(
            t('food.meals.manageMealData.shareRecipeIngredientLine', {
              grams: gramsStr,
              name,
            })
          );
        }

        if (ingredientLines.length === 0) {
          showSnackbar('error', t('food.meals.manageMealData.shareRecipeNoIngredients'));
          return;
        }

        const description = meal.description?.trim() ?? '';
        const message =
          description.length > 0
            ? `${ingredientLines.join('\n')}\n\n${description}`
            : ingredientLines.join('\n');

        await shareText(message, { title: meal.name ?? undefined });
      } catch (error) {
        captureException(error, { data: { context: 'MyMealsModal.handleShareMealAsRecipe' } });
        showSnackbar('error', t('errors.somethingWentWrong'));
      }
    },
    [formatRoundedDecimal, shareText, showSnackbar, t]
  );

  const handleConfirmDelete = async () => {
    if (!deleteMealId) {
      return;
    }

    setIsDeleting(true);
    try {
      await MealService.deleteMeal(deleteMealId);
      await refresh();
    } catch (error) {
      console.error('Error deleting meal:', error);
      captureException(error, { data: { context: 'MyMealsModal.handleConfirmDelete' } });
      showSnackbar('error', t('errors.somethingWentWrong'));
    } finally {
      setIsDeleting(false);
      setDeleteMealId(null);
    }
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

  const showLoading = isLoading || isTransforming || isGeneratingMealAI;

  // Helper functions to avoid nested ternaries
  const getEmptyStateTitle = () => {
    if (searchQuery.trim()) {
      return t('meals.noMealsFound');
    }

    return activeFilter === 'all' ? t('meals.noMealsYet') : t('meals.noMealsFound');
  };

  const getEmptyStateMessage = () => {
    if (searchQuery.trim()) {
      return t('meals.noMealsMatch', { query: searchQuery });
    }

    return activeFilter === 'all' ? t('meals.createFirstMeal') : t('meals.tryDifferentFilter');
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('meals.title')}
      closable={!isGeneratingMealAI}
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
        <View className="px-4 pb-4 pt-6">
          {/* Search Input */}
          <TextInput
            label=""
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t('meals.searchPlaceholder')}
            editable={!isGeneratingMealAI}
            icon={<Search size={theme.iconSize.md} color={theme.colors.text.secondary} />}
          />
        </View>

        {/* Filter Tabs */}
        <View className="mb-6">
          <FilterTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onTabChange={isGeneratingMealAI ? () => {} : setActiveFilter}
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
                {isGeneratingMealAI ? t('meals.generateAI.generating') : t('meals.loadingMeals')}
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
                {getEmptyStateTitle()}
              </Text>
              <Text
                className="text-center font-medium"
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {getEmptyStateMessage()}
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
                    label={isLoadingMore ? t('meals.loadingMore') : t('meals.loadMore')}
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
            isAiEnabled={isAiConfigured}
          />
        ) : null}
        {/* AI Meal Generation Context Modal */}
        {generateMealContextVisible ? (
          <AINutritionTrackingContextModal
            visible={generateMealContextVisible}
            onClose={() => setGenerateMealContextVisible(false)}
            onApply={handleGenerateMealAIWithContext}
            title={t('meals.generateAI.title')}
            describeLabel={t('meals.generateAI.describeLabel')}
            placeholder={t('meals.generateAI.placeholder')}
            applyLabel={t('meals.generateAI.applyLabel')}
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
                icon: Share2,
                iconColor: theme.colors.text.primary,
                iconBgColor: theme.colors.background.iconDarker,
                title: t('food.meals.manageMealData.shareMealAsRecipe'),
                description: t('food.meals.manageMealData.shareMealAsRecipeDesc'),
                onPress: () => {
                  void handleShareMealAsRecipe(menuMealId);
                },
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
            isAiEnabled={isAiConfigured}
            initialMealType={initialMealType}
          />
        ) : null}
        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          visible={!!deleteMealId}
          onClose={() => setDeleteMealId(null)}
          onConfirm={handleConfirmDelete}
          title={t('food.meals.manageMealData.deleteMeal')}
          message={t('food.meals.manageMealData.deleteMealWarning')}
          confirmLabel={t('common.delete')}
          variant="destructive"
          isLoading={isDeleting}
        />
      </View>
    </FullScreenModal>
  );
}
