import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/theme/Button';
import { NutritionGoalsModal, NutritionGoals } from '../../components/NutritionGoalsModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EndWorkoutModal } from '../../components/EndWorkoutModal';
import { UserMenuModal } from '../../components/UserMenuModal';
import { SessionFeedbackModal } from '../../components/SessionFeedbackModal';
import { EditSetDetailsModal } from '../../components/EditSetDetailsModal';
import { LogSetPerformanceModal } from '../../components/LogSetPerformanceModal';
import { FoodDetailsModal } from '../../components/FoodDetailsModal';
import { AddFoodModal } from '../../components/AddFoodModal';
import { FoodSearchModal } from '../../components/FoodSearchModal';
import { NotificationsModal } from '../../components/NotificationsModal';
import { WorkoutOptionsModal } from '../../components/WorkoutOptionsModal';
import { ReplaceExerciseModal } from '../../components/ReplaceExerciseModal';
import { WorkoutHistoryModal } from '../../components/WorkoutHistoryModal';
import { DatePickerModal } from '../../components/DatePickerModal';
import { WorkoutSummaryCelebration } from '../../components/WorkoutSummaryCelebration';
import { EditPersonalInfoModal } from '../../components/EditPersonalInfoModal';
import { EditFitnessDetailsModal } from '../../components/EditFitnessDetailsModal';
import { MainSettingsModal } from '../../components/MainSettingsModal';
import { BasicSettingsModal } from '../../components/BasicSettingsModal';

export default function ModalsTestScreen() {
  // Nutrition Goals Modal
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);

  // Setting Modal
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isBasicSettingsVisible, setIsBasicSettingsVisible] = useState(false);

  // Edit Personal Info Modal
  const [isEditPersonalInfoVisible, setIsEditPersonalInfoVisible] = useState(false);

  // Edit Fitness Details Modal
  const [isEditFitnessDetailsVisible, setIsEditFitnessDetailsVisible] = useState(false);

  // Confirmation Modal
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [confirmationVariant, setConfirmationVariant] = useState<
    'default' | 'destructive' | 'primary'
  >('default');

  // End Workout Modal
  const [isEndWorkoutVisible, setIsEndWorkoutVisible] = useState(false);

  // User Menu Modal
  const [isUserMenuVisible, setIsUserMenuVisible] = useState(false);

  // Session Feedback Modal
  const [isSessionFeedbackVisible, setIsSessionFeedbackVisible] = useState(false);

  // Edit Set Details Modal
  const [isEditSetDetailsVisible, setIsEditSetDetailsVisible] = useState(false);

  // Log Set Performance Modal
  const [isLogSetPerformanceVisible, setIsLogSetPerformanceVisible] = useState(false);

  // Food Details Modal
  const [isFoodDetailsVisible, setIsFoodDetailsVisible] = useState(false);

  // Add Food Modal
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);

  // Food Search Modal
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);

  // Notifications Modal
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

  // Workout Options Modal
  const [isWorkoutOptionsVisible, setIsWorkoutOptionsVisible] = useState(false);

  // Replace Exercise Modal
  const [isReplaceExerciseVisible, setIsReplaceExerciseVisible] = useState(false);

  // Workout History Modal
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);

  // Date Picker Modal
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Workout Summary Celebration
  const [isWorkoutSummaryVisible, setIsWorkoutSummaryVisible] = useState(false);

  const handleSaveGoals = (goals: NutritionGoals) => {
    console.log('Goals saved:', goals);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="mb-2 text-3xl font-bold text-text-primary">Modals Test</Text>
            <Text className="text-base text-text-secondary">
              Test various modal components in the app
            </Text>
          </View>

          {/* Nutrition Goals Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Nutrition Goals Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A comprehensive modal for setting nutrition and body composition goals with
              interactive sliders.
            </Text>
            <Button
              label="Open Nutrition Goals Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNutritionGoalsVisible(true)}
            />
          </View>

          {/* Basic Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Basic Settings Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A comprehensive modal for setting nutrition and body composition goals with
              interactive sliders.
            </Text>
            <Button
              label="Open Basic Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsBasicSettingsVisible(true)}
            />
          </View>

          {/* Main Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Settings Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A modal for adjusting app settings including notifications, privacy, and account
              preferences.
            </Text>
            <Button
              label="Open Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsSettingsVisible(true)}
            />
          </View>

          {/* Edit Personal Info Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Edit Personal Info Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A modal for editing user profile information including avatar, name, email, DOB, and
              gender.
            </Text>
            <Button
              label="Open Edit Personal Info Modal"
              variant="accent"
              width="full"
              onPress={() => setIsEditPersonalInfoVisible(true)}
            />
          </View>

          {/* Edit Fitness Details Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Edit Fitness Details Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A modal for editing fitness-related details such as units, body stats, goals, and
              lifting experience.
            </Text>
            <Button
              label="Open Edit Fitness Details Modal"
              variant="accent"
              width="full"
              onPress={() => setIsEditFitnessDetailsVisible(true)}
            />
          </View>

          {/* Confirmation Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Confirmation Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A modal for confirming actions with different variants.
            </Text>
            <View className="flex-row gap-2">
              <Button
                label="Default Variant"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setConfirmationVariant('default');
                  setIsConfirmationVisible(true);
                }}
              />
              <Button
                label="Destructive"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setConfirmationVariant('destructive');
                  setIsConfirmationVisible(true);
                }}
              />
              <Button
                label="Primary"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setConfirmationVariant('primary');
                  setIsConfirmationVisible(true);
                }}
              />
            </View>
          </View>

          {/* End Workout Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">End Workout Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for ending a workout session with save/discard options.
            </Text>
            <Button
              label="Open End Workout Modal"
              variant="accent"
              width="full"
              onPress={() => setIsEndWorkoutVisible(true)}
            />
          </View>

          {/* User Menu Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">User Menu Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              User profile menu with navigation options.
            </Text>
            <Button
              label="Open User Menu Modal"
              variant="accent"
              width="full"
              onPress={() => setIsUserMenuVisible(true)}
            />
          </View>

          {/* Session Feedback Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Session Feedback Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for collecting workout session feedback with rating sliders.
            </Text>
            <Button
              label="Open Session Feedback Modal"
              variant="accent"
              width="full"
              onPress={() => setIsSessionFeedbackVisible(true)}
            />
          </View>

          {/* Edit Set Details Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Edit Set Details Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for editing workout set details (weight, reps, partials).
            </Text>
            <Button
              label="Open Edit Set Details Modal"
              variant="accent"
              width="full"
              onPress={() => setIsEditSetDetailsVisible(true)}
            />
          </View>

          {/* Log Set Performance Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Log Set Performance Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for logging set performance with RPE slider.
            </Text>
            <Button
              label="Open Log Set Performance Modal"
              variant="accent"
              width="full"
              onPress={() => setIsLogSetPerformanceVisible(true)}
            />
          </View>

          {/* Food Details Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Food Details Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal displaying detailed food information.
            </Text>
            <Button
              label="Open Food Details Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFoodDetailsVisible(true)}
            />
          </View>

          {/* Add Food Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Add Food Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding food to a meal with various options.
            </Text>
            <Button
              label="Open Add Food Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddFoodVisible(true)}
            />
          </View>

          {/* Food Search Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Food Search Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for searching and selecting food items.
            </Text>
            <Button
              label="Open Food Search Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFoodSearchVisible(true)}
            />
          </View>

          {/* Notifications Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Notifications Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal displaying app notifications.
            </Text>
            <Button
              label="Open Notifications Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNotificationsVisible(true)}
            />
          </View>

          {/* Workout Options Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Workout Options Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal with workout-related options and actions.
            </Text>
            <Button
              label="Open Workout Options Modal"
              variant="accent"
              width="full"
              onPress={() => setIsWorkoutOptionsVisible(true)}
            />
          </View>

          {/* Replace Exercise Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Replace Exercise Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for replacing an exercise in a workout.
            </Text>
            <Button
              label="Open Replace Exercise Modal"
              variant="accent"
              width="full"
              onPress={() => setIsReplaceExerciseVisible(true)}
            />
          </View>

          {/* Workout History Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Workout History Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal displaying workout history and statistics.
            </Text>
            <Button
              label="Open Workout History Modal"
              variant="accent"
              width="full"
              onPress={() => setIsWorkoutHistoryVisible(true)}
            />
          </View>

          {/* Date Picker Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Date Picker Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">Modal for selecting dates.</Text>
            <Button
              label="Open Date Picker Modal"
              variant="accent"
              width="full"
              onPress={() => setIsDatePickerVisible(true)}
            />
          </View>

          {/* Workout Summary Celebration */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Workout Summary Celebration
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Celebration screen shown after completing a workout with animated trophy, stats, and
              actions.
            </Text>
            <Button
              label="Open Workout Summary Celebration"
              variant="accent"
              width="full"
              onPress={() => setIsWorkoutSummaryVisible(true)}
            />
          </View>

          {/* Bottom spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>

      {/* Modals */}
      <MainSettingsModal visible={isSettingsVisible} onClose={() => setIsSettingsVisible(false)} />

      <BasicSettingsModal
        visible={isBasicSettingsVisible}
        onClose={() => setIsBasicSettingsVisible(false)}
      />

      <NutritionGoalsModal
        visible={isNutritionGoalsVisible}
        onClose={() => setIsNutritionGoalsVisible(false)}
        onSave={handleSaveGoals}
      />

      <EditPersonalInfoModal
        visible={isEditPersonalInfoVisible}
        onClose={() => setIsEditPersonalInfoVisible(false)}
        onSave={(data) => {
          console.log('Personal info saved:', data);
        }}
      />

      <EditFitnessDetailsModal
        visible={isEditFitnessDetailsVisible}
        onClose={() => setIsEditFitnessDetailsVisible(false)}
        onSave={(data) => {
          console.log('Fitness details saved:', data);
        }}
      />

      <ConfirmationModal
        visible={isConfirmationVisible}
        onClose={() => setIsConfirmationVisible(false)}
        onConfirm={() => {
          console.log('Confirmed!');
        }}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant={confirmationVariant}
      />

      <EndWorkoutModal
        visible={isEndWorkoutVisible}
        onClose={() => setIsEndWorkoutVisible(false)}
        onFinishAndSave={() => {
          console.log('Workout saved');
        }}
        onFinishAndDiscard={() => {
          console.log('Workout discarded');
        }}
      />

      <UserMenuModal
        visible={isUserMenuVisible}
        onClose={() => setIsUserMenuVisible(false)}
        user={{
          name: 'John Doe',
          avatar: { uri: 'https://via.placeholder.com/100' },
        }}
        onProfilePress={() => {
          console.log('Profile pressed');
          setIsUserMenuVisible(false);
        }}
        onSettingsPress={() => {
          console.log('Settings pressed');
          setIsUserMenuVisible(false);
        }}
        onProgressPress={() => {
          console.log('Progress pressed');
          setIsUserMenuVisible(false);
        }}
      />

      <SessionFeedbackModal
        visible={isSessionFeedbackVisible}
        onClose={() => setIsSessionFeedbackVisible(false)}
        onSubmit={(data) => {
          console.log('Feedback submitted:', data);
        }}
      />

      <EditSetDetailsModal
        visible={isEditSetDetailsVisible}
        onClose={() => setIsEditSetDetailsVisible(false)}
        onSave={(data) => {
          console.log('Set details saved:', data);
        }}
        setLabel="Set 2"
        initialWeight={24}
        initialReps={10}
        initialPartials={0}
      />

      <LogSetPerformanceModal
        visible={isLogSetPerformanceVisible}
        onClose={() => setIsLogSetPerformanceVisible(false)}
        exerciseName="Bench Press"
        setLabel="Set 2"
        weight={80}
        reps={8}
        partials={0}
        initialRpe={8}
        onConfirm={(data) => {
          console.log('Set logged:', data);
        }}
        onEditSetDetails={(data) => {
          console.log('Set details edited:', data);
        }}
      />

      <FoodDetailsModal
        visible={isFoodDetailsVisible}
        onClose={() => setIsFoodDetailsVisible(false)}
        food={{
          name: 'Grilled Chicken Breast',
          category: 'Lean Meat • High Protein',
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
        }}
      />

      <AddFoodModal
        visible={isAddFoodVisible}
        onClose={() => setIsAddFoodVisible(false)}
        onMealTypeSelect={(mealType) => {
          console.log('Meal type selected:', mealType);
        }}
        onAiCameraPress={() => {
          console.log('AI Camera pressed');
        }}
        onScanBarcodePress={() => {
          console.log('Barcode scan pressed');
        }}
        onSearchFoodPress={() => {
          console.log('Search food pressed');
        }}
        onCreateCustomFoodPress={() => {
          console.log('Create custom food pressed');
        }}
      />

      <FoodSearchModal
        visible={isFoodSearchVisible}
        onClose={() => setIsFoodSearchVisible(false)}
        mealType="breakfast"
        onCreatePress={() => {
          console.log('Create pressed');
        }}
        onBarcodeScanPress={() => {
          console.log('Barcode scan pressed');
        }}
        onFoodSelect={(food) => {
          console.log('Food selected:', food);
        }}
      />

      <NotificationsModal
        visible={isNotificationsVisible}
        onClose={() => setIsNotificationsVisible(false)}
        onClearAll={() => {
          console.log('Clear all notifications');
        }}
      />

      <WorkoutOptionsModal
        visible={isWorkoutOptionsVisible}
        onClose={() => setIsWorkoutOptionsVisible(false)}
        onPreviewWorkout={() => {
          console.log('Preview workout');
        }}
        onWorkoutSettings={() => {
          console.log('Workout settings');
        }}
        onEndWorkout={() => {
          console.log('End workout');
        }}
      />

      <ReplaceExerciseModal
        visible={isReplaceExerciseVisible}
        onClose={() => setIsReplaceExerciseVisible(false)}
        onReplace={(exercise) => {
          console.log('Exercise replaced:', exercise);
        }}
        currentExercise="Bench Press"
      />

      <WorkoutHistoryModal
        visible={isWorkoutHistoryVisible}
        onClose={() => setIsWorkoutHistoryVisible(false)}
        workoutName="Push Day"
        duration="1h 15m"
        totalVolume={12500}
        totalSets={18}
      />

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        onDateSelect={(date) => {
          console.log('Date selected:', date);
        }}
        selectedDate={new Date()}
      />

      <WorkoutSummaryCelebration
        visible={isWorkoutSummaryVisible}
        onClose={() => setIsWorkoutSummaryVisible(false)}
        onGoHome={() => {
          console.log('Go Home pressed');
          setIsWorkoutSummaryVisible(false);
        }}
        onShareSummary={() => {
          console.log('Share Summary pressed');
        }}
        totalTime="45m"
        volume="12,450 kg"
        personalRecords={2}
      />
    </SafeAreaView>
  );
}
