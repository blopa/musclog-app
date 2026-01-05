import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { MasterLayout } from '../components/MasterLayout';
import { RecentWorkoutsCard } from '../components/RecentWorkoutsCard';
import { CircularArrow } from '../components/CircularArrow';
import { ActionButton } from '../components/ActionButton';
import { DailySummaryCard } from '../components/DailySummaryCard';

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
      image: require('../assets/icon.png'),
      imageBgColor: '#d4b5a0',
    },
    {
      id: '2',
      name: 'Morning Run',
      date: 'Tuesday',
      duration: '28m',
      calories: 310,
      prs: null,
      image: require('../assets/icon.png'),
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

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, dailySummary, recentWorkouts, recentFoods } = PAGE_DATA;

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
        <DailySummaryCard
          calories={dailySummary.calories}
          activity={dailySummary.activity}
          gradientColors={dailySummary.gradientColors}
        />

        {/* Action Buttons */}
        <View className="mx-6 mb-8 flex-row gap-4">
          <ActionButton variant="workout" label={t('home.actions.startWorkout')} />
          <ActionButton variant="food" label={t('home.actions.trackFood')} />
        </View>

        {/* Recent Workouts */}
        <View className="mx-6 mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">
              {t('home.sections.recentWorkouts')}
            </Text>
            <Pressable>
              <Text className="text-sm font-medium text-[#22c55e]">{t('common.seeAll')}</Text>
            </Pressable>
          </View>

          <View className="gap-3">
            {recentWorkouts.map((workout) => (
              <RecentWorkoutsCard
                key={workout.id}
                name={workout.name}
                date={workout.date}
                duration={workout.duration}
                calories={workout.calories}
                prs={workout.prs}
                image={workout.image}
                imageBgColor={workout.imageBgColor}
              />
            ))}
          </View>
        </View>

        {/* Recent Foods */}
        <View className="mx-6 mb-8">
          <Text className="mb-4 text-2xl font-bold text-white">
            {t('home.sections.recentFoods')}
          </Text>

          <View className="gap-3">
            {recentFoods.map((food) => (
              <Pressable
                key={food.id}
                className="flex-row items-center gap-4 rounded-2xl bg-[#1a2f2a] p-5">
                <View className="flex-1">
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
                <CircularArrow />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View className="h-24" />
      </ScrollView>
    </MasterLayout>
  );
}
