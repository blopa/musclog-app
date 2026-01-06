import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronDown,
  MoreVertical,
  SkipForward,
  CheckCircle,
  Dumbbell,
  Repeat,
  ChevronRight,
  Activity,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';

export default function RestTimerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [restTime, setRestTime] = useState(90); // 1:30 in seconds
  const [totalDuration, setTotalDuration] = useState({ hours: 0, minutes: 45, seconds: 12 });
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

  // Total duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalDuration((prev) => {
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

  // Spinning loader animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

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
      <View className="relative z-20 flex-row items-center justify-between px-4 pb-4 pt-4">
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-white/5 active:bg-white/10"
          onPress={() => router.back()}>
          <ChevronDown size={theme.iconSize.md} color={theme.colors.text.primary} />
        </Pressable>

        <View className="items-center">
          <Text className="text-xs font-semibold uppercase tracking-widest text-accent-primary opacity-80">
            {t('restTimer.totalDuration')}
          </Text>
          <Text className="text-lg font-bold tabular-nums tracking-tight text-text-primary">
            {formatTime(totalDuration.hours)}:{formatTime(totalDuration.minutes)}:
            {formatTime(totalDuration.seconds)}
          </Text>
        </View>

        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full bg-white/5 active:bg-white/10"
          onPress={() => setIsOptionsModalVisible(true)}>
          <MoreVertical size={theme.iconSize.md} color={theme.colors.text.primary} />
        </Pressable>
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
                style={{
                  shadowColor: theme.colors.accent.secondary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 15,
                }}
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
            <Text className="text-sm text-text-secondary">
              {t('restTimer.done')}:{' '}
              <Text className="font-medium text-text-primary">{exerciseData.completed.name}</Text>
            </Text>
          </View>
          <Text className="font-medium text-text-secondary">
            {exerciseData.completed.weight}kg <Text className="text-text-tertiary">×</Text>{' '}
            {exerciseData.completed.reps} {t('restTimer.reps')}
          </Text>
        </View>

        {/* Next Exercise Card */}
        <Pressable className="relative overflow-hidden rounded-xl active:opacity-90">
          {/* Gradient border effect */}
          <View className="absolute -inset-[1px] overflow-hidden rounded-[13px]">
            <LinearGradient
              colors={[theme.colors.status.purple, theme.colors.accent.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, opacity: 0.4 }}
            />
          </View>

          <View className="relative flex-row items-center gap-4 rounded-xl bg-bg-card p-4">
            {/* Exercise Image */}
            <View className="relative h-20 w-20 overflow-hidden rounded-lg bg-bg-overlay">
              <Image
                source={exerciseData.next.image}
                className="h-full w-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
            </View>

            {/* Exercise Info */}
            <View className="min-w-0 flex-1 gap-1">
              <View className="w-fit rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                  {t('restTimer.upNext')}
                </Text>
              </View>

              <Text className="mt-1 truncate text-lg font-bold text-text-primary">
                {exerciseData.next.name}
              </Text>

              <View className="mt-1 flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <Dumbbell size={16} color={theme.colors.text.secondary} />
                  <Text className="text-sm text-text-secondary">{exerciseData.next.weight}kg</Text>
                </View>
                <View className="h-1 w-1 rounded-full bg-white/20" />
                <View className="flex-row items-center gap-1">
                  <Repeat size={16} color={theme.colors.text.secondary} />
                  <Text className="text-sm text-text-secondary">
                    {exerciseData.next.reps} {t('restTimer.reps')}
                  </Text>
                </View>
                <View className="h-1 w-1 rounded-full bg-white/20" />
                <Text className="text-sm font-medium text-white/80">
                  {exerciseData.next.sets} {t('restTimer.sets')}
                </Text>
              </View>
            </View>

            <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          </View>
        </Pressable>
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
