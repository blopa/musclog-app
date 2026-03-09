import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Copy,
  Edit,
  ListPlus,
  ScanLine,
  Scissors,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BottomPopUpMenu } from '../../components/BottomPopUpMenu';
import { DailySummaryCard } from '../../components/cards/DailySummaryCard/DailySummaryCard';
import { FoodItemCard } from '../../components/cards/FoodItemCard';
import { DateNavigator } from '../../components/DateNavigator';
import { MasterLayout } from '../../components/MasterLayout';
import { MealSection } from '../../components/MealSection';
import { AddFoodModal } from '../../components/modals/AddFoodModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import CreateCustomFoodModal from '../../components/modals/CreateCustomFoodModal';
import { CreateMealModal } from '../../components/modals/CreateMealModal';
import { FoodMealDetailsModal } from '../../components/modals/FoodMealDetailsModal';
import { FoodSearchModal } from '../../components/modals/FoodSearchModal';
import GoalsManagementModal from '../../components/modals/GoalsManagementModal';
import { MoveCopyMealModal } from '../../components/modals/MoveCopyMealModal';
import MyMealsModal from '../../components/modals/MyMealsModal';
import SmartCameraModal from '../../components/modals/SmartCameraModal';
import { useSnackbar } from '../../components/SnackbarContext';
import { Button } from '../../components/theme/Button';
import { EmptyStateCard } from '../../components/theme/EmptyStateCard';
import { MenuButton } from '../../components/theme/MenuButton';
import { SkeletonLoader } from '../../components/theme/SkeletonLoader';
import Food from '../../database/models/Food';
import NutritionLog, { type MealType } from '../../database/models/NutritionLog';
import { NutritionService } from '../../database/services';
import { useDailyNutritionSummary } from '../../hooks/useDailyNutritionSummary';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';
import { getSimpleServingDisplay } from '../../utils/foodDisplay';

const getMealActionErrorKey = (mode: 'move' | 'copy' | 'split'): string => {
  switch (mode) {
    case 'move':
      return 'food.actions.moveError';
    case 'copy':
      return 'food.actions.copyError';
    case 'split':
      return 'food.actions.splitError';
    default:
      return 'food.actions.moveError';
  }
};

export default function FoodScreen() {
  const { t } = useTranslation();
  const { units, isAiFeaturesEnabled, useOcrBeforeAi } = useSettings();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [hideCameraModePicker, setHideCameraModePicker] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan'>(
    'ai-meal-photo'
  );
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<{
    log: NutritionLog;
    food: Food | null;
    nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    gramWeight: number;
    displayName: string;
  } | null>(null);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [selectedDate, setSelectedDate] = useState(new Date()); // Add date state
  const [isMealMenuVisible, setIsMealMenuVisible] = useState(false);
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [isDeleteAllMealVisible, setIsDeleteAllMealVisible] = useState(false);
  const [isMealActionModalVisible, setIsMealActionModalVisible] = useState(false);
  const [mealActionMode, setMealActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealActionLoading, setIsMealActionLoading] = useState(false);

  const { logs, dailyNutrients, isLoading, refresh, totalCount, nutritionGoal } =
    useDailyNutritionSummary({
      date: selectedDate,
      enableReactivity: true,
      visible: true,
    });

  const [resolvedLogs, setResolvedLogs] = useState<
    {
      log: NutritionLog;
      food: Food | null;
      nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      gramWeight: number;
      displayName: string;
    }[]
  >([]);
  const [isResolvingRelations, setIsResolvingRelations] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setIsResolvingRelations(true);
      setResolvedLogs([]);

      try {
        const resolved = await Promise.all(
          logs.map(async (log) => {
            let food: Food | null = null;
            try {
              food = await log.food;
            } catch {
              // Food may be deleted; we still show the log using snapshot name and nutrients
            }
            const [nutrients, gramWeight, displayName] = await Promise.all([
              log.getNutrients(),
              log.getGramWeight(),
              log.getDisplayName(),
            ]);
            return { log, food, nutrients, gramWeight, displayName };
          })
        );

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

  // Calculate calories consumed and macros
  const caloriesData = useMemo(() => {
    const totalCalories = nutritionGoal?.totalCalories || 2500;
    const consumedCalories = Math.round(dailyNutrients?.calories || 0);
    const percentage = Math.round((consumedCalories / totalCalories) * 100);

    return {
      consumed: consumedCalories,
      total: totalCalories,
      percentage,
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

  // Check if all meals are empty AND no food has ever been tracked
  const hasNoFood = !isScreenLoading && totalCount === 0;

  const handleFoodMenuPress = (entry: {
    log: any;
    food: any;
    nutrients: any;
    gramWeight: number;
    displayName: string;
  }) => {
    setSelectedFoodItem(entry);
    setIsFoodMenuVisible(true);
  };

  const handleEditFood = () => {
    setIsFoodMenuVisible(false);
    setIsDuplicateMode(false);
    setIsFoodDetailsModalVisible(true);
  };

  const handleDuplicateFood = () => {
    setIsFoodMenuVisible(false);
    setIsDuplicateMode(true);
    setIsFoodDetailsModalVisible(true);
  };

  const handleDeleteFood = () => {
    setIsFoodMenuVisible(false);
    setIsDeleteConfirmationVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedFoodItem) {
      return;
    }

    try {
      // The @writer method returns a promise that resolves when the operation completes
      await NutritionService.deleteNutritionLog(selectedFoodItem.log.id);
      showSnackbar('success', t('food.actions.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting food:', error);
      showSnackbar('error', t('food.actions.deleteError'));
    } finally {
      // Always close the modal and clear selection, regardless of success or error
      setIsDeleteConfirmationVisible(false);
      setSelectedFoodItem(null);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmationVisible(false);
    setSelectedFoodItem(null);
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

  const handleAddFoodToMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsFoodSearchModalVisible(true);
  };

  const handleMealMenuPress = (mealType: MealType) => {
    setSelectedMealForMenu(mealType);
    setIsMealMenuVisible(true);
  };

  const handleDeleteAllMeal = () => {
    setIsMealMenuVisible(false);
    setIsDeleteAllMealVisible(true);
  };

  const handleConfirmDeleteAllMeal = async () => {
    if (!selectedMealForMenu) {
      return;
    }
    try {
      const mealFoods = mealsByType[selectedMealForMenu];
      await NutritionService.deleteNutritionLogsBatch(mealFoods.map((e) => e.log));
      showSnackbar('success', t('food.actions.deleteAllSuccess'));
      await refresh();
    } catch (error) {
      console.error('Error deleting all meal items:', error);
      showSnackbar('error', t('food.actions.deleteAllError'));
    } finally {
      setIsDeleteAllMealVisible(false);
      setSelectedMealForMenu(null);
    }
  };

  const handleMoveMealToAnotherDay = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('move');
    setIsMealActionModalVisible(true);
  };

  const handleCopyMealToAnotherDay = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('copy');
    setIsMealActionModalVisible(true);
  };

  const handleSplitMeal = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('split');
    setIsMealActionModalVisible(true);
  };

  const handleConfirmMealAction = async (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => {
    if (!selectedMealForMenu) {
      return;
    }
    setIsMealActionLoading(true);
    try {
      const mealFoods = mealsByType[selectedMealForMenu];
      const logs = mealFoods.map((e) => e.log);
      if (mealActionMode === 'move') {
        await NutritionService.moveNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.moveSuccess'));
      } else if (mealActionMode === 'copy') {
        await NutritionService.copyNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.copySuccess'));
      } else if (mealActionMode === 'split' && splitPercentage) {
        await NutritionService.splitNutritionLogsToDate(
          logs,
          targetDate,
          targetMealType,
          splitPercentage
        );
        showSnackbar('success', t('food.actions.splitSuccess'));
      }
      await refresh();
    } catch (error) {
      console.error('Error performing meal action:', error);
      const errorKey = getMealActionErrorKey(mealActionMode);

      showSnackbar('error', t(errorKey));
    } finally {
      setIsMealActionLoading(false);
      setIsMealActionModalVisible(false);
      setSelectedMealForMenu(null);
    }
  };

  const mealMenuItems = [
    {
      icon: Scissors,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      title: t('food.actions.splitMeal'),
      description: t('food.actions.splitMealDesc'),
      onPress: handleSplitMeal,
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.deleteAll'),
      description: t('food.actions.deleteAllDesc'),
      onPress: handleDeleteAllMeal,
    },
    {
      icon: ArrowRight,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.moveToAnotherDay'),
      description: t('food.actions.moveToAnotherDayDesc'),
      onPress: handleMoveMealToAnotherDay,
    },
    {
      icon: Copy,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.copyToAnotherDay'),
      description: t('food.actions.copyToAnotherDayDesc'),
      onPress: handleCopyMealToAnotherDay,
    },
  ];

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        <View className="border-b border-border-dark bg-bg-primary">
          <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
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
                title={t('emptyStates.foods.title')}
                description={t('emptyStates.foods.description')}
                buttonLabel={t('emptyStates.foods.buttonLabel')}
                buttonVariant="secondary"
                onButtonPress={() => setIsAddFoodModalVisible(true)}
              />
            ) : null}

            {/* Normal State */}
            {!isScreenLoading && !hasNoFood ? (
              <>
                {/* Daily Summary Card */}
                <DailySummaryCard
                  calories={{
                    consumed: caloriesData.consumed,
                    remaining: Math.max(0, caloriesData.total - caloriesData.consumed),
                    goal: caloriesData.total,
                  }}
                  macros={{
                    protein: {
                      value: Math.round(dailyNutrients?.protein || 0),
                      goal: nutritionGoal?.protein || 150,
                    },
                    carbs: {
                      value: Math.round(dailyNutrients?.carbs || 0),
                      goal: nutritionGoal?.carbs || 250,
                    },
                    fats: {
                      value: Math.round(dailyNutrients?.fat || 0),
                      goal: nutritionGoal?.fats || 80,
                    },
                  }}
                  menuButton={
                    <MenuButton
                      onPress={() => setIsGoalsManagementModalVisible(true)}
                      size="sm"
                      color={theme.colors.text.primary}
                    />
                  }
                />

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
                        setHideCameraModePicker(false);
                        setIsCameraVisible(true);
                      }}
                    />
                    {isAiFeaturesEnabled ? (
                      <Button
                        label={t('food.actions.aiCamera')}
                        icon={Sparkles}
                        variant="secondaryGradient"
                        size="md"
                        width="flex-1"
                        onPress={() => {
                          setCameraMode('ai-meal-photo');
                          setHideCameraModePicker(false);
                          setIsCameraVisible(true);
                        }}
                      />
                    ) : null}
                  </View>
                  <View className="flex-row gap-4">
                    <Button
                      // label={t('food.actions.goToToday')}
                      label={t('food.actions.myMeals')}
                      // icon={Calendar}
                      icon={UtensilsCrossed}
                      variant="secondary"
                      size="sm"
                      width="flex-1"
                      // onPress={goToToday}
                      onPress={() => setIsMyMealsModalVisible(true)}
                    />
                    <Button
                      label={t('food.actions.moreFoodOptions')}
                      icon={ListPlus}
                      variant="secondaryGradient"
                      size="sm"
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
                  onAddFood={() => handleAddFoodToMeal('breakfast')}
                  menuButton={
                    mealsByType.breakfast.length > 0 ? (
                      <MenuButton
                        onPress={() => handleMealMenuPress('breakfast')}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    ) : undefined
                  }
                >
                  {mealsByType.breakfast.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      // description={getSimpleServingDisplay(entry.gramWeight, units)}
                      portion={entry.gramWeight}
                      calories={Math.ceil(entry.nutrients.calories)}
                      protein={entry.nutrients.protein}
                      carbs={entry.nutrients.carbs}
                      fat={entry.nutrients.fat}
                      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                      mealType="breakfast"
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
                  onAddFood={() => handleAddFoodToMeal('lunch')}
                  menuButton={
                    mealsByType.lunch.length > 0 ? (
                      <MenuButton
                        onPress={() => handleMealMenuPress('lunch')}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    ) : undefined
                  }
                >
                  {mealsByType.lunch.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      // description={getSimpleServingDisplay(entry.gramWeight, units)}
                      portion={entry.gramWeight}
                      calories={Math.ceil(entry.nutrients.calories)}
                      protein={entry.nutrients.protein}
                      carbs={entry.nutrients.carbs}
                      fat={entry.nutrients.fat}
                      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                      mealType="lunch"
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
                  onAddFood={() => handleAddFoodToMeal('dinner')}
                  menuButton={
                    mealsByType.dinner.length > 0 ? (
                      <MenuButton
                        onPress={() => handleMealMenuPress('dinner')}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    ) : undefined
                  }
                >
                  {mealsByType.dinner.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      // description={getSimpleServingDisplay(entry.gramWeight, units)}
                      portion={entry.gramWeight}
                      calories={Math.ceil(entry.nutrients.calories)}
                      protein={entry.nutrients.protein}
                      carbs={entry.nutrients.carbs}
                      fat={entry.nutrients.fat}
                      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                      mealType="dinner"
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
                  onAddFood={() => handleAddFoodToMeal('snack')}
                  menuButton={
                    mealsByType.snack.length > 0 ? (
                      <MenuButton
                        onPress={() => handleMealMenuPress('snack')}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    ) : undefined
                  }
                >
                  {mealsByType.snack.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      // description={getSimpleServingDisplay(entry.gramWeight, units)}
                      portion={entry.gramWeight}
                      calories={Math.ceil(entry.nutrients.calories)}
                      protein={entry.nutrients.protein}
                      carbs={entry.nutrients.carbs}
                      fat={entry.nutrients.fat}
                      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                      mealType="snack"
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
                  onAddFood={() => handleAddFoodToMeal('other')}
                  menuButton={
                    mealsByType.other.length > 0 ? (
                      <MenuButton
                        onPress={() => handleMealMenuPress('other')}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    ) : undefined
                  }
                >
                  {mealsByType.other.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      // description={getSimpleServingDisplay(entry.gramWeight, units)}
                      portion={entry.gramWeight}
                      calories={Math.ceil(entry.nutrients.calories)}
                      protein={entry.nutrients.protein}
                      carbs={entry.nutrients.carbs}
                      fat={entry.nutrients.fat}
                      image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                      mealType="other"
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
          isAiEnabled={isAiFeaturesEnabled}
          visible={isAddFoodModalVisible}
          onClose={() => setIsAddFoodModalVisible(false)}
          onMealTypeSelect={(mealType) => {
            setSelectedMealType(mealType);
            setIsAddFoodModalVisible(false);
            setIsFoodSearchModalVisible(true);
          }}
          onAiCameraPress={() => {
            // Open CameraModal with AI mode selected
            setIsAddFoodModalVisible(false);
            setCameraMode('ai-meal-photo');
            setHideCameraModePicker(false);
            setIsCameraVisible(true);
          }}
          onScanBarcodePress={() => {
            // Open CameraModal with barcode mode selected
            setIsAddFoodModalVisible(false);
            setCameraMode('barcode-scan');
            setHideCameraModePicker(false);
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
            setIsMyMealsModalVisible(true);
            setIsAddFoodModalVisible(false);
          }}
          onQuickTrackMealPress={() => {
            setIsQuickTrackMealModalVisible(true);
            setIsAddFoodModalVisible(false);
          }}
        />
      ) : null}

      {/* Quick Track Meal (CreateMealModal in quickTrack mode) */}
      {isQuickTrackMealModalVisible ? (
        <CreateMealModal
          visible={isQuickTrackMealModalVisible}
          onClose={() => setIsQuickTrackMealModalVisible(false)}
          mode="quickTrack"
          logDate={selectedDate}
          onTracked={() => {
            refresh();
            setIsQuickTrackMealModalVisible(false);
          }}
        />
      ) : null}

      {/* My Meals Modal */}
      {isMyMealsModalVisible ? (
        <MyMealsModal
          visible={isMyMealsModalVisible}
          onClose={() => setIsMyMealsModalVisible(false)}
        />
      ) : null}

      {/* Camera Modal */}
      {isCameraVisible ? (
        <SmartCameraModal
          visible={isCameraVisible}
          onClose={() => setIsCameraVisible(false)}
          mode={cameraMode}
          hideCameraModePicker={hideCameraModePicker}
          isAiEnabled={isAiFeaturesEnabled}
          useOcrBeforeAi={useOcrBeforeAi}
        />
      ) : null}

      {/* Create Custom Food Modal */}
      {isCreateCustomFoodVisible ? (
        <CreateCustomFoodModal
          visible={isCreateCustomFoodVisible}
          trackFoodAfterSave={true}
          onClose={() => setIsCreateCustomFoodVisible(false)}
          isAiEnabled={isAiFeaturesEnabled}
        />
      ) : null}

      {/* Food Search Modal */}
      {isFoodSearchModalVisible ? (
        <FoodSearchModal
          visible={isFoodSearchModalVisible}
          onClose={() => setIsFoodSearchModalVisible(false)}
          mealType={selectedMealType}
          logDate={selectedDate}
          onFoodTracked={refresh}
          onCreatePress={() => {
            // Open CreateCustomFoodModal
            setIsFoodSearchModalVisible(false);
            setIsCreateCustomFoodVisible(true);
          }}
          onBarcodeScanPress={() => {
            // Open camera modal with barcode mode
            setIsFoodSearchModalVisible(false);
            setCameraMode('barcode-scan');
            setHideCameraModePicker(true);
            setIsCameraVisible(true);
          }}
          isAiEnabled={isAiFeaturesEnabled}
        />
      ) : null}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmationVisible && selectedFoodItem ? (
        <ConfirmationModal
          visible={isDeleteConfirmationVisible}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          title={t('food.actions.deleteConfirmTitle')}
          message={t('food.actions.deleteConfirmMessage', {
            foodName: selectedFoodItem.displayName,
          })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          variant="destructive"
        />
      ) : null}

      {/* Goals Management Modal */}
      <GoalsManagementModal
        visible={isGoalsManagementModalVisible}
        onClose={() => setIsGoalsManagementModalVisible(false)}
      />

      {/* Food Menu Modal */}
      <BottomPopUpMenu
        visible={isFoodMenuVisible}
        onClose={() => setIsFoodMenuVisible(false)}
        title={selectedFoodItem?.displayName ?? ''}
        subtitle={`${getSimpleServingDisplay(selectedFoodItem?.gramWeight || 0, units)} • ${Math.ceil(selectedFoodItem?.nutrients?.calories || 0)} kcal`}
        items={foodMenuItems}
      />

      {/* Meal Menu Modal */}
      <BottomPopUpMenu
        visible={isMealMenuVisible}
        onClose={() => setIsMealMenuVisible(false)}
        title={selectedMealForMenu ? t(`food.meals.${selectedMealForMenu}`) : ''}
        subtitle={t('food.actions.mealMenuSubtitle')}
        items={mealMenuItems}
      />

      {/* Delete All Meal Confirmation Modal */}
      {isDeleteAllMealVisible && selectedMealForMenu ? (
        <ConfirmationModal
          visible={isDeleteAllMealVisible}
          onClose={() => {
            setIsDeleteAllMealVisible(false);
            setSelectedMealForMenu(null);
          }}
          onConfirm={handleConfirmDeleteAllMeal}
          title={t('food.actions.deleteAllConfirmTitle')}
          message={t('food.actions.deleteAllConfirmMessage', {
            mealName: t(
              `food.meals.${selectedMealForMenu === 'snack' ? 'snacks' : selectedMealForMenu}`
            ),
          })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          variant="destructive"
        />
      ) : null}

      {/* Move / Copy Meal Modal */}
      {isMealActionModalVisible && selectedMealForMenu ? (
        <MoveCopyMealModal
          visible={isMealActionModalVisible}
          onClose={() => {
            setIsMealActionModalVisible(false);
            setSelectedMealForMenu(null);
          }}
          onConfirm={handleConfirmMealAction}
          mode={mealActionMode}
          sourceMealType={selectedMealForMenu}
          sourceDate={selectedDate}
          isLoading={isMealActionLoading}
        />
      ) : null}

      {/* Food Details Modal (edit/duplicate mode) */}
      {isFoodDetailsModalVisible && selectedFoodItem ? (
        <FoodMealDetailsModal
          visible={isFoodDetailsModalVisible}
          onClose={() => {
            setIsFoodDetailsModalVisible(false);
            setIsDuplicateMode(false);
            setSelectedFoodItem(null);
          }}
          food={selectedFoodItem.food}
          foodLog={isDuplicateMode ? undefined : selectedFoodItem.log}
          initialMealType={isDuplicateMode ? selectedFoodItem.log.type : undefined}
          initialDate={isDuplicateMode ? new Date(selectedFoodItem.log.date) : undefined}
          initialServingSize={isDuplicateMode ? selectedFoodItem.gramWeight : undefined}
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
          isAiEnabled={isAiFeaturesEnabled}
        />
      ) : null}
    </MasterLayout>
  );
}
