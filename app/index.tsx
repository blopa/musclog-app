import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bell,
  Clock,
  Droplet,
  Flame,
  Trophy,
  UtensilsCrossed,
  Wheat,
  Zap,
} from 'lucide-react-native';
import { createElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ActionButton } from '../components/ActionButton';
import { DailySummaryCard } from '../components/cards/DailySummaryCard/DailySummaryCard';
import { DailySummaryEmptyState } from '../components/cards/DailySummaryCard/DailySummaryEmptyState';
import { DetailedItemCard } from '../components/cards/DetailedItemCard';
import { MasterLayout } from '../components/MasterLayout';
import { AddFoodModal } from '../components/modals/AddFoodModal';
import CreateCustomFoodModal from '../components/modals/CreateCustomFoodModal';
import { FoodSearchModal } from '../components/modals/FoodSearchModal';
import MyMealsModal from '../components/modals/MyMealsModal';
import { NotificationsModal } from '../components/modals/NotificationsModal';
import { NutritionGoalsModal } from '../components/modals/NutritionGoalsModal';
import PastWorkoutDetailModal from '../components/modals/PastWorkoutDetailModal';
import PastWorkoutsHistoryModal from '../components/modals/PastWorkoutsHistoryModal';
import SmartCameraModal from '../components/modals/SmartCameraModal';
import { UserMenuModal } from '../components/modals/UserMenuModal';
import ShowMoreButton from '../components/ShowMoreButton';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { WorkoutFoodEmptyState } from '../components/WorkoutFoodEmptyState';
import { TEMP_GOOGLE_AUTH_CODE } from '../constants/auth';
import { type MealType } from '../database/models';
import { useCurrentNutritionGoal } from '../hooks/useCurrentNutritionGoal';
import { useNutritionLogs } from '../hooks/useNutritionLogs';
import { useUser } from '../hooks/useUser';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { theme } from '../theme';
import { getAvatarDisplayProps } from '../utils/avatarUtils';
import { getCurrentOnboardingStep, isOnboardingCompleted } from '../utils/onboardingService';

// No notification system yet, so leave it like this for now
const SHOW_NOTIFICATIONS = false;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user: dbUser, isLoading: isLoadingUser } = useUser();
  const params = useLocalSearchParams<{ code?: string }>();

  // Memoize today's date to prevent infinite re-renders
  const today = useMemo(() => new Date(), []);

  // Get current nutrition goals
  const { goal: nutritionGoal, isLoading: isLoadingGoal } = useCurrentNutritionGoal({
    mode: 'current',
  });

  // Get today's nutrition data
  const { dailyNutrients, isLoading: isLoadingNutrition } = useNutritionLogs({
    mode: 'daily',
    date: today,
  });

  // Get recent foods for display (limit to today's logs)
  const { recentFoods, isLoading: isLoadingRecentFoods } = useNutritionLogs({
    mode: 'recent',
    date: today,
  });

  // Calculate daily summary from real data
  const dailySummary = useMemo(() => {
    const caloriesGoal = nutritionGoal?.totalCalories;
    const caloriesConsumed = dailyNutrients.calories;
    const caloriesRemaining = Math.max(0, (caloriesGoal ?? 0) - caloriesConsumed);

    return {
      calories: {
        consumed: caloriesConsumed,
        remaining: caloriesRemaining,
        goal: caloriesGoal ?? 0,
      },
      gradientColors: theme.colors.gradients.primary,
    };
  }, [nutritionGoal, dailyNutrients]);

  // Calculate macros from real data
  const macros = useMemo(() => {
    return {
      protein: {
        value: Math.round(dailyNutrients.protein),
        goal: nutritionGoal?.protein ?? 0,
      },
      carbs: {
        value: Math.round(dailyNutrients.carbs),
        goal: nutritionGoal?.carbs ?? 0,
      },
      fats: {
        value: Math.round(dailyNutrients.fat),
        goal: nutritionGoal?.fats ?? 0,
      },
    };
  }, [dailyNutrients, nutritionGoal]);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | undefined>(undefined);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [cameraMode, setCameraMode] = useState<'ai-meal-photo' | 'ai-label-scan' | 'barcode-scan'>(
    'ai-meal-photo'
  );

  // Use reactive hook for recent workouts
  const { workouts: recentWorkouts, isLoading: isLoadingRecent } = useWorkoutHistory({
    initialLimit: 2,
    groupByMonth: false,
  });

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const codeParam = params.code;
        const completed = await isOnboardingCompleted();

        if (!completed) {
          try {
            const saved = await getCurrentOnboardingStep();
            if (saved) {
              if (saved === '/onboarding/connect-with-google' && codeParam) {
                try {
                  await AsyncStorage.setItem(TEMP_GOOGLE_AUTH_CODE, codeParam);
                } catch (e) {
                  console.warn('Failed to save auth code to AsyncStorage', e);
                }

                router.replace({
                  pathname: '/onboarding/connect-with-google',
                  params: { loading: 'true' },
                });
              } else {
                router.replace(saved);
              }
            } else {
              router.replace('/onboarding/landing');
            }
          } catch (e) {
            console.error('Error restoring onboarding step, falling back to landing', e);
            router.replace('/onboarding/landing');
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [params.code, router]);

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
        <View className="flex-row items-center justify-between px-6 py-6">
          <Pressable
            className="flex-row items-center gap-3"
            onPress={() => setIsUserMenuVisible(true)}
          >
            <View className="relative">
              <View
                className="h-14 w-14 overflow-hidden rounded-full border-4"
                style={{
                  borderColor: dbUser
                    ? getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).color
                    : theme.colors.accent.primary,
                  backgroundColor: dbUser
                    ? getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).backgroundColor
                    : theme.colors.accent.primary20,
                }}
              >
                {dbUser?.avatarIcon ? (
                  <View className="h-full w-full items-center justify-center rounded-full">
                    {createElement(
                      getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).IconComponent,
                      {
                        size: 24,
                        color: getAvatarDisplayProps(dbUser.avatarIcon, dbUser.avatarColor).color,
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
              <Text className="text-sm text-text-secondary">{t('home.greeting.goodEvening')}</Text>
              <Text className="text-xl font-bold text-text-primary">
                {dbUser?.fullName || 'Guest'}
              </Text>
            </View>
          </Pressable>
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

        {/* Daily Summary Card */}
        <View className="mb-6 px-6">
          {nutritionGoal ? (
            <DailySummaryCard calories={dailySummary.calories} macros={macros} />
          ) : (
            <DailySummaryEmptyState onSetGoals={() => setIsNutritionGoalsVisible(true)} />
          )}
        </View>

        {/* Action Buttons */}
        <View className="mx-6 mb-8 flex-row gap-4">
          <ActionButton
            variant="workout"
            label={t('home.actions.startWorkout')}
            onPress={() => router.push('/workout/workouts')}
          />
          <ActionButton
            variant="food"
            label={t('home.actions.trackFood')}
            onPress={() => setIsAddFoodVisible(true)}
          />
        </View>
        <View className="mx-6 mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('home.sections.recentFoods')}
            </Text>
            <ShowMoreButton
              onPress={() => router.push('/nutrition/food')}
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
          ) : recentFoods.length === 0 ? (
            <WorkoutFoodEmptyState type="food" onButtonPress={() => setIsAddFoodVisible(true)} />
          ) : (
            <View className="gap-3">
              {recentFoods.slice(0, 2).map((food) => (
                <DetailedItemCard
                  key={food.id}
                  item={{
                    name: food.name ?? '',
                    media: food.imageUrl
                      ? { uri: food.imageUrl }
                      : { icon: UtensilsCrossed, color: theme.colors.text.secondary },
                    itemOne: { value: `${Math.round(food.protein ?? 0)}G P`, icon: Zap },
                    itemTwo: { value: `${Math.round(food.carbs ?? 0)}G C`, icon: Wheat },
                    itemThree: { value: `${Math.round(food.fat ?? 0)}G F`, icon: Droplet },
                  }}
                  ctaLabel={
                    <Text className="text-lg font-bold text-text-primary">
                      {Math.round(food.calories ?? 0)} {t('common.kcal')}
                    </Text>
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Workouts */}
        <View className="mx-6 mb-8">
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
            <WorkoutFoodEmptyState
              type="workout"
              onButtonPress={() => router.push('/workout/workouts')}
            />
          ) : (
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
            </View>
          )}
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>

      {/* User Menu Modal */}
      {isUserMenuVisible ? (
        <UserMenuModal
          visible={isUserMenuVisible}
          onClose={() => setIsUserMenuVisible(false)}
          user={{
            name: dbUser?.fullName || 'Guest',
            avatarIcon: dbUser?.avatarIcon,
            avatarColor: dbUser?.avatarColor,
          }}
          onProfilePress={() => router.push('/profile')}
          onSettingsPress={() => router.push('/settings')}
          onProgressPress={() => router.push('/progress')}
          {...(__DEV__ && {
            onDebugMenuPress: () => router.push('/test/debug'),
          })}
        />
      ) : null}

      {/* Notifications Modal */}
      {isNotificationsVisible ? (
        <NotificationsModal
          visible={isNotificationsVisible}
          onClose={() => setIsNotificationsVisible(false)}
          onClearAll={() => {
            // Handle clear all notifications
            console.log('Clear all notifications');
          }}
        />
      ) : null}

      {/* Workout History Modal */}
      {isWorkoutHistoryVisible ? (
        <PastWorkoutsHistoryModal
          visible={isWorkoutHistoryVisible}
          onClose={() => setIsWorkoutHistoryVisible(false)}
        />
      ) : null}

      {/* Workout Detail Modal */}
      {!!selectedWorkoutId ? (
        <PastWorkoutDetailModal
          visible={!!selectedWorkoutId}
          onClose={() => setSelectedWorkoutId(undefined)}
          workoutId={selectedWorkoutId}
        />
      ) : null}

      {/* Add Food Modal */}
      {isAddFoodVisible ? (
        <AddFoodModal
          visible={isAddFoodVisible}
          onClose={() => setIsAddFoodVisible(false)}
          onMealTypeSelect={(mealType) => {
            setSelectedMealType(mealType);
            setIsAddFoodVisible(false);
            setIsFoodSearchVisible(true);
          }}
          onAiCameraPress={() => {
            setIsAddFoodVisible(false);
            setCameraMode('ai-meal-photo');
            setIsCameraVisible(true);
          }}
          onScanBarcodePress={() => {
            setIsAddFoodVisible(false);
            setCameraMode('barcode-scan');
            setIsCameraVisible(true);
          }}
          onSearchFoodPress={() => {
            setIsAddFoodVisible(false);
            setSelectedMealType('snack');
            setIsFoodSearchVisible(true);
          }}
          onCreateCustomFoodPress={() => {
            setIsAddFoodVisible(false);
            setIsCreateCustomFoodVisible(true);
          }}
          onTrackCustomMealPress={() => {
            setIsMyMealsVisible(true);
            setIsAddFoodVisible(false);
          }}
        />
      ) : null}

      {/* Nutrition Goals Modal */}
      {isNutritionGoalsVisible ? (
        <NutritionGoalsModal
          visible={isNutritionGoalsVisible}
          onClose={() => setIsNutritionGoalsVisible(false)}
          onSave={(goals) => {
            console.log('Nutrition goals saved:', goals);
            setIsNutritionGoalsVisible(false);
          }}
        />
      ) : null}

      {/* Food Search Modal */}
      {isFoodSearchVisible ? (
        <FoodSearchModal
          visible={isFoodSearchVisible}
          onClose={() => setIsFoodSearchVisible(false)}
          mealType={selectedMealType}
          onCreatePress={() => {
            setIsFoodSearchVisible(false);
            setIsCreateCustomFoodVisible(true);
          }}
          onBarcodeScanPress={() => {
            setIsFoodSearchVisible(false);
            setCameraMode('barcode-scan');
            setIsCameraVisible(true);
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

      {/* My Meals Modal */}
      {isMyMealsVisible ? (
        <MyMealsModal visible={isMyMealsVisible} onClose={() => setIsMyMealsVisible(false)} />
      ) : null}

      {/* Create Custom Food Modal */}
      {isCreateCustomFoodVisible ? (
        <CreateCustomFoodModal
          visible={isCreateCustomFoodVisible}
          onClose={() => setIsCreateCustomFoodVisible(false)}
          onSave={(data) => {
            console.log('Custom food saved:', data);
            setIsCreateCustomFoodVisible(false);
          }}
        />
      ) : null}
    </MasterLayout>
  );
}
