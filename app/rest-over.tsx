import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Platform } from 'react-native';
import { Dumbbell, AlertCircle, Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/theme/Button';
import { GradientText } from '../components/GradientText';
import { WorkoutTimeTracker } from '../components/WorkoutTimeTracker';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';

export default function RestOverScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);

  useEffect(() => {
    // Pulse animation for the glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim, glowAnim]);

  const handleStartNextSet = () => {
    // Navigate back to workout session or start next set
    router.back();
  };

  const handleEndWorkout = () => {
    setIsOptionsModalVisible(false);
    setIsEndWorkoutModalVisible(true);
  };

  // Default values - these would come from props or route params in real app
  const nextExercise = {
    name: 'Incline Dumbbell Fly',
    weight: '20kg',
    reps: 12,
    set: 2,
    totalSets: 4,
  };

  // Web-specific styles for proper viewport positioning
  const webScreenStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
        } as any)
      : {};

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']} style={webScreenStyle}>
      {/* Background Glow Effects */}
      <Animated.View
        className="absolute right-[-10%] top-[-20%] h-[50%] w-[80%] rounded-full blur-3xl"
        style={{
          backgroundColor: 'rgba(79, 70, 229, 0.3)',
          opacity: pulseAnim,
        }}
      />
      <Animated.View
        className="absolute bottom-[-10%] left-[-20%] h-[50%] w-[90%] rounded-full blur-3xl"
        style={{
          backgroundColor: 'rgba(41, 224, 142, 0.2)',
        }}
      />

      {/* Header */}
      <View className="relative z-20">
        <WorkoutTimeTracker
          onClose={() => router.back()}
          onOptionsPress={() => setIsOptionsModalVisible(true)}
          initialTime={{ hours: 0, minutes: 45, seconds: 20 }}
        />
      </View>

      {/* Main Content */}
      <View className="z-10 w-full flex-1 items-center justify-center gap-8 px-6">
        {/* Icon with Glow */}
        <View className="relative mb-4 items-center justify-center">
          <Animated.View
            className="absolute inset-0 rounded-full"
            style={{
              backgroundColor: 'rgba(41, 224, 142, 0.2)',
              transform: [{ scale: glowAnim }],
            }}
          />
          <View
            className="relative z-10 h-24 w-24 items-center justify-center rounded-full border"
            style={{
              backgroundColor: theme.colors.background.cardDark,
              borderColor: 'rgba(41, 224, 142, 0.2)',
              shadowColor: theme.colors.accent.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}>
            <Dumbbell size={48} color={theme.colors.accent.primary} strokeWidth={1.5} />
          </View>
          {/* Red Alert Badge */}
          <View
            className="absolute -right-1 -top-1 z-20 h-8 w-8 items-center justify-center rounded-full border-4"
            style={{
              backgroundColor: theme.colors.status.error,
              borderColor: theme.colors.background.primary,
            }}>
            <AlertCircle size={16} color={theme.colors.text.white} strokeWidth={3} />
          </View>
        </View>

        {/* Title and Subtitle */}
        <View className="mx-auto max-w-xs gap-3">
          <View className="flex-row flex-wrap items-center justify-center">
            <Text className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Rest time is{' '}
            </Text>
            <GradientText
              colors={
                [theme.colors.accent.primary, '#818cf8'] as readonly [string, string, ...string[]]
              }
              style={{
                fontSize: 36,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}>
              over!
            </GradientText>
          </View>
          <Text className="text-lg font-medium text-white/70">Time to go! Next set is up.</Text>
        </View>

        {/* Up Next Card */}
        <View
          className="mt-4 w-full max-w-sm rounded-xl border p-5"
          style={{
            backgroundColor: 'rgba(25, 43, 35, 0.5)',
            borderColor: theme.colors.background.white5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}>
          <View className="mb-3 flex-row items-center gap-3">
            <View
              className="h-10 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.accent.primary }}
            />
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase tracking-widest text-accent-primary opacity-80">
                Up Next
              </Text>
              <Text className="text-xl font-bold text-white">{nextExercise.name}</Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between border-t border-white/10 pt-3">
            <View className="flex-col items-start">
              <Text className="text-[10px] font-bold uppercase text-white/40">Weight</Text>
              <Text className="text-base font-bold text-white">{nextExercise.weight}</Text>
            </View>
            <View className="flex-col items-start">
              <Text className="text-[10px] font-bold uppercase text-white/40">Reps</Text>
              <Text className="text-base font-bold text-white">{nextExercise.reps}</Text>
            </View>
            <View className="flex-col items-start">
              <Text className="text-[10px] font-bold uppercase text-white/40">Set</Text>
              <Text className="text-base font-bold text-white">
                {nextExercise.set}
                <Text className="font-normal text-white/40">/{nextExercise.totalSets}</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View className="z-10 w-full px-6 pb-12">
        <Button
          label="Start Next Set"
          icon={Play}
          variant="accent"
          size="lg"
          width="full"
          onPress={handleStartNextSet}
        />
      </View>

      {/* Workout Options Modal */}
      <WorkoutOptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        onPreviewWorkout={() => router.push('/workout-preview' as any)}
        onWorkoutSettings={() => router.push('/workout-settings' as any)}
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
