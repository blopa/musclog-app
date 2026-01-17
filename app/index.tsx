import { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
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
import { DailySummaryCard } from '../components/cards/DailySummaryCard';
import { UserMenuModal } from '../components/modals/UserMenuModal';
import { NotificationsModal } from '../components/modals/NotificationsModal';
import { useRouter } from 'expo-router';
import { SkeletonLoader } from '../components/theme/SkeletonLoader';

const PAGE_DATA = {
  user: {
    greeting: 'Good Evening',
    name: 'Alex Johnson',
    avatar: require('../assets/icon.png'),
    hasNotifications: true,
  },
  dailySummary: {
    calories: {
      consumed: 1820,
      remaining: 620,
      goal: 2440, // consumed + remaining
    },
    activity: {
      minutes: 45,
      goal: 90,
    },
    gradientColors: theme.colors.gradients.primary,
  },
  recentWorkouts: [
    {
      id: '1',
      name: 'Upper Body Power',
      date: 'Yesterday',
      duration: '1h 10m',
      calories: 450,
      prs: 4,
      image: require('../assets/icon.png'),
      imageBgColor: theme.colors.background.imageLight,
    },
    {
      id: '2',
      name: 'Morning Run',
      date: 'Tuesday',
      duration: '28m',
      calories: 310,
      prs: null,
      image: require('../assets/icon.png'),
      imageBgColor: theme.colors.background.imageMedium,
    },
  ],
  recentFoods: [
    {
      id: '1',
      name: 'Breakfast Burrito',
      protein: 24,
      carbs: 42,
      fat: 18,
      calories: 450,
    },
    {
      id: '2',
      name: 'Chicken & Rice Bowl',
      protein: 45,
      carbs: 60,
      fat: 12,
      calories: 620,
    },
  ],
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState(PAGE_DATA.user);
  const [dailySummary, setDailySummary] = useState(PAGE_DATA.dailySummary);
  const [recentWorkouts, setRecentWorkouts] = useState(PAGE_DATA.recentWorkouts);
  const [recentFoods, setRecentFoods] = useState(PAGE_DATA.recentFoods);
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Simulate loading recent data - replace with actual API call
  const loadRecentData = async () => {
    setIsLoadingRecent(true);
    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In real app, replace with: const data = await fetchRecentData();
      setRecentWorkouts(PAGE_DATA.recentWorkouts);
      setRecentFoods(PAGE_DATA.recentFoods);
    } catch (err) {
      console.error('Failed to load recent data:', err);
    } finally {
      setIsLoadingRecent(false);
    }
  };

  useEffect(() => {
    // Uncomment to simulate initial load
    // loadRecentData();
  }, []);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <Pressable
            className="flex-row items-center gap-3"
            onPress={() => setIsUserMenuVisible(true)}>
            <View className="relative">
              <View
                className="h-14 w-14 overflow-hidden rounded-full border-4 border-accent-primary"
                style={{ backgroundColor: theme.colors.background.imageLight }}>
                <Image source={user.avatar} className="h-full w-full" resizeMode="cover" />
              </View>
              <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg-primary bg-accent-primary" />
            </View>
            <View>
              <Text className="text-sm text-text-secondary">{t('home.greeting.goodEvening')}</Text>
              <Text className="text-xl font-bold text-text-primary">{user.name}</Text>
            </View>
          </Pressable>
          <Pressable
            className="relative rounded-full bg-bg-overlay p-3"
            onPress={() => setIsNotificationsVisible(true)}>
            <Bell size={theme.iconSize.md} color={theme.colors.text.primary} />
            {user.hasNotifications && (
              <View
                className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: theme.colors.status.notificationBadge }}
              />
            )}
          </Pressable>
        </View>

        {/* Daily Summary Card */}
        <View className="mb-6 px-6">
          <DailySummaryCard
            calories={dailySummary.calories}
            activity={dailySummary.activity}
            macros={{
              protein: { value: 180, goal: 200 },
              carbs: { value: 250, goal: 300 },
              fats: { value: 70, goal: 200 },
            }}
          />
        </View>

        {/* Action Buttons */}
        <View className="mx-6 mb-8 flex-row gap-4">
          <ActionButton variant="workout" label={t('home.actions.startWorkout')} />
          <ActionButton variant="food" label={t('home.actions.trackFood')} />
        </View>

        {/* Recent Workouts */}
        <View className="mx-6 mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-text-primary">
              {t('home.sections.recentWorkouts')}
            </Text>
            <Pressable>
              <Text className="text-sm font-medium text-text-accent">{t('common.seeAll')}</Text>
            </Pressable>
          </View>

          {isLoadingRecent ? (
            <View className="gap-3">
              {[1, 2].map((i) => (
                <View
                  key={i}
                  className="rounded-lg border bg-bg-card p-4"
                  style={{ borderColor: theme.colors.background.white5 }}>
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
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Foods */}
        <View className="mx-6 mb-8">
          <Text className="mb-4 text-2xl font-bold text-text-primary">
            {t('home.sections.recentFoods')}
          </Text>

          {isLoadingRecent ? (
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
          ) : (
            <View className="gap-3">
              {recentFoods.map((food) => (
                <DetailedItemCard
                  key={food.id}
                  item={{
                    name: food.name,
                    media: { icon: UtensilsCrossed, color: theme.colors.text.secondary },
                    itemOne: { value: `${food.protein}G P`, icon: Zap },
                    itemTwo: { value: `${food.carbs}G C`, icon: Wheat },
                    itemThree: { value: `${food.fat}G F`, icon: Droplet },
                  }}
                  ctaLabel={
                    <Text className="text-lg font-bold text-text-primary">
                      {food.calories} {t('common.kcal')}
                    </Text>
                  }
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
        user={user}
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
    </MasterLayout>
  );
}
