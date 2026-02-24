import { MaterialIcons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ExerciseService,
  FoodPortionService,
  FoodService,
  MealService,
  NutritionGoalService,
  NutritionService,
  UserMetricService,
  WorkoutService,
  WorkoutTemplateService,
} from '../../database/services';
import { useExerciseDataLogs } from '../../hooks/useExerciseDataLogs';
import { useFoodDataLogs } from '../../hooks/useFoodDataLogs';
import { useFoodPortionDataLogs } from '../../hooks/useFoodPortionDataLogs';
import { useFoodsDataLogs } from '../../hooks/useFoodsDataLogs';
import { useMealDataLogs } from '../../hooks/useMealDataLogs';
import { useNutritionGoalDataLogs } from '../../hooks/useNutritionGoalDataLogs';
import { useTheme } from '../../hooks/useTheme';
import { useUserMetricDataLogs } from '../../hooks/useUserMetricDataLogs';
import { useWorkoutLogDataLogs } from '../../hooks/useWorkoutLogDataLogs';
import { useWorkoutTemplateDataLogs } from '../../hooks/useWorkoutTemplateDataLogs';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { useSnackbar } from '../SnackbarContext';
import { Button } from '../theme/Button';
import { SkeletonLoader } from '../theme/SkeletonLoader';
import { TextInput } from '../theme/TextInput';
import { ConfirmationModal } from './ConfirmationModal';
import CreateCustomFoodModal from './CreateCustomFoodModal';
import CreateExerciseModal from './CreateExerciseModal';
import { CreateFoodPortionModal } from './CreateFoodPortionModal';
import { CreateMealModal } from './CreateMealModal';
import CreateWorkoutModal from './CreateWorkoutModal';
import { CreateWorkoutOptionsModal } from './CreateWorkoutOptionsModal';
import { FullScreenModal } from './FullScreenModal';
import { GenericEditModal } from './GenericEditModal';
import { getEditFields } from './GenericEditModal/entityEditConfig';
import { useEditRecord } from './GenericEditModal/useEditRecord';

export type DataLogModalVariant =
  | 'meal'
  | 'nutrition_log'
  | 'food'
  | 'foodPortion'
  | 'exercise'
  | 'workoutLog'
  | 'workoutTemplate'
  | 'userMetric'
  | 'nutritionGoal';

export type DataLogModalTranslations = {
  title: string;
  searchPlaceholder: string;
  noItemsText: string;
  noItemsDesc: string;
  endOfHistoryText: string;
  menuTitle: string;
  favoriteAddTitle: string;
  favoriteRemoveTitle: string;
  favoriteAddDesc: string;
  favoriteRemoveDesc: string;
  editTitle: string;
  editDesc: string;
  duplicateTitle: string;
  duplicateDesc: string;
  deleteTitle: string;
  deleteDesc: string;
  formatCaloriesMacros: (params: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }) => string;
  /** When set (e.g. for exercise variant), used for the row subtitle instead of formatCaloriesMacros */
  formatItemSubtitle?: (item: DataLogDisplayItem) => string;
};

export function getDataLogModalTranslations(
  variant: DataLogModalVariant,
  t: TFunction
): DataLogModalTranslations {
  if (variant === 'meal') {
    return {
      title: t('food.meals.manageMealData.title'),
      searchPlaceholder: t('food.meals.manageMealData.searchPlaceholder'),
      noItemsText: t('food.meals.manageMealData.noMeals', 'No meals yet'),
      noItemsDesc: t(
        'food.meals.manageMealData.noMealsDesc',
        'Create custom meals to see them here'
      ),
      endOfHistoryText: t('food.meals.manageMealData.endOfHistory'),
      menuTitle: t('food.meals.manageMealData.mealOptions'),
      favoriteAddTitle: t('food.meals.manageMealData.addToFavorites'),
      favoriteRemoveTitle: t('food.meals.manageMealData.removeFromFavorites'),
      favoriteAddDesc: t('food.meals.manageMealData.addToFavoritesDesc'),
      favoriteRemoveDesc: t('food.meals.manageMealData.removeFromFavoritesDesc'),
      editTitle: t('food.meals.manageMealData.editMeal'),
      editDesc: t('food.meals.manageMealData.editMealDesc'),
      duplicateTitle: t('food.meals.manageMealData.duplicateMeal'),
      duplicateDesc: t('food.meals.manageMealData.duplicateMealDesc'),
      deleteTitle: t('food.meals.manageMealData.deleteMeal'),
      deleteDesc: t('food.meals.manageMealData.deleteMealDesc'),
      formatCaloriesMacros: (params) => t('food.meals.manageMealData.caloriesMacrosFormat', params),
    };
  }

  if (variant === 'exercise') {
    return {
      title: t('exercises.manageExerciseData.title'),
      searchPlaceholder: t('exercises.manageExerciseData.searchPlaceholder'),
      noItemsText: t('exercises.manageExerciseData.noExercises', 'No exercises yet'),
      noItemsDesc: t(
        'exercises.manageExerciseData.noExercisesDesc',
        'Create custom exercises to see them here'
      ),
      endOfHistoryText: t('exercises.manageExerciseData.endOfHistory'),
      menuTitle: t('exercises.manageExerciseData.exerciseOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('exercises.manageExerciseData.editExercise'),
      editDesc: t('exercises.manageExerciseData.editExerciseDesc'),
      duplicateTitle: t('exercises.manageExerciseData.duplicateExercise'),
      duplicateDesc: t('exercises.manageExerciseData.duplicateExerciseDesc'),
      deleteTitle: t('exercises.manageExerciseData.deleteExercise'),
      deleteDesc: t('exercises.manageExerciseData.deleteExerciseDesc'),
      formatCaloriesMacros: () => '', // Not used when formatItemSubtitle is set
      formatItemSubtitle: (item) => {
        // Normalize muscle group: ensure lowercase for translation keys
        const muscleGroupRaw = (item.muscleGroup ?? 'other').toLowerCase();
        const muscleGroup = t(`exercises.muscleGroups.${muscleGroupRaw}`, {
          defaultValue: muscleGroupRaw,
        });

        // Normalize equipment type: ensure lowercase for translation keys
        const equipmentTypeRaw = (item.equipmentType ?? 'other').toLowerCase();
        const equipmentType = t(`exercises.equipmentTypes.${equipmentTypeRaw}`, {
          defaultValue: equipmentTypeRaw,
        });

        return t('exercises.manageExerciseData.detailFormat', {
          muscleGroup,
          equipment: equipmentType,
        });
      },
    };
  }

  if (variant === 'workoutTemplate') {
    return {
      title: t('workouts.manageWorkoutTemplateData.title'),
      searchPlaceholder: t('workouts.manageWorkoutTemplateData.searchPlaceholder'),
      noItemsText: t('workouts.manageWorkoutTemplateData.noTemplates', 'No workout templates yet'),
      noItemsDesc: t(
        'workouts.manageWorkoutTemplateData.noTemplatesDesc',
        'Create workout templates to see them here'
      ),
      endOfHistoryText: t('workouts.manageWorkoutTemplateData.endOfHistory'),
      menuTitle: t('workouts.manageWorkoutTemplateData.templateOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('workouts.manageWorkoutTemplateData.editTemplate'),
      editDesc: t('workouts.manageWorkoutTemplateData.editTemplateDesc'),
      duplicateTitle: t('workouts.manageWorkoutTemplateData.duplicateTemplate'),
      duplicateDesc: t('workouts.manageWorkoutTemplateData.duplicateTemplateDesc'),
      deleteTitle: t('workouts.manageWorkoutTemplateData.deleteTemplate'),
      deleteDesc: t('workouts.manageWorkoutTemplateData.deleteTemplateDesc'),
      formatCaloriesMacros: () => '',
      formatItemSubtitle: (item) =>
        item.description ?? t('workouts.manageWorkoutTemplateData.noDescription'),
    };
  }

  if (variant === 'workoutLog') {
    return {
      title: t('workoutLog.manageWorkoutLogData.title'),
      searchPlaceholder: t('workoutLog.manageWorkoutLogData.searchPlaceholder'),
      noItemsText: t('workoutLog.manageWorkoutLogData.noWorkoutLogs', 'No workout logs yet'),
      noItemsDesc: t(
        'workoutLog.manageWorkoutLogData.noWorkoutLogsDesc',
        'Complete workouts to see them here'
      ),
      endOfHistoryText: t('workoutLog.manageWorkoutLogData.endOfHistory'),
      menuTitle: t('workoutLog.manageWorkoutLogData.workoutLogOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('workoutLog.manageWorkoutLogData.editWorkoutLog'),
      editDesc: t('workoutLog.manageWorkoutLogData.editWorkoutLogDesc'),
      duplicateTitle: t('workoutLog.manageWorkoutLogData.duplicateWorkoutLog'),
      duplicateDesc: t('workoutLog.manageWorkoutLogData.duplicateWorkoutLogDesc'),
      deleteTitle: t('workoutLog.manageWorkoutLogData.deleteWorkoutLog'),
      deleteDesc: t('workoutLog.manageWorkoutLogData.deleteWorkoutLogDesc'),
      formatCaloriesMacros: () => '',
      formatItemSubtitle: (item) =>
        t('workoutLog.manageWorkoutLogData.detailFormat', {
          status: item.isCompleted
            ? t('workoutLog.manageWorkoutLogData.statusCompleted')
            : t('workoutLog.manageWorkoutLogData.statusInProgress'),
          volume:
            item.totalVolume != null
              ? t('workoutLog.manageWorkoutLogData.volumeFormat', { volume: item.totalVolume })
              : '—',
        }),
    };
  }

  if (variant === 'userMetric') {
    return {
      title: t('bodyMetrics.manageMetricData.title'),
      searchPlaceholder: t('bodyMetrics.manageMetricData.searchPlaceholder'),
      noItemsText: t('bodyMetrics.manageMetricData.noEntries', 'No metric entries yet'),
      noItemsDesc: t(
        'bodyMetrics.manageMetricData.noEntriesDesc',
        'Add body metric entries to see them here'
      ),
      endOfHistoryText: t('bodyMetrics.manageMetricData.endOfHistory'),
      menuTitle: t('bodyMetrics.manageMetricData.metricOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('bodyMetrics.manageMetricData.editEntry'),
      editDesc: t('bodyMetrics.manageMetricData.editEntryDesc'),
      duplicateTitle: t('bodyMetrics.manageMetricData.duplicateEntry'),
      duplicateDesc: t('bodyMetrics.manageMetricData.duplicateEntryDesc'),
      deleteTitle: t('bodyMetrics.manageMetricData.deleteEntry'),
      deleteDesc: t('bodyMetrics.manageMetricData.deleteEntryDesc'),
      formatCaloriesMacros: () => '',
      formatItemSubtitle: (item) => {
        const value = item.metricValue ?? 0;
        const unit = item.metricUnit ?? '';
        return unit ? `${value} ${unit}`.trim() : String(value);
      },
    };
  }

  if (variant === 'nutrition_log') {
    return {
      title: t('nutrition.manageFoodData.title'),
      searchPlaceholder: t('nutrition.manageFoodData.searchPlaceholder'),
      noItemsText: t('nutrition.manageFoodData.noLogs', 'No food logs yet'),
      noItemsDesc: t(
        'nutrition.manageFoodData.noLogsDesc',
        'Start tracking your meals to see them here'
      ),
      endOfHistoryText: t('nutrition.manageFoodData.endOfHistory'),
      menuTitle: t('nutrition.manageFoodData.foodOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('nutrition.manageFoodData.editFoodEntry'),
      editDesc: t('nutrition.manageFoodData.editFoodEntryDesc'),
      duplicateTitle: t('nutrition.manageFoodData.duplicateEntry'),
      duplicateDesc: t('nutrition.manageFoodData.duplicateEntryDesc'),
      deleteTitle: t('nutrition.manageFoodData.deleteEntry'),
      deleteDesc: t('nutrition.manageFoodData.deleteEntryDesc'),
      formatCaloriesMacros: (params) => t('food.manageFoodData.caloriesMacrosFormat', params),
    };
  }

  if (variant === 'food') {
    return {
      title: t('food.manageFoodLibrary.title'),
      searchPlaceholder: t('food.manageFoodLibrary.searchPlaceholder'),
      noItemsText: t('food.manageFoodLibrary.noFoods', 'No foods yet'),
      noItemsDesc: t(
        'food.manageFoodLibrary.noFoodsDesc',
        'Add custom foods or scan products to see them here'
      ),
      endOfHistoryText: t('food.manageFoodLibrary.endOfHistory'),
      menuTitle: t('food.manageFoodLibrary.foodOptions'),
      favoriteAddTitle: t('food.manageFoodLibrary.addToFavorites'),
      favoriteRemoveTitle: t('food.manageFoodLibrary.removeFromFavorites'),
      favoriteAddDesc: t('food.manageFoodLibrary.addToFavoritesDesc'),
      favoriteRemoveDesc: t('food.manageFoodLibrary.removeFromFavoritesDesc'),
      editTitle: t('food.manageFoodLibrary.editFood'),
      editDesc: t('food.manageFoodLibrary.editFoodDesc'),
      duplicateTitle: t('food.manageFoodLibrary.duplicateFood'),
      duplicateDesc: t('food.manageFoodLibrary.duplicateFoodDesc'),
      deleteTitle: t('food.manageFoodLibrary.deleteFood'),
      deleteDesc: t('food.manageFoodLibrary.deleteFoodDesc'),
      formatCaloriesMacros: (params) => t('food.manageFoodLibrary.caloriesMacrosFormat', params),
    };
  }

  if (variant === 'foodPortion') {
    return {
      title: t('food.managePortionData.title'),
      searchPlaceholder: t('food.managePortionData.searchPlaceholder'),
      noItemsText: t('food.managePortionData.noPortions', 'No portions yet'),
      noItemsDesc: t(
        'food.managePortionData.noPortionsDesc',
        'Create custom portion sizes to see them here'
      ),
      endOfHistoryText: t('food.managePortionData.endOfHistory'),
      menuTitle: t('food.managePortionData.portionOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('food.managePortionData.editPortion'),
      editDesc: t('food.managePortionData.editPortionDesc'),
      duplicateTitle: t('food.managePortionData.duplicatePortion'),
      duplicateDesc: t('food.managePortionData.duplicatePortionDesc'),
      deleteTitle: t('food.managePortionData.deletePortion'),
      deleteDesc: t('food.managePortionData.deletePortionDesc'),
      formatCaloriesMacros: () => '',
      formatItemSubtitle: (item) =>
        t('food.managePortionData.gramWeightFormat', {
          grams: item.portionGramWeight ?? 0,
        }),
    };
  }

  if (variant === 'nutritionGoal') {
    return {
      title: t('goalsManagement.manageGoalData.title'),
      searchPlaceholder: t('goalsManagement.manageGoalData.searchPlaceholder'),
      noItemsText: t('goalsManagement.manageGoalData.noGoals', 'No goals yet'),
      noItemsDesc: t(
        'goalsManagement.manageGoalData.noGoalsDesc',
        'Set nutrition goals to see them here'
      ),
      endOfHistoryText: t('goalsManagement.manageGoalData.endOfHistory'),
      menuTitle: t('goalsManagement.manageGoalData.goalOptions'),
      favoriteAddTitle: '',
      favoriteRemoveTitle: '',
      favoriteAddDesc: '',
      favoriteRemoveDesc: '',
      editTitle: t('goalsManagement.manageGoalData.editGoal'),
      editDesc: t('goalsManagement.manageGoalData.editGoalDesc'),
      duplicateTitle: t('goalsManagement.manageGoalData.duplicateGoal'),
      duplicateDesc: t('goalsManagement.manageGoalData.duplicateGoalDesc'),
      deleteTitle: t('goalsManagement.manageGoalData.deleteGoal'),
      deleteDesc: t('goalsManagement.manageGoalData.deleteGoalDesc'),
      formatCaloriesMacros: () => '',
      formatItemSubtitle: (item) =>
        t('goalsManagement.manageGoalData.subtitleFormat', {
          calories: item.goalCalories ?? 0,
          phase: item.goalEatingPhase ?? '',
          targetWeight: item.goalTargetWeight ?? 0,
        }),
    };
  }

  // Exhaustive: should not reach (all variants handled above)
  return {
    title: '',
    searchPlaceholder: '',
    noItemsText: '',
    noItemsDesc: '',
    endOfHistoryText: '',
    menuTitle: '',
    favoriteAddTitle: '',
    favoriteRemoveTitle: '',
    favoriteAddDesc: '',
    favoriteRemoveDesc: '',
    editTitle: '',
    editDesc: '',
    duplicateTitle: '',
    duplicateDesc: '',
    deleteTitle: '',
    deleteDesc: '',
    formatCaloriesMacros: () => '',
  };
}

// Helper: determine the empty-state icon name for a given DataLogModal variant
export function getEmptyStateIconName(
  variant: DataLogModalVariant
): ComponentProps<typeof MaterialIcons>['name'] {
  // Map variants to MaterialIcons names used for the empty-state illustration
  switch (variant) {
    case 'exercise':
    case 'workoutLog':
    case 'workoutTemplate':
      return 'fitness-center';
    case 'userMetric':
      return 'monitor-weight';
    case 'foodPortion':
      return 'scale';
    case 'nutritionGoal':
      return 'flag';
    // meal, nutrition_log, food and any other fallback
    default:
      return 'restaurant-menu';
  }
}

// Base type that MealDataDisplayItem, FoodDataDisplayItem, ExerciseDataDisplayItem, and WorkoutLogDataDisplayItem satisfy
export type DataLogDisplayItem = {
  id: string;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  isFavorite?: boolean; // Optional - only meals have this
  muscleGroup?: string; // Optional - only exercises have this
  equipmentType?: string; // Optional - only exercises have this
  isCompleted?: boolean; // Optional - only workout logs have this
  totalVolume?: number; // Optional - only workout logs have this
  description?: string; // Optional - only workout templates have this
  metricValue?: number; // Optional - only user metrics have this
  metricUnit?: string; // Optional - only user metrics have this
  portionGramWeight?: number; // Optional - only food portions have this
  goalCalories?: number; // Optional - only nutrition goals have this
  goalEatingPhase?: string; // Optional - only nutrition goals have this
  goalTargetWeight?: number; // Optional - only nutrition goals have this
};

export type DataLogModalData = {
  dayGroups: { date: string; dateTimestamp: number; items: DataLogDisplayItem[] }[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

type DataLogModalProps = {
  visible: boolean;
  onClose: () => void;
  variant: DataLogModalVariant;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
} & DataLogModalData;

export function DataLogModal({
  visible,
  onClose,
  variant,
  searchQuery,
  onSearchQueryChange,
  dayGroups: typedDayGroups,
  isLoading,
  isLoadingMore,
  hasMore,
  loadMore,
  refresh,
}: DataLogModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [selectedItem, setSelectedItem] = useState<DataLogDisplayItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);

  // Create modal states
  const [createMealModalVisible, setCreateMealModalVisible] = useState(false);
  const [createFoodModalVisible, setCreateFoodModalVisible] = useState(false);
  const [createExerciseModalVisible, setCreateExerciseModalVisible] = useState(false);
  const [createFoodPortionModalVisible, setCreateFoodPortionModalVisible] = useState(false);
  const [createWorkoutModalVisible, setCreateWorkoutModalVisible] = useState(false);
  const [createWorkoutOptionsModalVisible, setCreateWorkoutOptionsModalVisible] = useState(false);

  const translations = getDataLogModalTranslations(variant, t);

  // Edit modal integration
  const {
    initialValues: editInitialValues,
    isLoading: isLoadingEdit,
    error: editError,
    save: saveEdit,
  } = useEditRecord(variant, editRecordId, editModalVisible);

  const editFields = getEditFields(variant);

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditRecordId(null);
  };

  const handleSaveEdit = async (values: any) => {
    await saveEdit(values);
    await refresh();
  };

  const handleItemPress = (item: DataLogDisplayItem) => {
    setSelectedItem(item);
    setShowMenu(true);
  };

  const handleToggleFavorite = async () => {
    if (!selectedItem) {
      return;
    }
    setShowMenu(false);

    try {
      if (variant === 'meal') {
        await MealService.toggleMealFavorite(selectedItem.id);
      } else if (variant === 'food') {
        await FoodService.toggleFavorite(selectedItem.id);
      }
      await refresh();
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
  };

  const handleEdit = () => {
    if (!selectedItem) {
      return;
    }

    setShowMenu(false);
    setEditRecordId(selectedItem.id);
    setEditModalVisible(true);
  };

  const handleDuplicate = async () => {
    if (!selectedItem) {
      return;
    }
    setShowMenu(false);
    setIsDuplicating(true);

    try {
      switch (variant) {
        case 'meal':
          await MealService.duplicateMeal(selectedItem.id);
          break;
        case 'food':
          await FoodService.duplicateFood(selectedItem.id);
          break;
        case 'foodPortion':
          await FoodPortionService.duplicatePortion(selectedItem.id);
          break;
        case 'exercise':
          await ExerciseService.duplicateExercise(selectedItem.id);
          break;
        case 'workoutTemplate':
          await WorkoutTemplateService.duplicateTemplate(selectedItem.id);
          break;
        case 'workoutLog':
          await WorkoutService.duplicateWorkoutLog(selectedItem.id);
          break;
        case 'nutrition_log':
          await NutritionService.duplicateNutritionLog(selectedItem.id);
          break;
        case 'userMetric':
        case 'nutritionGoal':
          // These variants don't support duplicate
          break;
      }
      await refresh();
    } catch (error) {
      console.error('Duplicate failed:', error);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDelete = () => {
    if (!selectedItem) {
      return;
    }
    setShowMenu(false);
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) {
      return;
    }
    setIsDeleting(true);

    try {
      switch (variant) {
        case 'meal':
          // TODO: Check if meal is used in any nutrition logs with the ConfirmationModal and warn user
          await MealService.deleteMeal(selectedItem.id);
          break;
        case 'food':
          // TODO: Check if food is used in any meals or nutrition logs with the ConfirmationModal and warn user
          await FoodService.deleteFood(selectedItem.id);
          break;
        case 'foodPortion':
          // TODO: Check if portion is used in any foods, meals, or nutrition logs with the ConfirmationModal and warn user
          await FoodPortionService.deleteFoodPortion(selectedItem.id);
          break;
        case 'exercise':
          // TODO: Check if exercise is used in any workout templates or logs with the ConfirmationModal and warn user
          await ExerciseService.deleteExercise(selectedItem.id);
          break;
        case 'workoutTemplate':
          // TODO: Check if template has active schedules with the ConfirmationModal and warn user
          await WorkoutTemplateService.deleteTemplate(selectedItem.id);
          break;
        case 'workoutLog':
          // TODO: Check if this is the currently active workout with the ConfirmationModal and warn user
          await WorkoutService.deleteWorkoutLog(selectedItem.id);
          break;
        case 'nutrition_log':
          await NutritionService.deleteNutritionLog(selectedItem.id);
          break;
        case 'userMetric':
          await UserMetricService.deleteMetric(selectedItem.id);
          break;
        case 'nutritionGoal':
          // TODO: Check if this is the current active goal with the ConfirmationModal and warn user
          await NutritionGoalService.deleteGoal(selectedItem.id);
          break;
      }
      await refresh();
      setDeleteModalVisible(false);
    } catch (error) {
      console.error('Delete failed:', error);
      showSnackbar('error', t('common.deleteFailed'), {
        action: t('common.ok'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getMenuItems = (): BottomPopUpMenuItem[] => {
    if (!selectedItem) {
      return [];
    }

    const EditIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="edit" {...props} />
    );
    const DuplicateIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="content-copy" {...props} />
    );
    const DeleteIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="delete" {...props} />
    );
    const FavoriteIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name={selectedItem.isFavorite ? 'star' : 'star-border'} {...props} />
    );

    const menuItems: BottomPopUpMenuItem[] = [];

    // Add Favorite toggle for meals and food library
    if (variant === 'meal' || variant === 'food') {
      menuItems.push({
        icon: FavoriteIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: selectedItem.isFavorite
          ? translations.favoriteRemoveTitle
          : translations.favoriteAddTitle,
        description: selectedItem.isFavorite
          ? translations.favoriteRemoveDesc
          : translations.favoriteAddDesc,
        onPress: handleToggleFavorite,
      });
    }

    // Supported edit variants
    const editSupportedVariants: DataLogModalVariant[] = [
      'meal',
      'exercise',
      'foodPortion',
      'userMetric',
      'workoutTemplate',
      'food',
      'nutrition_log',
      'nutritionGoal',
    ];

    // Add Edit menu item only if supported
    if (editSupportedVariants.includes(variant)) {
      menuItems.push({
        icon: EditIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: translations.editTitle,
        description: translations.editDesc,
        onPress: handleEdit,
      });
    }

    // Add common menu items (duplicate and delete)
    menuItems.push(
      {
        icon: DuplicateIcon,
        iconColor: theme.colors.text.primary,
        iconBgColor: theme.colors.background.iconDarker,
        title: translations.duplicateTitle,
        description: translations.duplicateDesc,
        onPress: handleDuplicate,
      },
      {
        icon: DeleteIcon,
        iconColor: theme.colors.status.error50,
        iconBgColor: 'rgba(239, 68, 68, 0.1)',
        title: translations.deleteTitle,
        description: translations.deleteDesc,
        onPress: handleDelete,
      }
    );

    return menuItems;
  };

  const renderItem = (item: DataLogDisplayItem) => (
    <GenericCard key={item.id} variant="card" isPressable onPress={() => handleItemPress(item)}>
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1 flex-row items-center gap-4">
          <View
            className="size-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: item.iconBgColor }}
          >
            <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-semibold leading-snug text-text-primary">
                {item.name}
              </Text>
              {(variant === 'meal' || variant === 'food') && item.isFavorite ? (
                <MaterialIcons name="star" size={16} color={theme.colors.accent.secondary} />
              ) : null}
            </View>
            <Text className="text-sm font-medium tracking-wider text-text-secondary">
              {translations.formatItemSubtitle
                ? translations.formatItemSubtitle(item)
                : translations.formatCaloriesMacros({
                    calories: item.calories ?? 0,
                    protein: item.protein ?? 0,
                    carbs: item.carbs ?? 0,
                    fat: item.fat ?? 0,
                  })}
            </Text>
          </View>
        </View>
        <Pressable
          className="size-8 items-center justify-center rounded-full active:opacity-70"
          onPress={() => handleItemPress(item)}
        >
          <MaterialIcons name="more-vert" size={20} color={theme.colors.text.secondary} />
        </Pressable>
      </View>
    </GenericCard>
  );

  const renderHeaderRight = () => (
    <Pressable
      className="flex size-10 items-center justify-center rounded-full active:bg-white/10"
      onPress={() => {
        setShowCreateMenu(true);
      }}
    >
      <MaterialIcons name="add" size={theme.iconSize.md} color={theme.colors.text.primary} />
    </Pressable>
  );

  const getCreateMenuItems = (): BottomPopUpMenuItem[] => {
    const CreateIcon = (props: { size: number; color: string }) => (
      <MaterialIcons name="add" {...props} />
    );

    const menuItems: BottomPopUpMenuItem[] = [];

    switch (variant) {
      case 'meal':
        menuItems.push({
          icon: CreateIcon,
          iconColor: theme.colors.text.primary,
          iconBgColor: theme.colors.background.iconDarker,
          title: t('food.createMeal.title'),
          description: t('food.createMeal.description'),
          onPress: () => {
            setShowCreateMenu(false);
            setCreateMealModalVisible(true);
          },
        });
        break;
      case 'food':
        menuItems.push({
          icon: CreateIcon,
          iconColor: theme.colors.text.primary,
          iconBgColor: theme.colors.background.iconDarker,
          title: t('food.createFood.title'),
          description: t('food.createFood.description'),
          onPress: () => {
            setShowCreateMenu(false);
            setCreateFoodModalVisible(true);
          },
        });
        break;
      case 'foodPortion':
        menuItems.push({
          icon: CreateIcon,
          iconColor: theme.colors.text.primary,
          iconBgColor: theme.colors.background.iconDarker,
          title: t('food.createPortion.title'),
          description: t('food.createPortion.description'),
          onPress: () => {
            setShowCreateMenu(false);
            setCreateFoodPortionModalVisible(true);
          },
        });
        break;
      case 'exercise':
        menuItems.push({
          icon: CreateIcon,
          iconColor: theme.colors.text.primary,
          iconBgColor: theme.colors.background.iconDarker,
          title: t('exercises.createExercise.title'),
          description: t('exercises.createExercise.description'),
          onPress: () => {
            setShowCreateMenu(false);
            setCreateExerciseModalVisible(true);
          },
        });
        break;
      case 'workoutTemplate':
        menuItems.push({
          icon: CreateIcon,
          iconColor: theme.colors.text.primary,
          iconBgColor: theme.colors.background.iconDarker,
          title: t('workouts.createTemplate.title'),
          description: t('workouts.createTemplate.description'),
          onPress: () => {
            setShowCreateMenu(false);
            setCreateWorkoutOptionsModalVisible(true);
          },
        });
        break;
      case 'userMetric':
        // User metrics are typically added from the main metrics screen, not here
        break;
      case 'nutrition_log':
      case 'nutritionGoal':
        // These are typically created from other flows
        break;
      case 'workoutLog':
        // Workout logs are created from active workout sessions
        break;
    }

    return menuItems;
  };

  // Unify load more button to size="md" and consistent labels
  const loadingLabel = isLoadingMore
    ? t('common.loading', 'Loading...')
    : t('bodyMetrics.history.loadMore', 'Load More');

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={translations.title}
        headerRight={renderHeaderRight()}
        scrollable
      >
        <ScrollView className="mt-6 flex flex-col gap-3 px-4">
          {/* Search Bar */}
          <View className="relative">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              placeholder={translations.searchPlaceholder}
              icon={<MaterialIcons name="search" size={20} color={theme.colors.text.tertiary} />}
            />
          </View>

          {/* Item List */}
          <View className="mt-6 flex flex-col gap-3">
            {isLoading ? (
              <View className="flex flex-col gap-4">
                <SkeletonLoader width={80} height={16} className="mb-2" />
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="rounded-lg border p-4"
                    style={{
                      backgroundColor: theme.colors.background.card,
                      borderColor: theme.colors.background.white5,
                    }}
                  >
                    <View className="flex-row items-center gap-4">
                      <SkeletonLoader width={40} height={40} borderRadius={20} />
                      <View className="flex-1 gap-2">
                        <SkeletonLoader width="70%" height={16} />
                        <SkeletonLoader width="50%" height={14} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : typedDayGroups.length === 0 ? (
              <View
                className="items-center justify-center py-12"
                style={{ backgroundColor: theme.colors.background.card }}
              >
                <MaterialIcons
                  name={getEmptyStateIconName(variant)}
                  size={48}
                  color={theme.colors.text.tertiary}
                />
                <Text
                  className="mt-3 text-center text-base font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {translations.noItemsText}
                </Text>
                <Text
                  className="mt-1 text-center text-sm"
                  style={{ color: theme.colors.text.tertiary }}
                >
                  {translations.noItemsDesc}
                </Text>
              </View>
            ) : (
              typedDayGroups.map((dayData) => (
                <View
                  key={`${dayData.date}-${dayData.dateTimestamp}`}
                  className="flex flex-col gap-2"
                >
                  <View>
                    <Text className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                      {dayData.date}
                    </Text>
                  </View>
                  <View className="flex flex-col gap-2">{dayData.items.map(renderItem)}</View>
                </View>
              ))
            )}

            {!isLoading && hasMore ? (
              <View className="py-4">
                <Button
                  label={loadingLabel}
                  variant="outline"
                  size="sm"
                  width="full"
                  disabled={isLoadingMore}
                  loading={isLoadingMore}
                  onPress={loadMore}
                />
              </View>
            ) : null}
          </View>

          {/* End of history indicator */}
          {!isLoading && typedDayGroups.length > 0 && !hasMore ? (
            <View className="mt-12 flex flex-col items-center justify-center opacity-40">
              <MaterialIcons name="history" size={48} color={theme.colors.text.tertiary} />
              <Text className="mt-2 text-sm font-medium text-text-tertiary">
                {translations.endOfHistoryText}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </FullScreenModal>

      {/* Item Menu */}
      <BottomPopUpMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={translations.menuTitle}
        items={getMenuItems()}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        title={translations.deleteTitle}
        message={t('common.deleteConfirmMessage', { name: selectedItem?.name || '' })}
        confirmLabel={t('common.delete', 'Delete')}
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Edit Modal */}
      <GenericEditModal
        visible={editModalVisible}
        onClose={handleCloseEditModal}
        title={translations.editTitle}
        fields={editFields}
        initialValues={editInitialValues}
        onSave={handleSaveEdit}
        isLoading={isLoadingEdit}
        loadError={editError ?? undefined}
      />

      {/* Create Menu */}
      {showCreateMenu ? (
        <BottomPopUpMenu
          visible={showCreateMenu}
          onClose={() => setShowCreateMenu(false)}
          title={t('common.createNew')}
          items={getCreateMenuItems()}
        />
      ) : null}

      {/* Create Modals */}
      {createMealModalVisible ? (
        <CreateMealModal
          visible={createMealModalVisible}
          onClose={() => setCreateMealModalVisible(false)}
          onSave={() => {
            refresh();
            setCreateMealModalVisible(false);
          }}
        />
      ) : null}

      {createFoodModalVisible ? (
        <CreateCustomFoodModal
          visible={createFoodModalVisible}
          onClose={() => setCreateFoodModalVisible(false)}
          onSave={() => {
            refresh();
            setCreateFoodModalVisible(false);
          }}
        />
      ) : null}

      {createExerciseModalVisible ? (
        <CreateExerciseModal
          visible={createExerciseModalVisible}
          onClose={() => setCreateExerciseModalVisible(false)}
        />
      ) : null}

      {createFoodPortionModalVisible ? (
        <CreateFoodPortionModal
          visible={createFoodPortionModalVisible}
          onClose={() => setCreateFoodPortionModalVisible(false)}
          onCreatePortion={() => {
            refresh();
            setCreateFoodPortionModalVisible(false);
          }}
        />
      ) : null}

      {createWorkoutOptionsModalVisible ? (
        <CreateWorkoutOptionsModal
          visible={createWorkoutOptionsModalVisible}
          onClose={() => setCreateWorkoutOptionsModalVisible(false)}
          onGenerateWithAi={() => {
            setCreateWorkoutOptionsModalVisible(false);
            // TODO: Implement AI workout generation
          }}
          onCreateEmptyTemplate={() => {
            setCreateWorkoutOptionsModalVisible(false);
            setCreateWorkoutModalVisible(true);
          }}
          onBrowseTemplates={() => {
            setCreateWorkoutOptionsModalVisible(false);
            // TODO: Implement template browsing
          }}
        />
      ) : null}

      {createWorkoutModalVisible ? (
        <CreateWorkoutModal
          visible={createWorkoutModalVisible}
          onClose={() => setCreateWorkoutModalVisible(false)}
        />
      ) : null}
    </>
  );
}

// Wrapper: owns search state and calls only useMealDataLogs
type MealDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function MealDataModal({ visible, onClose }: MealDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useMealDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="meal"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useFoodDataLogs
type NutritionLogModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function NutritionLogModal({ visible, onClose }: NutritionLogModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useFoodDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="nutrition_log"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useFoodsDataLogs (Food model / food library)
type FoodDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FoodDataModal({ visible, onClose }: FoodDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useFoodsDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="food"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useFoodPortionDataLogs
type FoodPortionDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function FoodPortionDataModal({ visible, onClose }: FoodPortionDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } =
    useFoodPortionDataLogs({
      visible,
      batchSize: 20,
      searchQuery,
    });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="foodPortion"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useExerciseDataLogs
type ExerciseDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ExerciseDataModal({ visible, onClose }: ExerciseDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useExerciseDataLogs({
    visible,
    batchSize: 20,
    searchQuery,
  });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="exercise"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useWorkoutLogDataLogs
type WorkoutLogDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function WorkoutLogDataModal({ visible, onClose }: WorkoutLogDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useWorkoutLogDataLogs(
    {
      visible,
      batchSize: 20,
      searchQuery,
    }
  );

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="workoutLog"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useWorkoutTemplateDataLogs
type WorkoutTemplateDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function WorkoutTemplateDataModal({ visible, onClose }: WorkoutTemplateDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } =
    useWorkoutTemplateDataLogs({
      visible,
      batchSize: 20,
      searchQuery,
    });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="workoutTemplate"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useUserMetricDataLogs
type UserMetricDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function UserMetricDataModal({ visible, onClose }: UserMetricDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } = useUserMetricDataLogs(
    {
      visible,
      batchSize: 20,
      searchQuery,
    }
  );

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="userMetric"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}

// Wrapper: owns search state and calls only useNutritionGoalDataLogs
type NutritionGoalDataModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function NutritionGoalDataModal({ visible, onClose }: NutritionGoalDataModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { dayGroups, isLoading, isLoadingMore, hasMore, loadMore, refresh } =
    useNutritionGoalDataLogs({
      visible,
      batchSize: 20,
      searchQuery,
    });

  return (
    <DataLogModal
      visible={visible}
      onClose={onClose}
      variant="nutritionGoal"
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      dayGroups={dayGroups as DataLogModalData['dayGroups']}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      loadMore={loadMore}
      refresh={refresh}
    />
  );
}
