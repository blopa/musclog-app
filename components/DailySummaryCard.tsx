import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

type DailySummaryCardProps = {
  calories: {
    consumed: number;
    remaining: number;
    goal: number;
  };
  activity: {
    minutes: number;
    goal: number;
  };
  gradientColors: readonly [string, string, ...string[]];
};

export function DailySummaryCard({ calories, activity, gradientColors }: DailySummaryCardProps) {
  const { t } = useTranslation();

  // Calculate progress percentages
  const caloriesProgress = (calories.consumed / calories.goal) * 100;
  const activityProgress = (activity.minutes / activity.goal) * 100;

  return (
    <View className="mx-6 mb-6">
      <LinearGradient
        colors={gradientColors}
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
                {calories.consumed.toLocaleString()}
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
              {calories.remaining} {t('common.remaining')}
            </Text>
          </View>

          {/* Activity Minutes */}
          <View className="flex-1">
            <View className="mb-2 flex-row items-baseline gap-1">
              <Text className="text-5xl font-bold text-white">{activity.minutes}</Text>
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
              {t('common.goal')}: {activity.goal} {t('common.min')}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
