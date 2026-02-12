import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit,
  ListPlus,
  ScanLine,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '../../components/BottomPopUpMenu';
import { CaloriesRemainingCard } from '../../components/cards/CaloriesRemainingCard';
import { FoodItemCard } from '../../components/cards/FoodItemCard';
import { MasterLayout } from '../../components/MasterLayout';
import { MealSection } from '../../components/MealSection';
import { AddFoodModal } from '../../components/modals/AddFoodModal';
import CreateCustomFoodModal from '../../components/modals/CreateCustomFoodModal';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { FoodDetailsModal } from '../../components/modals/FoodDetailsModal';
import { FoodSearchModal } from '../../components/modals/FoodSearchModal';
import SmartCameraModal from '../../components/modals/SmartCameraModal';
import { useSnackbar } from '../../components/SnackbarContext';
import { Button } from '../../components/theme/Button';
import { EmptyStateCard } from '../../components/theme/EmptyStateCard';
import { SkeletonLoader } from '../../components/theme/SkeletonLoader';
import Food from '../../database/models/Food';
import NutritionLog from '../../database/models/NutritionLog';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useNutritionLogs } from '../../hooks/useNutritionLogs';
import { useSettings } from '../../hooks/useSettings';
import i18n, { LanguageKeys, LOCALE_MAP } from '../../lang/lang';
import { theme } from '../../theme';

export default function FoodScreen() {
  const { t } = useTranslation();
  const { units } = useSettings();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan'>(
    'ai-meal-photo'
  );
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<{
    log: any;
    food: any;
    nutrients: any;
    gramWeight: number;
  } | null>(null);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState(t('food.meals.breakfast'));
  const [selectedDate, setSelectedDate] = useState(new Date()); // Add date state
  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];

  const { logs, dailyNutrients, isLoading, refresh } = useNutritionLogs({
    mode: 'daily',
    date: selectedDate,
    enableReactivity: true,
    visible: true,
  });

  const [resolvedLogs, setResolvedLogs] = useState<
    {
      log: NutritionLog;
      food: Food;
      nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      gramWeight: number;
    }[]
  >([]);
  const [isResolvingRelations, setIsResolvingRelations] = useState(false);

  // Get current nutrition goal
  const { goal: nutritionGoal } = useCurrentNutritionGoal({
    mode: 'current',
    enableReactivity: true,
    visible: true,
  });

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setIsResolvingRelations(true);
      setResolvedLogs([]);

      try {
        const resolved = (
          await Promise.all(
            logs.map(async (log) => {
              const [food, nutrients, gramWeight] = await Promise.all([
                log.food,
                log.getNutrients(),
                log.getGramWeight(),
              ]);

              return food ? { log, food, nutrients, gramWeight } : null;
            })
          )
        ).filter((item) => item !== null) as {
          log: any;
          food: any;
          nutrients: any;
          gramWeight: any;
        }[];

        if (!cancelled) {
          setResolvedLogs(resolved);
          setIsResolvingRelations(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedLogs([]);
          setIsResolvingRelations(false);
        }
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [logs]);

  const isScreenLoading = isLoading || isResolvingRelations;

  // Calculate calories remaining and macros
  const caloriesData = useMemo(() => {
    const totalCalories = nutritionGoal?.totalCalories || 2500;
    const consumedCalories = Math.ceil(dailyNutrients?.calories || 0);
    const remainingCalories = Math.max(0, totalCalories - consumedCalories);
    const percentage = Math.round((consumedCalories / totalCalories) * 100);

    return {
      remaining: Math.ceil(remainingCalories),
      total: totalCalories,
      percentage,
    };
  }, [dailyNutrients, nutritionGoal]);

  const macrosData = useMemo(() => {
    const totalProtein = nutritionGoal?.protein || 150;
    const totalCarbs = nutritionGoal?.carbs || 250;
    const totalFat = nutritionGoal?.fats || 80;

    return {
      protein: {
        percentage: Math.round(((dailyNutrients?.protein || 0) / totalProtein) * 100),
        amount: `${Math.round(dailyNutrients?.protein || 0)}g`,
        color: theme.colors.macros.protein.text,
        progressColor: theme.colors.macros.protein.bg,
      },
      carbs: {
        percentage: Math.round(((dailyNutrients?.carbs || 0) / totalCarbs) * 100),
        amount: `${Math.round(dailyNutrients?.carbs || 0)}g`,
        color: theme.colors.macros.carbs.text,
        progressColor: theme.colors.macros.carbs.bg,
      },
      fat: {
        percentage: Math.round(((dailyNutrients?.fat || 0) / totalFat) * 100),
        amount: `${Math.round(dailyNutrients?.fat || 0)}g`,
        color: theme.colors.macros.fat.text,
        progressColor: theme.colors.macros.fat.bg,
      },
    };
  }, [dailyNutrients, nutritionGoal]);

  // Group logs by meal type
  const mealsByType = useMemo(() => {
    const meals: Record<string, (typeof resolvedLogs)[number][]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };

    resolvedLogs.forEach((entry) => {
      if (entry.log.type && meals[entry.log.type]) {
        meals[entry.log.type].push(entry);
      }
    });

    return meals;
  }, [resolvedLogs]);

  // Check if all meals are empty
  const hasNoFood = !isScreenLoading && logs.length === 0;

  // Date navigation functions
  const goToPreviousDay = () => {
    const previousDay = new Date(selectedDate);
    previousDay.setDate(previousDay.getDate() - 1);
    setSelectedDate(previousDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleFoodMenuPress = (entry: {
    log: any;
    food: any;
    nutrients: any;
    gramWeight: number;
  }) => {
    setSelectedFoodItem(entry);
    setIsFoodMenuVisible(true);
  };

  const handleEditFood = () => {
    setIsFoodMenuVisible(false);
    setIsFoodDetailsModalVisible(true);
  };

  const handleDuplicateFood = () => {
    // TODO: implement duplicate food functionality
    console.log('Duplicate food:', selectedFoodItem?.food?.name);
  };

  const handleDeleteFood = () => {
    // TODO: implement delete food functionality with confirmation dialog
    console.log('Delete food:', selectedFoodItem?.food?.name);
  };

  const foodMenuItems = [
    {
      icon: Edit,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.edit'),
      description: t('food.actions.editDesc'),
      onPress: handleEditFood,
    },
    {
      icon: Copy,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.duplicate'),
      description: t('food.actions.duplicateDesc'),
      onPress: handleDuplicateFood,
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.delete'),
      description: t('food.actions.deleteDesc'),
      onPress: handleDeleteFood,
    },
  ];

  const handleAddFoodToMeal = (mealType: string) => {
    setSelectedMealType(mealType);
    setIsFoodSearchModalVisible(true);
  };

  // Format date for display
  const getDisplayDate = () => {
    const now = new Date();
    const isToday = selectedDate.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = selectedDate.toDateString() === yesterday.toDateString();

    if (isToday) {
      return t('food.header.today');
    } else if (isYesterday) {
      return t('food.header.yesterday');
    } else {
      return format(selectedDate, 'MMM d', { locale });
    }
  };

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        {/* Header with Date Navigation */}
        <View className="border-b border-border-dark bg-bg-primary">
          <View className="flex-row items-center justify-between px-4 py-4">
            <Pressable onPress={goToPreviousDay}>
              <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
            <Pressable
              onPress={() => setIsDatePickerVisible(true)}
              className="flex-row items-center gap-2"
            >
              <Text className="text-xl font-semibold text-text-primary">{getDisplayDate()}</Text>
              <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
            </Pressable>
            <Pressable onPress={goToNextDay}>
              <ChevronRight size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pt-6">
            {/* Loading State */}
            {isScreenLoading ? (
              <>
                {/* Calories Card Skeleton */}
                <View
                  className="rounded-lg border bg-bg-card p-5"
                  style={{ borderColor: theme.colors.background.white5 }}
                >
                  <View className="mb-4 flex-row items-center justify-between">
                    <View className="gap-2">
                      <SkeletonLoader width={theme.size['120']} height={theme.size['4']} />
                      <SkeletonLoader width={theme.size['20']} height={theme.size['8']} />
                    </View>
                    <SkeletonLoader width={theme.size['60']} height={theme.size['6']} />
                  </View>
                  <SkeletonLoader
                    width="100%"
                    height={theme.size['2']}
                    borderRadius={theme.borderRadius.xs}
                  />
                  <View className="mt-4 flex-row gap-2">
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                  </View>
                </View>

                {/* Food Item Skeletons */}
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="flex-row items-center justify-between rounded-lg border bg-bg-card p-4"
                    style={{ borderColor: theme.colors.background.white5 }}
                  >
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader
                        width={theme.size['10']}
                        height={theme.size['10']}
                        borderRadius={theme.borderRadius.xl}
                      />
                      <View className="gap-1">
                        <SkeletonLoader width={theme.size['96']} height={theme.size['4']} />
                        <SkeletonLoader width={theme.size['16']} height={theme.size['3']} />
                      </View>
                    </View>
                    <SkeletonLoader width={theme.size['12']} height={theme.size['4']} />
                  </View>
                ))}
              </>
            ) : null}

            {/* Empty State */}
            {!isScreenLoading && hasNoFood ? (
              <EmptyStateCard
                icon={UtensilsCrossed}
                title={t('emptyStates.food.title')}
                description={t('emptyStates.food.description')}
                buttonLabel={t('emptyStates.food.buttonLabel')}
                buttonVariant="secondary"
                onButtonPress={() => setIsAddFoodModalVisible(true)}
              />
            ) : null}

            {/* Normal State */}
            {!isScreenLoading && !hasNoFood ? (
              <>
                {/* Calories Remaining Card */}
                <CaloriesRemainingCard calories={caloriesData} macros={macrosData} />

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
                        setCameraMode('barcode-scan');
                        setIsCameraVisible(true);
                      }}
                    />
                    <Button
                      label={t('food.actions.aiCamera')}
                      icon={Sparkles}
                      variant="secondaryGradient"
                      size="md"
                      width="flex-1"
                      onPress={() => {
                        setCameraMode('ai-meal-photo');
                        setIsCameraVisible(true);
                      }}
                    />
                  </View>
                  <View className="flex-row gap-4">
                    <Button
                      label={t('food.actions.goToToday')}
                      icon={Calendar}
                      variant="secondary"
                      size="md"
                      width="flex-1"
                      onPress={goToToday}
                    />
                    <Button
                      label={t('food.actions.moreFoodOptions')}
                      icon={ListPlus}
                      variant="secondaryGradient"
                      size="md"
                      width="flex-1"
                      onPress={() => setIsAddFoodModalVisible(true)}
                    />
                  </View>
                </View>

                {/* Breakfast Section */}
                <MealSection
                  title={t('food.meals.breakfast')}
                  totalCalories={Math.ceil(dailyNutrients?.byMealType?.breakfast?.calories || 0)}
                  totalProtein={dailyNutrients?.byMealType?.breakfast?.protein || 0}
                  totalCarbs={dailyNutrients?.byMealType?.breakfast?.carbs || 0}
                  totalFat={dailyNutrients?.byMealType?.breakfast?.fat || 0}
                  onAddFood={() => handleAddFoodToMeal(t('food.meals.breakfast'))}
                >
                  {mealsByType.breakfast.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.food?.name ?? ''}
                      description={`${Math.round(entry.gramWeight)} g`}
                      calories={Math.ceil(entry.nutrients.calories)}
                      image={
                        entry.food?.imageUrl
                          ? { uri: entry.food.imageUrl }
                          : require('../../assets/icon.png')
                      }
                      onMorePress={() => handleFoodMenuPress(entry)}
                    />
                  ))}
                </MealSection>

                {/* Lunch Section */}
                <MealSection
                  title={t('food.meals.lunch')}
                  totalCalories={Math.ceil(dailyNutrients?.byMealType?.lunch?.calories || 0)}
                  totalProtein={dailyNutrients?.byMealType?.lunch?.protein || 0}
                  totalCarbs={dailyNutrients?.byMealType?.lunch?.carbs || 0}
                  totalFat={dailyNutrients?.byMealType?.lunch?.fat || 0}
                  onAddFood={() => handleAddFoodToMeal(t('food.meals.lunch'))}
                >
                  {mealsByType.lunch.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.food?.name ?? ''}
                      description={`${Math.round(entry.gramWeight)} g`}
                      calories={Math.ceil(entry.nutrients.calories)}
                      image={
                        entry.food?.imageUrl
                          ? { uri: entry.food.imageUrl }
                          : require('../../assets/icon.png')
                      }
                      onMorePress={() => handleFoodMenuPress(entry)}
                    />
                  ))}
                </MealSection>

                {/* Dinner Section */}
                <MealSection
                  title={t('food.meals.dinner')}
                  totalCalories={Math.ceil(dailyNutrients?.byMealType?.dinner?.calories || 0)}
                  totalProtein={dailyNutrients?.byMealType?.dinner?.protein || 0}
                  totalCarbs={dailyNutrients?.byMealType?.dinner?.carbs || 0}
                  totalFat={dailyNutrients?.byMealType?.dinner?.fat || 0}
                  onAddFood={() => handleAddFoodToMeal(t('food.meals.dinner'))}
                >
                  {mealsByType.dinner.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.food?.name ?? ''}
                      description={`${Math.round(entry.gramWeight)} g`}
                      calories={Math.ceil(entry.nutrients.calories)}
                      image={
                        entry.food?.imageUrl
                          ? { uri: entry.food.imageUrl }
                          : require('../../assets/icon.png')
                      }
                      onMorePress={() => handleFoodMenuPress(entry)}
                    />
                  ))}
                </MealSection>

                {/* Snack Section */}
                <MealSection
                  title={t('food.meals.snacks')}
                  totalCalories={Math.ceil(dailyNutrients?.byMealType?.snack?.calories || 0)}
                  totalProtein={dailyNutrients?.byMealType?.snack?.protein || 0}
                  totalCarbs={dailyNutrients?.byMealType?.snack?.carbs || 0}
                  totalFat={dailyNutrients?.byMealType?.snack?.fat || 0}
                  onAddFood={() => handleAddFoodToMeal(t('food.meals.snacks'))}
                >
                  {mealsByType.snack.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.food?.name ?? ''}
                      description={`${Math.round(entry.gramWeight)} g`}
                      calories={Math.ceil(entry.nutrients.calories)}
                      image={
                        entry.food?.imageUrl
                          ? { uri: entry.food.imageUrl }
                          : require('../../assets/icon.png')
                      }
                      onMorePress={() => handleFoodMenuPress(entry)}
                    />
                  ))}
                </MealSection>

                {/* Other Section */}
                <MealSection
                  title={t('food.meals.other')}
                  totalCalories={Math.ceil(dailyNutrients?.byMealType?.other?.calories || 0)}
                  totalProtein={dailyNutrients?.byMealType?.other?.protein || 0}
                  totalCarbs={dailyNutrients?.byMealType?.other?.carbs || 0}
                  totalFat={dailyNutrients?.byMealType?.other?.fat || 0}
                  onAddFood={() => handleAddFoodToMeal(t('food.meals.other'))}
                >
                  {mealsByType.other.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.food?.name ?? ''}
                      description={`${Math.round(entry.gramWeight)} g`}
                      calories={Math.ceil(entry.nutrients.calories)}
                      image={
                        entry.food?.imageUrl
                          ? { uri: entry.food.imageUrl }
                          : require('../../assets/icon.png')
                      }
                      onMorePress={() => handleFoodMenuPress(entry)}
                    />
                  ))}
                </MealSection>
              </>
            ) : null}

            {/* Bottom spacing for navigation */}
            <View className="h-32" />
          </View>
        </ScrollView>
      </View>

      {/* Add Food Modal */}
      {isAddFoodModalVisible ? (
        <AddFoodModal
          visible={isAddFoodModalVisible}
          onClose={() => setIsAddFoodModalVisible(false)}
          onMealTypeSelect={(mealType) => {
            // Map meal type to display name
            const mealTypeMap: Record<string, string> = {
              breakfast: t('food.meals.breakfast'),
              lunch: t('food.meals.lunch'),
              dinner: t('food.meals.dinner'),
              snack: t('food.meals.snacks'),
              other: t('food.meals.other'),
            };
            setSelectedMealType(mealTypeMap[mealType] || t('food.meals.breakfast'));
            setIsAddFoodModalVisible(false);
            setIsFoodSearchModalVisible(true);
          }}
          onAiCameraPress={() => {
            // Open CameraModal with AI mode selected
            setIsAddFoodModalVisible(false);
            setCameraMode('ai-meal-photo');
            setIsCameraVisible(true);
          }}
          onScanBarcodePress={() => {
            // Open CameraModal with barcode mode selected
            setIsAddFoodModalVisible(false);
            setCameraMode('barcode-scan');
            setIsCameraVisible(true);
          }}
          onSearchFoodPress={() => {
            setIsAddFoodModalVisible(false);
            setIsFoodSearchModalVisible(true);
          }}
          onCreateCustomFoodPress={() => {
            // Open CreateCustomFoodModal
            setIsAddFoodModalVisible(false);
            setIsCreateCustomFoodVisible(true);
          }}
          onTrackCustomMealPress={() => {
            // TODO: implement track custom meal functionality
            console.log('Track Custom Meal pressed');
          }}
        />
      ) : null}

      {/* Camera Modal */}
      {isCameraVisible ? (
        <SmartCameraModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          mode={cameraMode}
        />
      ) : null}

      {/* Create Custom Food Modal */}
      {isCreateCustomFoodVisible ? (
        <CreateCustomFoodModal
          visible={isCreateCustomFoodVisible}
          trackFoodAfterSave={true}
          onClose={() => setIsCreateCustomFoodVisible(false)}
        />
      ) : null}

      {/* Food Search Modal */}
      {isFoodSearchModalVisible ? (
        <FoodSearchModal
          visible={isFoodSearchModalVisible}
          onClose={() => setIsFoodSearchModalVisible(false)}
          mealType={selectedMealType}
          onCreatePress={() => {
            // TODO: implement create custom food from search modal
            console.log('Create food pressed');
          }}
          onBarcodeScanPress={() => {
            // TODO: open camera modal with barcode mode from search modal
            console.log('Barcode scan pressed');
          }}
          onFoodSelect={(food) => {
            // TODO: implement food selection and add to selected meal type
            // Handle food selection (e.g., add to meal)
            setIsFoodSearchModalVisible(false);
          }}
        />
      ) : null}

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      {/* Food Menu Modal */}
      <BottomPopUpMenu
        visible={isFoodMenuVisible}
        onClose={() => setIsFoodMenuVisible(false)}
        title={selectedFoodItem?.food?.name || ''}
        subtitle={`${Math.round(selectedFoodItem?.gramWeight || 0)}g • ${Math.ceil(selectedFoodItem?.nutrients?.calories || 0)} kcal`}
        items={foodMenuItems}
      />

      {/* Food Details Modal (edit mode) */}
      {isFoodDetailsModalVisible && selectedFoodItem ? (
        <FoodDetailsModal
          visible={isFoodDetailsModalVisible}
          onClose={() => {
            setIsFoodDetailsModalVisible(false);
            setSelectedFoodItem(null);
          }}
          food={selectedFoodItem.food}
          foodLog={selectedFoodItem.log}
          onAddFood={async (_data) => {
            try {
              await refresh();
            } catch (_error) {
              // Show error snackbar to user
              showSnackbar('error', t('food.errors.refreshFailed'));

              // Reload the current screen using expo-router
              router.replace('/nutrition/food');
            }
          }}
        />
      ) : null}
    </MasterLayout>
  );
}
