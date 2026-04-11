import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  AlertTriangle,
  Apple,
  Beef,
  Carrot,
  Coffee,
  Cookie,
  CookingPot,
  Donut,
  Egg,
  Fish,
  Grape,
  type LucideIcon,
  Milk,
  Pizza,
  Plus,
  QrCode,
  Salad,
  Search,
  Soup,
  Sparkles,
  Utensils,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { FoodSearchItemCard } from '@/components/cards/FoodSearchItemCard';
import { SameAsYesterdayCard } from '@/components/cards/SameAsYesterdayCard';
import { Button } from '@/components/theme/Button';
import { useSnackbar } from '@/context/SnackbarContext';
import { type MealType } from '@/database/models';
import Meal from '@/database/models/Meal';
import { FoodPortionService, NutritionService } from '@/database/services';
import { useFavoriteFoods } from '@/hooks/useFavoriteFoods';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMeals, type UseMealsResultBasic } from '@/hooks/useMeals';
import useNutritionLogs from '@/hooks/useNutritionLogs';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { type UnifiedFoodResult, useUnifiedFoodSearch } from '@/hooks/useUnifiedFoodSearch';
import { useYesterdayMealData } from '@/hooks/useYesterdayMealData';
import { localCalendarDayDate } from '@/utils/calendarDate';
import { resolveRoundedPer100gCaloriesForDisplay } from '@/utils/inferCaloriesFromMacros';
import { captureException } from '@/utils/sentry';

import { ConfirmationModal } from './ConfirmationModal';
import { FoodMealDetailsModal } from './FoodMealDetailsModal';
import { FullScreenModal } from './FullScreenModal';
import { RecentNutritionHistoryModal } from './RecentNutritionHistoryModal';

const FOOD_ICONS: LucideIcon[] = [
  Apple,
  Beef,
  Carrot,
  Coffee,
  Cookie,
  CookingPot,
  Donut,
  Egg,
  Fish,
  Grape,
  Milk,
  Pizza,
  Salad,
  Soup,
  Utensils,
  UtensilsCrossed,
  Wheat,
];

function pickRandomFoodIcon(): LucideIcon {
  return FOOD_ICONS[Math.floor(Math.random() * FOOD_ICONS.length)];
}

type FoodItem = UnifiedFoodResult & {
  icon?: string; // Emoji
  iconName?: string; // Lucide icon name, e.g. 'utensils-crossed'
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
  lastGramWeight?: number;
};

type FoodSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  mealType?: MealType; // e.g., "Breakfast", "Lunch", etc. If not provided, inferred from current hour
  /** Date to use when logging food (e.g. the date currently selected on the food screen). */
  logDate?: Date;
  onCreatePress?: () => void;
  onBarcodeScanPress?: () => void;
  onFoodSelect?: (food: FoodItem) => void;
  /** Called when food(s) have been tracked so the parent can refresh logs (e.g. daily nutrition list). */
  onFoodTracked?: () => void;
  /** When false, the "Try AI Camera" option in FoodNotFoundModal is hidden. Defaults to true. */
  isAiEnabled?: boolean;
};

type UnderlineTabsProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

function getMealsTabLabel(options: {
  searchQuery: string;
  filteredCount: number;
  totalCount?: number;
  t: (key: string) => string;
}): string {
  const { searchQuery, filteredCount, totalCount, t } = options;
  const base = t('foodSearch.filters.meals');
  if (searchQuery.trim()) {
    return `${base} (${filteredCount})`;
  }
  if (totalCount !== undefined) {
    return `${base} (${totalCount})`;
  }
  return base;
}

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
        <Pressable onPress={rightAction.onPress} className="-m-2 p-2">
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
  const { formatRoundedDecimal } = useFormatAppNumber();

  const macroSummary = t('food.manageFoodLibrary.macrosFormat', {
    protein: formatRoundedDecimal(mealData.protein, 2),
    carbs: formatRoundedDecimal(mealData.carbs, 2),
    fat: formatRoundedDecimal(mealData.fat, 2),
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
          {formatRoundedDecimal(mealData.calories, 2)} {t('food.common.kcal')} • {macroSummary}
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

function getSectionHeaderTitle(
  isInitialLoad: boolean,
  hasLocalResults: boolean,
  hasApiResults: boolean,
  isLoadingAPI: boolean,
  t: (key: string) => string
): string {
  if (isInitialLoad) {
    return t('foodSearch.searching');
  }

  if (hasLocalResults || hasApiResults || isLoadingAPI) {
    return t('foodSearch.bestMatches');
  }

  return t('foodSearch.noResults');
}

function getSearchingStatusText(
  isLoadingLocal: boolean,
  isLoadingAPI: boolean,
  t: (key: string) => string
): string {
  if (isLoadingLocal && isLoadingAPI) {
    return t('foodSearch.searchingLocalAndAPI');
  }

  if (isLoadingLocal) {
    return t('foodSearch.searchingLocal');
  }

  return t('foodSearch.searchingAPI');
}

export function FoodSearchModal({
  visible,
  onClose,
  mealType,
  logDate,
  onCreatePress,
  onBarcodeScanPress,
  onFoodSelect,
  onFoodTracked,
  isAiEnabled = true,
}: FoodSearchModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();
  const { foodSearchSource } = useSettings();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSessionIcon, setSearchSessionIcon] = useState<LucideIcon>(pickRandomFoodIcon);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [isFoodDetailsVisible, setIsFoodDetailsVisible] = useState(false);
  const [isMealDetailsVisible, setIsMealDetailsVisible] = useState(false);
  const [portion100gName, setPortion100gName] = useState<string>('100g');
  const [isRecentNutritionHistoryModalVisible, setIsRecentNutritionHistoryModalVisible] =
    useState(false);
  const [confirmSameAsYesterdayVisible, setConfirmSameAsYesterdayVisible] = useState(false);
  const [isAddingSameAsYesterday, setIsAddingSameAsYesterday] = useState(false);

  const { yesterdayMealData, isLoadingYesterday, hasItemsTrackedForSelectedDate } =
    useYesterdayMealData({
      visible,
      mealType,
      logDate,
    });

  // When this modal is hidden (for any reason), tear down every child modal that
  // was opened inside it. Without this, a sub-modal that was visible when the parent
  // closed (e.g. RecentNutritionHistoryModal opened → food tracked → FoodSearchModal
  // closed) keeps its native window alive and intercepts touches on the next open.
  useEffect(() => {
    if (!visible) {
      setIsRecentNutritionHistoryModalVisible(false);
      setConfirmSameAsYesterdayVisible(false);
      setIsFoodDetailsVisible(false);
      setSelectedFood(null);
      setIsMealDetailsVisible(false);
      setSelectedMeal(null);
    }
  }, [visible]);

  // Load the standard 100g portion name when modal is visible
  useEffect(() => {
    if (!visible) {
      return;
    }
    let mounted = true;
    FoodPortionService.get100gPortion().then((portion) => {
      if (mounted) {
        setPortion100gName(portion?.name ?? '100g');
      }
    });
    return () => {
      mounted = false;
    };
  }, [visible]);

  // Pick a new random food emoji each time the user starts a new search
  useEffect(() => {
    if (searchQuery) {
      setSearchSessionIcon(pickRandomFoodIcon());
    }
  }, [searchQuery]);

  // Get recent local foods for the "Recent History" section
  const { recentFoods: recentFoodsRaw } = useNutritionLogs({
    mode: 'recent',
    mealType,
    visible,
    initialLimit: 5,
    enableReactivity: true,
  }) as UseMealsResultBasic & { recentFoods: any[] };

  const recentFoods = useMemo(() => {
    return (recentFoodsRaw || []).map((item) => {
      const food = item.food;

      return {
        id: food.id,
        name: food.name ?? '',
        description: t('foodSearch.foodDescriptionPer100g', {
          brand: food.brand || t('foodSearch.customFoodLabel'),
          calories: formatInteger(
            resolveRoundedPer100gCaloriesForDisplay({
              calories: food.calories,
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
            })
          ),
        }),
        brand: food.brand,
        serving_size: portion100gName,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        imageUrl: food.imageUrl,
        source: 'local',
        iconName: 'utensils-crossed',
        iconColor: theme.colors.accent.primary,
        iconBgColor: theme.colors.accent.primary10,
        lastGramWeight: item.lastGramWeight,
        _raw: food,
      } as FoodItem;
    });
  }, [
    recentFoodsRaw,
    t,
    formatInteger,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    portion100gName,
  ]);

  // Calculate API limits based on food search source setting
  const { apiLimit: openFoodLimit, usdaLimit } = useMemo(() => {
    if (foodSearchSource === 'both') {
      return { apiLimit: 10, usdaLimit: 10 }; // 10 from each source
    }
    return { apiLimit: 20, usdaLimit: 20 }; // 20 from single source
  }, [foodSearchSource]);

  // Use unified search for both local and API results
  const {
    resultsBySource,
    isLoadingLocal,
    isLoadingAPI,
    apiError,
    usdaError,
    localCount,
    apiCount,
    hasLocalResults,
    hasApiResults,
    isInitialLoad,
    hasMoreLocal,
    hasMoreAPI,
    hasMoreUSDA,
    isLoadingMoreLocal,
    isLoadingMoreAPI,
    isLoadingMoreUSDA,
    loadMoreLocal,
    loadMoreAPI,
    loadMoreUSDA,
    firstResolvedApi,
    retryAPI,
    retryUSDA,
    cancelSearch,
    triggerNow,
  } = useUnifiedFoodSearch({
    searchTerm: searchQuery,
    enabled: visible,
    includeLocal: true,
    includeAPI: true,
    localLimit: 10,
    apiLimit: openFoodLimit,
    usdaLimit,
    debounceMs: 600,
  });

  // Keep screen awake while searching external APIs to prevent the phone from
  // turning off the screen and killing network requests
  useEffect(() => {
    if (isLoadingAPI) {
      activateKeepAwakeAsync('food-search-api').catch(() => {});
    } else {
      deactivateKeepAwake('food-search-api').catch(() => {});
    }

    return () => {
      deactivateKeepAwake('food-search-api').catch(() => {});
    };
  }, [isLoadingAPI]);

  const [showCancelSearch, setShowCancelSearch] = useState(false);

  useEffect(() => {
    setShowCancelSearch(false);

    if (!searchQuery.trim() || (!isLoadingAPI && !isInitialLoad) || hasApiResults) {
      return;
    }

    const timer = setTimeout(() => setShowCancelSearch(true), 10_000);
    return () => clearTimeout(timer);
  }, [searchQuery, isLoadingAPI, isInitialLoad, hasApiResults]);

  const handleCancelSearch = useCallback(() => {
    cancelSearch();
    setSearchQuery('');
    setShowCancelSearch(false);
  }, [cancelSearch]);

  const [suggestedFoods, setSuggestedFoods] = useState<FoodItem[] | null>(null);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState('');

  const {
    foods: favoriteFoodsRaw,
    isLoading: isLoadingFavorites,
    isLoadingMore: isLoadingMoreFavorites,
    hasMore: hasMoreFavoriteFoods,
    loadMore: loadMoreFavoriteFoods,
    totalCount: favoriteFoodsCount,
    error: favoriteFoodsError,
  } = useFavoriteFoods({
    visible: visible && !searchQuery, // Always load count, but only load foods when not searching
    initialLimit: 10,
    batchSize: 10,
    enableReactivity: true,
  });
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
        if (mounted) {
          setSuggestedFoods(null);
        }
        return;
      }

      setIsLoadingSuggested(true);

      try {
        // Use the mealType prop if provided, otherwise infer from current hour
        let mealKey: MealType;
        let titleKey = 'foodSearch.commonFoods';

        if (mealType) {
          // Use provided mealType
          mealKey = mealType;
          if (mealType === 'breakfast') {
            titleKey = 'foodSearch.commonBreakfastFoods';
          } else if (mealType === 'lunch') {
            titleKey = 'foodSearch.commonLunchFoods';
          } else if (mealType === 'snack') {
            titleKey = 'foodSearch.commonSnackFoods';
          } else if (mealType === 'dinner') {
            titleKey = 'foodSearch.commonDinnerFoods';
          }
        } else {
          // Fallback: infer from current hour
          const hour = new Date().getHours();
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
          } else {
            mealKey = 'other';
          }
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
              description: t('foodSearch.foodDescriptionFormat', {
                brand: f.brand || t('foodSearch.customFoodLabel'),
                calories: formatInteger(
                  resolveRoundedPer100gCaloriesForDisplay({
                    calories: f.calories,
                    protein: f.protein,
                    carbs: f.carbs,
                    fat: f.fat,
                    fiber: f.fiber,
                  })
                ),
              }),
              brand: (f as any).brand,
              serving_size: portion100gName,
              calories: f.calories,
              protein: f.protein,
              carbs: f.carbs,
              fat: f.fat,
              fiber: f.fiber,
              source: 'local',
              imageUrl: f.imageUrl ? f.imageUrl : undefined,
              iconName: f.imageUrl ? undefined : 'utensils-crossed',
              iconColor: theme.colors.accent.primary,
              iconBgColor: theme.colors.accent.primary10,
              _raw: f,
            }) as FoodItem
        );

        if (mounted) {
          setSuggestedFoods(mapped);
        }
      } catch (err) {
        console.error('Error loading suggested foods:', err);
        if (mounted) {
          setSuggestedFoods([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingSuggested(false);
        }
      }
    };

    loadSuggestions();

    return () => {
      mounted = false;
    };
  }, [
    visible,
    searchQuery,
    mealType,
    t,
    formatInteger,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    portion100gName,
  ]);

  // Memoized mapping of favorite foods to FoodItem format
  const favoriteFoods = useMemo(() => {
    return favoriteFoodsRaw.map(
      (f) =>
        ({
          id: f.id,
          name: f.name ?? '',
          description: t('foodSearch.foodDescriptionFormat', {
            brand: f.brand || t('foodSearch.customFoodLabel'),
            calories: formatInteger(
              resolveRoundedPer100gCaloriesForDisplay({
                calories: f.calories,
                protein: f.protein,
                carbs: f.carbs,
                fat: f.fat,
                fiber: f.fiber,
              })
            ),
          }),
          brand: f.brand,
          serving_size: portion100gName,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          fiber: f.fiber,
          source: 'local',
          imageUrl: f.imageUrl ? f.imageUrl : undefined,
          iconName: f.imageUrl ? undefined : 'utensils-crossed',
          iconColor: theme.colors.accent.primary,
          iconBgColor: theme.colors.accent.primary10,
          _raw: f,
        }) as FoodItem
    );
  }, [
    favoriteFoodsRaw,
    t,
    formatInteger,
    theme.colors.accent.primary,
    theme.colors.accent.primary10,
    portion100gName,
  ]);

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

  // Filter meals by search query (client-side, on name + description)
  const filteredMealCardsData = useMemo(() => {
    if (!searchQuery.trim()) {
      return mealCardsData;
    }
    const q = searchQuery.trim().toLowerCase();
    return mealCardsData.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    );
  }, [mealCardsData, searchQuery]);

  // Helper function to format count with "99+" limit
  const formatCount = useCallback((count: number): string => {
    return count > 99 ? '99+' : count.toString();
  }, []);

  // Get filtered results based on active filter
  const filteredResults = useMemo(() => {
    switch (activeFilter) {
      case 'myFoods':
        return resultsBySource.local;
      case 'openfood':
        return resultsBySource.api;
      case 'usda':
        return resultsBySource.usda;
      case 'all':
      default:
        return resultsBySource.all;
    }
  }, [activeFilter, resultsBySource]);

  const FILTER_TABS = useMemo(() => {
    return [
      { id: 'all', label: `${t('foodSearch.filters.allResults')} (${resultsBySource.all.length})` },
      {
        id: 'myFoods',
        label: `${t('foodSearch.filters.favorites')} (${formatCount(favoriteFoodsCount)})`,
      },
      ...(resultsBySource.api.length > 0
        ? [
            {
              id: 'openfood' as const,
              label: `${t('foodSearch.filters.openFoodFacts')} (${resultsBySource.api.length})`,
            },
          ]
        : []),
      ...(resultsBySource.usda.length > 0
        ? [
            {
              id: 'usda' as const,
              label: `${t('foodSearch.filters.usda')} (${resultsBySource.usda.length})`,
            },
          ]
        : []),
      {
        id: 'meals',
        label: getMealsTabLabel({
          searchQuery,
          filteredCount: filteredMealCardsData.length,
          totalCount: mealsTotalCount,
          t,
        }),
      },
    ];
  }, [
    t,
    resultsBySource.all.length,
    resultsBySource.api.length,
    resultsBySource.usda.length,
    formatCount,
    favoriteFoodsCount,
    searchQuery,
    filteredMealCardsData.length,
    mealsTotalCount,
  ]);

  // If Open Food Facts or USDA tab is hidden (0 items) but was selected, switch to 'all'
  useEffect(() => {
    if (activeFilter === 'openfood' && resultsBySource.api.length === 0) {
      setActiveFilter('all');
    }
    if (activeFilter === 'usda' && resultsBySource.usda.length === 0) {
      setActiveFilter('all');
    }
  }, [activeFilter, resultsBySource.api.length, resultsBySource.usda.length]);

  const handleFoodClick = (food: UnifiedFoodResult) => {
    // Convert to FoodItem format
    const foodItem: FoodItem = {
      ...food,
      iconName: food.source === 'local' ? 'utensils-crossed' : undefined,
      iconColor: food.source === 'local' ? theme.colors.accent.primary : undefined,
      iconBgColor: food.source === 'local' ? theme.colors.accent.primary10 : undefined,
    };

    // Always close the history modal before opening food details — if it was open,
    // leaving it visible would stack two native modal windows and block touches.
    setIsRecentNutritionHistoryModalVisible(false);
    setSelectedFood(foodItem);
    setIsFoodDetailsVisible(true);
  };

  const mealLabel = mealType
    ? t(`food.meals.${mealType === 'snack' ? 'snacks' : mealType}`)
    : t('food.meals.other');

  const handleConfirmSameAsYesterday = useCallback(async () => {
    if (!yesterdayMealData || yesterdayMealData.logs.length === 0 || !mealType) {
      return;
    }

    // TypeScript: assign to const to narrow the type after the guard check
    const currentMealType: MealType = mealType;
    const targetDate = localCalendarDayDate(logDate ?? new Date());
    setIsAddingSameAsYesterday(true);
    try {
      for (const log of yesterdayMealData.logs) {
        await NutritionService.logFood(
          log.foodId,
          targetDate,
          currentMealType,
          log.amount,
          log.portionId
        );
      }
      onFoodSelect?.({} as FoodItem);
      onFoodTracked?.();
      onClose();
      showSnackbar('success', t('foodSearch.sameAsYesterdaySuccess'));
    } catch (err) {
      console.error('Error logging same as yesterday:', err);
      captureException(err, { data: { context: 'FoodSearchModal.handleSameAsYesterday' } });
      showSnackbar('error', t('foodSearch.sameAsYesterdayError'));
    } finally {
      setIsAddingSameAsYesterday(false);
    }
  }, [yesterdayMealData, mealType, logDate, onFoodSelect, onFoodTracked, onClose, showSnackbar, t]);

  const headerRight = (
    <Pressable onPress={onCreatePress}>
      <Text className="text-sm font-semibold text-accent-secondary">
        {t('foodSearch.createFood')}
      </Text>
    </Pressable>
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('food.meals.addFoodTo', {
          meal: mealType
            ? t(`food.meals.${mealType === 'snack' ? 'snacks' : mealType}`)
            : t('food.meals.other'),
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
                onSubmitEditing={triggerNow}
                returnKeyType="search"
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
                hitSlop={8}
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
                  {activeFilter === 'meals' ? (
                    /* Meals tab with search query: filter meals client-side */
                    <View>
                      <SectionHeader title={t('foodSearch.filters.meals')} />
                      <View className="gap-1.5">
                        {isLoadingMeals ? (
                          <View className="flex items-center justify-center py-4">
                            <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                          </View>
                        ) : filteredMealCardsData.length > 0 ? (
                          filteredMealCardsData.map((mealData) => (
                            <MealSearchCard
                              key={mealData.meal.id}
                              mealData={mealData}
                              onAddPress={() => handleMealSelect(mealData.meal)}
                            />
                          ))
                        ) : (
                          <View className="py-8">
                            <Text className="text-center text-text-secondary">
                              {t('foodSearch.noResultsFor', { query: searchQuery })}
                            </Text>
                            <Text className="mt-2 text-center text-sm text-text-tertiary">
                              {t('foodSearch.trySomethingElse')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    /* All / Favorites / API tabs: food search results */
                    <View>
                      <SectionHeader
                        title={getSectionHeaderTitle(
                          isInitialLoad,
                          hasLocalResults,
                          hasApiResults,
                          isLoadingAPI,
                          t
                        )}
                      />
                      <View className="gap-1.5">
                        {/* Show initial loading state */}
                        {isInitialLoad ? (
                          <View className="flex items-center justify-center py-12">
                            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                            <Text className="mt-2 text-sm text-text-secondary">
                              {getSearchingStatusText(isLoadingLocal, isLoadingAPI, t)}
                            </Text>
                            {showCancelSearch ? (
                              <View className="mt-4">
                                <Button
                                  label={t('foodSearch.cancelSearch')}
                                  onPress={handleCancelSearch}
                                  size="sm"
                                  variant="outline"
                                />
                              </View>
                            ) : null}
                          </View>
                        ) : null}

                        {/* Show results when available */}
                        {!isInitialLoad && (filteredResults.length > 0 || apiError || usdaError) ? (
                          <>
                            {/* Local Results Section - only show if filter includes local or 'all' */}
                            {(activeFilter === 'all' || activeFilter === 'myFoods') &&
                            resultsBySource.local.length > 0 ? (
                              <View className="mb-4">
                                <View className="mb-3 flex-row items-center gap-2">
                                  <View className="h-0.5 flex-1 bg-accent-primary/20" />
                                  <View className="flex-row items-center gap-2">
                                    <Text className="text-xs font-medium uppercase text-accent-primary">
                                      {t('foodSearch.yourFoods', {
                                        count: resultsBySource.local.length,
                                      })}
                                    </Text>
                                  </View>
                                  <View className="h-0.5 flex-1 bg-accent-primary/20" />
                                </View>
                                <View className="gap-1.5">
                                  {(resultsBySource.local || []).map((food) => (
                                    <FoodSearchItemCard
                                      key={`local-${food.id}`}
                                      food={{
                                        ...food,
                                        name: food.name ?? '',
                                        iconName: 'utensils-crossed',
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

                            {/* OFF and USDA sections — ordered by whichever resolved first */}
                            {(firstResolvedApi === 'usda'
                              ? (['usda', 'openfood'] as const)
                              : (['openfood', 'usda'] as const)
                            ).map((apiSource) => {
                              if (apiSource === 'openfood') {
                                if (
                                  !(activeFilter === 'all' || activeFilter === 'openfood') ||
                                  (resultsBySource.api.length === 0 && !apiError)
                                ) {
                                  return null;
                                }

                                return (
                                  <View key="openfood" className="mb-4">
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
                                    {apiError ? (
                                      <View
                                        className="mb-4 overflow-hidden rounded-xl border"
                                        style={{
                                          backgroundColor: theme.colors.status.error10,
                                          borderColor: theme.colors.status.error + '33',
                                        }}
                                      >
                                        <View className="flex-row items-center gap-3 p-3">
                                          <View
                                            className="items-center justify-center rounded-lg p-2"
                                            style={{
                                              backgroundColor: theme.colors.status.error + '22',
                                            }}
                                          >
                                            <AlertTriangle
                                              size={theme.iconSize.sm}
                                              color={theme.colors.status.error}
                                            />
                                          </View>
                                          <Text
                                            className="flex-1 text-xs font-medium"
                                            style={{ color: theme.colors.status.error }}
                                          >
                                            {t('foodSearch.errorLoadingAPI')}
                                          </Text>
                                        </View>
                                        <View className="items-center px-3 pb-3">
                                          <Button
                                            label={t('foodSearch.retrySearch')}
                                            onPress={retryAPI}
                                            size="sm"
                                            variant="outline"
                                            width="full"
                                          />
                                        </View>
                                      </View>
                                    ) : (
                                      <View className="gap-1.5">
                                        {resultsBySource.api.map((food: UnifiedFoodResult) => (
                                          <FoodSearchItemCard
                                            key={`api-${food.id}`}
                                            food={{
                                              ...food,
                                              iconComponent: food.imageUrl
                                                ? undefined
                                                : searchSessionIcon,
                                            }}
                                            onAddPress={() => handleFoodClick(food)}
                                          />
                                        ))}
                                      </View>
                                    )}
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
                                );
                              }

                              // usda
                              if (
                                !(activeFilter === 'all' || activeFilter === 'usda') ||
                                (resultsBySource.usda.length === 0 && !usdaError)
                              ) {
                                return null;
                              }

                              return (
                                <View key="usda" className="mb-4">
                                  <View className="mb-3 flex-row items-center gap-2">
                                    <View className="h-0.5 flex-1 bg-text-tertiary/30" />
                                    <View className="flex-row items-center gap-2">
                                      <Text className="text-xs font-medium uppercase text-text-tertiary">
                                        {t('foodSearch.usda', {
                                          count: resultsBySource.usda.length,
                                        })}
                                      </Text>
                                    </View>
                                    <View className="h-0.5 flex-1 bg-text-tertiary/30" />
                                  </View>
                                  {usdaError ? (
                                    <View
                                      className="mb-4 overflow-hidden rounded-xl border"
                                      style={{
                                        backgroundColor: theme.colors.status.error10,
                                        borderColor: theme.colors.status.error + '33',
                                      }}
                                    >
                                      <View className="flex-row items-center gap-3 p-3">
                                        <View
                                          className="items-center justify-center rounded-lg p-2"
                                          style={{
                                            backgroundColor: theme.colors.status.error + '22',
                                          }}
                                        >
                                          <AlertTriangle
                                            size={theme.iconSize.sm}
                                            color={theme.colors.status.error}
                                          />
                                        </View>
                                        <Text
                                          className="flex-1 text-xs font-medium"
                                          style={{ color: theme.colors.status.error }}
                                        >
                                          {t('foodSearch.errorLoadingUSDA')}
                                        </Text>
                                      </View>
                                      <View className="items-center px-3 pb-3">
                                        <Button
                                          label={t('foodSearch.retrySearch')}
                                          onPress={retryUSDA}
                                          size="sm"
                                          variant="outline"
                                          width="full"
                                        />
                                      </View>
                                    </View>
                                  ) : (
                                    <View className="gap-1.5">
                                      {resultsBySource.usda.map((food: UnifiedFoodResult) => (
                                        <FoodSearchItemCard
                                          key={`usda-${food.id}`}
                                          food={{ ...food, iconComponent: searchSessionIcon }}
                                          onAddPress={() => handleFoodClick(food)}
                                        />
                                      ))}
                                    </View>
                                  )}
                                  {hasMoreUSDA ? (
                                    <View className="py-3">
                                      <Button
                                        label={
                                          isLoadingMoreUSDA
                                            ? t('foodSearch.loadingMore')
                                            : t('foodSearch.loadMoreUSDA')
                                        }
                                        onPress={loadMoreUSDA}
                                        size="sm"
                                        variant="outline"
                                        disabled={isLoadingMoreUSDA}
                                        loading={isLoadingMoreUSDA}
                                        width="full"
                                        iconPosition="left"
                                      />
                                    </View>
                                  ) : null}
                                </View>
                              );
                            })}
                          </>
                        ) : null}

                        {!isInitialLoad && isLoadingAPI ? (
                          <View className="flex items-center justify-center py-4">
                            <ActivityIndicator size="small" color={theme.colors.accent.primary} />
                            <Text className="ml-2 text-xs text-text-secondary">
                              {t('foodSearch.searchingAPI')}
                            </Text>
                            {showCancelSearch ? (
                              <View className="mt-3">
                                <Button
                                  label={t('foodSearch.cancelSearch')}
                                  onPress={handleCancelSearch}
                                  size="sm"
                                  variant="outline"
                                />
                              </View>
                            ) : null}
                          </View>
                        ) : null}

                        {/* Show no results state - only when API is completely done */}
                        {!isInitialLoad &&
                        !isLoadingAPI &&
                        !apiError &&
                        !usdaError &&
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
                  )}
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
                        ) : favoriteFoodsError ? (
                          <View className="py-8 text-center">
                            <Text className="text-center text-text-tertiary">
                              {t('foodSearch.loadFavoritesError')}
                            </Text>
                          </View>
                        ) : favoriteFoods.length > 0 ? (
                          <>
                            {favoriteFoods.map((food) => (
                              <FoodSearchItemCard
                                key={food.id}
                                food={food}
                                onAddPress={() => handleFoodClick(food)}
                              />
                            ))}
                            {hasMoreFavoriteFoods ? (
                              <View className="py-3">
                                <Button
                                  label={
                                    isLoadingMoreFavorites
                                      ? t('foodSearch.loadingMore')
                                      : t('foodSearch.loadMoreFavorites')
                                  }
                                  onPress={loadMoreFavoriteFoods}
                                  size="sm"
                                  variant="outline"
                                  disabled={isLoadingMoreFavorites}
                                  loading={isLoadingMoreFavorites}
                                  width="full"
                                  iconPosition="left"
                                />
                              </View>
                            ) : null}
                          </>
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
                          onPress: () => setIsRecentNutritionHistoryModalVisible(true),
                        }}
                      />
                      <View className="gap-1.5">
                        {recentFoods.length > 0 ? (
                          recentFoods.map((food) => (
                            <FoodSearchItemCard
                              key={food.id}
                              food={food}
                              onAddPress={() => handleFoodClick(food)}
                            />
                          ))
                        ) : (
                          <View className="py-8 text-center">
                            <Text className="text-center text-text-tertiary">
                              {t('foodSearch.noRecentFoods')}
                            </Text>
                          </View>
                        )}
                      </View>

                      {activeFilter === 'all' &&
                      !isLoadingYesterday &&
                      !hasItemsTrackedForSelectedDate &&
                      yesterdayMealData &&
                      yesterdayMealData.logs.length > 0 ? (
                        <SameAsYesterdayCard
                          yesterdayMealData={yesterdayMealData}
                          mealLabel={mealLabel}
                          onAddAllPress={() => setConfirmSameAsYesterdayVisible(true)}
                        />
                      ) : null}
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
                        <FoodSearchItemCard
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
            barcode={
              selectedFood.source === 'local' || selectedFood.source === 'usda'
                ? undefined
                : selectedFood.id
            }
            source={selectedFood.source}
            productFromSearch={
              selectedFood.source === 'openfood' || selectedFood.source === 'usda'
                ? { ...selectedFood._raw, source: selectedFood.source }
                : undefined
            }
            food={selectedFood.source === 'local' ? (selectedFood._raw as any) : undefined}
            initialMealType={mealType}
            initialDate={logDate}
            initialServingSize={selectedFood.lastGramWeight}
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
            onFoodTracked={() => {
              setSearchQuery('');
              onFoodTracked?.();
              onClose();
            }}
            isAiEnabled={isAiEnabled}
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
            initialDate={logDate}
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
            onFoodTracked={() => {
              setSearchQuery('');
              onFoodTracked?.();
              onClose();
            }}
            isAiEnabled={isAiEnabled}
          />
        ) : null}

        <RecentNutritionHistoryModal
          visible={isRecentNutritionHistoryModalVisible}
          onClose={() => setIsRecentNutritionHistoryModalVisible(false)}
          onFoodClick={handleFoodClick}
          portion100gName={portion100gName}
          mealType={mealType}
        />

        <ConfirmationModal
          visible={confirmSameAsYesterdayVisible}
          onClose={() => setConfirmSameAsYesterdayVisible(false)}
          onConfirm={handleConfirmSameAsYesterday}
          title={t('foodSearch.confirmTrackSameAsYesterdayTitle')}
          message={t('foodSearch.confirmTrackSameAsYesterdayMessage', { meal: mealLabel })}
          confirmLabel={t('common.confirm')}
          variant="primary"
          isLoading={isAddingSameAsYesterday}
        />
      </FullScreenModal>
    </>
  );
}
