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
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import CreateCustomFoodModal from '../../components/modals/CreateCustomFoodModal';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { FoodMealDetailsModal } from '../../components/modals/FoodMealDetailsModal';
import { FoodSearchModal } from '../../components/modals/FoodSearchModal';
import MyMealsModal from '../../components/modals/MyMealsModal';
import SmartCameraModal from '../../components/modals/SmartCameraModal';
import { useSnackbar } from '../../components/SnackbarContext';
import { Button } from '../../components/theme/Button';
import { EmptyStateCard } from '../../components/theme/EmptyStateCard';
import { SkeletonLoader } from '../../components/theme/SkeletonLoader';
import Food from '../../database/models/Food';
import NutritionLog, { type MealType } from '../../database/models/NutritionLog';
import { NutritionService } from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useNutritionLogs } from '../../hooks/useNutritionLogs';
import { useSettings } from '../../hooks/useSettings';
import i18n, { LanguageKeys, LOCALE_MAP } from '../../lang/lang';
import { theme } from '../../theme';
import { getSimpleServingDisplay } from '../../utils/foodDisplay';

export default function FoodScreen() {
  const { t } = useTranslation();
  const { units } = useSettings();
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
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
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
  const currentLanguage = (i18n.language || 'en-US') as LanguageKeys;
  const locale = LOCALE_MAP[currentLanguage] || LOCALE_MAP['en-US'];

  const { logs, dailyNutrients, isLoading, refresh, totalCount } = useNutritionLogs({
    mode: 'daily',
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

  // Get nutrition goal active on the displayed date (so past dates show the correct goal)
  const { goal: nutritionGoal } = useCurrentNutritionGoal({
    mode: 'current',
    date: selectedDate,
    enableReactivity: true,
    visible: true,
  });

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
    const consumedCalories = Math.ceil(dailyNutrients?.calories || 0);
    const percentage = Math.round((consumedCalories / totalCalories) * 100);

    return {
      consumed: consumedCalories,
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
        goal: totalProtein,
        color: theme.colors.macros.protein.text,
        progressColor: theme.colors.macros.protein.bg,
      },
      carbs: {
        percentage: Math.round(((dailyNutrients?.carbs || 0) / totalCarbs) * 100),
        amount: `${Math.round(dailyNutrients?.carbs || 0)}g`,
        goal: totalCarbs,
        color: theme.colors.macros.carbs.text,
        progressColor: theme.colors.macros.carbs.bg,
      },
      fat: {
        percentage: Math.round(((dailyNutrients?.fat || 0) / totalFat) * 100),
        amount: `${Math.round(dailyNutrients?.fat || 0)}g`,
        goal: totalFat,
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

  // Check if all meals are empty AND no food has ever been tracked
  const hasNoFood = !isScreenLoading && totalCount === 0;

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
      return format(selectedDate, 'MMM d, yyyy', { locale });
    }
  };

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        {/* Header with Date Navigation */}
        <View className="border-b border-border-dark bg-bg-primary">
          <View className="flex-row items-center justify-between px-4 py-4">
            <Pressable
              onPress={goToPreviousDay}
              className="rounded-lg p-3 active:bg-bg-secondary"
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ChevronLeft size={theme.iconSize.md} color={theme.colors.text.primary} />
            </Pressable>
            <Pressable
              onPress={() => setIsDatePickerVisible(true)}
              className="flex-row items-center gap-2"
            >
              <Text className="text-xl font-semibold text-text-primary">{getDisplayDate()}</Text>
              <Calendar size={theme.iconSize.sm} color={theme.colors.accent.secondary} />
            </Pressable>
            <Pressable
              onPress={goToNextDay}
              className="rounded-lg p-3 active:bg-bg-secondary"
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
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
                        setHideCameraModePicker(false);
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
                        setHideCameraModePicker(false);
                        setIsCameraVisible(true);
                      }}
                    />
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
                >
                  {mealsByType.breakfast.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      description={getSimpleServingDisplay(entry.gramWeight, units)}
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
                >
                  {mealsByType.lunch.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      description={getSimpleServingDisplay(entry.gramWeight, units)}
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
                >
                  {mealsByType.dinner.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      description={getSimpleServingDisplay(entry.gramWeight, units)}
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
                >
                  {mealsByType.snack.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      description={getSimpleServingDisplay(entry.gramWeight, units)}
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
                >
                  {mealsByType.other.map((entry) => (
                    <FoodItemCard
                      key={entry.log.id}
                      name={entry.displayName}
                      description={getSimpleServingDisplay(entry.gramWeight, units)}
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
          logDate={selectedDate}
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
        title={selectedFoodItem?.displayName ?? ''}
        subtitle={`${getSimpleServingDisplay(selectedFoodItem?.gramWeight || 0, units)} • ${Math.ceil(selectedFoodItem?.nutrients?.calories || 0)} kcal`}
        items={foodMenuItems}
      />

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
        />
      ) : null}
    </MasterLayout>
  );
}
