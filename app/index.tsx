import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import {
  Bell,
  Zap,
  Wheat,
  Droplet,
  UtensilsCrossed,
  Flame,
  Clock,
  Trophy,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { MasterLayout } from '../components/MasterLayout';
import { DetailedItemCard } from '../components/cards/DetailedItemCard';
import { ActionButton } from '../components/ActionButton';
import ShowMoreButton from '../components/ShowMoreButton';
import { DailySummaryCard } from '../components/cards/DailySummaryCard';
import { UserMenuModal } from '../components/modals/UserMenuModal';
import { NotificationsModal } from '../components/modals/NotificationsModal';
import { AddFoodModal } from '../components/modals/AddFoodModal';
import PastWorkoutsHistoryModal from '../components/modals/PastWorkoutsHistoryModal';
import PastWorkoutDetailModal from '../components/modals/PastWorkoutDetailModal';
import { useRouter } from 'expo-router';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';
import { WorkoutFoodEmptyState } from '../components/WorkoutFoodEmptyState';
import { isOnboardingCompleted } from '../utils/onboardingService';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { useUser } from '../hooks/useUser';
import { useCurrentNutritionGoal } from '../hooks/useCurrentNutritionGoal';
import { useNutritionLogs } from '../hooks/useNutritionLogs';
import { getAvatarDisplayProps } from '../utils/avatarUtils';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user: dbUser, isLoading: isLoadingUser } = useUser();

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

  // Get recent foods for display
  const { recentFoods, isLoading: isLoadingRecentFoods } = useNutritionLogs({
    mode: 'recent',
  });

  // Calculate daily summary from real data
  const dailySummary = useMemo(() => {
    const caloriesGoal = nutritionGoal?.totalCalories || 2000; // Default goal if not set
    const caloriesConsumed = dailyNutrients.calories;
    const caloriesRemaining = Math.max(0, caloriesGoal - caloriesConsumed);

    return {
      calories: {
        consumed: caloriesConsumed,
        remaining: caloriesRemaining,
        goal: caloriesGoal,
      },
      activity: {
        minutes: 45, // TODO: Get from workout data when available
        goal: 90,
      },
      gradientColors: theme.colors.gradients.primary,
    };
  }, [nutritionGoal, dailyNutrients]);

  // Calculate macros from real data
  const macros = useMemo(() => {
    return {
      protein: {
        value: Math.round(dailyNutrients.protein),
        goal: nutritionGoal?.protein || 200,
      },
      carbs: {
        value: Math.round(dailyNutrients.carbs),
        goal: nutritionGoal?.carbs || 300,
      },
      fats: {
        value: Math.round(dailyNutrients.fat),
        goal: nutritionGoal?.fats || 200,
      },
    };
  }, [dailyNutrients, nutritionGoal]);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | undefined>(undefined);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  // Use reactive hook for recent workouts
  const { workouts: recentWorkouts, isLoading: isLoadingRecent } = useWorkoutHistory({
    initialLimit: 2,
    groupByMonth: false,
  });

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await isOnboardingCompleted();
        if (!completed) {
          // Redirect to onboarding if not completed
          router.replace('/onboarding/landing');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, allow access (don't block user)
      } finally {
        setIsCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [router]);

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
                    {React.createElement(
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
          <Pressable
            className="relative rounded-full bg-bg-overlay p-3"
            onPress={() => setIsNotificationsVisible(true)}
          >
            <Bell size={theme.iconSize.md} color={theme.colors.text.primary} />
            {false ? ( // TODO: Implement notifications logic
              <View
                className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: theme.colors.status.notificationBadge }}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Daily Summary Card */}
        <View className="mb-6 px-6">
          <DailySummaryCard
            calories={dailySummary.calories}
            activity={dailySummary.activity}
            macros={macros}
          />
        </View>

        {/* Action Buttons */}
        <View className="mx-6 mb-8 flex-row gap-4">
          <ActionButton variant="workout" label={t('home.actions.startWorkout')} />
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
              onPress={() => router.push('/food/recent')}
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
                    name: food.name,
                    media: { icon: UtensilsCrossed, color: theme.colors.text.secondary },
                    itemOne: { value: `${Math.round(food.protein)}G P`, icon: Zap },
                    itemTwo: { value: `${Math.round(food.carbs)}G C`, icon: Wheat },
                    itemThree: { value: `${Math.round(food.fat)}G F`, icon: Droplet },
                  }}
                  ctaLabel={
                    <Text className="text-lg font-bold text-text-primary">
                      {Math.round(food.calories)} {t('common.kcal')}
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
              onButtonPress={() => router.push('/workout/plan')}
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

      {/* Notifications Modal */}
      <NotificationsModal
        visible={isNotificationsVisible}
        onClose={() => setIsNotificationsVisible(false)}
        onClearAll={() => {
          // Handle clear all notifications
          console.log('Clear all notifications');
        }}
      />

      {/* Workout History Modal */}
      <PastWorkoutsHistoryModal
        visible={isWorkoutHistoryVisible}
        onClose={() => setIsWorkoutHistoryVisible(false)}
      />

      {/* Workout Detail Modal */}
      <PastWorkoutDetailModal
        visible={!!selectedWorkoutId}
        onClose={() => setSelectedWorkoutId(undefined)}
        workoutId={selectedWorkoutId}
      />

      {/* Add Food Modal */}
      <AddFoodModal
        visible={isAddFoodVisible}
        onClose={() => setIsAddFoodVisible(false)}
        onMealTypeSelect={(mealType) => {
          console.log('Selected meal type:', mealType);
          setIsAddFoodVisible(false);
          // TODO: Navigate to food search or other appropriate screen
        }}
        onAiCameraPress={() => {
          console.log('AI Camera pressed');
          setIsAddFoodVisible(false);
          // TODO: Navigate to AI camera screen
        }}
        onScanBarcodePress={() => {
          console.log('Scan barcode pressed');
          setIsAddFoodVisible(false);
          // TODO: Navigate to barcode scanner
        }}
        onSearchFoodPress={() => {
          console.log('Search food pressed');
          setIsAddFoodVisible(false);
          router.push('/food/search');
        }}
        onCreateCustomFoodPress={() => {
          console.log('Create custom food pressed');
          setIsAddFoodVisible(false);
          // TODO: Navigate to create custom food screen
        }}
        onTrackCustomMealPress={() => {
          console.log('Track custom meal pressed');
          setIsAddFoodVisible(false);
          // TODO: Navigate to track custom meal screen
        }}
      />
    </MasterLayout>
  );
}
