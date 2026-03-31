import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddExerciseModal } from '../../components/modals/AddExerciseModal';
import { AddExerciseToSessionModal } from '../../components/modals/AddExerciseToSessionModal';
import { AddFoodItemToMealModal } from '../../components/modals/AddFoodItemToMealModal';
import { AddFoodModal } from '../../components/modals/AddFoodModal';
import { AddMealModal } from '../../components/modals/AddMealModal';
import AddUserMetricEntryModal from '../../components/modals/AddUserMetricEntryModal';
import { AdvancedSettingsModal } from '../../components/modals/AdvancedSettingsModal';
import { AiCustomPromptEditModal } from '../../components/modals/AiCustomPromptEditModal';
import { AiCustomPromptsModal } from '../../components/modals/AiCustomPromptsModal';
import { AINotConfiguredModal } from '../../components/modals/AINotConfiguredModal';
import { AINutritionTrackingContextModal } from '../../components/modals/AINutritionTrackingContextModal';
import { AISettingsModal } from '../../components/modals/AISettingsModal';
import { BarcodeCameraModal } from '../../components/modals/BarcodeCameraModal';
import { BasicSettingsModal } from '../../components/modals/BasicSettingsModal';
import BodyMetricsHistoryModal from '../../components/modals/BodyMetricsHistoryModal';
import { BrowseTemplatesModal } from '../../components/modals/BrowseTemplatesModal';
import { CenteredModal } from '../../components/modals/CenteredModal';
import { CoachModal } from '../../components/modals/CoachModal';
import { ConfirmationModal } from '../../components/modals/ConfirmationModal';
import { ConnectGoogleAccountModal } from '../../components/modals/ConnectGoogleAccountModal';
import CreateCustomFoodModal from '../../components/modals/CreateCustomFoodModal';
import CreateExerciseModal from '../../components/modals/CreateExerciseModal';
import { CreateFoodPortionModal } from '../../components/modals/CreateFoodPortionModal';
import { CreateMealModal } from '../../components/modals/CreateMealModal';
import CreateWorkoutModal from '../../components/modals/CreateWorkoutModal';
import { CreateWorkoutOptionsModal } from '../../components/modals/CreateWorkoutOptionsModal';
import { CycleLogModal } from '../../components/modals/CycleLogModal';
import { CycleSettingsModal } from '../../components/modals/CycleSettingsModal';
import {
  ExerciseDataModal,
  FoodDataModal,
  FoodPortionDataModal,
  MealDataModal,
  NutritionGoalDataModal,
  NutritionLogModal,
  UserMetricDataModal,
  WorkoutLogDataModal,
  WorkoutTemplateDataModal,
} from '../../components/modals/DataLogModal';
import { DatePickerInput } from '../../components/modals/DatePickerInput';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { EditFitnessDetailsModal } from '../../components/modals/EditFitnessDetailsModal';
import EditPastWorkoutDataModal from '../../components/modals/EditPastWorkoutDataModal';
import { EditPersonalInfoModal } from '../../components/modals/EditPersonalInfoModal';
import { EditSetDetailsModal } from '../../components/modals/EditSetDetailsModal';
import { EndWorkoutModal } from '../../components/modals/EndWorkoutModal';
import ExercisesModal from '../../components/modals/ExercisesModal';
import { FilterWorkoutsModal } from '../../components/modals/FilterWorkoutsModal';
import { FoodMealDetailsModal } from '../../components/modals/FoodMealDetailsModal';
import { FoodNotFoundModal } from '../../components/modals/FoodNotFoundModal';
import { FoodSearchModal } from '../../components/modals/FoodSearchModal';
import { FreeSessionExerciseCompleteModal } from '../../components/modals/FreeSessionExerciseCompleteModal';
import { FullScreenModal } from '../../components/modals/FullScreenModal';
import { GenericEditModal } from '../../components/modals/GenericEditModal';
import GoalsManagementModal from '../../components/modals/GoalsManagementModal';
import { ImportNutritionModal } from '../../components/modals/ImportNutritionModal';
import { ImportWorkoutsModal } from '../../components/modals/ImportWorkoutsModal';
import { LogMealModal } from '../../components/modals/LogMealModal';
import { LogSetPerformanceModal } from '../../components/modals/LogSetPerformanceModal';
import { MealEstimationModal } from '../../components/modals/MealEstimationModal';
import { MoveCopyMealModal } from '../../components/modals/MoveCopyMealModal';
import MyMealsModal from '../../components/modals/MyMealsModal';
import { NotificationsModal } from '../../components/modals/NotificationsModal';
import { NotificationsSettingsModal } from '../../components/modals/NotificationsSettingsModal';
import { NutritionConfirmationModal } from '../../components/modals/NutritionConfirmationModal';
import { NutritionGoals, NutritionGoalsModal } from '../../components/modals/NutritionGoalsModal';
import { PastWorkoutBottomMenu } from '../../components/modals/PastWorkoutBottomMenu';
import PastWorkoutDetailModal from '../../components/modals/PastWorkoutDetailModal';
import { PastWorkoutsHistoryFilterMenu } from '../../components/modals/PastWorkoutsHistoryFilterMenu';
import PastWorkoutsHistoryModal from '../../components/modals/PastWorkoutsHistoryModal';
import { PortionSizesPickerModal } from '../../components/modals/PortionSizesPickerModal';
import { RecentNutritionHistoryModal } from '../../components/modals/RecentNutritionHistoryModal';
import { ReplaceExerciseModal } from '../../components/modals/ReplaceExerciseModal';
import { RetrospectiveNutritionModal } from '../../components/modals/RetrospectiveNutritionModal';
import { ScannedFoodDetailsModal } from '../../components/modals/ScannedFoodDetailsModal';
import { SelectModal } from '../../components/modals/SelectModal';
import { SessionFeedbackModal } from '../../components/modals/SessionFeedbackModal';
import SmartCameraModal from '../../components/modals/SmartCameraModal';
import { TimePickerInput } from '../../components/modals/TimePickerInput';
import { TimePickerModal } from '../../components/modals/TimePickerModal';
import { UserMenuModal } from '../../components/modals/UserMenuModal';
import ViewExerciseModal from '../../components/modals/ViewExerciseModal';
import { VisualSettingsModal } from '../../components/modals/VisualSettingsModal';
import { WorkoutOptionsModal } from '../../components/modals/WorkoutOptionsModal';
import { WorkoutSessionHistoryModal } from '../../components/modals/WorkoutSessionHistoryModal';
import WorkoutSessionOverviewModal from '../../components/modals/WorkoutSessionOverviewModal';
import { Button } from '../../components/theme/Button';
import { EnrichedWorkoutLogSet } from '../../database/services';
import { useMenstrualCycle } from '../../hooks/useMenstrualCycle';

export default function ModalsTestScreen() {
  // Menstrual cycle data for CycleSettingsModal
  const { cycle } = useMenstrualCycle();

  // Nutrition Goals Modal
  const [isNutritionGoalsVisible, setIsNutritionGoalsVisible] = useState(false);

  // Setting Modal
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
  const [isAiNotConfiguredVisible, setIsAiNotConfiguredVisible] = useState(false);
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

  // Nutrition Log Modal
  const [isNutritionLogVisible, setIsNutritionLogVisible] = useState(false);

  // Food Data Modal (Food library - Food model)
  const [isFoodDataVisible, setIsFoodDataVisible] = useState(false);

  // Add Food Modal
  const [isAddFoodVisible, setIsAddFoodVisible] = useState(false);
  const [isBarcodeCameraVisible, setIsBarcodeCameraVisible] = useState(false);

  // Add Meal Modal
  const [isAddMealVisible, setIsAddMealVisible] = useState(false);
  // My Meals Modal
  const [isMyMealsVisible, setIsMyMealsVisible] = useState(false);
  // Create Meal Modal
  const [isCreateMealVisible, setIsCreateMealVisible] = useState(false);

  // Food Search Modal
  const [isFoodSearchVisible, setIsFoodSearchVisible] = useState(false);
  // Food Not Found Modal (test)
  const [isFoodNotFoundVisible, setIsFoodNotFoundVisible] = useState(false);

  // Notifications Modal
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

  // Workout Options Modal
  const [isWorkoutOptionsVisible, setIsWorkoutOptionsVisible] = useState(false);

  // Workout Session Overview Modal
  const [isWorkoutOverviewVisible, setIsWorkoutOverviewVisible] = useState(false);

  // Create Workout Options Modal
  const [isCreateWorkoutOptionsVisible, setIsCreateWorkoutOptionsVisible] = useState(false);

  // Replace Exercise Modal
  const [isReplaceExerciseVisible, setIsReplaceExerciseVisible] = useState(false);

  // Workout History Modal
  const [isWorkoutHistoryVisible, setIsWorkoutHistoryVisible] = useState(false);

  // Date Picker Modal
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [testDatePickerSelection, setTestDatePickerSelection] = useState(() => new Date());

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
  // Create Workout Modal
  const [isCreateWorkoutVisible, setIsCreateWorkoutVisible] = useState(false);
  // Portion Sizes Picker Modal
  const [isPortionSizesPickerVisible, setIsPortionSizesPickerVisible] = useState(false);
  // Create Food Portion Modal
  const [isCreateFoodPortionVisible, setIsCreateFoodPortionVisible] = useState(false);
  // Browse Templates Modal
  const [isBrowseTemplatesVisible, setIsBrowseTemplatesVisible] = useState(false);

  // Log Meal Modal
  const [isLogMealVisible, setIsLogMealVisible] = useState(false);

  // Meal Data Modal
  const [isMealDataVisible, setIsMealDataVisible] = useState(false);

  // Exercise Data Modal
  const [isExerciseDataVisible, setIsExerciseDataVisible] = useState(false);

  // Workout Log Data Modal
  const [isWorkoutLogDataVisible, setIsWorkoutLogDataVisible] = useState(false);

  // Workout Template Data Modal
  const [isWorkoutTemplateDataVisible, setIsWorkoutTemplateDataVisible] = useState(false);

  // User Metric Data Modal
  const [isUserMetricDataVisible, setIsUserMetricDataVisible] = useState(false);

  // Food Portion Data Modal
  const [isFoodPortionDataVisible, setIsFoodPortionDataVisible] = useState(false);

  // Nutrition Goal Data Modal
  const [isNutritionGoalDataVisible, setIsNutritionGoalDataVisible] = useState(false);

  // Meal Estimation Modal
  const [isMealEstimationVisible, setIsMealEstimationVisible] = useState(false);

  // Time Picker Modal
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());

  // Free Session Exercise Complete Modal
  const [isFreeSessionExerciseCompleteVisible, setIsFreeSessionExerciseCompleteVisible] =
    useState(false);

  // Import Nutrition Modal
  const [isImportNutritionVisible, setIsImportNutritionVisible] = useState(false);

  // Import Workouts Modal
  const [isImportWorkoutsVisible, setIsImportWorkoutsVisible] = useState(false);

  // Nutrition Confirmation Modal
  const [isNutritionConfirmationVisible, setIsNutritionConfirmationVisible] = useState(false);

  // Retrospective Nutrition Modal
  const [isRetrospectiveNutritionVisible, setIsRetrospectiveNutritionVisible] = useState(false);

  // AI Nutrition Tracking Context Modal
  const [isAiNutritionContextVisible, setIsAiNutritionContextVisible] = useState(false);

  // AI Custom Prompts Modal
  const [isAiCustomPromptsVisible, setIsAiCustomPromptsVisible] = useState(false);

  // AI Custom Prompt Edit Modal
  const [isAiCustomPromptEditVisible, setIsAiCustomPromptEditVisible] = useState(false);

  // Cycle Log Modal
  const [isCycleLogVisible, setIsCycleLogVisible] = useState(false);

  // Cycle Settings Modal
  const [isCycleSettingsVisible, setIsCycleSettingsVisible] = useState(false);

  // Generic Edit Modal
  const [isGenericEditVisible, setIsGenericEditVisible] = useState(false);

  // Select Modal (option rows — native padding QA)
  const [isSelectModalTestVisible, setIsSelectModalTestVisible] = useState(false);
  const [selectModalTestValue, setSelectModalTestValue] = useState('a');

  // Move Copy Meal Modal
  const [isMoveCopyMealVisible, setIsMoveCopyMealVisible] = useState(false);
  const [moveCopyMode, setMoveCopyMode] = useState<'move' | 'copy' | 'split'>('move');

  // Notifications Settings Modal
  const [isNotificationsSettingsVisible, setIsNotificationsSettingsVisible] = useState(false);

  // Past Workout Bottom Menu
  const [isPastWorkoutBottomMenuVisible, setIsPastWorkoutBottomMenuVisible] = useState(false);

  // Past Workouts History Filter Menu
  const [isPastWorkoutsFilterVisible, setIsPastWorkoutsFilterVisible] = useState(false);

  // Recent Nutrition History Modal
  const [isRecentNutritionHistoryVisible, setIsRecentNutritionHistoryVisible] = useState(false);

  // Scanned Food Details Modal
  const [isScannedFoodDetailsVisible, setIsScannedFoodDetailsVisible] = useState(false);

  // Smart Camera Modal
  const [isSmartCameraVisible, setIsSmartCameraVisible] = useState(false);

  // Visual Settings Modal
  const [isVisualSettingsVisible, setIsVisualSettingsVisible] = useState(false);

  // Add Exercise To Session Modal
  const [isAddExerciseToSessionVisible, setIsAddExerciseToSessionVisible] = useState(false);

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

          {/* Native row padding QA — Pressable + flex rows (verify trailing icons on device) */}
          <View className="mb-6 rounded-xl border border-accent-primary/30 bg-bg-card p-4">
            <Text className="mb-1 text-lg font-bold text-text-primary">
              Native row padding (device QA)
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Use these on a phone to confirm trailing chevrons/checkmarks are not flush to the
              right edge. Includes SelectModal list rows, compact date/time (food details style),
              and Generic Edit with a select field.
            </Text>
            <Button
              label="Open Select Modal (list rows)"
              variant="accent"
              width="full"
              onPress={() => setIsSelectModalTestVisible(true)}
            />
            <Text className="mt-2 text-xs text-text-tertiary">
              Selected: {selectModalTestValue}
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
              Configure AI integrations — model row & custom prompts row (native padding QA).
            </Text>
            <Button
              label="Open AI Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAiSettingsVisible(true)}
            />
            <View className="h-3" />
            <Button
              label="Open AI Not Configured Modal"
              variant="outline"
              width="full"
              onPress={() => setIsAiNotConfiguredVisible(true)}
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

          {/* Nutrition Log Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Nutrition Log Data Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing nutrition log entries with search and food item options.
            </Text>
            <Button
              label="Open Nutrition Log Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNutritionLogVisible(true)}
            />
          </View>

          {/* Food Data Modal (Food library) */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Food Data Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing your food library (Food model) with search, favorites, and options.
            </Text>
            <Button
              label="Open Food Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFoodDataVisible(true)}
            />
          </View>

          {/* Add Food Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Add Food Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding food to a nutrition data with various options.
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

          {/* My Meals Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">My Meals Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Preview the My Meals modal used for managing saved meals.
            </Text>
            <Button
              label="Open My Meals Modal"
              variant="accent"
              width="full"
              onPress={() => setIsMyMealsVisible(true)}
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
            <Text className="mb-2 text-lg font-bold text-text-primary">Food Not Found Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Empty-state modal when food isnt found.
            </Text>
            <Button
              label="Open Food Not Found Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFoodNotFoundVisible(true)}
            />
          </View>
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Barcode Camera Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Open camera to scan product barcodes.
            </Text>
            <Button
              label="Open Barcode Camera Modal"
              variant="accent"
              width="full"
              onPress={() => setIsBarcodeCameraVisible(true)}
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
            <View className="h-3" />
            <Button
              label="Open Session Overview"
              variant="outline"
              width="full"
              onPress={() => setIsWorkoutOverviewVisible(true)}
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
            <Text className="mb-4 text-sm text-text-secondary">
              Default and compact variants (compact matches food details).
            </Text>
            <DatePickerInput
              label="Date (default)"
              selectedDate={testDatePickerSelection}
              onPress={() => setIsDatePickerVisible(true)}
              variant="default"
            />
            <View className="mt-3">
              <TimePickerInput
                label="Time (default)"
                selectedTime={selectedTime}
                onPress={() => setIsTimePickerVisible(true)}
                variant="default"
              />
            </View>
            <View className="mt-4">
              <DatePickerInput
                label="Date (compact)"
                selectedDate={testDatePickerSelection}
                onPress={() => setIsDatePickerVisible(true)}
                variant="compact"
              />
            </View>
            <View className="mt-3">
              <TimePickerInput
                label="Time (compact)"
                selectedTime={selectedTime}
                onPress={() => setIsTimePickerVisible(true)}
                variant="compact"
              />
            </View>
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
              Custom food form — scroll to Portion sizes for the chevron row (native padding QA).
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

          {/* Create Workout Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Create Workout Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for creating a new workout with exercises, goals, and scheduling options.
            </Text>
            <Button
              label="Open Create Workout Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCreateWorkoutVisible(true)}
            />
          </View>

          {/* Portion Sizes Picker Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Portion Sizes Picker Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for selecting portion sizes with categories for standard, weight, and volume
              units.
            </Text>
            <Button
              label="Open Portion Sizes Picker Modal"
              variant="accent"
              width="full"
              onPress={() => setIsPortionSizesPickerVisible(true)}
            />
          </View>

          {/* Create Food Portion Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Create Food Portion Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for creating custom food portions with name, weight, and icon selection.
            </Text>
            <Button
              label="Open Create Food Portion Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCreateFoodPortionVisible(true)}
            />
          </View>

          {/* Browse Templates Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Browse Templates Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              A full-screen modal for browsing and selecting workout templates with search and
              category filtering.
            </Text>
            <Button
              label="Open Browse Templates Modal"
              variant="accent"
              width="full"
              onPress={() => setIsBrowseTemplatesVisible(true)}
            />
          </View>

          {/* Log Meal Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Log Meal Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for logging a meal with date and meal type selection.
            </Text>
            <Button
              label="Open Log Meal Modal"
              variant="accent"
              width="full"
              onPress={() => setIsLogMealVisible(true)}
            />
          </View>

          {/* Meal Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Meal Data Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing meal data with search and meal options.
            </Text>
            <Button
              label="Open Meal Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsMealDataVisible(true)}
            />
          </View>

          {/* Exercise Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Exercise Data Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing exercise data with search and exercise options.
            </Text>
            <Button
              label="Open Exercise Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsExerciseDataVisible(true)}
            />
          </View>

          {/* Workout Log Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Workout Log Data Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing workout log data with search and session options.
            </Text>
            <Button
              label="Open Workout Log Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsWorkoutLogDataVisible(true)}
            />
          </View>

          {/* Workout Template Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Workout Template Data Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing workout template data with search and template options.
            </Text>
            <Button
              label="Open Workout Template Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsWorkoutTemplateDataVisible(true)}
            />
          </View>

          {/* User Metric Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">User Metric Data Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing body metric entries (weight, body fat, etc.) with search and
              history.
            </Text>
            <Button
              label="Open User Metric Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsUserMetricDataVisible(true)}
            />
          </View>

          {/* Food Portion Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Food Portion Data Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing portion sizes (e.g. cup, slice, 100g) with search and options.
            </Text>
            <Button
              label="Open Food Portion Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFoodPortionDataVisible(true)}
            />
          </View>

          {/* Meal Estimation Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Meal Estimation Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for displaying AI-powered meal estimation with identified food items and
              nutritional breakdown.
            </Text>
            <Button
              label="Open Meal Estimation Modal"
              variant="accent"
              width="full"
              onPress={() => setIsMealEstimationVisible(true)}
            />
          </View>

          {/* Time Picker Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Time Picker Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for selecting time with hour and minute controls.
            </Text>
            <Button
              label="Open Time Picker Modal"
              variant="accent"
              width="full"
              onPress={() => setIsTimePickerVisible(true)}
            />
          </View>

          {/* Free Session Exercise Complete Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Free Session Exercise Complete Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal displayed when completing an exercise in a free training session with summary
              stats and options.
            </Text>
            <Button
              label="Open Free Session Exercise Complete Modal"
              variant="accent"
              width="full"
              onPress={() => setIsFreeSessionExerciseCompleteVisible(true)}
            />
          </View>

          {/* Nutrition Goal Data Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Nutrition Goal Data Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing nutrition goals history with search and options.
            </Text>
            <Button
              label="Open Nutrition Goal Data Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNutritionGoalDataVisible(true)}
            />
          </View>

          {/* Import Nutrition Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Import Nutrition Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for pasting raw nutrition data to be parsed by AI.
            </Text>
            <Button
              label="Open Import Nutrition Modal"
              variant="accent"
              width="full"
              onPress={() => setIsImportNutritionVisible(true)}
            />
          </View>

          {/* Import Workouts Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Import Workouts Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for pasting raw workout data to be parsed by AI.
            </Text>
            <Button
              label="Open Import Workouts Modal"
              variant="accent"
              width="full"
              onPress={() => setIsImportWorkoutsVisible(true)}
            />
          </View>

          {/* Nutrition Confirmation Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Nutrition Confirmation Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for reviewing and confirming AI-parsed nutrition entries before saving.
            </Text>
            <Button
              label="Open Nutrition Confirmation Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNutritionConfirmationVisible(true)}
            />
          </View>

          {/* Retrospective Nutrition Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Retrospective Nutrition Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for describing meals in natural language to log nutrition for a past date.
            </Text>
            <Button
              label="Open Retrospective Nutrition Modal"
              variant="accent"
              width="full"
              onPress={() => setIsRetrospectiveNutritionVisible(true)}
            />
          </View>

          {/* AI Nutrition Tracking Context Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              AI Nutrition Tracking Context Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding context to AI nutrition tracking like meal description and tags.
            </Text>
            <Button
              label="Open AI Nutrition Context Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAiNutritionContextVisible(true)}
            />
          </View>

          {/* AI Custom Prompts Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              AI Custom Prompts Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for managing AI custom prompts for different contexts.
            </Text>
            <Button
              label="Open AI Custom Prompts Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAiCustomPromptsVisible(true)}
            />
          </View>

          {/* AI Custom Prompt Edit Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              AI Custom Prompt Edit Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for editing or creating AI custom prompts.
            </Text>
            <Button
              label="Open AI Custom Prompt Edit Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAiCustomPromptEditVisible(true)}
            />
          </View>

          {/* Cycle Log Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Cycle Log Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for logging menstrual cycle data including flow and symptoms.
            </Text>
            <Button
              label="Open Cycle Log Modal"
              variant="accent"
              width="full"
              onPress={() => setIsCycleLogVisible(true)}
            />
          </View>

          {/* Cycle Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Cycle Settings Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for configuring menstrual cycle settings and goals.
            </Text>
            <Button
              label="Open Cycle Settings Modal"
              variant="accent"
              width="full"
              disabled={!cycle}
              onPress={() => cycle && setIsCycleSettingsVisible(true)}
            />
          </View>

          {/* Generic Edit Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Generic Edit Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Includes a select field (chevron row). Reusable modal for editing various data types.
            </Text>
            <Button
              label="Open Generic Edit Modal"
              variant="accent"
              width="full"
              onPress={() => setIsGenericEditVisible(true)}
            />
          </View>

          {/* Move Copy Meal Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Move/Copy Meal Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for moving, copying, or splitting meals to different dates.
            </Text>
            <View className="flex-row gap-2">
              <Button
                label="Move Mode"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setMoveCopyMode('move');
                  setIsMoveCopyMealVisible(true);
                }}
              />
              <Button
                label="Copy Mode"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setMoveCopyMode('copy');
                  setIsMoveCopyMealVisible(true);
                }}
              />
              <Button
                label="Split Mode"
                variant="outline"
                size="sm"
                width="flex-1"
                onPress={() => {
                  setMoveCopyMode('split');
                  setIsMoveCopyMealVisible(true);
                }}
              />
            </View>
          </View>

          {/* Notifications Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Notifications Settings Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for configuring notification preferences for workouts, nutrition, and cycle.
            </Text>
            <Button
              label="Open Notifications Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsNotificationsSettingsVisible(true)}
            />
          </View>

          {/* Past Workout Bottom Menu */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Past Workout Bottom Menu
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Bottom menu with actions for past workouts like edit, share, delete, and preview.
            </Text>
            <Button
              label="Open Past Workout Bottom Menu"
              variant="accent"
              width="full"
              onPress={() => setIsPastWorkoutBottomMenuVisible(true)}
            />
          </View>

          {/* Past Workouts History Filter Menu */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Past Workouts History Filter Menu
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Filter menu for past workouts with options for type, muscle groups, and date range.
            </Text>
            <Button
              label="Open Past Workouts Filter Menu"
              variant="accent"
              width="full"
              onPress={() => setIsPastWorkoutsFilterVisible(true)}
            />
          </View>

          {/* Recent Nutrition History Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Recent Nutrition History Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal showing recently used food items for quick selection.
            </Text>
            <Button
              label="Open Recent Nutrition History Modal"
              variant="accent"
              width="full"
              onPress={() => setIsRecentNutritionHistoryVisible(true)}
            />
          </View>

          {/* Scanned Food Details Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Scanned Food Details Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal displaying details for scanned barcode products.
            </Text>
            <Button
              label="Open Scanned Food Details Modal"
              variant="accent"
              width="full"
              onPress={() => setIsScannedFoodDetailsVisible(true)}
            />
          </View>

          {/* Smart Camera Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Smart Camera Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Full-screen camera modal for AI meal scanning and barcode detection.
            </Text>
            <Button
              label="Open Smart Camera Modal"
              variant="accent"
              width="full"
              onPress={() => setIsSmartCameraVisible(true)}
            />
          </View>

          {/* Visual Settings Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">Visual Settings Modal</Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for customizing navigation bar items and visual preferences.
            </Text>
            <Button
              label="Open Visual Settings Modal"
              variant="accent"
              width="full"
              onPress={() => setIsVisualSettingsVisible(true)}
            />
          </View>

          {/* Add Exercise To Session Modal */}
          <View className="mb-6">
            <Text className="mb-2 text-lg font-bold text-text-primary">
              Add Exercise To Session Modal
            </Text>
            <Text className="mb-4 text-sm text-text-secondary">
              Modal for adding exercises to an active workout session with sets configuration.
            </Text>
            <Button
              label="Open Add Exercise To Session Modal"
              variant="accent"
              width="full"
              onPress={() => setIsAddExerciseToSessionVisible(true)}
            />
          </View>

          {/* Bottom spacing */}
          <View className="h-8" />
        </View>
      </ScrollView>

      {/* Modals */}
      <BasicSettingsModal
        visible={isBasicSettingsVisible}
        onClose={() => setIsBasicSettingsVisible(false)}
      />

      <BarcodeCameraModal
        visible={isBarcodeCameraVisible}
        onClose={() => setIsBarcodeCameraVisible(false)}
        onBarcodeScanned={(data) => console.log('Barcode scanned:', data)}
      />

      <AdvancedSettingsModal
        visible={isAdvancedSettingsVisible}
        onClose={() => setIsAdvancedSettingsVisible(false)}
        onExportPress={() => console.log('Export pressed')}
        onImportPress={() => console.log('Import pressed')}
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
      <FoodMealDetailsModal
        visible={isFoodDetailsVisible}
        onClose={() => setIsFoodDetailsVisible(false)}
        barcode="3017620425035"
      />

      <NutritionLogModal
        visible={isNutritionLogVisible}
        onClose={() => setIsNutritionLogVisible(false)}
      />

      <FoodDataModal visible={isFoodDataVisible} onClose={() => setIsFoodDataVisible(false)} />

      <AddFoodModal
        visible={isAddFoodVisible}
        onClose={() => setIsAddFoodVisible(false)}
        onMealTypeSelect={(mealType) => {
          console.log('Meal type selected:', mealType);
        }}
        onAiCameraPress={() => {
          console.log('AI Camera pressed');
        }}
        onScanBarcodePress={() => setIsBarcodeCameraVisible(true)}
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

      <MyMealsModal visible={isMyMealsVisible} onClose={() => setIsMyMealsVisible(false)} />

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

      <FoodNotFoundModal
        visible={isFoodNotFoundVisible}
        onClose={() => setIsFoodNotFoundVisible(false)}
        onTryAiScan={() => console.log('AI Camera Scan pressed')}
        onSearchAgain={() => console.log('Search again pressed')}
        onCreateCustom={() => {
          console.log('Create custom food pressed from not-found');
          setIsFoodNotFoundVisible(false);
          setIsNewCustomFoodVisible(true);
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

      <WorkoutSessionOverviewModal
        visible={isWorkoutOverviewVisible}
        onClose={() => setIsWorkoutOverviewVisible(false)}
        workoutLogId={undefined} // Test with no workout data
        onStartWorkout={() => {
          console.log('Start workout pressed');
          setIsWorkoutOverviewVisible(false);
        }}
        onResumeSession={() => {
          console.log('Resume session pressed');
          setIsWorkoutOverviewVisible(false);
        }}
        onSelectExercise={(exerciseId) => {
          console.log('Selected exercise:', exerciseId);
        }}
        onCancelWorkout={() => {
          console.log('Cancel workout pressed');
          setIsWorkoutOverviewVisible(false);
        }}
        onFinishWorkout={() => {
          console.log('Finish workout pressed');
          setIsWorkoutOverviewVisible(false);
        }}
      />

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        onDateSelect={(date) => {
          console.log('Date selected:', date);
          setTestDatePickerSelection(date);
        }}
        selectedDate={testDatePickerSelection}
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

      <AINotConfiguredModal
        visible={isAiNotConfiguredVisible}
        onClose={() => setIsAiNotConfiguredVisible(false)}
        onOpenAISettings={() => setIsAiSettingsVisible(true)}
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

      <CoachModal
        visible={isCoachModalVisible}
        onClose={() => setIsCoachModalVisible(false)}
        onOpenMyMeals={() => setIsMyMealsVisible(true)}
      />

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
      <CreateCustomFoodModal
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
        initialSets={[
          {
            id: '1',
            weight: 100,
            reps: 10,
            partialReps: 0,
            rest: 60,
            repsInReserve: 2,
            isPR: true,
          },
          {
            id: '2',
            weight: 100,
            reps: 8,
            partialReps: 0,
            rest: 60,
            repsInReserve: 1,
          },
        ]}
      />

      <PastWorkoutDetailModal
        visible={isPastWorkoutDetailVisible}
        onClose={() => setIsPastWorkoutDetailVisible(false)}
      />

      <CreateWorkoutModal
        visible={isCreateWorkoutVisible}
        onClose={() => setIsCreateWorkoutVisible(false)}
      />

      <PortionSizesPickerModal
        visible={isPortionSizesPickerVisible}
        onClose={() => setIsPortionSizesPickerVisible(false)}
        onConfirm={(selectedIds) => {
          console.log('Selected portion sizes:', selectedIds);
        }}
        selectedIds={['grams', 'cups']}
      />

      <CreateFoodPortionModal
        visible={isCreateFoodPortionVisible}
        onClose={() => setIsCreateFoodPortionVisible(false)}
        onCreatePortion={(portion) => {
          console.log('Food portion created:', portion);
        }}
      />

      <BrowseTemplatesModal
        visible={isBrowseTemplatesVisible}
        onClose={() => setIsBrowseTemplatesVisible(false)}
        onTemplateSelect={(template) => {
          console.log('Template selected:', template);
        }}
      />

      <LogMealModal
        visible={isLogMealVisible}
        onClose={() => setIsLogMealVisible(false)}
        meal={{
          name: 'Chicken & Rice Bowl',
          type: 'Lunch',
          image:
            'https://lh3.googleusercontent.com/aida-public/AB6AXuDgHwqUjNwt7pYkcCh9wPuRU31RWGIrWYDLXPJDDNrfBXCFSKxpLBeHsDY16TfU5HYsaCTi-u_8B1BcbIYdVpvNuhGxsVBL6mCNOEdOm9Z6uc6BrRCTNKG8G21FwVcD2HxMmg7ZVVAum9UlrPxDk0ZHjSDSsPBEuBJbbT1-7j9oIW1b9AYpg7la8RmX9oyRxgronJChnW7EMtAf5uL_wGtwacJUegLjkb0p4zFxeHsy6NQNSXq6m33Z3QzW8d4I1-xTKsxWvehxV5Vi',
          calories: 650,
          protein: 45,
          carbs: 60,
          fat: 18,
        }}
        onLogMeal={(date, mealType, portionGrams) => {
          console.log('Meal logged:', { date, mealType, portionGrams });
        }}
      />

      <MealDataModal visible={isMealDataVisible} onClose={() => setIsMealDataVisible(false)} />

      <ExerciseDataModal
        visible={isExerciseDataVisible}
        onClose={() => setIsExerciseDataVisible(false)}
      />

      <WorkoutLogDataModal
        visible={isWorkoutLogDataVisible}
        onClose={() => setIsWorkoutLogDataVisible(false)}
      />

      <WorkoutTemplateDataModal
        visible={isWorkoutTemplateDataVisible}
        onClose={() => setIsWorkoutTemplateDataVisible(false)}
      />

      <UserMetricDataModal
        visible={isUserMetricDataVisible}
        onClose={() => setIsUserMetricDataVisible(false)}
      />

      <FoodPortionDataModal
        visible={isFoodPortionDataVisible}
        onClose={() => setIsFoodPortionDataVisible(false)}
      />

      <NutritionGoalDataModal
        visible={isNutritionGoalDataVisible}
        onClose={() => setIsNutritionGoalDataVisible(false)}
      />

      <MealEstimationModal
        visible={isMealEstimationVisible}
        onClose={() => setIsMealEstimationVisible(false)}
        mealImage="https://example.com/meal.jpg"
      />

      <TimePickerModal
        visible={isTimePickerVisible}
        onClose={() => setIsTimePickerVisible(false)}
        selectedTime={selectedTime}
        title="Select Time"
        onTimeSelect={(time) => {
          console.log('Time selected:', time);
          setSelectedTime(time);
        }}
      />

      <FreeSessionExerciseCompleteModal
        visible={isFreeSessionExerciseCompleteVisible}
        onClose={() => setIsFreeSessionExerciseCompleteVisible(false)}
        exerciseName="Bench Press"
        exerciseId="test-exercise-id"
        sets={
          [
            {
              id: '1',
              logExerciseId: 'test-log-exercise-id',
              exerciseId: 'test-exercise-id',
              reps: 10,
              weight: 80,
              difficultyLevel: 8,
              isSkipped: false,
            },
            {
              id: '2',
              logExerciseId: 'test-log-exercise-id',
              exerciseId: 'test-exercise-id',
              reps: 8,
              weight: 85,
              difficultyLevel: 9,
              isSkipped: false,
            },
          ] as EnrichedWorkoutLogSet[]
        }
        units="metric"
        onAddNextExercise={() => console.log('Add next exercise pressed')}
        onFinishWorkout={() => console.log('Finish workout pressed')}
        isFinishing={false}
      />
      <ImportNutritionModal
        visible={isImportNutritionVisible}
        onClose={() => setIsImportNutritionVisible(false)}
      />

      <ImportWorkoutsModal
        visible={isImportWorkoutsVisible}
        onClose={() => setIsImportWorkoutsVisible(false)}
      />

      <NutritionConfirmationModal
        visible={isNutritionConfirmationVisible}
        onClose={() => setIsNutritionConfirmationVisible(false)}
        onConfirm={(entries) => console.log('Confirmed entries:', entries)}
        entries={[
          {
            productTitle: 'Oatmeal',
            calories: 350,
            protein: 12,
            carbs: 60,
            fat: 7,
            fiber: 5,
            mealType: 1,
          },
        ]}
      />

      <RetrospectiveNutritionModal
        visible={isRetrospectiveNutritionVisible}
        onClose={() => setIsRetrospectiveNutritionVisible(false)}
        targetDate={new Date()}
      />

      <AINutritionTrackingContextModal
        visible={isAiNutritionContextVisible}
        onClose={() => setIsAiNutritionContextVisible(false)}
        onApply={(context) => console.log('AI context applied:', context)}
      />

      <AiCustomPromptsModal
        visible={isAiCustomPromptsVisible}
        onClose={() => setIsAiCustomPromptsVisible(false)}
      />

      <AiCustomPromptEditModal
        visible={isAiCustomPromptEditVisible}
        onClose={() => setIsAiCustomPromptEditVisible(false)}
      />

      <CycleLogModal
        visible={isCycleLogVisible}
        onClose={() => setIsCycleLogVisible(false)}
        initialDate={new Date()}
      />

      {cycle ? (
        <CycleSettingsModal
          visible={isCycleSettingsVisible}
          onClose={() => setIsCycleSettingsVisible(false)}
          cycle={cycle}
        />
      ) : null}

      <GenericEditModal
        visible={isGenericEditVisible}
        onClose={() => setIsGenericEditVisible(false)}
        title="Generic Edit Modal"
        fields={[
          { key: 'name', label: 'Name', type: 'text', required: true },
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
              { value: 'c', label: 'Option C' },
            ],
          },
          { key: 'amount', label: 'Amount', type: 'number', required: true },
          { key: 'active', label: 'Active', type: 'boolean' },
        ]}
        initialValues={{ name: 'Test', category: 'a', amount: 100, active: true }}
        onSave={async (values) => {
          console.log('Generic edit saved:', values);
          setIsGenericEditVisible(false);
        }}
      />

      <SelectModal
        visible={isSelectModalTestVisible}
        onClose={() => setIsSelectModalTestVisible(false)}
        title="Select modal (QA)"
        options={[
          { value: 'a', label: 'First option' },
          { value: 'b', label: 'Second option' },
          { value: 'c', label: 'Third option with a longer label' },
        ]}
        selectedValue={selectModalTestValue}
        onSelect={(val) => {
          setSelectModalTestValue(val);
          setIsSelectModalTestVisible(false);
        }}
      />

      <MoveCopyMealModal
        visible={isMoveCopyMealVisible}
        onClose={() => setIsMoveCopyMealVisible(false)}
        onConfirm={async (targetDate, targetMealType, splitPercentage) => {
          console.log('Move/Copy confirmed:', { targetDate, targetMealType, splitPercentage });
        }}
        mode={moveCopyMode}
        sourceMealType="lunch"
        sourceDate={new Date()}
      />

      <NotificationsSettingsModal
        visible={isNotificationsSettingsVisible}
        onClose={() => setIsNotificationsSettingsVisible(false)}
      />

      <PastWorkoutBottomMenu
        visible={isPastWorkoutBottomMenuVisible}
        onClose={() => setIsPastWorkoutBottomMenuVisible(false)}
        workoutName="Sample Workout"
        onEdit={() => console.log('Edit workout')}
        onShare={() => console.log('Share workout')}
        onDelete={() => console.log('Delete workout')}
        onPreview={() => console.log('Preview workout')}
      />

      <PastWorkoutsHistoryFilterMenu
        visible={isPastWorkoutsFilterVisible}
        onClose={() => setIsPastWorkoutsFilterVisible(false)}
        onApplyFilters={(filters) => console.log('Applied filters:', filters)}
        onClearFilters={() => console.log('Cleared filters')}
      />

      <RecentNutritionHistoryModal
        visible={isRecentNutritionHistoryVisible}
        onClose={() => setIsRecentNutritionHistoryVisible(false)}
        onFoodClick={(food) => console.log('Food clicked:', food)}
        portion100gName="100g"
      />

      <ScannedFoodDetailsModal
        visible={isScannedFoodDetailsVisible}
        onClose={() => setIsScannedFoodDetailsVisible(false)}
        barcode="3017620425035"
        onAddFood={(food) => console.log('Food added from scan:', food)}
      />

      <SmartCameraModal
        visible={isSmartCameraVisible}
        onClose={() => setIsSmartCameraVisible(false)}
        mode="barcode-scan"
      />

      <VisualSettingsModal
        visible={isVisualSettingsVisible}
        onClose={() => setIsVisualSettingsVisible(false)}
      />

      <AddExerciseToSessionModal
        visible={isAddExerciseToSessionVisible}
        onClose={() => setIsAddExerciseToSessionVisible(false)}
        workoutLogId="test-workout-log-id"
      />
    </SafeAreaView>
  );
}
