import { useState, useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { WorkoutTimeTracker } from '../components/WorkoutTimeTracker';
import { UpNextExerciseCard } from '../components/UpNextExerciseCard';
import { RestTimerControls } from '../components/RestTimerControls';
import { RestTimer } from '../components/RestTimer';

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
        <RestTimer restTime={restTime} rotationAnim={rotationAnim} />

        {/* Controls */}
        <RestTimerControls
          onMinus5s={handleMinus5s}
          onSkipRest={handleSkipRest}
          onPlus5s={handlePlus5s}
        />
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
