import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Dumbbell, UtensilsCrossed, ChevronRight, Flame } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { MasterLayout } from './components/MasterLayout';

import './lang/lang';
import './global.css';

const PAGE_DATA = {
  user: {
    greeting: 'Good Evening',
    name: 'Alex Johnson',
    avatar: require('./assets/icon.png'),
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
    gradientColors: ['#5b7cf5', '#4a9d8f', '#47d9ba'] as const,
  },
  recentWorkouts: [
    {
      id: '1',
      name: 'Upper Body Power',
      date: 'Yesterday',
      duration: '1h 10m',
      calories: 450,
      prs: 4,
      image: require('./assets/icon.png'),
      imageBgColor: '#d4b5a0',
    },
    {
      id: '2',
      name: 'Morning Run',
      date: 'Tuesday',
      duration: '28m',
      calories: 310,
      prs: null,
      image: require('./assets/icon.png'),
      imageBgColor: '#8b7d6b',
    },
  ],
  recentFoods: [
    {
      id: '1',
      name: 'Breakfast Burrito',
      emoji: '🌯',
      protein: 24,
      carbs: 42,
      fat: 18,
      calories: 450,
    },
    {
      id: '2',
      name: 'Chicken & Rice Bowl',
      emoji: '🍔',
      protein: 45,
      carbs: 60,
      fat: 12,
      calories: 620,
    },
  ],
};

export default function App() {
  const { t } = useTranslation();
  const { user, dailySummary, recentWorkouts, recentFoods } = PAGE_DATA;

  // Calculate progress percentages
  const caloriesProgress = (dailySummary.calories.consumed / dailySummary.calories.goal) * 100;
  const activityProgress = (dailySummary.activity.minutes / dailySummary.activity.goal) * 100;

  return (
    <MasterLayout>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-6">
          <View className="flex-row items-center gap-3">
            <View className="relative">
              <View className="h-14 w-14 overflow-hidden rounded-full border-4 border-[#22c55e] bg-[#d4b5a0]">
                <Image source={user.avatar} className="h-full w-full" resizeMode="cover" />
              </View>
              <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0a1f1a] bg-[#22c55e]" />
            </View>
            <View>
              <Text className="text-sm text-gray-400">{t('home.greeting.goodEvening')}</Text>
              <Text className="text-xl font-bold text-white">{user.name}</Text>
            </View>
          </View>
          <Pressable className="relative rounded-full bg-[#1a2f2a] p-3">
            <Bell size={24} color="#ffffff" />
            {user.hasNotifications && (
              <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
            )}
          </Pressable>
        </View>

        {/* Daily Summary Card */}
        <View className="mx-6 mb-6">
          <LinearGradient
            colors={dailySummary.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 24, padding: 24 }}>
            <View className="mb-6 flex-row items-start justify-between">
              <Text className="text-sm font-semibold tracking-wide text-white/90">
                {t('home.dailySummary.title')}
              </Text>
              <View className="rounded-full bg-white/25 px-4 py-1.5">
                <Text className="text-xs font-medium text-white">{t('common.today')}</Text>
              </View>
            </View>

            <View className="flex-row gap-8">
              {/* Calories */}
              <View className="flex-1">
                <View className="mb-2 flex-row items-baseline gap-1">
                  <Text className="text-5xl font-bold text-white">
                    {dailySummary.calories.consumed.toLocaleString()}
                  </Text>
                  <Text className="text-sm uppercase text-white/70">{t('common.kcal')}</Text>
                </View>
                <View className="mb-2">
                  <View className="h-2 overflow-hidden rounded-full bg-white/30">
                    <View
                      className="h-full rounded-full bg-white"
                      style={{ width: `${caloriesProgress}%` }}
                    />
                  </View>
                </View>
                <Text className="text-sm text-white/70">
                  {dailySummary.calories.remaining} {t('common.remaining')}
                </Text>
              </View>

              {/* Activity Minutes */}
              <View className="flex-1">
                <View className="mb-2 flex-row items-baseline gap-1">
                  <Text className="text-5xl font-bold text-white">
                    {dailySummary.activity.minutes}
                  </Text>
                    <Text className="text-sm uppercase text-white/70">{t('common.min')}</Text>
                </View>
                <View className="mb-2">
                  <View className="h-2 overflow-hidden rounded-full bg-white/30">
                    <View
                      className="h-full rounded-full bg-white"
                      style={{ width: `${activityProgress}%` }}
                    />
                  </View>
                </View>
                <Text className="text-sm text-white/70">
                  {t('common.goal')}: {dailySummary.activity.goal} {t('common.min')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View className="mx-6 mb-8 flex-row gap-4">
            <Pressable className="min-h-[180px] flex-1 justify-between rounded-3xl bg-[#22c55e] p-6">
              <Dumbbell size={40} color="#0a1f1a" strokeWidth={2.5} />
              <Text className="text-2xl font-bold leading-tight text-[#0a1f1a]">
                {t('home.actions.startWorkout')}
              </Text>
            </Pressable>

            <Pressable className="min-h-[180px] flex-1 justify-between rounded-3xl bg-[#1a2f2a] p-6">
              <UtensilsCrossed size={40} color="#ffffff" strokeWidth={2.5} />
              <Text className="text-2xl font-bold leading-tight text-white">
                {t('home.actions.trackFood')}
              </Text>
            </Pressable>
        </View>

        {/* Recent Workouts */}
        <View className="mx-6 mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-2xl font-bold text-white">{t('home.sections.recentWorkouts')}</Text>
              <Pressable>
                <Text className="text-sm font-medium text-[#22c55e]">{t('common.seeAll')}</Text>
              </Pressable>
            </View>

          <View className="gap-3">
            {recentWorkouts.map((workout) => (
              <Pressable
                key={workout.id}
                className="flex-row items-center gap-4 rounded-2xl bg-[#1a2f2a] p-4">
                <View
                  className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl"
                  style={{ backgroundColor: workout.imageBgColor }}>
                  <Image source={workout.image} className="h-full w-full" resizeMode="cover" />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-lg font-bold text-white">{workout.name}</Text>
                  <Text className="mb-2 text-sm text-gray-400">
                    {workout.date} • {workout.duration}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-row items-center gap-1 rounded-full bg-[#0f251f] px-2.5 py-1">
                      <Flame size={14} color="#f97316" />
                      <Text className="text-xs font-medium text-orange-500">
                        {workout.calories}
                      </Text>
                    </View>
                    {workout.prs !== null && (
                      <View className="flex-row items-center gap-1 rounded-full bg-[#0f251f] px-2.5 py-1">
                        <Text className="text-xs">💪</Text>
                        <Text className="text-xs font-medium text-[#22c55e]">
                          {workout.prs} PRS
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={24} color="#4b5563" />
              </Pressable>
            ))}
          </View>
        </View>

          {/* Recent Foods */}
          <View className="mx-6 mb-8">
            <Text className="mb-4 text-2xl font-bold text-white">{t('home.sections.recentFoods')}</Text>

          <View className="gap-3">
            {recentFoods.map((food) => (
              <View key={food.id} className="rounded-2xl bg-[#1a2f2a] p-5">
                <View className="mb-3 flex-row items-start justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-4xl">{food.emoji}</Text>
                    <View>
                      <Text className="text-lg font-bold text-white">{food.name}</Text>
                      <View className="mt-2 flex-row gap-2">
                        <View className="rounded-full bg-[#0f251f] px-2.5 py-1">
                          <Text className="text-xs text-gray-400">
                            {t('home.macros.protein', { value: food.protein })}
                          </Text>
                        </View>
                        <View className="rounded-full bg-[#0f251f] px-2.5 py-1">
                          <Text className="text-xs text-gray-400">
                            {t('home.macros.carbs', { value: food.carbs })}
                          </Text>
                        </View>
                        <View className="rounded-full bg-[#0f251f] px-2.5 py-1">
                          <Text className="text-xs text-gray-400">
                            {t('home.macros.fat', { value: food.fat })}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Text className="text-lg font-bold text-white">
                    {food.calories} {t('common.kcal')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>
    </MasterLayout>
  );
}
