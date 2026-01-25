import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/theme/Button';
import { NutritionGoalsModal, NutritionGoals } from '../../components/modals/NutritionGoalsModal';
import { AddExerciseModal } from '../../components/modals/AddExerciseModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import { UserMenuModal } from '../../components/modals/UserMenuModal';
import { SessionFeedbackModal } from '../../components/modals/SessionFeedbackModal';
import { EditSetDetailsModal } from '../../components/modals/EditSetDetailsModal';
import { LogSetPerformanceModal } from '../../components/modals/LogSetPerformanceModal';
import { FoodDetailsModal } from '../../components/modals/FoodDetailsModal';
import { AddFoodModal } from '../../components/modals/AddFoodModal';
import { AddMealModal } from '../../components/modals/AddMealModal';
import { CreateMealModal } from '../../components/modals/CreateMealModal';
import { FoodSearchModal } from '../../components/modals/FoodSearchModal';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import { ReplaceExerciseModal } from '../../components/modals/ReplaceExerciseModal';
import { WorkoutSessionHistoryModal } from '../../components/modals/WorkoutSessionHistoryModal';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { CreateWorkoutOptionsModal } from '../../components/modals/CreateWorkoutOptionsModal';
import { EditPersonalInfoModal } from '../../components/modals/EditPersonalInfoModal';
import { EditFitnessDetailsModal } from '../../components/modals/EditFitnessDetailsModal';
import { MainSettingsModal } from '../../components/modals/MainSettingsModal';
import { BasicSettingsModal } from '../../components/modals/BasicSettingsModal';
import { AdvancedSettingsModal } from '../../components/modals/AdvancedSettingsModal';
import { AISettingsModal } from '../../components/modals/AISettingsModal';
import { FilterWorkoutsModal } from '../../components/modals/FilterWorkoutsModal';
import { ConnectGoogleAccountModal } from '../../components/modals/ConnectGoogleAccountModal';
import { AddFoodItemToMealModal } from '../../components/modals/AddFoodItemToMealModal';
import { CenteredModal } from '../../components/modals/CenteredModal';
import { CoachModal } from '../../components/modals/CoachModal';
import { FullScreenModal } from '../../components/modals/FullScreenModal';
import ExercisesModal from '../../components/modals/ExercisesModal';
import ViewExerciseModal from '../../components/modals/ViewExerciseModal';
import CreateExerciseModal from '../../components/modals/CreateExerciseModal';
import NewCustomFoodModal from '../../components/modals/NewCustomFoodModal';
import GoalsManagementModal from '../../components/modals/GoalsManagementModal';
import PastWorkoutsHistoryModal from '../../components/modals/PastWorkoutsHistoryModal';
import BodyMetricsHistoryModal from '../../components/modals/BodyMetricsHistoryModal';
import AddUserMetricEntryModal from '../../components/modals/AddUserMetricEntryModal';
import PastWorkoutDetailModal from '../../components/modals/PastWorkoutDetailModal';
import EditPastWorkoutDataModal from '../../components/modals/EditPastWorkoutDataModal';

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
  // Advanced Settings Modal
  const [isAdvancedSettingsVisible, setIsAdvancedSettingsVisible] = useState(false);
  // AI Settings Modal
  const [isAiSettingsVisible, setIsAiSettingsVisible] = useState(false);
  // Filter Workouts Modal
  const [isFilterWorkoutsVisible, setIsFilterWorkoutsVisible] = useState(false);

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

  // Add Meal Modal
  const [isAddMealVisible, setIsAddMealVisible] = useState(false);
  // Create Meal Modal
  const [isCreateMealVisible, setIsCreateMealVisible] = useState(false);

  // Food Search Modal
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);

  // Notifications Modal
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

  // Workout Options Modal
  const [isWorkoutOptionsVisible, setIsWorkoutOptionsVisible] = useState(false);

  // Create Workout Options Modal
  const [isCreateWorkoutOptionsVisible, setIsCreateWorkoutOptionsVisible] = useState(false);

  // Replace Exercise Modal
  const [isReplaceExerciseVisible, setIsReplaceExerciseVisible] = useState(false);

  // Workout History Modal
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);

  // Date Picker Modal
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Add Exercise Modal
  const [isAddExerciseVisible, setIsAddExerciseVisible] = useState(false);

  // Connect Google Account Modal
  const [isConnectGoogleAccountVisible, setIsConnectGoogleAccountVisible] = useState(false);

  // Add Food Item to Meal Modal
  const [isAddFoodItemToMealVisible, setIsAddFoodItemToMealVisible] = useState(false);

  // Centered Modal
  const [isCenteredModalVisible, setIsCenteredModalVisible] = useState(false);

  // Coach Modal
  const [isCoachModalVisible, setIsCoachModalVisible] = useState(false);

  // Full Screen Modal
  const [isFullScreenModalVisible, setIsFullScreenModalVisible] = useState(false);

  // Exercises Modal
  const [isExercisesModalVisible, setIsExercisesModalVisible] = useState(false);

  // View Exercise Modal
  const [isViewExerciseVisible, setIsViewExerciseVisible] = useState(false);

  // Create Exercise Modal
  const [isCreateExerciseVisible, setIsCreateExerciseVisible] = useState(false);
  // New Custom Food Modal
  const [isNewCustomFoodVisible, setIsNewCustomFoodVisible] = useState(false);
  // Goals Management Modal
  const [isGoalsManagementVisible, setIsGoalsManagementVisible] = useState(false);
  // Past Workouts History Modal
  const [isPastWorkoutsHistoryVisible, setIsPastWorkoutsHistoryVisible] = useState(false);
  // Body Metrics History Modal
  const [isBodyMetricsHistoryVisible, setIsBodyMetricsHistoryVisible] = useState(false);
  // Add User Metric Entry Modal
  const [isAddUserMetricEntryVisible, setIsAddUserMetricEntryVisible] = useState(false);
  // Past Workout Detail Modal
  const [isPastWorkoutDetailVisible, setIsPastWorkoutDetailVisible] = useState(false);
  // Edit Past Workout Data Modal
  const [isEditPastWorkoutDataVisible, setIsEditPastWorkoutDataVisible] = useState(false);

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

          {/* Add Exercise Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Add Exercise Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding an exercise to the current workout.
            </Text>
            <Button
              label="Open Add Exercise Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddExerciseVisible(true)}
            />
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

          {/* Advanced Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Advanced Settings Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Export, import, privacy, and danger zone.
            </Text>
            <Button
              label="Open Advanced Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAdvancedSettingsVisible(true)}
            />
          </View>

          {/* AI Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">AI Settings Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Configure AI integrations like Google Gemini and OpenAI.
            </Text>
            <Button
              label="Open AI Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAiSettingsVisible(true)}
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

          {/* Add Meal Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Add Meal Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for creating or generating meals and managing categories.
            </Text>
            <Button
              label="Open Add Meal Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddMealVisible(true)}
            />
          </View>
          {/* Create Meal Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Create Meal Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for creating a new meal with custom ingredients and macros.
            </Text>
            <Button
              label="Open Create Meal Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCreateMealVisible(true)}
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
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Connect Google Account Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for connecting Google account for AI features.
            </Text>
            {/* Connect Google Account Modal Button */}
            <Button
              label="Open Connect Google Account Modal"
              variant="accent"
              width="full"
              onPress={() => setIsConnectGoogleAccountVisible(true)}
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
            <View className="h-3" />
            <Button
              label="Open Create Workout Options"
              variant="outline"
              width="full"
              onPress={() => setIsCreateWorkoutOptionsVisible(true)}
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

          {/* Filter Workouts Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Filter Workouts Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Filter workouts by type, target muscles, and duration.
            </Text>
            <Button
              label="Open Filter Workouts Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFilterWorkoutsVisible(true)}
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

          {/* Add Food Item to Meal Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Add Food Item to Meal Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding a specific food item to a meal.
            </Text>
            <Button
              label="Open Add Food Item to Meal Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddFoodItemToMealVisible(true)}
            />
          </View>

          {/* Centered Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Centered Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A simple centered modal for displaying information.
            </Text>
            <Button
              label="Open Centered Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCenteredModalVisible(true)}
            />
          </View>

          {/* Coach Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Coach Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for displaying coaching tips and guidance.
            </Text>
            <Button
              label="Open Coach Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCoachModalVisible(true)}
            />
          </View>

          {/* Full Screen Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Full Screen Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A modal that takes up the full screen for immersive content.
            </Text>
            <Button
              label="Open Full Screen Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFullScreenModalVisible(true)}
            />
          </View>
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">New Custom Food Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for creating a new custom food item with detailed nutritional information.
            </Text>
            <Button
              label="Open New Custom Food Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNewCustomFoodVisible(true)}
            />
          </View>

          {/* Exercises Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Exercises Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal for browsing and selecting exercises from the exercise library
              with search and categorization.
            </Text>
            <Button
              label="Open Exercises Modal"
              variant="accent"
              width="full"
              onPress={() => setIsExercisesModalVisible(true)}
            />
          </View>

          {/* View Exercise Modal */}
          <View className="mb-6">
            <Button
              label="Open View Exercise Modal"
              variant="accent"
              width="full"
              onPress={() => setIsViewExerciseVisible(true)}
            />
          </View>

          {/* Create Exercise Modal */}
          <View className="mb-6">
            <Button
              label="Open Create Exercise Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCreateExerciseVisible(true)}
            />
          </View>

          {/* Goals Management Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Goals Management Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal for viewing and managing goals history and current goals.
            </Text>
            <Button
              label="Open Goals Management Modal"
              variant="accent"
              width="full"
              onPress={() => setIsGoalsManagementVisible(true)}
            />
          </View>

          {/* Past Workouts History Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Past Workouts History Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal displaying past workout history with search and filtering
              capabilities.
            </Text>
            <Button
              label="Open Past Workouts History Modal"
              variant="accent"
              width="full"
              onPress={() => setIsPastWorkoutsHistoryVisible(true)}
            />
          </View>

          {/* Body Metrics History Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Body Metrics History Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal for viewing body metrics history with charts and timeline entries.
            </Text>
            <Button
              label="Open Body Metrics History Modal"
              variant="accent"
              width="full"
              onPress={() => setIsBodyMetricsHistoryVisible(true)}
            />
          </View>

          {/* Add User Metric Entry Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Add User Metric Entry Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal for adding body metric entries (weight, body fat, height) with
              date, time, and mood selection.
            </Text>
            <Button
              label="Open Add User Metric Entry Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddUserMetricEntryVisible(true)}
            />
          </View>

          {/* Edit Past Workout Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Edit Past Workout Data Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Edit sets and details of a past workout session.
            </Text>
            <Button
              label="Open Edit Past Workout Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsEditPastWorkoutDataVisible(true)}
            />
          </View>

          {/* Past Workout Detail Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Past Workout Detail Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal displaying detailed workout information including summary stats,
              volume trends, and exercise breakdown with sets.
            </Text>
            <Button
              label="Open Past Workout Detail Modal"
              variant="accent"
              width="full"
              onPress={() => setIsPastWorkoutDetailVisible(true)}
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

      <AdvancedSettingsModal
        visible={isAdvancedSettingsVisible}
        onClose={() => setIsAdvancedSettingsVisible(false)}
        onExportPress={() => console.log('Export pressed')}
        onImportPress={() => console.log('Import pressed')}
        onAnonymousBugReportChange={(v) => console.log('Anonymous bug report:', v)}
        onAccountDeletionPress={() => console.log('Account deletion requested')}
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
        initialRepsInReserve={2}
      />

      <LogSetPerformanceModal
        visible={isLogSetPerformanceVisible}
        onClose={() => setIsLogSetPerformanceVisible(false)}
        exerciseName="Bench Press"
        setLabel="Set 2"
        weight={80}
        reps={8}
        partials={0}
        repsInReserve={2}
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

      <AddMealModal
        visible={isAddMealVisible}
        onClose={() => setIsAddMealVisible(false)}
        onCreateMeal={() => {
          setIsAddMealVisible(false);
          setTimeout(() => setIsCreateMealVisible(true), 300);
        }}
        onGenerateMealAI={() => console.log('Generate meal with AI pressed')}
        onManageCategories={() => console.log('Manage categories pressed')}
      />
      <CreateMealModal
        visible={isCreateMealVisible}
        onClose={() => setIsCreateMealVisible(false)}
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

      <CreateWorkoutOptionsModal
        visible={isCreateWorkoutOptionsVisible}
        onClose={() => setIsCreateWorkoutOptionsVisible(false)}
        onGenerateWithAi={() => {
          console.log('Generate with AI pressed');
          setIsCreateWorkoutOptionsVisible(false);
        }}
        onCreateEmptyTemplate={() => {
          console.log('Create empty template pressed');
          setIsCreateWorkoutOptionsVisible(false);
        }}
        onBrowseTemplates={() => {
          console.log('Browse templates pressed');
          setIsCreateWorkoutOptionsVisible(false);
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

      <WorkoutSessionHistoryModal
        visible={isWorkoutHistoryVisible}
        onClose={() => setIsWorkoutHistoryVisible(false)}
        workoutLog={null}
        sets={[]}
        exercises={[]}
        currentSetOrder={null}
      />

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        onDateSelect={(date) => {
          console.log('Date selected:', date);
        }}
        selectedDate={new Date()}
      />

      <AddExerciseModal
        visible={isAddExerciseVisible}
        onClose={() => setIsAddExerciseVisible(false)}
        onAddExercise={(data) => {
          console.log('Exercise added:', data);
          setIsAddExerciseVisible(false);
        }}
      />

      <AISettingsModal
        visible={isAiSettingsVisible}
        onClose={() => setIsAiSettingsVisible(false)}
        onConnectGoogleAccount={() => console.log('Connect Google pressed')}
        onGetOpenAiKeyPress={() => console.log('Get OpenAI Key pressed')}
        onOpenAiModelPress={() => console.log('OpenAI model pressed')}
      />

      <FilterWorkoutsModal
        visible={isFilterWorkoutsVisible}
        onClose={() => setIsFilterWorkoutsVisible(false)}
        onApplyFilters={(filters) => console.log('Applied filters:', filters)}
        onClearFilters={() => console.log('Cleared filters')}
      />

      <ConnectGoogleAccountModal
        visible={isConnectGoogleAccountVisible}
        onClose={() => setIsConnectGoogleAccountVisible(false)}
        onConnect={() => console.log('Google Account Connected')}
        onMaybeLater={() => console.log('Maybe Later pressed')}
      />

      <AddFoodItemToMealModal
        visible={isAddFoodItemToMealVisible}
        onClose={() => setIsAddFoodItemToMealVisible(false)}
        onAddFoods={(foods) => console.log('Food items added to meal:', foods)}
      />

      <CenteredModal
        visible={isCenteredModalVisible}
        onClose={() => setIsCenteredModalVisible(false)}
        title="Centered Modal"
        subtitle="This is a centered modal."
        footer={<Text>Footer content here</Text>}
      >
        <Text>Centered modal content goes here.</Text>
      </CenteredModal>

      <CoachModal visible={isCoachModalVisible} onClose={() => setIsCoachModalVisible(false)} />

      <FullScreenModal
        visible={isFullScreenModalVisible}
        onClose={() => setIsFullScreenModalVisible(false)}
        title="Full Screen Modal"
        subtitle="Subtitle for full screen modal"
        footer={<Text>Footer content for full screen modal</Text>}
      >
        <Text>Full screen modal content goes here.</Text>
      </FullScreenModal>

      <ExercisesModal
        visible={isExercisesModalVisible}
        onClose={() => setIsExercisesModalVisible(false)}
      />

      <ViewExerciseModal
        visible={isViewExerciseVisible}
        onClose={() => setIsViewExerciseVisible(false)}
      />

      <CreateExerciseModal
        visible={isCreateExerciseVisible}
        onClose={() => setIsCreateExerciseVisible(false)}
      />
      <NewCustomFoodModal
        visible={isNewCustomFoodVisible}
        onClose={() => setIsNewCustomFoodVisible(false)}
        onSave={(data) => console.log('New custom food saved:', data)}
      />

      <GoalsManagementModal
        visible={isGoalsManagementVisible}
        onClose={() => setIsGoalsManagementVisible(false)}
      />

      <PastWorkoutsHistoryModal
        visible={isPastWorkoutsHistoryVisible}
        onClose={() => setIsPastWorkoutsHistoryVisible(false)}
      />

      <BodyMetricsHistoryModal
        visible={isBodyMetricsHistoryVisible}
        onClose={() => setIsBodyMetricsHistoryVisible(false)}
      />

      <AddUserMetricEntryModal
        visible={isAddUserMetricEntryVisible}
        onClose={() => setIsAddUserMetricEntryVisible(false)}
      />

      <EditPastWorkoutDataModal
        visible={isEditPastWorkoutDataVisible}
        onClose={() => setIsEditPastWorkoutDataVisible(false)}
        onSave={() => {
          console.log('Edit past workout data saved');
          setIsEditPastWorkoutDataVisible(false);
        }}
        workoutId={'test-workout-id'}
        exerciseId={'test-exercise-id'}
        initialSets={[]}
      />

      <PastWorkoutDetailModal
        visible={isPastWorkoutDetailVisible}
        onClose={() => setIsPastWorkoutDetailVisible(false)}
      />
    </SafeAreaView>
  );
}
