import * as ExpoLinking from 'expo-linking';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { Bell, Clock, Flame, Plus, Trophy } from 'lucide-react-native';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { DetailedItemCard } from '@/components/cards/DetailedItemCard';
import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { HomeMoodPrompt } from '@/components/cards/HomeMoodPrompt';
import { HomeSupplementPrompt } from '@/components/cards/HomeSupplementPrompt';
import { HomeWaterPrompt } from '@/components/cards/HomeWaterPrompt';
import { useCoach } from '@/components/CoachContext';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { DailySummaryBottomMenu } from '@/components/DailySummaryBottomMenu';
import { DailyHomeFooter } from '@/components/home/DailyHomeFooter';
import { DailyHomeSummary } from '@/components/home/DailyHomeSummary';
import { HomeActionsRow } from '@/components/home/HomeActionsRow';
import { WeeklyHomeSummary } from '@/components/home/WeeklyHomeSummary';
import { MasterLayout } from '@/components/MasterLayout';
import { AddFoodModal } from '@/components/modals/AddFoodModal';
import CreateCustomFoodModal from '@/components/modals/CreateCustomFoodModal';
import { FoodMealDetailsModal } from '@/components/modals/FoodMealDetailsModal';
import { FoodSearchModal } from '@/components/modals/FoodSearchModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { LogCardioModal } from '@/components/modals/LogCardioModal';
import MyMealsModal from '@/components/modals/MyMealsModal';
import { NotificationsModal } from '@/components/modals/NotificationsModal';
import { type NutritionGoals, NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import PastWorkoutDetailModal from '@/components/modals/PastWorkoutDetailModal';
import PastWorkoutsHistoryModal from '@/components/modals/PastWorkoutsHistoryModal';
import { UserMenuModal } from '@/components/modals/UserMenuModal';
import ShowMoreButton from '@/components/ShowMoreButton';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { WeeklyReviewCard } from '@/components/WeeklyReviewCard';
import { WhatsNewAutoPrompt } from '@/components/whatsNew/WhatsNewAutoPrompt';
import { WorkoutTodayCard } from '@/components/workout/WorkoutTodayCard';
import { WorkoutFoodEmptyState } from '@/components/WorkoutFoodEmptyState';
import { HomeActionKey } from '@/constants/homeActions';
import { isStaticExport } from '@/constants/platform';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { type CameraMode, useSmartCamera } from '@/context/SmartCameraContext';
import { type MealType } from '@/database/models';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';
import { useDailyNutritionSummary } from '@/hooks/useDailyNutritionSummary';
import { useDefaultNutritionGoals } from '@/hooks/useDefaultNutritionGoals';
import { useEmpiricalTDEE } from '@/hooks/useEmpiricalTDEE';
import { useNutritionLogs } from '@/hooks/useNutritionLogs';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useUser } from '@/hooks/useUser';
import { useWorkoutHistory } from '@/hooks/useWorkoutHistory';
import { refreshDailyStepsIfStale } from '@/services/dailyStepsRefresh';
import { isProduction } from '@/utils/app';
import { getAvatarDisplayProps } from '@/utils/avatarUtils';
import { isSameLocalCalendarDay, localCalendarDayDate } from '@/utils/calendarDate';
import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';
import { handleError } from '@/utils/handleError';
import { nutritionGoalsToInput, nutritionGoalToInitialValues } from '@/utils/nutritionGoals';

// Set by +native-intent.tsx on cold start to defer widget action until navigator is ready
declare global {
  var __PENDING_WIDGET_ACTION: string | undefined;
}

function drainPendingWidgetAction(
  openCamera: (opts: { mode: CameraMode; showBarcodeTextSearch?: boolean }) => void
) {
  const action = global.__PENDING_WIDGET_ACTION;
  if (!action) {
    return;
  }

  global.__PENDING_WIDGET_ACTION = undefined;
  if (action === 'open-camera') {
    openCamera({ mode: 'barcode-scan', showBarcodeTextSearch: true });
  }
}

// No notification system yet, so leave it like this for now
const SHOW_NOTIFICATIONS = false;

const GOALS_MANAGEMENT_TAB = {
  FITNESS: 'fitness',
  NUTRITION: 'nutrition',
} as const;

type GoalsManagementTab = (typeof GOALS_MANAGEMENT_TAB)[keyof typeof GOALS_MANAGEMENT_TAB];

export default function HomeScreen() {
  const [widgetCameraLaunch] = useState(() => global.__PENDING_WIDGET_ACTION === 'open-camera');
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const { defaults: nutritionGoalsDefaults, planData } = useDefaultNutritionGoals();
  const { tdee: currentTdee } = useEmpiricalTDEE({
    fallbackValue: planData?.tdee ?? nutritionGoalsDefaults.totalCalories,
  });
  const {
    isAiConfigured,
    intuitiveEatingMode,
    nutritionDisplay,
    homeSummaryCard,
    homeActions,
    showHomeSteps,
  } = useSettings();
  const { openCamera } = useSmartCamera();
  const { openCoach } = useCoach();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();

  const pathname = usePathname();
  const navigationState = useRootNavigationState();

  const [today, setToday] = useState(() => localCalendarDayDate(new Date()));

  // The single owner of today's nutrition on this screen: the summary card renders it and
  // the stat strip needs the calories out of it. `useDailyNutritionSummary` is two live
  // queries with their own decryption, so subscribing per consumer ran the whole thing
  // twice for one calendar day. The weekly-streak card needs none of it, hence the gate.
  const needsDailyNutrition = homeSummaryCard !== 'weekly_streak' || showHomeSteps;
  const dailySummary = useDailyNutritionSummary({ date: today, visible: needsDailyNutrition });
  const currentNutritionGoal = dailySummary.nutritionGoal;

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
        void refreshDailyStepsIfStale();

        // Drain pending widget action set by redirectSystemPath when Android
        // recreates the activity while the JS process is still alive (the
        // cold-start useEffect won't re-run because its deps haven't changed).
        drainPendingWidgetAction(openCamera);
      }
    });

    const intervalId = setInterval(syncToday, 60_000);
    return () => {
      appSub.remove();
      clearInterval(intervalId);
    };
  }, [openCamera]);

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
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);
  const [isEditCurrentGoalVisible, setIsEditCurrentGoalVisible] = useState(false);
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);
  const [foodSearchInitialTab, setFoodSearchInitialTab] = useState<
    'all' | 'myFoods' | 'openfood' | 'usda' | 'meals'
  >('all');
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);
  const [isLogCardioVisible, setIsLogCardioVisible] = useState(false);
  const [isDailySummaryMenuVisible, setIsDailySummaryMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [goalsManagementTab, setGoalsManagementTab] = useState<GoalsManagementTab>('nutrition');
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [isMoodPromptVisible, setIsMoodPromptVisible] = useState(false);
  const [isWaterPromptVisible, setIsWaterPromptVisible] = useState(false);
  const [selectedLogEntry, setSelectedLogEntry] = useState<{
    log: (typeof recentNutritionLogs)[0]['log'];
    food: (typeof recentNutritionLogs)[0]['food'];
    nutrients: (typeof recentNutritionLogs)[0]['nutrients'];
    gramWeight: number;
    displayName: string;
    mealType: MealType;
  } | null>(null);

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const headerDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric' }).format(
        today
      ),
    [locale, today]
  );
  const avatar = dbUser?.avatarIcon
    ? getAvatarDisplayProps(theme, dbUser.avatarIcon, dbUser.avatarColor)
    : null;

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
  const handleCloseEditCurrentGoal = useCallback(() => setIsEditCurrentGoalVisible(false), []);
  const handleCloseFoodSearch = useCallback(() => setIsFoodSearchVisible(false), []);
  const handleCloseMyMeals = useCallback(() => setIsMyMealsVisible(false), []);
  const handleCloseDailySummaryMenu = useCallback(() => setIsDailySummaryMenuVisible(false), []);
  const handleCloseGoalsManagement = useCallback(() => setIsGoalsManagementModalVisible(false), []);
  const handleCloseCreateCustomFood = useCallback(() => setIsCreateCustomFoodVisible(false), []);
  const handleCloseWorkoutDetail = useCallback(() => setSelectedWorkoutId(undefined), []);

  const handleOpenGoalsManagement = useCallback((tab: GoalsManagementTab) => {
    setGoalsManagementTab(tab);
    setIsGoalsManagementModalVisible(true);
  }, []);

  const handleOpenNutritionGoalsManagement = useCallback(() => {
    handleOpenGoalsManagement(GOALS_MANAGEMENT_TAB.NUTRITION);
  }, [handleOpenGoalsManagement]);

  const handleOpenFitnessGoalsManagement = useCallback(() => {
    handleOpenGoalsManagement(GOALS_MANAGEMENT_TAB.FITNESS);
  }, [handleOpenGoalsManagement]);

  const homeActionHandlers: Record<HomeActionKey, () => void> = useMemo(
    () => ({
      start_workout: () => router.navigate('/app/workout/workouts'),
      track_food: () => setIsAddFoodVisible(true),
      scan_barcode: () => openCamera({ mode: 'barcode-scan', showBarcodeTextSearch: true }),
      ai_photo: () => openCamera({ mode: 'ai-meal-photo' }),
      my_meals: () => setIsMyMealsVisible(true),
      add_note: () => router.navigate('/app/notes'),
      log_cardio: () => setIsLogCardioVisible(true),
    }),
    [router, openCamera]
  );

  // Memoize modal action handlers
  const handleMealTypeSelect = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsAddFoodVisible(false);
    setFoodSearchInitialTab('all');
    setIsFoodSearchVisible(true);
  }, []);

  const handleAiCameraPress = useCallback(() => {
    setIsAddFoodVisible(false);
    openCamera({ mode: 'ai-meal-photo' });
  }, [openCamera]);

  const handleScanBarcodePress = useCallback(() => {
    setIsAddFoodVisible(false);
    openCamera({ mode: 'barcode-scan', showBarcodeTextSearch: true });
  }, [openCamera]);

  const handleSearchFoodPress = useCallback(() => {
    setIsAddFoodVisible(false);
    setSelectedMealType('snack');
    setFoodSearchInitialTab('all');
    setIsFoodSearchVisible(true);
  }, []);

  const handleCreateCustomFoodPress = useCallback(() => {
    setIsAddFoodVisible(false);
    setIsCreateCustomFoodVisible(true);
  }, []);

  const handleTrackCustomMealPress = useCallback(() => {
    setIsAddFoodVisible(false);
    setFoodSearchInitialTab('meals');
    setIsFoodSearchVisible(true);
  }, []);

  const handleSaveNutritionGoals = useCallback(
    async (goals: NutritionGoals) => {
      try {
        const savedGoal = await NutritionGoalService.saveGoals(nutritionGoalsToInput(goals));
        await NutritionGoalService.regenerateCheckins(savedGoal.id);
        setIsNutritionGoalsVisible(false);
        triggerConfetti(ConfettiActivity.FIRST_MANUAL_NUTRITION_GOAL);
      } catch (error) {
        await handleError(error, 'index.saveNutritionGoals', {
          snackbarMessage: t('errors.somethingWentWrong'),
          consoleMessage: 'Failed to save nutrition goals:',
        });
      }
    },
    [t, triggerConfetti]
  );

  const handleSaveCurrentNutritionGoal = useCallback(
    async (goals: NutritionGoals) => {
      if (!currentNutritionGoal) {
        return;
      }

      try {
        await NutritionGoalService.updateGoal(
          currentNutritionGoal.id,
          nutritionGoalsToInput(goals),
          true
        );
        setIsEditCurrentGoalVisible(false);
      } catch (error) {
        await handleError(error, 'index.saveCurrentNutritionGoal', {
          snackbarMessage: t('errors.somethingWentWrong'),
          consoleMessage: 'Failed to update current nutrition goal:',
        });
      }
    },
    [currentNutritionGoal, t]
  );

  const handleFoodSearchCreatePress = useCallback(() => {
    setIsFoodSearchVisible(false);
    setIsCreateCustomFoodVisible(true);
  }, []);

  const handleFoodSearchBarcodePress = useCallback(() => {
    setIsFoodSearchVisible(false);
    openCamera({ mode: 'barcode-scan', mealType: selectedMealType, showBarcodeTextSearch: true });
  }, [openCamera, selectedMealType]);

  // Handle widget action stored by +native-intent.tsx on cold start (camera only —
  // screen-based actions like open-nutrition are routed directly by redirectSystemPath)
  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    drainPendingWidgetAction(openCamera);
  }, [navigationState?.key, openCamera]);

  // On web we navigate directly to /app, so we need to check here if we need to run onboarding redirect.
  // pathname is intentionally excluded from deps: usePathname() updates globally on every navigation,
  // which would re-trigger this effect and redirect the user back to /app from any other screen.
  useEffect(() => {
    if (Platform.OS !== 'web' || !navigationState?.key) {
      return;
    }

    runEntryOnboardingRedirect(router, 'app.index.web', '/app').then((redirected) => {
      // redirected === false means onboarding is confirmed complete (not an error-driven redirect).
      // triggerConfetti is deduplication-safe: it's a no-op once the activity is already celebrated.
      if (redirected === false) {
        triggerConfetti(ConfettiActivity.ONBOARDING_CONFIRMED);
      }
    });
  }, [navigationState?.key, router, triggerConfetti]);

  // Handle widget deep link when app is already running (warm start)
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const { queryParams } = ExpoLinking.parse(url);
      if (queryParams?.action === 'open-camera') {
        openCamera({ mode: 'barcode-scan', showBarcodeTextSearch: true });
      } else if (queryParams?.action === 'open-nutrition') {
        router.navigate('/app/nutrition/food');
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [openCamera, router]);

  return (
    <MasterLayout>
      <WhatsNewAutoPrompt suppressed={widgetCameraLaunch} />
      {showConfetti ? <ConfettiOverlay /> : null}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header: the avatar as the way into the account menu, then the day this screen is
            about. The avatar sits on the left so it lines up with the avatar the account menu
            opens with. A time-of-day greeting and the version string used to sit here; the
            version lives in Settings > About. */}
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.accountMenu')}
            className="active:opacity-70"
            onPress={() => setIsUserMenuVisible(true)}
            testID="home-account-menu"
          >
            {isLoadingUser ? (
              <SkeletonLoader width={44} height={44} borderRadius={22} />
            ) : (
              <AnimatedContent>
                <View
                  className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border"
                  style={{
                    borderColor: avatar ? avatar.color : theme.colors.accent.primary,
                    backgroundColor: avatar
                      ? avatar.backgroundColor
                      : theme.colors.background.imageLight,
                  }}
                >
                  {avatar ? (
                    createElement(avatar.IconComponent, {
                      size: theme.iconSize.lg,
                      color: avatar.color,
                    })
                  ) : (
                    <Text className="text-base font-semibold text-text-primary">
                      {dbUser?.fullName?.charAt(0).toUpperCase() || 'G'}
                    </Text>
                  )}
                </View>
              </AnimatedContent>
            )}
          </Pressable>
          <Text
            accessibilityRole="header"
            className="min-w-0 flex-1 text-right text-2xl font-bold text-text-primary"
            numberOfLines={1}
          >
            {headerDate}
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

        <View className="mx-4 mb-4">
          <WorkoutTodayCard activeOnly />
        </View>
        {/* Daily Summary Card */}
        <View className="mb-4 px-4">
          {homeSummaryCard === 'weekly_streak' ? (
            <WeeklyHomeSummary
              date={today}
              onCreateWorkoutGoalPress={handleOpenFitnessGoalsManagement}
            />
          ) : (
            <DailyHomeSummary
              date={today}
              summary={dailySummary}
              intuitiveEatingMode={intuitiveEatingMode}
              nutritionDisplay={nutritionDisplay}
              onOpenMenu={() => setIsDailySummaryMenuVisible(true)}
              onSetGoals={() => setIsNutritionGoalsVisible(true)}
            />
          )}
          {showHomeSteps ? (
            <DailyHomeFooter
              date={today}
              tdee={currentTdee}
              // `null` withholds the energy half of the strip: there is no goal to balance
              // against in intuitive-eating mode, or before one has been set.
              consumedKcal={
                intuitiveEatingMode || !currentNutritionGoal ? null : dailySummary.calories.consumed
              }
            />
          ) : null}
        </View>

        {/* Home prompts */}
        <View className="mx-4">
          <HomeMoodPrompt onVisibilityChange={setIsMoodPromptVisible} />
          <HomeWaterPrompt
            tdee={currentTdee}
            blockedByHigherPriorityPrompt={isMoodPromptVisible}
            onVisibilityChange={setIsWaterPromptVisible}
          />
          <HomeSupplementPrompt
            blockedByHigherPriorityPrompt={isMoodPromptVisible || isWaterPromptVisible}
          />
        </View>

        {/* Action Buttons */}
        <HomeActionsRow selected={homeActions} onActionPress={(key) => homeActionHandlers[key]()} />
        <View className="mx-4 mb-4">
          <WeeklyReviewCard compact quietUntilReady />
        </View>
        <View className="mx-4 mb-6">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-text-primary">
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
                <View
                  key={i}
                  className="flex-row items-center gap-4 rounded-card bg-bg-overlay p-5"
                >
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
                    onPress={() =>
                      setSelectedLogEntry({
                        log: entry.log,
                        food: entry.food,
                        nutrients: entry.nutrients,
                        gramWeight: entry.gramWeight,
                        displayName: entry.displayName,
                        mealType: entry.log.type,
                      })
                    }
                  />
                ))}

                <Button
                  variant="dashed"
                  size="sm"
                  width="full"
                  icon={Plus}
                  label={t('food.meals.addFood')}
                  onPress={() => setIsAddFoodVisible(true)}
                />
              </View>
            </AnimatedContent>
          )}
        </View>

        {/* Recent Workouts */}
        <View className="mx-4 mb-6">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-text-primary">
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
                  className="rounded-card border bg-bg-card p-4"
                  style={{ borderColor: theme.colors.background.ink5 }}
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

                <TextButton
                  label={t('startWorkout.label')}
                  icon={Plus}
                  onPress={() => router.navigate('/app/workout/workouts')}
                />
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
        {...(!isProduction() && {
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

      <NutritionGoalsModal
        visible={isEditCurrentGoalVisible}
        onClose={handleCloseEditCurrentGoal}
        onSave={handleSaveCurrentNutritionGoal}
        initialGoals={
          currentNutritionGoal
            ? nutritionGoalToInitialValues(currentNutritionGoal)
            : nutritionGoalsDefaults
        }
        isEditing={true}
      />

      {/* Food Search Modal */}
      <FoodSearchModal
        visible={isFoodSearchVisible}
        onClose={handleCloseFoodSearch}
        mealType={selectedMealType}
        initialTab={foodSearchInitialTab}
        onCreatePress={handleFoodSearchCreatePress}
        onBarcodeScanPress={handleFoodSearchBarcodePress}
        onFirstNutritionLog={() => triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG)}
        isAiEnabled={isAiConfigured}
      />

      {/* Quick walk/run log: mounted only while open so each open starts from the defaults */}
      {isLogCardioVisible ? (
        <LogCardioModal visible={isLogCardioVisible} onClose={() => setIsLogCardioVisible(false)} />
      ) : null}

      {/* My Meals Modal */}
      <MyMealsModal visible={isMyMealsVisible} onClose={handleCloseMyMeals} />

      <DailySummaryBottomMenu
        visible={isDailySummaryMenuVisible}
        onClose={handleCloseDailySummaryMenu}
        onEditCurrentGoalPress={() => setIsEditCurrentGoalVisible(true)}
        onGoalsManagementPress={handleOpenNutritionGoalsManagement}
        showEditCurrentGoal={currentNutritionGoal != null}
      />

      {/* Goals Management Modal */}
      <GoalsManagementModal
        visible={isGoalsManagementModalVisible}
        onClose={handleCloseGoalsManagement}
        tab={goalsManagementTab}
      />

      {/* Create Custom Food Modal */}
      <CreateCustomFoodModal
        visible={isCreateCustomFoodVisible}
        trackFoodAfterSave={true}
        onClose={handleCloseCreateCustomFood}
        isAiEnabled={isAiConfigured}
      />

      {/* Tracked Food Log Details Modal */}
      <FoodMealDetailsModal
        visible={selectedLogEntry !== null}
        onClose={() => setSelectedLogEntry(null)}
        entry={selectedLogEntry}
      />
    </MasterLayout>
  );
}
