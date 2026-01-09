import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ScanLine,
  Sparkles,
  ListPlus,
  UtensilsCrossed,
  WifiOff,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import i18n, { LOCALE_MAP, LanguageKeys } from '../lang/lang';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { CaloriesRemainingCard } from '../components/CaloriesRemainingCard';
import { FoodItemCard } from '../components/FoodItemCard';
import { MealSection } from '../components/MealSection';
import { Button } from '../components/theme/Button';
import { AddFoodModal } from '../components/AddFoodModal';
import { FoodSearchModal } from '../components/FoodSearchModal';
import { EmptyStateCard } from '../components/theme/EmptyStateCard';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { ErrorStateCard } from '../components/theme/ErrorStateCard';

const FOOD_DATA = {
  date: 'Today, Oct 24',
  calories: {
    remaining: 1250,
    total: 2500,
    percentage: 50,
  },
  macros: {
    protein: {
      percentage: 40,
      amount: '120g',
      color: theme.colors.macros.protein.text,
      progressColor: theme.colors.macros.protein.bg,
    },
    carbs: {
      percentage: 45,
      amount: '150g',
      color: theme.colors.macros.carbs.text,
      progressColor: theme.colors.macros.carbs.bg,
    },
    fat: {
      percentage: 25,
      amount: '60g',
      color: theme.colors.macros.fat.text,
      progressColor: theme.colors.macros.fat.bg,
    },
  },
  meals: {
    breakfast: {
      totalCalories: 350,
      items: [
        {
          id: '1',
          name: 'Oatmeal & Berries',
          description: '1 cup oats • 1/2 cup blueberries',
          calories: 350,
          image: require('../assets/icon.png'),
        },
        {
          id: '2',
          name: 'Orange Juice',
          description: '1 glass (250ml)',
          calories: 110,
          image: require('../assets/icon.png'),
        },
      ],
    },
    lunch: {
      totalCalories: 450,
      items: [
        {
          id: '3',
          name: 'Grilled Chicken Salad',
          description: '200g Chicken • Mixed Greens...',
          calories: 450,
          image: require('../assets/icon.png'),
        },
      ],
    },
  },
};

export default function FoodScreen() {
  const { t } = useTranslation();
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('Breakfast');
  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];
  const today = new Date();
  const formattedDate = format(today, 'MMM d', { locale });

  // State management for food data
  const [meals, setMeals] = useState(FOOD_DATA.meals);
  const [calories, setCalories] = useState(FOOD_DATA.calories);
  const [macros, setMacros] = useState(FOOD_DATA.macros);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulate loading food data - replace with actual API call
  const loadFoodData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In real app, replace with: const data = await fetchFoodData();
      setMeals(FOOD_DATA.meals);
      setCalories(FOOD_DATA.calories);
      setMacros(FOOD_DATA.macros);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load food data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Uncomment to simulate initial load
    // loadFoodData();
  }, []);

  // Check if all meals are empty
  const hasNoFood = Object.values(meals).every((meal) => !meal.items || meal.items.length === 0);

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        {/* Header with Date Navigation */}
        <View className="border-b border-border-dark bg-bg-primary">
          <View className="flex-row items-center justify-between px-4 py-4">
            <Pressable>
              <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-semibold text-text-primary">
                {t('food.header.today')}, {formattedDate}
              </Text>
              <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
            </View>
            <Pressable>
              <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pt-6">
            {/* Error State */}
            {error && (
              <ErrorStateCard
                icon={WifiOff}
                title={t('errors.connectionTimeout.title')}
                description={t('errors.connectionTimeout.description')}
                buttonLabel={t('errors.connectionTimeout.tryAgain')}
                onButtonPress={loadFoodData}
              />
            )}

            {/* Loading State */}
            {isLoading && !error && (
              <>
                {/* Calories Card Skeleton */}
                <View className="rounded-lg border border-white/5 bg-bg-card p-5">
                  <View className="mb-4 flex-row items-center justify-between">
                    <View className="gap-2">
                      <SkeletonLoader width={120} height={16} />
                      <SkeletonLoader width={80} height={32} />
                    </View>
                    <SkeletonLoader width={60} height={24} />
                  </View>
                  <SkeletonLoader width="100%" height={8} borderRadius={4} />
                  <View className="mt-4 flex-row gap-2">
                    <SkeletonLoader width="33%" height={60} borderRadius={8} />
                    <SkeletonLoader width="33%" height={60} borderRadius={8} />
                    <SkeletonLoader width="33%" height={60} borderRadius={8} />
                  </View>
                </View>

                {/* Food Item Skeletons */}
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="flex-row items-center justify-between rounded-lg border border-white/5 bg-bg-card p-4">
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader width={40} height={40} borderRadius={20} />
                      <View className="gap-1">
                        <SkeletonLoader width={96} height={16} />
                        <SkeletonLoader width={64} height={12} />
                      </View>
                    </View>
                    <SkeletonLoader width={48} height={16} />
                  </View>
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && !error && hasNoFood && (
              <EmptyStateCard
                icon={UtensilsCrossed}
                title={t('emptyStates.food.title')}
                description={t('emptyStates.food.description')}
                buttonLabel={t('emptyStates.food.buttonLabel')}
                buttonVariant="secondary"
                onButtonPress={() => setIsAddFoodModalVisible(true)}
              />
            )}

            {/* Normal State */}
            {!isLoading && !error && !hasNoFood && (
              <>
                {/* Calories Remaining Card */}
                <CaloriesRemainingCard calories={calories} macros={macros} />

                {/* Scan Buttons */}
                <View className="gap-4">
                  <View className="flex-row gap-4">
                    <Button
                      label={t('food.actions.scanBarcode')}
                      icon={ScanLine}
                      variant="secondary"
                      size="md"
                      width="flex-1"
                      onPress={() => {
                        // Handle scan barcode action
                      }}
                    />
                    <Button
                      label={t('food.actions.aiCamera')}
                      icon={Sparkles}
                      variant="secondaryGradient"
                      size="md"
                      width="flex-1"
                      onPress={() => {
                        // Handle AI camera action
                      }}
                    />
                  </View>
                  <Button
                    label={t('food.actions.moreFoodOptions')}
                    icon={ListPlus}
                    variant="secondaryGradient"
                    size="md"
                    width="full"
                    onPress={() => setIsAddFoodModalVisible(true)}
                  />
                </View>

                {/* Breakfast Section */}
                {meals.breakfast.items && meals.breakfast.items.length > 0 && (
                  <MealSection
                    title={t('food.meals.breakfast')}
                    totalCalories={meals.breakfast.totalCalories}>
                    {meals.breakfast.items.map((item) => (
                      <FoodItemCard
                        key={item.id}
                        name={item.name}
                        description={item.description}
                        calories={item.calories}
                        image={item.image}
                      />
                    ))}
                  </MealSection>
                )}

                {/* Lunch Section */}
                {meals.lunch.items && meals.lunch.items.length > 0 && (
                  <MealSection
                    title={t('food.meals.lunch')}
                    totalCalories={meals.lunch.totalCalories}>
                    {meals.lunch.items.map((item) => (
                      <FoodItemCard
                        key={item.id}
                        name={item.name}
                        description={item.description}
                        calories={item.calories}
                        image={item.image}
                      />
                    ))}
                  </MealSection>
                )}
              </>
            )}

            {/* Bottom spacing for navigation */}
            <View className="h-32" />
          </View>
        </ScrollView>
      </View>

      {/* Add Food Modal */}
      <AddFoodModal
        visible={isAddFoodModalVisible}
        onClose={() => setIsAddFoodModalVisible(false)}
        onMealTypeSelect={(mealType) => {
          // Map meal type to display name
          const mealTypeMap: Record<string, string> = {
            breakfast: 'Breakfast',
            lunch: 'Lunch',
            dinner: 'Dinner',
            snack: 'Snacks',
            other: 'Other',
          };
          setSelectedMealType(mealTypeMap[mealType] || 'Breakfast');
          setIsAddFoodModalVisible(false);
          setIsFoodSearchModalVisible(true);
        }}
        onAiCameraPress={() => {
          console.log('AI Camera pressed');
        }}
        onScanBarcodePress={() => {
          console.log('Scan Barcode pressed');
        }}
        onSearchFoodPress={() => {
          setIsAddFoodModalVisible(false);
          setIsFoodSearchModalVisible(true);
        }}
        onCreateCustomFoodPress={() => {
          console.log('Create Custom Food pressed');
        }}
        onTrackCustomMealPress={() => {
          console.log('Track Custom Meal pressed');
        }}
      />

      {/* Food Search Modal */}
      <FoodSearchModal
        visible={isFoodSearchModalVisible}
        onClose={() => setIsFoodSearchModalVisible(false)}
        mealType={selectedMealType}
        onCreatePress={() => {
          console.log('Create food pressed');
        }}
        onBarcodeScanPress={() => {
          console.log('Barcode scan pressed');
        }}
        onFoodSelect={(food) => {
          console.log('Food selected:', food);
          // Handle food selection (e.g., add to meal)
          setIsFoodSearchModalVisible(false);
        }}
      />
    </MasterLayout>
  );
}
