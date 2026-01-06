import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { X, MoreVertical, SkipForward, Edit, Repeat, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

export default function WorkoutSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [weight, setWeight] = useState(24);
  const [reps, setReps] = useState(10);
  const [time, setTime] = useState({ hours: 0, minutes: 45, seconds: 12 });

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTime((prev) => {
        let newSeconds = prev.seconds + 1;
        let newMinutes = prev.minutes;
        let newHours = prev.hours;

        if (newSeconds >= 60) {
          newSeconds = 0;
          newMinutes += 1;
        }
        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours += 1;
        }

        return { hours: newHours, minutes: newMinutes, seconds: newSeconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (value: number) => String(value).padStart(2, '0');

  const exerciseData = {
    name: 'Incline Dumbbell Press',
    category: 'Chest • Strength',
    set: 2,
    totalSets: 4,
    image: require('../assets/icon.png'), // Replace with actual exercise image
    previousSet: {
      weight: 22,
      reps: 12,
    },
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <StatusBar style="light" />
      <View className="flex-1">
        {/* Hero Image Background */}
        <ImageBackground
          source={exerciseData.image}
          className="absolute inset-0"
          style={{ height: 520 }}
          resizeMode="cover">
          <LinearGradient
            colors={[
              'rgba(10, 31, 26, 0.6)',
              'rgba(10, 31, 26, 0.7)',
              theme.colors.background.primary,
            ]}
            locations={[0, 0.5, 1]}
            style={{ flex: 1 }}
          />
        </ImageBackground>

        {/* Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center justify-between p-4">
            <Pressable
              className="h-12 w-12 items-center justify-center"
              onPress={() => router.back()}>
              <X size={theme.iconSize.xl} color={theme.colors.text.primary} />
            </Pressable>
            <View className="items-center">
              <Text className="text-5xl font-bold tracking-tight text-text-primary">
                {formatTime(time.hours)}:{formatTime(time.minutes)}:{formatTime(time.seconds)}
              </Text>
              <Text className="text-sm font-semibold tracking-wider mt-1 text-accent-primary">
                {t('workoutSession.totalTime')}
              </Text>
            </View>
            <Pressable className="h-12 w-12 items-center justify-center">
              <MoreVertical size={theme.iconSize.lg} color={theme.colors.text.primary} />
            </Pressable>
          </View>

          {/* Exercise Info */}
          <View className="px-6 mt-48">
            <Text className="text-5xl font-bold mb-3 text-text-primary">{exerciseData.name}</Text>
            <View className="flex-row items-center gap-3 mb-2">
              <View className="bg-accent-primary px-4 py-1.5 rounded-full">
                <Text className="text-sm font-bold text-text-black">
                  {t('workoutSession.setOf', { current: exerciseData.set, total: exerciseData.totalSets })}
                </Text>
              </View>
              <Text className="text-lg text-text-secondary">{exerciseData.category}</Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View className="px-6 mt-8 flex-row gap-3">
            <Pressable className="flex-1 bg-bg-overlay/80 border border-border-accent rounded-3xl p-6 items-center">
              <Text className="text-text-secondary text-sm font-medium mb-2">
                {t('workoutSession.weight')}
              </Text>
              <Text className="text-5xl font-bold text-text-primary">{weight}</Text>
              <Text className="text-text-secondary text-lg mt-1">{t('workoutSession.kg')}</Text>
            </Pressable>

            <Pressable className="flex-1 bg-bg-overlay/80 border border-border-accent rounded-3xl p-6 items-center">
              <Text className="text-text-secondary text-sm font-medium mb-2">
                {t('workoutSession.reps')}
              </Text>
              <Text className="text-5xl font-bold text-text-primary">{reps}</Text>
            </Pressable>

            <Pressable className="flex-1 bg-bg-overlay/80 border border-border-accent rounded-3xl p-6 items-center">
              <Text className="text-text-secondary text-sm font-medium mb-2">
                {t('workoutSession.partials')}
              </Text>
              <Text className="text-5xl font-bold text-text-tertiary">-</Text>
            </Pressable>
          </View>

          {/* Previous & History */}
          <View className="px-6 mt-6 flex-row items-center justify-between">
            <Text className="text-text-secondary">
              {t('workoutSession.previous')}:{' '}
              <Text className="text-text-primary">
                {exerciseData.previousSet.weight}
                {t('workoutSession.kg')} × {exerciseData.previousSet.reps} {t('workoutSession.reps')}
              </Text>
            </Text>
            <Pressable onPress={() => router.push('/workout-history')}>
              <Text className="text-accent-primary font-semibold">{t('workoutSession.history')}</Text>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View className="px-6 mt-8 pb-32">
            <View className="flex-row gap-6 mb-6">
              <Pressable className="flex-1 items-center gap-2">
                <View className="h-20 w-20 bg-bg-overlay/80 border border-border-accent rounded-full items-center justify-center">
                  <SkipForward size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                </View>
                <Text className="text-text-secondary text-sm font-medium">
                  {t('workoutSession.skip')}
                </Text>
              </Pressable>

              <Pressable className="flex-1 items-center gap-2">
                <View className="h-20 w-20 bg-bg-overlay/80 border border-border-accent rounded-full items-center justify-center">
                  <Edit size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                </View>
                <Text className="text-text-secondary text-sm font-medium">
                  {t('workoutSession.edit')}
                </Text>
              </Pressable>

              <Pressable className="flex-1 items-center gap-2">
                <View className="h-20 w-20 bg-bg-overlay/80 border border-border-accent rounded-full items-center justify-center">
                  <Repeat size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                </View>
                <Text className="text-text-secondary text-sm font-medium">
                  {t('workoutSession.replace')}
                </Text>
              </Pressable>
            </View>

            {/* Complete Button */}
            <Pressable className="w-full bg-accent-primary py-5 rounded-3xl flex-row items-center justify-center gap-3">
              <CheckCircle size={theme.iconSize.lg} color={theme.colors.text.black} />
              <Text className="text-text-black font-bold text-xl">
                {t('workoutSession.completeSet')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

