import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
} from 'react-native';
import { Search, QrCode, Plus, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme, addOpacityToHex } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { FoodDetailsModal } from './FoodDetailsModal';
import { useFoodSearch, useProductDetails } from '../../hooks/useSearchFood';
import { type SearchResultProduct } from '../../types/openFoodFacts';

type FoodItem = {
  id: string;
  name: string;
  description: string;
  icon?: string; // Emoji or icon name
  iconColor?: string;
  iconBgColor?: string;
  image?: ImageSourcePropType;
  imageUrl?: string; // For remote images
  grade?: string; // e.g., "A", "A+"
  gradeColor?: string;
  // Nutritional data (optional)
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  // Additional data from API
  brand?: string;
  serving_size?: string;
  nutriments?: any;
  _raw?: any;
};

type FoodSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  mealType: string; // e.g., "Breakfast", "Lunch", etc.
  onCreatePress?: () => void;
  onBarcodeScanPress?: () => void;
  onFoodSelect?: (food: FoodItem) => void;
};

const RECENT_HISTORY: FoodItem[] = [
  {
    id: '1',
    name: 'Banana (Large)',
    description: '1 large (136g) • 121 kcal',
    icon: '🍌',
    iconColor: theme.colors.status.warning,
    iconBgColor: theme.colors.status.warning10,
    grade: 'A',
    gradeColor: theme.colors.accent.primary,
    calories: 121,
    protein: 1.5,
    carbs: 31,
    fat: 0.4,
  },
  {
    id: '2',
    name: 'Large Egg',
    description: '1 large • 72 kcal • 6g Protein',
    iconColor: theme.colors.status.info,
    iconBgColor: theme.colors.status.info10,
    grade: 'A+',
    gradeColor: theme.colors.status.success,
    calories: 72,
    protein: 6,
    carbs: 0.4,
    fat: 5,
  },
];

const COMMON_FOODS: FoodItem[] = [
  {
    id: '3',
    name: 'Oatmeal & Berries',
    description: '1 bowl • 350 kcal',
    calories: 350,
    protein: 12,
    carbs: 55,
    fat: 8,
  },
  {
    id: '4',
    name: 'Black Coffee',
    description: '1 cup (8oz) • 2 kcal',
    iconColor: theme.colors.status.warning,
    iconBgColor: theme.colors.status.warning10,
    calories: 2,
    protein: 0.3,
    carbs: 0,
    fat: 0,
  },
  {
    id: '5',
    name: 'Whole Wheat Toast',
    description: '2 slices • 180 kcal',
    iconColor: theme.colors.status.purple,
    iconBgColor: theme.colors.status.purple20,
    calories: 180,
    protein: 8,
    carbs: 32,
    fat: 3,
  },
  {
    id: '6',
    name: 'Greek Yogurt',
    description: '1 cup (170g) • 100 kcal • 18g Protein',
    iconColor: theme.colors.status.error,
    iconBgColor: theme.colors.status.error20,
    calories: 100,
    protein: 18,
    carbs: 6,
    fat: 0,
  },
];

type UnderlineTabsProps = {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
};

function UnderlineTabs({ tabs, activeTab, onTabChange }: UnderlineTabsProps) {
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

export function FoodSearchModal({
  visible,
  onClose,
  mealType,
  onCreatePress,
  onBarcodeScanPress,
  onFoodSelect,
}: FoodSearchModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [isFoodDetailsVisible, setIsFoodDetailsVisible] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Use the search hooks
  const { data: foods = [], isLoading, error } = useFoodSearch(debouncedSearch);
  const { data: productDetails, isLoading: isLoadingDetails } = useProductDetails(selectedBarcode);

  const FILTER_TABS = [
    { id: 'all', label: t('foodSearch.filters.allResults') },
    { id: 'myFoods', label: t('foodSearch.filters.myFoods') },
    { id: 'meals', label: t('foodSearch.filters.meals') },
    { id: 'recipes', label: t('foodSearch.filters.recipes') },
  ];

  const handleFoodClick = (food: SearchResultProduct) => {
    setSelectedBarcode(food.code || null);

    // Convert SearchResultProduct to FoodItem format
    const foodItem: FoodItem = {
      id: food.code || String(Math.random()),
      name: food.product_name || 'Unknown Product',
      description: `${food.brands || food.generic_name || 'Generic'} • ${formatCalories(food)}`,
      brand: food.brands,
      imageUrl: food.image_url,
      serving_size: food.serving_size,
      nutriments: food.nutriments,
      _raw: food,
    };

    setSelectedFood(foodItem);
    setIsFoodDetailsVisible(true);
  };

  const formatCalories = useCallback((food: SearchResultProduct) => {
    const kcal = food.nutriments?.['energy-kcal'];

    if (kcal) {
      return `${Math.round(kcal)} kcal`;
    }

    // TODO: calculate using macro values
    return 'N/A';
  }, []);

  const headerRight = (
    <Pressable onPress={onCreatePress}>
      <Text className="text-sm font-semibold text-accent-secondary">
        {t('foodSearch.createMeal')}
      </Text>
    </Pressable>
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('food.meals.addFoodTo', { meal: mealType })}
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
                  title={isLoading ? 'SEARCHING...' : 'BEST MATCHES'}
                  rightAction={{
                    label: t('foodSearch.viewAll'),
                    onPress: () => {
                      // Handle view all
                    },
                  }}
                />
                <View className="gap-1.5">
                  {isLoading ? (
                    <View className="flex items-center justify-center py-12">
                      <ActivityIndicator size="large" color={theme.colors.accent.primary} />
                    </View>
                  ) : null}

                  {error ? (
                    <View className="py-8 text-center">
                      <Text className="text-center text-text-secondary">
                        Error loading food data. Please try again.
                      </Text>
                    </View>
                  ) : null}

                  {!isLoading && !error && foods.length === 0 && debouncedSearch ? (
                    <View className="py-8 text-center">
                      <Text className="text-center text-text-secondary">
                        {`No results found for "${debouncedSearch}"`}
                      </Text>
                    </View>
                  ) : null}

                  {!isLoading && !error && foods.length > 0
                    ? foods.map((food) => (
                        <FoodItemCard
                          key={food.code}
                          food={{
                            id: food.code || String(Math.random()),
                            name: food.product_name || 'Unknown Product',
                            description: `${food.brands || food.generic_name || 'Generic'} • ${formatCalories(food)}`,
                            brand: food.brands,
                            imageUrl: food.image_url,
                            serving_size: food.serving_size,
                            nutriments: food.nutriments,
                            _raw: food,
                          }}
                          onAddPress={() => handleFoodClick(food)}
                        />
                      ))
                    : null}
                </View>
              </View>
            ) : null}

            {/* Recent History Section - Only show when not searching */}
            {!searchQuery ? (
              <View>
                <SectionHeader
                  title={t('foodSearch.recentHistory')}
                  rightAction={{
                    label: t('foodSearch.viewAll'),
                    onPress: () => {
                      // Handle view all
                    },
                  }}
                />
                <View className="gap-1.5">
                  {RECENT_HISTORY.map((food) => (
                    <FoodItemCard
                      key={food.id}
                      food={food}
                      onAddPress={() => {
                        setSelectedFood(food);
                        setIsFoodDetailsVisible(true);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Common Foods Section - Only show when not searching */}
            {!searchQuery ? (
              <View>
                <SectionHeader title={t('foodSearch.commonBreakfastFoods')} icon={Sparkles} />
                <View className="gap-1.5">
                  {COMMON_FOODS.map((food) => (
                    <FoodItemCard
                      key={food.id}
                      food={food}
                      onAddPress={() => {
                        setSelectedFood(food);
                        setIsFoodDetailsVisible(true);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {/* Food Details Modal */}
      {selectedFood ? (
        <FoodDetailsModal
          visible={isFoodDetailsVisible}
          onClose={() => {
            setIsFoodDetailsVisible(false);
            setSelectedFood(null);
          }}
          food={{
            name: selectedFood.name,
            category: selectedFood.description,
            calories: selectedFood.calories || 0,
            protein: selectedFood.protein || 0,
            carbs: selectedFood.carbs || 0,
            fat: selectedFood.fat || 0,
          }}
          barcode={selectedFood.id}
          serving_size={selectedFood.serving_size}
          nutriments={selectedFood.nutriments}
          _raw={selectedFood._raw}
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
    </FullScreenModal>
  );
}
