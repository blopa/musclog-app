import * as ExpoLinking from 'expo-linking';
import { useRootNavigationState, useRouter } from 'expo-router';
import { Bell, Clock, Flame, Plus, Trophy } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { DailySummaryCard } from '@/components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '@/components/cards/DailySummaryCard/DailySummaryEmptyState';
import { DetailedItemCard } from '@/components/cards/DetailedItemCard';
import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { HomeMoodPrompt } from '@/components/cards/HomeMoodPrompt';
import { HomeSupplementPrompt } from '@/components/cards/HomeSupplementPrompt';
import { useCoach } from '@/components/CoachContext';
import { MasterLayout } from '@/components/MasterLayout';
import { AddFoodModal } from '@/components/modals/AddFoodModal';
import CreateCustomFoodModal from '@/components/modals/CreateCustomFoodModal';
import { FoodSearchModal } from '@/components/modals/FoodSearchModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import MyMealsModal from '@/components/modals/MyMealsModal';
import { NotificationsModal } from '@/components/modals/NotificationsModal';
import { NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import PastWorkoutDetailModal from '@/components/modals/PastWorkoutDetailModal';
import PastWorkoutsHistoryModal from '@/components/modals/PastWorkoutsHistoryModal';
import { UserMenuModal } from '@/components/modals/UserMenuModal';
import ShowMoreButton from '@/components/ShowMoreButton';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import DashedButton from '@/components/theme/DashedButton';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { WorkoutFoodEmptyState } from '@/components/WorkoutFoodEmptyState';
import { isStaticExport } from '@/constants/platform';
import { useSmartCamera } from '@/context/SmartCameraContext';
import { type MealType } from '@/database/models';
import { NutritionGoalService } from '@/database/services';
import { useDailyNutritionSummary } from '@/hooks/useDailyNutritionSummary';
import { useDefaultNutritionGoals } from '@/hooks/useDefaultNutritionGoals';
import { useNutritionLogs } from '@/hooks/useNutritionLogs';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useUser } from '@/hooks/useUser';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import packageJson from '@/package.json';
import { getAvatarDisplayProps } from '@/utils/avatarUtils';
import { isSameLocalCalendarDay, localCalendarDayDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '@/utils/onboardingService';

// Set by +native-intent.tsx on cold start to defer widget action until navigator is ready
declare global {
  var __PENDING_WIDGET_ACTION: string | undefined;
}

// No notification system yet, so leave it like this for now
const SHOW_NOTIFICATIONS = false;

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const { defaults: nutritionGoalsDefaults } = useDefaultNutritionGoals();
  const { isAiConfigured, intuitiveEatingMode, nutritionDisplay } = useSettings();
  const { openCamera } = useSmartCamera();
  const { openCoach } = useCoach();

  const navigationState = useRootNavigationState();

  const [today, setToday] = useState(() => localCalendarDayDate(new Date()));

  useEffect(() => {
    if (isStaticExport) {
      return;
    }

    const syncToday = () => {
      setToday((prev) => {
        const now = new Date();
        return isSameLocalCalendarDay(prev, now) ? prev : localCalendarDayDate(now);
      });
    };

    syncToday();
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncToday();
      }
    });

    const intervalId = setInterval(syncToday, 60_000);
    return () => {
      appSub.remove();
      clearInterval(intervalId);
    };
  }, []);

  const {
    calories: dailyCalories,
    macros: dailyMacros,
    secondaryNutrients: dailySecondaryNutrients,
    nutritionGoal,
    isLoading: isLoadingNutritionSummary,
  } = useDailyNutritionSummary({ date: today });

  // Get recent foods for display (limit to today's logs)
  const { recentNutritionLogs, isLoading: isLoadingRecentFoods } = useNutritionLogs({
    mode: 'recent-logs',
    date: today,
  });

  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | undefined>(undefined);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [isMoodPromptVisible, setIsMoodPromptVisible] = useState(false);

  // Get time-based greeting
  const getTimeBasedGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return t('home.greeting.goodMorning');
    } else if (hour < 18) {
      return t('home.greeting.goodAfternoon');
    } else {
      return t('home.greeting.goodEvening');
    }
  }, [t]);

  // Use reactive hook for recent workouts - only load when visible
  const { workouts: recentWorkouts, isLoading: isLoadingRecent } = useWorkoutHistory({
    initialLimit: 2,
    groupByMonth: false,
    visible: true,
    skipPRDetection: true,
  });

  // Memoize modal close handlers to prevent unnecessary re-renders
  const handleCloseUserMenu = useCallback(() => setIsUserMenuVisible(false), []);
  const handleCloseNotifications = useCallback(() => setIsNotificationsVisible(false), []);
  const handleCloseWorkoutHistory = useCallback(() => setIsWorkoutHistoryVisible(false), []);
  const handleCloseAddFood = useCallback(() => setIsAddFoodVisible(false), []);
  const handleCloseNutritionGoals = useCallback(() => setIsNutritionGoalsVisible(false), []);
  const handleCloseFoodSearch = useCallback(() => setIsFoodSearchVisible(false), []);
  const handleCloseMyMeals = useCallback(() => setIsMyMealsVisible(false), []);
  const handleCloseGoalsManagement = useCallback(() => setIsGoalsManagementModalVisible(false), []);
  const handleCloseCreateCustomFood = useCallback(() => setIsCreateCustomFoodVisible(false), []);
  const handleCloseWorkoutDetail = useCallback(() => setSelectedWorkoutId(undefined), []);

  // Memoize modal action handlers
  const handleMealTypeSelect = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddFoodVisible(false);
    setIsFoodSearchVisible(true);
  }, []);

  const handleAiCameraPress = useCallback(() => {
    setIsAddFoodVisible(false);
    openCamera({ mode: 'ai-meal-photo' });
  }, [openCamera]);

  const handleScanBarcodePress = useCallback(() => {
    setIsAddFoodVisible(false);
    openCamera({ mode: 'barcode-scan' });
  }, [openCamera]);

  const handleSearchFoodPress = useCallback(() => {
    setIsAddFoodVisible(false);
    setSelectedMealType('snack');
    setIsFoodSearchVisible(true);
  }, []);

  const handleCreateCustomFoodPress = useCallback(() => {
    setIsAddFoodVisible(false);
    setIsCreateCustomFoodVisible(true);
  }, []);

  const handleTrackCustomMealPress = useCallback(() => {
    setIsMyMealsVisible(true);
    setIsAddFoodVisible(false);
  }, []);

  const handleSaveNutritionGoals = useCallback(
    async (goals: any) => {
      try {
        const savedGoal = await NutritionGoalService.saveGoals(goals);
        await NutritionGoalService.regenerateCheckins(savedGoal.id);
        setIsNutritionGoalsVisible(false);
      } catch (error) {
        await handleError(error, 'index.saveNutritionGoals', {
          snackbarMessage: t('errors.somethingWentWrong'),
          consoleMessage: 'Failed to save nutrition goals:',
        });
      }
    },
    [t]
  );

  const handleFoodSearchCreatePress = useCallback(() => {
    setIsFoodSearchVisible(false);
    setIsCreateCustomFoodVisible(true);
  }, []);

  const handleFoodSearchBarcodePress = useCallback(() => {
    setIsFoodSearchVisible(false);
    openCamera({ mode: 'barcode-scan', mealType: selectedMealType });
  }, [openCamera, selectedMealType]);

  // Handle widget action stored by +native-intent.tsx on cold start (camera only —
  // screen-based actions like open-nutrition are routed directly by redirectSystemPath)
  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const action = global.__PENDING_WIDGET_ACTION;
    if (!action) {
      return;
    }

    global.__PENDING_WIDGET_ACTION = undefined;

    if (action === 'open-camera') {
      openCamera({ mode: 'barcode-scan' });
    }
  }, [navigationState?.key, openCamera]);

  // Handle widget deep link when app is already running (warm start)
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const { queryParams } = ExpoLinking.parse(url);
      if (queryParams?.action === 'open-camera') {
        openCamera({ mode: 'barcode-scan' });
      } else if (queryParams?.action === 'open-nutrition') {
        router.navigate('/app/nutrition/food');
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [openCamera, router]);

  // Check onboarding status on mount — wait until navigator is ready to avoid
  // "Attempted to navigate before mounting the Root Layout component" on cold start
  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    const checkOnboarding = async () => {
      try {
        const completed = await isOnboardingCompleted();

        if (!completed) {
          try {
            const saved = await getCurrentOnboardingStep();
            if (saved) {
              if (saved === '/app/onboarding/connect-with-google') {
                router.replace('/app/onboarding/fitness-info');
              } else {
                const normalizedSaved = saved.startsWith('/app') ? saved : `/app${saved}`;
                router.replace(normalizedSaved as never);
              }
            } else {
              router.replace('/app/onboarding/landing');
            }
          } catch (e) {
            handleError(e, 'index.restoreOnboardingStep');
            console.error('Error restoring onboarding step, falling back to landing', e);
            router.replace('/app/onboarding/landing');
          }
        }
      } catch (error) {
        handleError(error, 'index.checkOnboardingStatus');
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [router, navigationState?.key]);

  // Show loading spinner while checking onboarding
  if (isCheckingOnboarding) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.colors.background.primary }}
      >
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </View>
    );
  }

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-6">
          <Pressable
            className="flex-row items-center gap-3"
            onPress={() => setIsUserMenuVisible(true)}
          >
            {isLoadingUser ? (
              <>
                <SkeletonLoader width={56} height={56} borderRadius={28} />
                <View className="gap-2">
                  <SkeletonLoader width={80} height={12} />
                  <SkeletonLoader width={120} height={20} />
                </View>
              </>
            ) : (
              <AnimatedContent style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <>
                  <View className="relative">
                    <View
                      className="h-14 w-14 overflow-hidden rounded-full border-4"
                      style={{
                        borderColor: dbUser
                          ? getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
                              .color
                          : theme.colors.accent.primary,
                        backgroundColor: dbUser
                          ? getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
                              .backgroundColor
                          : theme.colors.accent.primary20,
                      }}
                    >
                      {dbUser?.avatarIcon ? (
                        <View className="h-full w-full items-center justify-center rounded-full">
                          {createElement(
                            getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
                              .IconComponent,
                            {
                              size: 24,
                              color: getAvatarDisplayProps(
                                theme,
                                dbUser.avatarIcon,
                                dbUser.avatarColor
                              ).color,
                            }
                          )}
                        </View>
                      ) : (
                        <View
                          className="h-full w-full items-center justify-center rounded-full"
                          style={{ backgroundColor: theme.colors.background.imageLight }}
                        >
                          <Text className="text-lg font-bold text-text-primary">
                            {dbUser?.fullName?.charAt(0).toUpperCase() || 'G'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View>
                    <Text className="text-sm text-text-secondary">{getTimeBasedGreeting()}</Text>
                    <Text className="text-xl font-bold text-text-primary">
                      {dbUser?.fullName || 'Guest'}
                    </Text>
                  </View>
                </>
              </AnimatedContent>
            )}
          </Pressable>
          <View className="items-end gap-2">
            <Text className="text-xs text-text-secondary opacity-40">
              {`Musclog v${packageJson.version}`}
            </Text>
            {SHOW_NOTIFICATIONS ? (
              <Pressable
                className="relative rounded-full bg-bg-overlay p-3"
                onPress={() => setIsNotificationsVisible(true)}
              >
                <Bell size={theme.iconSize.md} color={theme.colors.text.primary} />
                <View
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: theme.colors.status.notificationBadge }}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Daily Summary Card */}
        <View className="mb-6 px-4">
          {isLoadingNutritionSummary ? (
            <SkeletonLoader width="100%" height={180} borderRadius={16} />
          ) : nutritionGoal ? (
            <AnimatedContent>
              <DailySummaryCard
                calories={{
                  consumed: dailyCalories.consumed,
                  remaining: dailyCalories.remaining,
                  goal: dailyCalories.goal,
                }}
                macros={{
                  protein: {
                    value: dailyMacros.protein.value,
                    goal: dailyMacros.protein.goal,
                  },
                  carbs: {
                    value: dailyMacros.carbs.value,
                    goal: dailyMacros.carbs.goal,
                  },
                  fats: {
                    value: dailyMacros.fat.value,
                    goal: dailyMacros.fat.goal,
                  },
                  fiber: {
                    value: dailyMacros.fiber.value,
                    goal: dailyMacros.fiber.goal,
                  },
                }}
                secondaryNutrients={dailySecondaryNutrients}
                intuitiveMode={intuitiveEatingMode}
                nutritionDisplay={nutritionDisplay}
                menuButton={
                  <MenuButton
                    onPress={() => setIsGoalsManagementModalVisible(true)}
                    size="sm"
                    color={theme.colors.text.primary}
                  />
                }
              />
            </AnimatedContent>
          ) : (
            <AnimatedContent>
              <DailySummaryEmptyState onSetGoals={() => setIsNutritionGoalsVisible(true)} />
            </AnimatedContent>
          )}
        </View>

        {/* Home prompts */}
        <View className="mx-4">
          <HomeMoodPrompt onVisibilityChange={setIsMoodPromptVisible} />
          <HomeSupplementPrompt blockedByHigherPriorityPrompt={isMoodPromptVisible} />
        </View>

        {/* Action Buttons */}
        <View className="mx-4 mb-8 flex-row gap-4">
          <ActionButton
            variant="workout"
            label={t('home.actions.startWorkout')}
            onPress={() => router.navigate('/app/workout/workouts')}
          />
          <ActionButton
            variant="food"
            label={t('home.actions.trackFood')}
            onPress={() => setIsAddFoodVisible(true)}
          />
        </View>
        <View className="mx-4 mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('home.sections.recentFoods')}
            </Text>
            <ShowMoreButton
              onPress={() => router.navigate('/app/nutrition/food')}
              label={t('common.seeAll')}
            />
          </View>

          {isLoadingRecentFoods ? (
            <View className="gap-3">
              {[1, 2].map((i) => (
                <View key={i} className="flex-row items-center gap-4 rounded-2xl bg-bg-overlay p-5">
                  <View className="flex-row items-center gap-3">
                    <SkeletonLoader
                      width={theme.size['10']}
                      height={theme.size['10']}
                      borderRadius={theme.borderRadius.xl}
                    />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="60%" height={theme.size['4']} />
                      <View className="flex-row gap-2">
                        <SkeletonLoader
                          width={theme.size['60']}
                          height={theme.size['5']}
                          borderRadius={theme.borderRadius['10']}
                        />
                        <SkeletonLoader
                          width={theme.size['60']}
                          height={theme.size['5']}
                          borderRadius={theme.borderRadius['10']}
                        />
                        <SkeletonLoader
                          width={theme.size['60']}
                          height={theme.size['5']}
                          borderRadius={theme.borderRadius['10']}
                        />
                      </View>
                    </View>
                  </View>
                  <SkeletonLoader width={theme.size['12']} height={theme.size['4']} />
                </View>
              ))}
            </View>
          ) : recentNutritionLogs.length === 0 ? (
            <AnimatedContent>
              <WorkoutFoodEmptyState type="food" onButtonPress={() => setIsAddFoodVisible(true)} />
            </AnimatedContent>
          ) : (
            <AnimatedContent>
              <View className="gap-3">
                {recentNutritionLogs.slice(0, 2).map((entry) => (
                  <FoodItemCard
                    key={entry.log.id}
                    variant="compact"
                    name={entry.displayName}
                    calories={entry.nutrients.calories}
                    protein={entry.nutrients.protein}
                    carbs={entry.nutrients.carbs}
                    fat={entry.nutrients.fat}
                    portion={entry.gramWeight}
                    image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                    mealType={entry.log.type}
                    intuitiveMode={intuitiveEatingMode}
                  />
                ))}

                {/* Add Food Button - only show if there's at least one item */}
                {recentNutritionLogs.length > 0 ? (
                  <DashedButton
                    label={t('food.meals.addFood')}
                    onPress={() => setIsAddFoodVisible(true)}
                    size="sm"
                    icon={<Plus size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                  />
                ) : null}
              </View>
            </AnimatedContent>
          )}
        </View>

        {/* Recent Workouts */}
        <View className="mx-4 mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('home.sections.recentWorkouts')}
            </Text>
            <ShowMoreButton
              onPress={() => setIsWorkoutHistoryVisible(true)}
              label={t('common.seeAll')}
            />
          </View>

          {isLoadingRecent ? (
            <View className="gap-3">
              {[1, 2].map((i) => (
                <View
                  key={i}
                  className="rounded-lg border bg-bg-card p-4"
                  style={{ borderColor: theme.colors.background.white5 }}
                >
                  <View className="flex-row items-center gap-3">
                    <SkeletonLoader
                      width={theme.size['12']}
                      height={theme.size['12']}
                      borderRadius={theme.borderRadius.md}
                    />
                    <View className="flex-1 gap-2">
                      <SkeletonLoader width="70%" height={theme.size['4']} />
                      <SkeletonLoader width="50%" height={theme.size['3']} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : recentWorkouts.length === 0 ? (
            <AnimatedContent>
              <WorkoutFoodEmptyState
                type="workout"
                onButtonPress={() => router.navigate('/app/workout/workouts')}
              />
            </AnimatedContent>
          ) : (
            <AnimatedContent>
              <View className="gap-3">
                {recentWorkouts.map((workout) => (
                  <DetailedItemCard
                    key={workout.id}
                    item={{
                      name: workout.name,
                      media: workout.image,
                      itemOne: { value: workout.calories, icon: Flame },
                      itemTwo: { value: workout.duration, icon: Clock },
                      itemThree: {
                        value: workout.prs !== null ? workout.prs : '--',
                        icon: Trophy,
                      },
                    }}
                    description={`${workout.date} • ${workout.duration}`}
                    onPress={() => setSelectedWorkoutId(workout.id)}
                  />
                ))}

                {/* Start Workout Button - only show if there's at least one workout */}
                {recentWorkouts.length > 0 ? (
                  <DashedButton
                    label={t('startWorkout.label')}
                    onPress={() => router.navigate('/app/workout/workouts')}
                    size="sm"
                    icon={<Plus size={theme.iconSize.md} color={theme.colors.text.secondary} />}
                  />
                ) : null}
              </View>
            </AnimatedContent>
          )}
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>

      {/* User Menu Modal */}
      <UserMenuModal
        visible={isUserMenuVisible}
        onClose={handleCloseUserMenu}
        user={{
          name: dbUser?.fullName || 'Guest',
          avatarIcon: dbUser?.avatarIcon,
          avatarColor: dbUser?.avatarColor,
        }}
        onCoachPress={openCoach}
        onCyclePress={() => router.navigate('/app/cycle')}
        {...(__DEV__ && {
          onDebugMenuPress: () => router.navigate('/app/test/debug'),
        })}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        visible={isNotificationsVisible}
        onClose={handleCloseNotifications}
        onClearAll={() => {
          // TODO: Implement clear all notifications once we have notifications in the app
          console.log('Clear all notifications');
        }}
      />

      {/* Workout History Modal */}
      <PastWorkoutsHistoryModal
        visible={isWorkoutHistoryVisible}
        onClose={handleCloseWorkoutHistory}
      />

      {/* Workout Detail Modal */}
      <PastWorkoutDetailModal
        visible={!!selectedWorkoutId}
        onClose={handleCloseWorkoutDetail}
        workoutId={selectedWorkoutId || ''}
      />

      {/* Add Food Modal */}
      <AddFoodModal
        visible={isAddFoodVisible}
        onClose={handleCloseAddFood}
        onMealTypeSelect={handleMealTypeSelect}
        onAiCameraPress={handleAiCameraPress}
        onScanBarcodePress={handleScanBarcodePress}
        onSearchFoodPress={handleSearchFoodPress}
        onCreateCustomFoodPress={handleCreateCustomFoodPress}
        onTrackCustomMealPress={handleTrackCustomMealPress}
        isAiEnabled={isAiConfigured}
      />

      {/* Nutrition Goals Modal */}
      <NutritionGoalsModal
        visible={isNutritionGoalsVisible}
        onClose={handleCloseNutritionGoals}
        onSave={handleSaveNutritionGoals}
        initialGoals={nutritionGoalsDefaults}
      />

      {/* Food Search Modal */}
      <FoodSearchModal
        visible={isFoodSearchVisible}
        onClose={handleCloseFoodSearch}
        mealType={selectedMealType}
        onCreatePress={handleFoodSearchCreatePress}
        onBarcodeScanPress={handleFoodSearchBarcodePress}
        isAiEnabled={isAiConfigured}
      />

      {/* My Meals Modal */}
      <MyMealsModal visible={isMyMealsVisible} onClose={handleCloseMyMeals} />

      {/* Goals Management Modal */}
      <GoalsManagementModal
        visible={isGoalsManagementModalVisible}
        onClose={handleCloseGoalsManagement}
        tab="nutrition"
      />

      {/* Create Custom Food Modal */}
      <CreateCustomFoodModal
        visible={isCreateCustomFoodVisible}
        trackFoodAfterSave={true}
        onClose={handleCloseCreateCustomFood}
        isAiEnabled={isAiConfigured}
      />
    </MasterLayout>
  );
}
