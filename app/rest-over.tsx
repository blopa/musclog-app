import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/theme/Button';
import { WorkoutTimeTracker } from '../components/WorkoutTimeTracker';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { RestOverStatusIcon } from '../components/RestOverStatusIcon';
import { RestOverTitle } from '../components/RestOverTitle';
import { RestOverNextExercise } from '../components/RestOverNextExercise';

export default function RestOverScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
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
  }, [pulseAnim]);

  const handleStartNextSet = () => {
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
        <RestOverStatusIcon />
        <RestOverTitle />
        <RestOverNextExercise exercise={nextExercise} />
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
