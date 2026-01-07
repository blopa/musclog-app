import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SkipForward, Edit, Repeat } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { WorkoutOptionsModal } from '../components/WorkoutOptionsModal';
import { EndWorkoutModal } from '../components/EndWorkoutModal';
import { WorkoutTimeTracker } from '../components/WorkoutTimeTracker';
import { WorkoutStatCard } from '../components/WorkoutStatCard';
import { WorkoutActionButton } from '../components/WorkoutActionButton';
import { CompleteSetButton } from '../components/CompleteSetButton';
import { LogSetPerformanceModal } from '../components/LogSetPerformanceModal';
import { EditSetDetailsModal } from '../components/EditSetDetailsModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ReplaceExerciseModal, Exercise } from '../components/ReplaceExerciseModal';

export default function WorkoutSessionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [weight, setWeight] = useState(24);
  const [reps, setReps] = useState(10);
  const [partials, setPartials] = useState(0);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isEndWorkoutModalVisible, setIsEndWorkoutModalVisible] = useState(false);
  const [isLogSetModalVisible, setIsLogSetModalVisible] = useState(false);
  const [isEditSetModalVisible, setIsEditSetModalVisible] = useState(false);
  const [isSkipSetModalVisible, setIsSkipSetModalVisible] = useState(false);
  const [isReplaceExerciseModalVisible, setIsReplaceExerciseModalVisible] = useState(false);

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
              ...theme.colors.gradients.workoutSessionOverlay,
              theme.colors.background.primary,
            ]}
            locations={[0, 0.2, 0.5, 1]}
            style={{ flex: 1 }}
          />
        </ImageBackground>

        {/* Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <WorkoutTimeTracker
            onClose={() => setIsEndWorkoutModalVisible(true)}
            onOptionsPress={() => setIsOptionsModalVisible(true)}
            initialTime={{ hours: 0, minutes: 45, seconds: 12 }}
          />

          {/* Exercise Info */}
          <View className="mt-48 px-6">
            <Text className="mb-3 text-5xl font-bold text-text-primary">{exerciseData.name}</Text>
            <View className="mb-2 flex-row items-center gap-3">
              <View className="rounded-full bg-accent-primary px-4 py-1.5">
                <Text className="text-text-black text-sm font-bold">
                  {t('workoutSession.setOf', {
                    current: exerciseData.set,
                    total: exerciseData.totalSets,
                  })}
                </Text>
              </View>
              <Text className="text-lg text-text-secondary">{exerciseData.category}</Text>
            </View>
          </View>

          {/* Stats Cards */}
          <View className="mt-8 flex-row gap-3 px-6">
            <WorkoutStatCard
              title={t('workoutSession.weight')}
              value={weight}
              unit={t('workoutSession.kg')}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.reps')}
              value={reps}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
            <WorkoutStatCard
              title={t('workoutSession.partials')}
              value={partials === 0 ? '-' : partials}
              onPress={() => {
                setIsEditSetModalVisible(true);
              }}
            />
          </View>

          {/* Previous & History */}
          <View className="mt-6 flex-row items-center justify-between px-6">
            <Text className="text-text-secondary">
              {t('workoutSession.previous')}:{' '}
              <Text className="text-text-primary">
                {exerciseData.previousSet.weight}
                {t('workoutSession.kg')} × {exerciseData.previousSet.reps}{' '}
                {t('workoutSession.reps')}
              </Text>
            </Text>
            <Pressable onPress={() => router.push('/workout-history')}>
              <Text className="font-semibold text-accent-primary">
                {t('workoutSession.history')}
              </Text>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View className="mt-8 px-6 pb-32">
            <View className="mb-6 flex-row gap-6">
              <WorkoutActionButton
                icon={SkipForward}
                label={t('workoutSession.skip')}
                onPress={() => {
                  setIsSkipSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Edit}
                label={t('workoutSession.edit')}
                onPress={() => {
                  setIsEditSetModalVisible(true);
                }}
              />
              <WorkoutActionButton
                icon={Repeat}
                label={t('workoutSession.replace')}
                onPress={() => {
                  setIsReplaceExerciseModalVisible(true);
                }}
              />
            </View>

            {/* Complete Button */}
            <CompleteSetButton
              onPress={() => {
                setIsLogSetModalVisible(true);
              }}
            />
          </View>
        </ScrollView>
      </View>

      {/* Workout Options Modal */}
      <WorkoutOptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        onPreviewWorkout={() => router.push('/workout-preview')}
        onWorkoutSettings={() => router.push('/workout-settings')}
        onEndWorkout={() => {
          setIsOptionsModalVisible(false);
          setIsEndWorkoutModalVisible(true);
        }}
      />

      {/* End Workout Confirmation Modal */}
      <EndWorkoutModal
        visible={isEndWorkoutModalVisible}
        onClose={() => setIsEndWorkoutModalVisible(false)}
        onFinishAndSave={() => {
          // Handle save workout logic
          router.back();
        }}
        onFinishAndDiscard={() => {
          // Handle discard workout logic
          router.back();
        }}
      />

      {/* Log Set Performance Modal */}
      <LogSetPerformanceModal
        visible={isLogSetModalVisible}
        onClose={() => setIsLogSetModalVisible(false)}
        exerciseName={exerciseData.name}
        setLabel={t('workoutSession.setOf', {
          current: exerciseData.set,
          total: exerciseData.totalSets,
        })}
        weight={weight}
        reps={reps}
        partials="-"
        initialRpe={8}
        onConfirm={(data) => {
          // Handle log set with RPE
          console.log('Set logged with RPE:', data.rpe);
          // You can update state, save to database, etc.
        }}
        onEditSetDetails={(data) => {
          // Update weight and reps from edit modal
          setWeight(data.weight);
          setReps(data.reps);
          setPartials(data.partials);
        }}
      />

      {/* Edit Set Details Modal */}
      <EditSetDetailsModal
        visible={isEditSetModalVisible}
        onClose={() => setIsEditSetModalVisible(false)}
        onSave={(data) => {
          setWeight(data.weight);
          setReps(data.reps);
          setPartials(data.partials);
          setIsEditSetModalVisible(false);
        }}
        setLabel={t('workoutSession.setOf', {
          current: exerciseData.set,
          total: exerciseData.totalSets,
        })}
        initialWeight={weight}
        initialReps={reps}
        initialPartials={partials}
      />

      {/* Skip Set Confirmation Modal */}
      <ConfirmationModal
        visible={isSkipSetModalVisible}
        onClose={() => setIsSkipSetModalVisible(false)}
        onConfirm={() => {
          // Handle skip set logic
          console.log('Set skipped');
        }}
        title={t('workoutSession.skipSet.title')}
        message={t('workoutSession.skipSet.message')}
        confirmLabel={t('workoutSession.skipSet.confirm')}
        cancelLabel={t('workoutSession.skipSet.cancel')}
        variant="destructive"
      />

      {/* Replace Exercise Modal */}
      <ReplaceExerciseModal
        visible={isReplaceExerciseModalVisible}
        onClose={() => setIsReplaceExerciseModalVisible(false)}
        onReplace={(exercise: Exercise) => {
          // Handle replace exercise logic
          console.log('Exercise replaced:', exercise);
          // You can update the exercise data here
        }}
        currentExercise={exerciseData.name}
      />
    </SafeAreaView>
  );
}
