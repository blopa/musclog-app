import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  SkipForward,
  CheckCircle,
  Activity,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { WorkoutTimeTracker } from '../components/WorkoutTimeTracker';
import { UpNextExerciseCard } from '../components/UpNextExerciseCard';

export default function RestTimerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [restTime, setRestTime] = useState(90); // 1:30 in seconds
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;

  // Rest timer countdown
  useEffect(() => {
    if (restTime > 0) {
      const interval = setInterval(() => {
        setRestTime((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [restTime]);

  // Spinning loader animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [rotationAnim]);

  const formatTime = (value: number) => String(value).padStart(2, '0');
  const formatRestTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${formatTime(mins)}:${formatTime(secs)}`;
  };

  // Calculate progress for circular ring (0 to 1)
  const totalRestTime = 90; // Initial rest time
  const progress = 1 - restTime / totalRestTime;
  const circumference = 2 * Math.PI * 46; // radius = 46
  const strokeDashoffset = circumference * (1 - progress);

  const handleMinus5s = () => {
    setRestTime((prev) => Math.max(0, prev - 5));
  };

  const handlePlus5s = () => {
    setRestTime((prev) => prev + 5);
  };

  const handleSkipRest = () => {
    setRestTime(0);
    // Navigate back to workout session
    router.back();
  };

  const handleEndWorkout = () => {
    setIsOptionsModalVisible(false);
    setIsEndWorkoutModalVisible(true);
  };

  const exerciseData = {
    completed: {
      name: 'Bench Press',
      weight: 80,
      reps: 8,
    },
    next: {
      name: 'Incline Dumbbell Fly',
      weight: 20,
      reps: 12,
      sets: 4,
      image: require('../assets/icon.png'),
    },
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <StatusBar style="light" />

      {/* Ambient Background Gradients */}
      <View
        className="absolute right-[-40%] top-[-20%] h-[20%] w-[110%] overflow-hidden rounded-full"
        style={{
          shadowColor: theme.colors.status.purple,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 200,
          elevation: 0,
          backgroundColor: '#3d3162',
        }}></View>
      <View
        className="absolute bottom-[-40%] left-[-20%] h-[50%] w-[110%] overflow-hidden rounded-full"
        style={{
          shadowColor: theme.colors.accent.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 200,
          elevation: 0,
          backgroundColor: '#125630',
        }}></View>

      {/* Header */}
      <View className="relative z-20">
        <WorkoutTimeTracker
          onClose={() => router.back()}
          onOptionsPress={() => setIsOptionsModalVisible(true)}
          initialTime={{ hours: 0, minutes: 45, seconds: 12 }}
        />
      </View>

      {/* Main Content */}
      <View className="z-10 flex-1 items-center justify-center gap-10 px-6">
        {/* Timer */}
        <View className="relative aspect-square w-full max-w-[400px] items-center justify-center">
          {/* Background glow */}
          <View className="absolute inset-4 overflow-hidden rounded-full">
            <LinearGradient
              colors={[`${theme.colors.accent.primary}33`, `${theme.colors.status.purple}33`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: 9999 }}
            />
          </View>

          {/* SVG Circular Progress */}
          <View className="h-full w-full items-center justify-center">
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 100 100"
              style={{ transform: [{ rotate: '-90deg' }] }}>
              {/* Background circle */}
              <Circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={theme.colors.border.accent}
                strokeOpacity={0.5}
                strokeWidth="4"
              />
              {/* Progress circle */}
              <Circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke={theme.colors.accent.secondary}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                opacity={1}
              />
            </Svg>
          </View>

          {/* Timer Text */}
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-[80px] font-bold tabular-nums leading-none tracking-tighter text-text-primary">
              {formatRestTime(restTime)}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Activity size={20} color={theme.colors.text.secondary} />
              </Animated.View>
              <Text className="text-lg font-medium tracking-wide text-text-secondary">
                {t('restTimer.resting')}
              </Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View className="w-full max-w-sm flex-row items-center justify-center gap-4">
          <Pressable
            className="active:bg-bg-card-elevated h-12 min-w-[72px] items-center justify-center rounded-xl border border-white/5 bg-bg-overlay/80 active:scale-95"
            onPress={handleMinus5s}>
            <Text className="text-sm font-bold text-text-primary">{t('restTimer.minus5s')}</Text>
          </Pressable>

          <Pressable
            className="h-14 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-accent-primary active:scale-95 active:opacity-90"
            onPress={handleSkipRest}>
            <SkipForward size={theme.iconSize.md} color={theme.colors.text.black} />
            <Text className="text-text-black font-bold uppercase tracking-wide">
              {t('restTimer.skipRest')}
            </Text>
          </Pressable>

          <Pressable
            className="active:bg-bg-card-elevated h-12 min-w-[72px] items-center justify-center rounded-xl border border-white/5 bg-bg-overlay/80 active:scale-95"
            onPress={handlePlus5s}>
            <Text className="text-sm font-bold text-text-primary">{t('restTimer.plus5s')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View className="z-10 mx-auto w-full max-w-lg gap-4 px-4 pb-8">
        {/* Completed Exercise */}
        <View className="flex-row items-center justify-between px-2">
          <View className="flex-row items-center gap-2">
            <CheckCircle size={18} color={theme.colors.accent.primary} />
            <Text className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              {t('restTimer.done')}:{' '}
              <Text className="font-medium text-white">{exerciseData.completed.name}</Text>
            </Text>
          </View>
          <Text className="font-medium" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            {exerciseData.completed.weight}kg{' '}
            <Text style={{ color: 'rgba(255, 255, 255, 0.3)' }}>×</Text>{' '}
            {exerciseData.completed.reps} {t('restTimer.reps')}
          </Text>
        </View>

        {/* Next Exercise Card */}
        <UpNextExerciseCard
          exercise={exerciseData.next}
          onPress={() => {
            // Handle navigation to exercise details or start exercise
          }}
        />
      </View>

      {/* Workout Options Modal */}
      <WorkoutOptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        onPreviewWorkout={() => router.push('/workout-preview')}
        onWorkoutSettings={() => router.push('/workout-settings')}
        onEndWorkout={handleEndWorkout}
      />

      {/* End Workout Confirmation Modal */}
      <EndWorkoutModal
        visible={isEndWorkoutModalVisible}
        onClose={() => setIsEndWorkoutModalVisible(false)}
        onFinishAndSave={() => {
          router.back();
        }}
        onFinishAndDiscard={() => {
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
