import { Plus, QrCode, Search, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type MealType } from '../../database/models';
import Meal from '../../database/models/Meal';
import { NutritionService } from '../../database/services';
import { useFoods } from '../../hooks/useFoods';
import { useMeals, type UseMealsResultBasic } from '../../hooks/useMeals';
import { useTheme } from '../../hooks/useTheme';
import { type UnifiedFoodResult, useUnifiedFoodSearch } from '../../hooks/useUnifiedFoodSearch';
import { addOpacityToHex } from '../../theme';
import { Button } from '../theme/Button';
import { FoodMealDetailsModal } from './FoodMealDetailsModal';
import { FullScreenModal } from './FullScreenModal';

type FoodItem = UnifiedFoodResult & {
  icon?: string; // Emoji or icon name
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
};

type FoodSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  mealType: MealType; // e.g., "Breakfast", "Lunch", etc.
  onCreatePress?: () => void;
  onBarcodeScanPress?: () => void;
  onFoodSelect?: (food: FoodItem) => void;
};

type UnderlineTabsProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

function UnderlineTabs({ tabs, activeTab, onTabChange }: UnderlineTabsProps) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-row"
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.padding.base,
        paddingTop: theme.spacing.padding.sm,
        gap: theme.spacing.gap.xl,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            className="pb-3"
            style={{
              borderBottomWidth: theme.borderWidth.medium,
              borderBottomColor: isActive ? theme.colors.accent.secondary : 'transparent',
            }}
          >
            <Text
              className="whitespace-nowrap text-sm"
              style={{
                color: isActive ? theme.colors.accent.secondary : theme.colors.text.secondary,
                fontWeight: isActive
                  ? theme.typography.fontWeight.semibold
                  : theme.typography.fontWeight.medium,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type FoodItemCardProps = {
  food: FoodItem;
  onAddPress: () => void;
};

function FoodItemCard({ food, onAddPress }: FoodItemCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const macroLine = t('food.manageFoodLibrary.macrosFormat', {
    protein: Math.round(food.protein ?? 0),
    carbs: Math.round(food.carbs ?? 0),
    fat: Math.round(food.fat ?? 0),
  });

  return (
    <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border-light bg-bg-overlay p-3 active:scale-[0.98]">
      {/* Icon/Image */}
      <View
        className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{
          backgroundColor: food.iconBgColor || theme.colors.background.secondaryDark,
          borderColor: food.iconColor
            ? addOpacityToHex(food.iconColor, theme.colors.opacity.subtle)
            : 'transparent',
        }}
      >
        {food.image ? (
          <Image
            source={food.image}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : food.imageUrl ? (
          <Image
            source={{ uri: food.imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : food.icon ? (
          <Text className="text-xl">{food.icon}</Text>
        ) : (
          <View className="h-full w-full opacity-80" />
        )}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between">
          <Text className="flex-1 truncate pr-2 font-semibold text-text-primary" numberOfLines={1}>
            {food.name}
          </Text>
          {food.grade ? (
            <View
              className="rounded border px-1.5 py-0.5"
              style={{
                backgroundColor: food.gradeColor
                  ? addOpacityToHex(food.gradeColor, theme.colors.opacity.veryLight)
                  : theme.colors.accent.primary5,
                borderColor: food.gradeColor
                  ? addOpacityToHex(food.gradeColor, theme.colors.opacity.subtle)
                  : theme.colors.accent.primary20,
              }}
            >
              <Text
                className="font-bold"
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: food.gradeColor || theme.colors.accent.primary,
                }}
              >
                {food.grade}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="truncate text-sm text-text-secondary" numberOfLines={1}>
          {food.description}
        </Text>
        <Text className="mt-0.5 text-xs text-text-secondary">{macroLine}</Text>
      </View>

      {/* Add Button */}
      <Pressable
        className="h-8 w-8 items-center justify-center rounded-full bg-bg-overlay active:bg-accent-primary"
        onPress={onAddPress}
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
        }}
      >
        <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </Pressable>
    </Pressable>
  );
}

type SectionHeaderProps = {
  title: string;
  icon?: typeof Sparkles;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
};

function SectionHeader({ title, icon: Icon, rightAction }: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View className="mb-3 flex-row items-center justify-between px-1">
      <View className="flex-row items-center gap-2">
        {Icon ? <Icon size={theme.iconSize.sm} color={theme.colors.accent.secondary} /> : null}
        <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          {title}
        </Text>
      </View>
      {rightAction ? (
        <Pressable onPress={rightAction.onPress}>
          <Text className="text-xs font-bold text-accent-secondary">{rightAction.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type MealCardData = {
  meal: Meal;
  name: string;
  description?: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type MealSearchCardProps = {
  mealData: MealCardData;
  onAddPress: () => void;
};

function MealSearchCard({ mealData, onAddPress }: MealSearchCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const macroSummary = t('food.manageFoodLibrary.macrosFormat', {
    protein: Math.round(mealData.protein),
    carbs: Math.round(mealData.carbs),
    fat: Math.round(mealData.fat),
  });

  return (
    <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border-light bg-bg-overlay p-3 active:scale-[0.98]">
      {/* Icon/Image */}
      <View
        className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
          borderColor: 'transparent',
        }}
      >
        {mealData.imageUrl ? (
          <Image
            source={{ uri: mealData.imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
            style={{ borderRadius: theme.borderRadius.xl }}
          />
        ) : (
          <Text className="text-xl">🍽️</Text>
        )}
      </View>

      {/* Content */}
      <View className="min-w-0 flex-1">
        <Text className="flex-1 truncate pr-2 font-semibold text-text-primary" numberOfLines={1}>
          {mealData.name}
        </Text>
        {mealData.description ? (
          <Text className="truncate text-sm text-text-secondary" numberOfLines={1}>
            {mealData.description}
          </Text>
        ) : null}
        <Text className="mt-0.5 text-sm text-text-secondary">
          {Math.round(mealData.calories)} {t('food.common.kcal')} • {macroSummary}
        </Text>
      </View>

      {/* Add Button */}
      <Pressable
        className="h-8 w-8 items-center justify-center rounded-full bg-bg-overlay active:bg-accent-primary"
        onPress={onAddPress}
        style={{
          backgroundColor: theme.colors.background.secondaryDark,
        }}
      >
        <Plus size={theme.iconSize.lg} color={theme.colors.accent.primary} />
      </Pressable>
    </Pressable>
  );
}

export function FoodSearchModal({
  visible,
  onClose,
  mealType,
  onCreatePress,
  onBarcodeScanPress,
  onFoodSelect,
}: FoodSearchModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isFoodDetailsVisible, setIsFoodDetailsVisible] = useState(false);
  const [isMealDetailsVisible, setIsMealDetailsVisible] = useState(false);

  // Get recent local foods for the "Recent History" section
  const { foods: recentFoods } = useFoods({
    mode: 'list',
    visible,
    enableReactivity: true,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    initialLimit: 5,
  });

  // Use unified search for both local and API results
  const {
    resultsBySource,
    isLoadingLocal,
    isLoadingAPI,
    error,
    localCount,
    apiCount,
    hasLocalResults,
    hasApiResults,
    isInitialLoad,
    hasMoreLocal,
    hasMoreAPI,
    isLoadingMoreLocal,
    isLoadingMoreAPI,
    loadMoreLocal,
    loadMoreAPI,
  } = useUnifiedFoodSearch({
    searchTerm: searchQuery,
    enabled: visible,
    includeLocal: true,
    includeAPI: true,
    localLimit: 10,
    apiLimit: 20,
    debounceMs: 300,
  });

  const [suggestedFoods, setSuggestedFoods] = useState<FoodItem[] | null>(null);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState('');
  const [favoriteFoods, setFavoriteFoods] = useState<FoodItem[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const {
    meals,
    isLoading: isLoadingMeals,
    isLoadingMore: isLoadingMoreMeals,
    hasMore: hasMoreMeals,
    loadMore: loadMoreMeals,
    totalCount: mealsTotalCount,
  } = useMeals({
    mode: 'list',
    visible,
    initialLimit: 10,
    batchSize: 10,
    sortBy: 'created_at',
    sortOrder: 'desc',
    enableReactivity: true,
  }) as UseMealsResultBasic;
  const [mealCardsData, setMealCardsData] = useState<MealCardData[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadSuggestions = async () => {
      if (!visible || searchQuery) {
        if (mounted) setSuggestedFoods(null);
        return;
      }

      setIsLoadingSuggested(true);

      try {
        const hour = new Date().getHours();
        let mealKey: MealType = 'other';
        let titleKey = 'foodSearch.commonFoods';

        if (hour < 10) {
          mealKey = 'breakfast';
          titleKey = 'foodSearch.commonBreakfastFoods';
        } else if (hour < 14) {
          mealKey = 'lunch';
          titleKey = 'foodSearch.commonLunchFoods';
        } else if (hour < 17) {
          mealKey = 'snack';
          titleKey = 'foodSearch.commonSnackFoods';
        } else if (hour < 21) {
          mealKey = 'dinner';
          titleKey = 'foodSearch.commonDinnerFoods';
        }

        // Try to get most eaten for this meal type
        const byMeal = await NutritionService.getMostEatenFoodsByMealType(mealKey as any, 5);
        let foodsArr = byMeal.map((r) => r.food).filter(Boolean);

        // Fallback to most eaten overall
        if (!foodsArr || foodsArr.length === 0) {
          const most = await NutritionService.getMostEatenFoods(5);
          foodsArr = most.map((r) => r.food).filter(Boolean);
          titleKey = 'foodSearch.yourFavoriteFoods';
        }

        if (mounted) {
          setSuggestedTitle(t(titleKey));
        }

        // Map to FoodItem
        const mapped = foodsArr.map(
          (f) =>
            ({
              id: f.id,
              name: f.name ?? '',
              description: `${f.brand || 'Custom Food'} • ${f.calories || 0} kcal`,
              brand: (f as any).brand,
              serving_size: '100 g', // TODO: use the PortionSize model instead
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              fiber: f.fiber,
              source: 'local',
              icon: '🍽️',
              iconColor: theme.colors.accent.primary,
              iconBgColor: theme.colors.accent.primary10,
              _raw: f,
            }) as FoodItem
        );

        if (mounted) setSuggestedFoods(mapped);
      } catch (err) {
        console.error('Error loading suggested foods:', err);
        if (mounted) setSuggestedFoods([]);
      } finally {
        if (mounted) setIsLoadingSuggested(false);
      }
    };

    loadSuggestions();

    return () => {
      mounted = false;
    };
  }, [visible, searchQuery, t, theme.colors.accent.primary, theme.colors.accent.primary10]);

  useEffect(() => {
    let mounted = true;

    const loadFavorites = async () => {
      if (!visible || activeFilter !== 'myFoods') {
        if (mounted) setFavoriteFoods([]);
        return;
      }

      setIsLoadingFavorites(true);
      try {
        const favs = await NutritionService.getFavoriteFoods();
        const mapped = favs.map(
          (f) =>
            ({
              id: f.id,
              name: f.name ?? '',
              description: `${f.brand || 'Custom Food'} • ${f.calories || 0} kcal`,
              brand: f.brand,
              serving_size: '100 g',
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              fiber: f.fiber,
              source: 'local',
              imageUrl: f.imageUrl ? f.imageUrl : undefined,
              icon: f.imageUrl ? undefined : '🍽️',
              iconColor: theme.colors.accent.primary,
              iconBgColor: theme.colors.accent.primary10,
              _raw: f,
            }) as FoodItem
        );

        if (mounted) {
          setFavoriteFoods(mapped);
        }
      } catch (err) {
        console.error('Error loading favorite foods:', err);
        if (mounted) {
          setFavoriteFoods([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingFavorites(false);
        }
      }
    };

    loadFavorites();

    return () => {
      mounted = false;
    };
  }, [visible, activeFilter, theme.colors.accent.primary, theme.colors.accent.primary10]);

  // Transform meals to card data with nutrients
  useEffect(() => {
    const transformMeals = async () => {
      if (meals.length === 0) {
        setMealCardsData([]);
        return;
      }

      try {
        const transformed = await Promise.all(
          meals.map(async (meal) => {
            const nutrients = await meal.getTotalNutrients();
            return {
              meal,
              name: meal.name ?? '',
              description: meal.description || undefined,
              imageUrl: meal.imageUrl || undefined,
              calories: nutrients.calories,
              protein: nutrients.protein,
              carbs: nutrients.carbs,
              fat: nutrients.fat,
            };
          })
        );
        setMealCardsData(transformed);
      } catch (error) {
        console.error('Error transforming meals:', error);
        setMealCardsData([]);
      }
    };

    transformMeals();
  }, [meals]);

  // Handle meal selection - open FoodDetailsModal instead of directly logging
  const handleMealSelect = (meal: Meal) => {
    setSelectedMeal(meal);
    setIsMealDetailsVisible(true);
  };

  // Get filtered results based on active filter
  const filteredResults = useMemo(() => {
    switch (activeFilter) {
      case 'myFoods':
        return resultsBySource.local;
      case 'api':
        return resultsBySource.api;
      case 'all':
      default:
        return resultsBySource.all;
    }
  }, [activeFilter, resultsBySource]);

  const FILTER_TABS = useMemo(() => {
    return [
      { id: 'all', label: `${t('foodSearch.filters.allResults')} (${resultsBySource.all.length})` },
      { id: 'myFoods', label: `${t('foodSearch.filters.favorites')} (${favoriteFoods.length})` },
      ...(apiCount > 0
        ? [{ id: 'api' as const, label: `${t('foodSearch.filters.openFoodFacts')} (${apiCount})` }]
        : []),
      {
        id: 'meals',
        label:
          mealsTotalCount !== undefined
            ? `${t('foodSearch.filters.meals')} (${mealsTotalCount})`
            : t('foodSearch.filters.meals'),
      },
    ];
  }, [t, resultsBySource.all.length, favoriteFoods.length, apiCount, mealsTotalCount]);

  // If Open Food Facts tab is hidden (0 items) but was selected, switch to 'all'
  useEffect(() => {
    if (activeFilter === 'api' && apiCount === 0) {
      setActiveFilter('all');
    }
  }, [activeFilter, apiCount]);

  const handleFoodClick = (food: UnifiedFoodResult) => {
    // Convert to FoodItem format
    const foodItem: FoodItem = {
      ...food,
      icon: food.source === 'local' ? '🍽️' : undefined,
      iconColor: food.source === 'local' ? theme.colors.accent.primary : undefined,
      iconBgColor: food.source === 'local' ? theme.colors.accent.primary10 : undefined,
    };

    setSelectedFood(foodItem);
    setIsFoodDetailsVisible(true);
  };

  const headerRight = (
    <Pressable onPress={onCreatePress}>
      <Text className="text-sm font-semibold text-accent-secondary">
        {t('foodSearch.createFood')}
      </Text>
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.meals.addFoodTo', {
        meal: t(`food.meals.${mealType === 'snack' ? 'snacks' : mealType}`),
      })}
      headerRight={headerRight}
      scrollable={false}
    >
      <View className="h-4" />
      <View className="flex-1 bg-bg-primary">
        {/* Search Bar */}
        <View className="border-b border-border-light bg-bg-primary px-4 pb-2">
          <View className="relative">
            <View
              className="absolute inset-y-0 left-0 z-10 items-center justify-center pl-3.5"
              style={{ pointerEvents: 'none' }}
            >
              <Search
                size={theme.iconSize.md}
                color={searchQuery ? theme.colors.accent.secondary : theme.colors.text.secondary}
              />
            </View>
            <TextInput
              placeholder={t('food.addFoodModal.searchFood.title')}
              placeholderTextColor={theme.colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="w-full rounded-2xl border border-border-light bg-bg-overlay py-3.5 pl-11 pr-10 text-base text-text-primary"
              style={{
                backgroundColor: theme.colors.background.secondaryDark,
                borderColor: searchQuery
                  ? theme.colors.accent.secondary31
                  : theme.colors.border.light,
              }}
              autoFocus
            />
            <Pressable
              className="absolute inset-y-0 right-0 items-center justify-center pr-2"
              onPress={onBarcodeScanPress}
            >
              <View className="rounded-lg p-1.5">
                <QrCode size={theme.iconSize.lg} color={theme.colors.text.secondary} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="border-b border-border-light bg-bg-primary">
          <UnderlineTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onTabChange={setActiveFilter}
          />
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 bg-bg-primary"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ backgroundColor: theme.colors.background.primary }}
        >
          <View className="gap-4 p-4 pb-20">
            {/* Search Results Section */}
            {searchQuery ? (
              <View>
                <SectionHeader
                  title={
                    isInitialLoad
                      ? t('foodSearch.searching')
                      : hasLocalResults || hasApiResults || isLoadingAPI
                        ? t('foodSearch.bestMatches')
                        : t('foodSearch.noResults')
                  }
                />
                <View className="gap-1.5">
                  {/* Show initial loading state */}
                  {isInitialLoad ? (
                    <View className="flex items-center justify-center py-12">
                      <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                      <Text className="mt-2 text-sm text-text-secondary">
                        {isLoadingLocal && isLoadingAPI
                          ? t('foodSearch.searchingLocalAndAPI')
                          : isLoadingLocal
                            ? t('foodSearch.searchingLocal')
                            : t('foodSearch.searchingAPI')}
                      </Text>
                    </View>
                  ) : null}

                  {/* Show results when available */}
                  {!isInitialLoad && !error && filteredResults.length > 0 ? (
                    <>
                      {/* Local Results Section - only show if filter includes local or 'all' */}
                      {(activeFilter === 'all' || activeFilter === 'myFoods') &&
                      resultsBySource.local.length > 0 ? (
                        <View className="mb-4">
                          <View className="mb-3 flex-row items-center gap-2">
                            <View className="h-0.5 flex-1 bg-accent-primary/20" />
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs font-medium uppercase text-accent-primary">
                                {t('foodSearch.yourFoods', { count: resultsBySource.local.length })}
                              </Text>
                            </View>
                            <View className="h-0.5 flex-1 bg-accent-primary/20" />
                          </View>
                          <View className="gap-1.5">
                            {(resultsBySource.local || []).map((food) => (
                              <FoodItemCard
                                key={`local-${food.id}`}
                                food={{
                                  ...food,
                                  name: food.name ?? '',
                                  icon: '🍽️',
                                  iconColor: theme.colors.accent.primary,
                                  iconBgColor: theme.colors.accent.primary10,
                                }}
                                onAddPress={() =>
                                  handleFoodClick({ ...food, name: food.name ?? '' })
                                }
                              />
                            ))}
                          </View>

                          {/* Load More Local Button */}
                          {hasMoreLocal ? (
                            <View className="py-3">
                              <Button
                                label={
                                  isLoadingMoreLocal
                                    ? t('foodSearch.loadingMore')
                                    : t('foodSearch.loadMoreLocal')
                                }
                                onPress={loadMoreLocal}
                                size="sm"
                                variant="outline"
                                disabled={isLoadingMoreLocal}
                                loading={isLoadingMoreLocal}
                                width="full"
                                iconPosition="left"
                              />
                            </View>
                          ) : null}
                        </View>
                      ) : null}

                      {/* API Results Section - only show if filter includes api or 'all' */}
                      {(activeFilter === 'all' || activeFilter === 'api') &&
                      resultsBySource.api.length > 0 ? (
                        <View className="mb-4">
                          <View className="mb-3 flex-row items-center gap-2">
                            <View className="h-0.5 flex-1 bg-text-tertiary/30" />
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs font-medium uppercase text-text-tertiary">
                                {t('foodSearch.openFoodFacts', {
                                  count: resultsBySource.api.length,
                                })}
                              </Text>
                            </View>
                            <View className="h-0.5 flex-1 bg-text-tertiary/30" />
                          </View>
                          <View className="gap-1.5">
                            {resultsBySource.api.map((food: UnifiedFoodResult) => (
                              <FoodItemCard
                                key={`api-${food.id}`}
                                food={food}
                                onAddPress={() => handleFoodClick(food)}
                              />
                            ))}
                          </View>

                          {/* Load More API Button */}
                          {hasMoreAPI ? (
                            <View className="py-3">
                              <Button
                                label={
                                  isLoadingMoreAPI
                                    ? t('foodSearch.loadingMore')
                                    : t('foodSearch.loadMoreAPI')
                                }
                                onPress={loadMoreAPI}
                                size="sm"
                                variant="outline"
                                disabled={isLoadingMoreAPI}
                                loading={isLoadingMoreAPI}
                                width="full"
                                iconPosition="left"
                              />
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  ) : null}
                  {!isInitialLoad && isLoadingAPI ? (
                    <View className="flex items-center justify-center py-4">
                      <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                      <Text className="ml-2 text-xs text-text-secondary">
                        {t('foodSearch.searchingAPI')}
                      </Text>
                    </View>
                  ) : null}

                  {/* Show no results state - only when API is completely done */}
                  {!isInitialLoad &&
                  !isLoadingAPI &&
                  !error &&
                  filteredResults.length === 0 &&
                  searchQuery ? (
                    <View className="py-8 text-center">
                      <Text className="text-center text-text-secondary">
                        {t('foodSearch.noResultsFor', { query: searchQuery })}
                      </Text>
                      {localCount === 0 && apiCount === 0 ? (
                        <Text className="mt-2 text-center text-sm text-text-tertiary">
                          {t('foodSearch.trySomethingElse')}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Non-search area: show favorites when "myFoods" tab is active, meals when "meals" tab is active, otherwise recent history */}
            {!searchQuery ? (
              <View>
                {activeFilter === 'myFoods' ? (
                  <View>
                    <SectionHeader title={t('foodSearch.yourFavoriteFoods')} />
                    <View className="gap-1.5">
                      {isLoadingFavorites ? (
                        <View className="py-4">
                          <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                        </View>
                      ) : favoriteFoods.length > 0 ? (
                        favoriteFoods.map((food) => (
                          <FoodItemCard
                            key={food.id}
                            food={food}
                            onAddPress={() => handleFoodClick(food)}
                          />
                        ))
                      ) : (
                        <View className="py-8 text-center">
                          <Text className="text-center text-text-tertiary">
                            {t('foodSearch.noFavoriteFoods')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : activeFilter === 'meals' ? (
                  <View>
                    <SectionHeader title={t('foodSearch.filters.meals')} />
                    <View className="gap-1.5">
                      {isLoadingMeals ? (
                        <View className="py-4">
                          <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                          <Text className="mt-2 text-center text-sm text-text-secondary">
                            {t('foodSearch.loadingMeals')}
                          </Text>
                        </View>
                      ) : mealCardsData.length > 0 ? (
                        <>
                          {mealCardsData.map((mealData) => (
                            <MealSearchCard
                              key={mealData.meal.id}
                              mealData={mealData}
                              onAddPress={() => handleMealSelect(mealData.meal)}
                            />
                          ))}
                          {hasMoreMeals ? (
                            <View className="py-3">
                              <Button
                                label={
                                  isLoadingMoreMeals
                                    ? t('foodSearch.loadingMore')
                                    : t('foodSearch.loadMoreMeals')
                                }
                                onPress={loadMoreMeals}
                                size="sm"
                                variant="outline"
                                disabled={isLoadingMoreMeals}
                                loading={isLoadingMoreMeals}
                                width="full"
                                iconPosition="left"
                              />
                            </View>
                          ) : null}
                        </>
                      ) : (
                        <View className="py-8 text-center">
                          <Text className="text-center text-text-tertiary">
                            {t('foodSearch.noMeals')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View>
                    <SectionHeader
                      title={t('foodSearch.recentHistory')}
                      rightAction={{
                        label: t('foodSearch.viewAll'),
                        onPress: () => {
                          // TODO: open recent history
                          console.log('View all clicked');
                        },
                      }}
                    />
                    <View className="gap-1.5">
                      {recentFoods.length > 0 ? (
                        recentFoods.map((food) => {
                          const foodItem: FoodItem = {
                            ...food,
                            id: food.id,
                            name: food.name ?? '',
                            description: `${food.brand || 'Custom Food'} • ${food.calories || 0} kcal per 100g`,
                            brand: food.brand,
                            serving_size: '100 g',
                            calories: food.calories,
                            protein: food.protein,
                            carbs: food.carbs,
                            fat: food.fat,
                            fiber: food.fiber,
                            imageUrl: food.imageUrl,
                            source: 'local',
                            icon: '🍽️',
                            iconColor: theme.colors.accent.primary,
                            iconBgColor: theme.colors.accent.primary10,
                            _raw: food,
                          };

                          return (
                            <FoodItemCard
                              key={food.id}
                              food={foodItem}
                              onAddPress={() => handleFoodClick(foodItem)}
                            />
                          );
                        })
                      ) : (
                        <View className="py-8 text-center">
                          <Text className="text-center text-text-tertiary">
                            {t('foodSearch.noRecentFoods')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : null}

            {!searchQuery &&
            activeFilter !== 'myFoods' &&
            activeFilter !== 'meals' &&
            suggestedFoods &&
            suggestedFoods.length > 0 ? (
              <View>
                <SectionHeader title={suggestedTitle} icon={Sparkles} />
                <View className="gap-1.5">
                  {isLoadingSuggested ? (
                    <View className="py-4">
                      <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                    </View>
                  ) : (
                    suggestedFoods.map((food) => (
                      <FoodItemCard
                        key={food.id}
                        food={food}
                        onAddPress={() => {
                          setSelectedFood(food);
                          setIsFoodDetailsVisible(true);
                        }}
                      />
                    ))
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {/* Food Details Modal */}
      {selectedFood ? (
        <FoodMealDetailsModal
          visible={isFoodDetailsVisible}
          onClose={() => {
            setIsFoodDetailsVisible(false);
            setSelectedFood(null);
          }}
          barcode={selectedFood.source === 'local' ? undefined : selectedFood.id}
          food={selectedFood.source === 'local' ? (selectedFood._raw as any) : undefined}
          onAddFood={(data) => {
            // Call the original onFoodSelect with the food and additional data
            onFoodSelect?.({
              ...selectedFood,
              servingSize: data.servingSize,
              meal: data.meal,
              date: data.date,
            } as any);

            setIsFoodDetailsVisible(false);
            setSelectedFood(null);
          }}
        />
      ) : null}

      {/* Meal Details Modal */}
      {selectedMeal ? (
        <FoodMealDetailsModal
          visible={isMealDetailsVisible}
          onClose={() => {
            setIsMealDetailsVisible(false);
            setSelectedMeal(null);
          }}
          meal={selectedMeal}
          initialMealType={mealType}
          onLogMeal={(data) => {
            // Call the original onFoodSelect if provided (for consistency)
            // Note: meals don't have servingSize, so we pass undefined
            onFoodSelect?.({
              id: selectedMeal.id,
              name: selectedMeal.name || '',
              meal: data.meal,
              date: data.date,
            } as any);

            setIsMealDetailsVisible(false);
            setSelectedMeal(null);
          }}
        />
      ) : null}
    </FullScreenModal>
  );
}
