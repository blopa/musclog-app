import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Copy,
  Edit,
  GitMerge,
  ListPlus,
  Scale,
  ScanLine,
  Scissors,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { DailySummaryCard } from '@/components/cards/DailySummaryCard/DailySummaryCard';
import { FoodItemCard } from '@/components/cards/FoodItemCard';
import { MealGroupCard } from '@/components/cards/MealGroupCard';
import { useCoach } from '@/components/CoachContext';
import { DateNavigator } from '@/components/DateNavigator';
import { MasterLayout } from '@/components/MasterLayout';
import { MealSection } from '@/components/MealSection';
import { AddFoodModal } from '@/components/modals/AddFoodModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import CreateCustomFoodModal from '@/components/modals/CreateCustomFoodModal';
import { CreateMealModal } from '@/components/modals/CreateMealModal';
import { FoodMealDetailsModal } from '@/components/modals/FoodMealDetailsModal';
import { FoodSearchModal } from '@/components/modals/FoodSearchModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { MealInsightsModal } from '@/components/modals/MealInsightsModal';
import { MoveCopyMealModal } from '@/components/modals/MoveCopyMealModal';
import MyMealsModal from '@/components/modals/MyMealsModal';
import { ScaleMealPortionModal } from '@/components/modals/ScaleMealPortionModal';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { useSmartCamera } from '@/context/SmartCameraContext';
import { useSnackbar } from '@/context/SnackbarContext';
import Food from '@/database/models/Food';
import NutritionLog, { type MealType } from '@/database/models/NutritionLog';
import {
  ChatService,
  NutritionService,
  scaleMealNutritionLogsToTotalGrams,
  SettingsService,
} from '@/database/services';
import { useDailyNutritionSummary } from '@/hooks/useDailyNutritionSummary';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import { localCalendarDayDate, localCalendarDayDateFromDayKeyMs } from '@/utils/calendarDate';
import { getMealCritique } from '@/utils/coachAI';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { getSimpleServingDisplay } from '@/utils/foodDisplay';
import { handleError } from '@/utils/handleError';
import { captureException } from '@/utils/sentry';

/**
 * Check if there are duplicate foods among UNGROUPED items only.
 * Foods with group_id are excluded from merging - they're already part of a meal group.
 * Returns true only if there are duplicates among ungrouped foods.
 */
function mealHasUngroupedDuplicateFoods(mealFoods: { log: NutritionLog }[]): boolean {
  // Filter out grouped foods (they have group_id)
  const ungroupedFoods = mealFoods.filter((entry) => !entry.log.groupId);

  const groupedByFood = new Map<string, typeof ungroupedFoods>();
  for (const entry of ungroupedFoods) {
    if (!entry.log.foodId) {
      continue;
    }
    const existing = groupedByFood.get(entry.log.foodId) || [];
    existing.push(entry);
    groupedByFood.set(entry.log.foodId, existing);
  }

  return [...groupedByFood.values()].some((g) => g.length > 1);
}

const getMealActionErrorKey = (mode: 'move' | 'copy' | 'split'): string => {
  switch (mode) {
    case 'move':
      return 'food.actions.moveError';
    case 'copy':
      return 'food.actions.copyError';
    case 'split':
      return 'food.actions.splitError';
    default:
      return 'food.actions.moveError';
  }
};

export default function FoodScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, locale: appLocale } = useFormatAppNumber();
  const { units, isAiConfigured, intuitiveEatingMode } = useSettings();
  const { openCoach } = useCoach();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const { openCamera, setCurrentDate } = useSmartCamera();
  const [isCreateCustomFoodVisible, setIsCreateCustomFoodVisible] = useState(false);
  const [isAddFoodModalVisible, setIsAddFoodModalVisible] = useState(false);
  const [isFoodSearchModalVisible, setIsFoodSearchModalVisible] = useState(false);
  const [isMyMealsModalVisible, setIsMyMealsModalVisible] = useState(false);
  const [isQuickTrackMealModalVisible, setIsQuickTrackMealModalVisible] = useState(false);
  const [isFoodMenuVisible, setIsFoodMenuVisible] = useState(false);
  const [isGoalsManagementModalVisible, setIsGoalsManagementModalVisible] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<{
    log: NutritionLog;
    food: Food | null;
    nutrients: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    gramWeight: number;
    displayName: string;
  } | null>(null);
  const [isFoodDetailsModalVisible, setIsFoodDetailsModalVisible] = useState(false);
  const [isDeleteConfirmationVisible, setIsDeleteConfirmationVisible] = useState(false);
  const [isDeleteFoodLoading, setIsDeleteFoodLoading] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));

  // Keep camera context aware of the current date so the nav-bar camera button
  // (which has no logDate) also opens FoodMealDetailsModal on the right date.
  useEffect(() => {
    setCurrentDate(selectedDate);
    return () => setCurrentDate(undefined);
  }, [selectedDate, setCurrentDate]);
  const [isMealMenuVisible, setIsMealMenuVisible] = useState(false);
  const [selectedMealForMenu, setSelectedMealForMenu] = useState<MealType | null>(null);
  const [isCreateMealModalVisible, setIsCreateMealModalVisible] = useState(false);
  const [createMealInitialFoods, setCreateMealInitialFoods] = useState<
    { food: Food; amount: number }[]
  >([]);
  const [isDeleteAllMealVisible, setIsDeleteAllMealVisible] = useState(false);
  const [isDeleteAllMealLoading, setIsDeleteAllMealLoading] = useState(false);
  const [isMealActionModalVisible, setIsMealActionModalVisible] = useState(false);
  const [mealActionMode, setMealActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealActionLoading, setIsMealActionLoading] = useState(false);
  const [isMergeDuplicatesVisible, setIsMergeDuplicatesVisible] = useState(false);
  const [isMergeDuplicatesLoading, setIsMergeDuplicatesLoading] = useState(false);
  const [isMealInsightsVisible, setIsMealInsightsVisible] = useState(false);
  const [isMealInsightsLoading, setIsMealInsightsLoading] = useState(false);
  const [isFoodMoveModalVisible, setIsFoodMoveModalVisible] = useState(false);
  const [isFoodMoveLoading, setIsFoodMoveLoading] = useState(false);
  const [isFoodSplitModalVisible, setIsFoodSplitModalVisible] = useState(false);
  const [isFoodSplitLoading, setIsFoodSplitLoading] = useState(false);
  const [isScaleMealPortionModalVisible, setIsScaleMealPortionModalVisible] = useState(false);
  const [isScaleMealPortionLoading, setIsScaleMealPortionLoading] = useState(false);
  const [selectedMealGroup, setSelectedMealGroup] = useState<{
    groupId: string;
    mealName: string;
    entries: {
      log: NutritionLog;
      food: Food | null;
      nutrients: any;
      gramWeight: number;
      displayName: string;
    }[];
    totalNutrients: { calories: number; protein: number; carbs: number; fat: number };
  } | null>(null);
  const [isMealGroupMenuVisible, setIsMealGroupMenuVisible] = useState(false);
  const [isDeleteMealGroupVisible, setIsDeleteMealGroupVisible] = useState(false);
  const [isDeleteMealGroupLoading, setIsDeleteMealGroupLoading] = useState(false);

  // Meal Group action states
  const [isMealGroupScaleModalVisible, setIsMealGroupScaleModalVisible] = useState(false);
  const [isMealGroupScaleLoading, setIsMealGroupScaleLoading] = useState(false);
  const [isMealGroupActionModalVisible, setIsMealGroupActionModalVisible] = useState(false);
  const [mealGroupActionMode, setMealGroupActionMode] = useState<'move' | 'copy' | 'split'>('move');
  const [isMealGroupActionLoading, setIsMealGroupActionLoading] = useState(false);
  const [isMealGroupCreateMealModalVisible, setIsMealGroupCreateMealModalVisible] = useState(false);
  const [mealGroupCreateMealInitialFoods, setMealGroupCreateMealInitialFoods] = useState<
    { food: Food; amount: number }[]
  >([]);
  const [isMealGroupInsightsVisible, setIsMealGroupInsightsVisible] = useState(false);
  const [isMealGroupInsightsLoading, setIsMealGroupInsightsLoading] = useState(false);

  const {
    logs,
    dailyNutrients,
    secondaryNutrients,
    isLoading,
    refresh,
    totalCount,
    nutritionGoal,
  } = useDailyNutritionSummary({
    date: selectedDate,
    enableReactivity: true,
    visible: true,
  });

  const [resolvedLogs, setResolvedLogs] = useState<
    {
      log: NutritionLog;
      food: Food | null;
      nutrients: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        alcohol: number;
      };
      gramWeight: number;
      displayName: string;
    }[]
  >([]);
  const [isResolvingRelations, setIsResolvingRelations] = useState(false);

  // Show skeleton until data is loaded
  const isScreenLoading = isLoading || isResolvingRelations;

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      setIsResolvingRelations(true);
      setResolvedLogs([]);

      try {
        const resolved = await Promise.all(
          logs.map(async (log) => {
            let food: Food | null = null;
            try {
              food = await log.food;
            } catch {
              // Food may be deleted; we still show the log using snapshot name and nutrients
            }
            const [nutrients, gramWeight, displayName] = await Promise.all([
              log.getNutrients(),
              log.getGramWeight(),
              log.getDisplayName(),
            ]);
            return { log, food, nutrients, gramWeight, displayName };
          })
        );

        if (!cancelled) {
          setResolvedLogs(resolved);
          setIsResolvingRelations(false);
        }
      } catch {
        if (!cancelled) {
          setResolvedLogs([]);
          setIsResolvingRelations(false);
        }
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [logs]);

  // Calculate calories consumed and macros
  const caloriesData = useMemo(() => {
    const totalCalories = nutritionGoal?.totalCalories || 2500;
    const consumedCalories = dailyNutrients?.calories || 0;
    const percentage = Math.round((consumedCalories / totalCalories) * 100);

    return {
      consumed: consumedCalories,
      total: totalCalories,
      percentage,
    };
  }, [dailyNutrients, nutritionGoal]);

  // ALL logs by meal type — used by action handlers (delete all, move, copy, split, scale, etc.)
  const mealsByType = useMemo(() => {
    const meals: Record<string, (typeof resolvedLogs)[number][]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };

    resolvedLogs.forEach((entry) => {
      if (entry.log.type && meals[entry.log.type]) {
        meals[entry.log.type].push(entry);
      }
    });

    return meals;
  }, [resolvedLogs]);

  // Ungrouped logs only — used for rendering individual FoodItemCards
  const ungroupedByType = useMemo(() => {
    const meals: Record<string, (typeof resolvedLogs)[number][]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };

    resolvedLogs.forEach((entry) => {
      if (entry.log.type && meals[entry.log.type] && !entry.log.groupId) {
        meals[entry.log.type].push(entry);
      }
    });

    return meals;
  }, [resolvedLogs]);

  // Group logs that belong to a named meal (have a group_id) by meal type
  type MealGroup = {
    groupId: string;
    mealName: string;
    entries: (typeof resolvedLogs)[number][];
    totalNutrients: { calories: number; protein: number; carbs: number; fat: number };
  };

  const mealGroupsByType = useMemo(() => {
    const groups: Record<string, MealGroup[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      other: [],
    };

    // Collect entries per groupId per mealType
    const groupMap: Record<string, Record<string, (typeof resolvedLogs)[number][]>> = {
      breakfast: {},
      lunch: {},
      dinner: {},
      snack: {},
      other: {},
    };

    resolvedLogs.forEach((entry) => {
      const type = entry.log.type;
      const gid = entry.log.groupId;
      if (type && gid && groupMap[type]) {
        if (!groupMap[type][gid]) {
          groupMap[type][gid] = [];
        }
        groupMap[type][gid].push(entry);
      }
    });

    // Convert to array of MealGroup with aggregated totals
    Object.entries(groupMap).forEach(([type, typeGroups]) => {
      Object.entries(typeGroups).forEach(([groupId, entries]) => {
        const totalNutrients = entries.reduce(
          (acc, e) => ({
            calories: acc.calories + e.nutrients.calories,
            protein: acc.protein + e.nutrients.protein,
            carbs: acc.carbs + e.nutrients.carbs,
            fat: acc.fat + e.nutrients.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        groups[type].push({
          groupId,
          mealName: entries[0]?.log.loggedMealName || entries[0]?.displayName || '',
          entries,
          totalNutrients,
        });
      });
    });

    return groups;
  }, [resolvedLogs]);

  // Check if all meals are empty AND no food has ever been tracked
  const hasNoFood = !isScreenLoading && totalCount === 0;

  const handleFoodMenuPress = (entry: {
    log: any;
    food: any;
    nutrients: any;
    gramWeight: number;
    displayName: string;
  }) => {
    setSelectedFoodItem(entry);
    setIsFoodMenuVisible(true);
  };

  const handleMealGroupMenuPress = (group: (typeof mealGroupsByType)['breakfast'][number]) => {
    setSelectedMealGroup(group);
    setIsMealGroupMenuVisible(true);
  };

  // Meal Group menu action handlers
  const handleMealGroupScalePortion = () => {
    setIsMealGroupMenuVisible(false);
    setIsMealGroupScaleModalVisible(true);
  };

  const handleConfirmMealGroupScalePortion = async (newTotalGrams: number) => {
    if (!selectedMealGroup) {
      return;
    }
    if (newTotalGrams < 1) {
      showSnackbar('error', t('food.actions.scaleMealPortionInvalid'));
      return;
    }

    const currentTotal = selectedMealGroup.entries.reduce((sum, e) => sum + e.gramWeight, 0);
    if (currentTotal <= 0) {
      showSnackbar('error', t('food.actions.scaleMealPortionError'));
      setIsMealGroupScaleModalVisible(false);
      setSelectedMealGroup(null);
      return;
    }

    setIsMealGroupScaleLoading(true);
    await flushLoadingPaint();
    try {
      await scaleMealNutritionLogsToTotalGrams(
        selectedMealGroup.entries.map((e) => ({ log: e.log, gramWeight: e.gramWeight })),
        newTotalGrams
      );
      showSnackbar('success', t('food.actions.scaleMealPortionSuccess'));
      await refresh();
      setIsMealGroupScaleModalVisible(false);
      setSelectedMealGroup(null);
    } catch (error) {
      captureException(error, { data: { context: 'food.scaleMealGroupPortions' } });
      console.error('Error scaling meal group portions:', error);
      showSnackbar('error', t('food.actions.scaleMealPortionError'));
    } finally {
      setIsMealGroupScaleLoading(false);
    }
  };

  const handleMealGroupMove = () => {
    setIsMealGroupMenuVisible(false);
    setMealGroupActionMode('move');
    setIsMealGroupActionModalVisible(true);
  };

  const handleMealGroupCopy = () => {
    setIsMealGroupMenuVisible(false);
    setMealGroupActionMode('copy');
    setIsMealGroupActionModalVisible(true);
  };

  const handleMealGroupSplit = () => {
    setIsMealGroupMenuVisible(false);
    setMealGroupActionMode('split');
    setIsMealGroupActionModalVisible(true);
  };

  const handleConfirmMealGroupAction = async (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => {
    if (!selectedMealGroup) {
      return;
    }
    setIsMealGroupActionLoading(true);
    await flushLoadingPaint();
    try {
      const logs = selectedMealGroup.entries.map((e) => e.log);
      if (mealGroupActionMode === 'move') {
        await NutritionService.moveNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.moveSuccess'));
      } else if (mealGroupActionMode === 'copy') {
        await NutritionService.copyNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.copySuccess'));
      } else if (mealGroupActionMode === 'split' && splitPercentage) {
        await NutritionService.splitNutritionLogsToDate(
          logs,
          targetDate,
          targetMealType,
          splitPercentage
        );
        showSnackbar('success', t('food.actions.splitSuccess'));
      }
      await refresh();
    } catch (error) {
      captureException(error, { data: { context: 'food.performMealGroupAction' } });
      console.error('Error performing meal group action:', error);
      const errorKey = getMealActionErrorKey(mealGroupActionMode);
      showSnackbar('error', t(errorKey));
    } finally {
      setIsMealGroupActionLoading(false);
      setIsMealGroupActionModalVisible(false);
      setSelectedMealGroup(null);
    }
  };

  const handleMealGroupCreateMeal = () => {
    setIsMealGroupMenuVisible(false);
    if (!selectedMealGroup) {
      return;
    }

    const items = selectedMealGroup.entries
      .map((entry) => {
        if (!entry.food) {
          return null;
        }
        return { food: entry.food, amount: Math.round(entry.gramWeight) };
      })
      .filter(Boolean) as { food: Food; amount: number }[];

    if (items.length === 0) {
      showSnackbar('error', t('food.createMeal.noFoods') ?? t('common.error'));
      setSelectedMealGroup(null);
      return;
    }

    setMealGroupCreateMealInitialFoods(items);
    setIsMealGroupCreateMealModalVisible(true);
  };

  const handleMealGroupGetInsights = () => {
    setIsMealGroupMenuVisible(false);
    setIsMealGroupInsightsVisible(true);
  };

  const handleSubmitMealGroupInsights = async (userRemarks: string) => {
    if (!selectedMealGroup) {
      return;
    }

    setIsMealGroupInsightsLoading(true);
    await flushLoadingPaint();
    try {
      const aiConfig = await AiService.getAiConfig();
      if (!aiConfig) {
        showSnackbar('error', t('food.actions.getMealInsightsError'));
        return;
      }

      const foods = selectedMealGroup.entries.map((e) => ({
        name: e.displayName,
        gramWeight: e.gramWeight,
      }));
      const totals = selectedMealGroup.entries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.nutrients.calories,
          protein: acc.protein + e.nutrients.protein,
          carbs: acc.carbs + e.nutrients.carbs,
          fat: acc.fat + e.nutrients.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      // Get the meal type from the first entry
      const mealType = selectedMealGroup.entries[0]?.log.type || 'other';

      const response = await getMealCritique(aiConfig, mealType, foods, totals, userRemarks);

      if (!response) {
        showSnackbar('error', t('food.actions.getMealInsightsError'));
        return;
      }

      await ChatService.saveMessage({ sender: 'coach', message: response, context: 'nutrition' });
      await SettingsService.setCoachConversationContext('nutrition');
      setIsMealGroupInsightsVisible(false);
      setSelectedMealGroup(null);
      openCoach();
    } catch (error) {
      captureException(error, { data: { context: 'food.getMealGroupInsights' } });
      console.error('Error getting meal group insights:', error);
      showSnackbar('error', t('food.actions.getMealInsightsError'));
    } finally {
      setIsMealGroupInsightsLoading(false);
    }
  };

  const handleConfirmDeleteMealGroup = async () => {
    if (!selectedMealGroup) {
      return;
    }
    setIsDeleteMealGroupLoading(true);
    try {
      await NutritionService.deleteNutritionLogsBatch(selectedMealGroup.entries.map((e) => e.log));
      await refresh();
    } catch {
      showSnackbar('error', t('errors.somethingWentWrong'));
    } finally {
      setIsDeleteMealGroupLoading(false);
      setIsDeleteMealGroupVisible(false);
      setSelectedMealGroup(null);
    }
  };

  const handleEditFood = () => {
    setIsFoodMenuVisible(false);
    setIsDuplicateMode(false);
    setIsFoodDetailsModalVisible(true);
  };

  const handleDuplicateFood = () => {
    setIsFoodMenuVisible(false);
    setIsDuplicateMode(true);
    setIsFoodDetailsModalVisible(true);
  };

  const handleDeleteFood = () => {
    setIsFoodMenuVisible(false);
    setIsDeleteConfirmationVisible(true);
  };

  const handleMoveFood = () => {
    setIsFoodMenuVisible(false);
    setIsFoodMoveModalVisible(true);
  };

  const handleSplitFood = () => {
    setIsFoodMenuVisible(false);
    setIsFoodSplitModalVisible(true);
  };

  const handleConfirmFoodMove = async (targetDate: Date, targetMealType: MealType) => {
    if (!selectedFoodItem) {
      return;
    }
    setIsFoodMoveLoading(true);
    await flushLoadingPaint();
    try {
      await NutritionService.moveNutritionLogsToDate(
        [selectedFoodItem.log],
        targetDate,
        targetMealType
      );
      showSnackbar('success', t('food.actions.moveSuccess'));
      await refresh();
    } catch (error) {
      captureException(error, { data: { context: 'food.handleMoveFood' } });
      console.error('Error moving food:', error);
      showSnackbar('error', t('food.actions.moveError'));
    } finally {
      setIsFoodMoveLoading(false);
      setIsFoodMoveModalVisible(false);
      setSelectedFoodItem(null);
    }
  };

  const handleConfirmFoodSplit = async (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => {
    if (!selectedFoodItem || !splitPercentage) {
      return;
    }
    setIsFoodSplitLoading(true);
    await flushLoadingPaint();
    try {
      await NutritionService.splitNutritionLogsToDate(
        [selectedFoodItem.log],
        targetDate,
        targetMealType,
        splitPercentage
      );
      showSnackbar('success', t('food.actions.splitSuccess'));
      await refresh();
    } catch (error) {
      captureException(error, { data: { context: 'food.handleSplitFood' } });
      console.error('Error splitting food:', error);
      showSnackbar('error', t('food.actions.splitError'));
    } finally {
      setIsFoodSplitLoading(false);
      setIsFoodSplitModalVisible(false);
      setSelectedFoodItem(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedFoodItem) {
      return;
    }

    setIsDeleteFoodLoading(true);
    await flushLoadingPaint();
    try {
      // The @writer method returns a promise that resolves when the operation completes
      await NutritionService.deleteNutritionLog(selectedFoodItem.log.id);
      showSnackbar('success', t('food.actions.deleteSuccess'));
    } catch (error) {
      captureException(error, { data: { context: 'food.handleDeleteFood' } });
      console.error('Error deleting food:', error);
      showSnackbar('error', t('food.actions.deleteError'));
    } finally {
      setIsDeleteFoodLoading(false);
      // Always close the modal and clear selection, regardless of success or error
      setIsDeleteConfirmationVisible(false);
      setSelectedFoodItem(null);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmationVisible(false);
    setSelectedFoodItem(null);
  };

  const foodMenuItems = [
    {
      icon: Edit,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.edit'),
      description: t('food.actions.editDesc'),
      onPress: handleEditFood,
    },
    {
      icon: Copy,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.duplicate'),
      description: t('food.actions.duplicateDesc'),
      onPress: handleDuplicateFood,
    },
    {
      icon: ArrowRight,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.move'),
      description: t('food.actions.moveDesc'),
      onPress: handleMoveFood,
    },
    {
      icon: Scissors,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      title: t('food.actions.split'),
      description: t('food.actions.splitDesc'),
      onPress: handleSplitFood,
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.delete'),
      description: t('food.actions.deleteDesc'),
      onPress: handleDeleteFood,
    },
  ];

  const handleAddFoodToMeal = (mealType: MealType) => {
    setSelectedMealType(mealType);
    setIsFoodSearchModalVisible(true);
  };

  const handleMealMenuPress = (mealType: MealType) => {
    setSelectedMealForMenu(mealType);
    setIsMealMenuVisible(true);
  };

  const handleDeleteAllMeal = () => {
    setIsMealMenuVisible(false);
    setIsDeleteAllMealVisible(true);
  };

  const handleConfirmDeleteAllMeal = async () => {
    if (!selectedMealForMenu) {
      return;
    }
    setIsDeleteAllMealLoading(true);
    await flushLoadingPaint();
    try {
      const mealFoods = mealsByType[selectedMealForMenu];
      await NutritionService.deleteNutritionLogsBatch(mealFoods.map((e) => e.log));
      showSnackbar('success', t('food.actions.deleteAllSuccess'));
      await refresh();
    } catch (error) {
      captureException(error, { data: { context: 'food.handleDeleteAllMealItems' } });
      console.error('Error deleting all meal items:', error);
      showSnackbar('error', t('food.actions.deleteAllError'));
    } finally {
      setIsDeleteAllMealLoading(false);
      setIsDeleteAllMealVisible(false);
      setSelectedMealForMenu(null);
    }
  };

  const handleMoveMealToAnotherDay = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('move');
    setIsMealActionModalVisible(true);
  };

  const handleCopyMealToAnotherDay = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('copy');
    setIsMealActionModalVisible(true);
  };

  const handleCreateMealFromFood = () => {
    setIsMealMenuVisible(false);
    if (!selectedMealForMenu) {
      return;
    }

    const mealFoods = mealsByType[selectedMealForMenu] || [];
    const items = mealFoods
      .map((entry) => {
        if (!entry.food) {
          return null;
        }

        return { food: entry.food, amount: Math.round(entry.gramWeight) };
      })
      .filter(Boolean) as { food: Food; amount: number }[];

    if (items.length === 0) {
      showSnackbar('error', t('food.createMeal.noFoods') ?? t('common.error'));
      setSelectedMealForMenu(null);
      return;
    }

    setCreateMealInitialFoods(items);
    setIsCreateMealModalVisible(true);
  };

  const handleSplitMeal = () => {
    setIsMealMenuVisible(false);
    setMealActionMode('split');
    setIsMealActionModalVisible(true);
  };

  const handleScaleMealPortion = () => {
    setIsMealMenuVisible(false);
    setIsScaleMealPortionModalVisible(true);
  };

  const handleConfirmScaleMealPortion = async (newTotalGrams: number) => {
    if (!selectedMealForMenu) {
      return;
    }
    if (newTotalGrams < 1) {
      showSnackbar('error', t('food.actions.scaleMealPortionInvalid'));
      return;
    }

    const mealFoods = mealsByType[selectedMealForMenu] || [];
    const currentTotal = mealFoods.reduce((sum, e) => sum + e.gramWeight, 0);
    if (currentTotal <= 0) {
      showSnackbar('error', t('food.actions.scaleMealPortionError'));
      setIsScaleMealPortionModalVisible(false);
      setSelectedMealForMenu(null);
      return;
    }

    setIsScaleMealPortionLoading(true);
    await flushLoadingPaint();
    try {
      await scaleMealNutritionLogsToTotalGrams(
        mealFoods.map((e) => ({ log: e.log, gramWeight: e.gramWeight })),
        newTotalGrams
      );
      showSnackbar('success', t('food.actions.scaleMealPortionSuccess'));
      await refresh();
      setIsScaleMealPortionModalVisible(false);
      setSelectedMealForMenu(null);
    } catch (error) {
      await handleError(error, 'food.scaleMealPortions', {
        snackbarMessage: t('food.actions.scaleMealPortionError'),
        consoleMessage: 'Error scaling meal portions:',
      });
    } finally {
      setIsScaleMealPortionLoading(false);
    }
  };

  const handleMergeDuplicates = () => {
    setIsMealMenuVisible(false);
    if (!selectedMealForMenu) {
      return;
    }

    const mealFoods = mealsByType[selectedMealForMenu] || [];
    if (!mealHasUngroupedDuplicateFoods(mealFoods)) {
      showSnackbar('success', t('food.actions.mergeDuplicatesNone'));
      setSelectedMealForMenu(null);
      return;
    }

    setIsMergeDuplicatesVisible(true);
  };

  const handleConfirmMergeDuplicates = async () => {
    // Determine if we're merging for a meal type or a meal group
    const entries = selectedMealForMenu
      ? mealsByType[selectedMealForMenu] || []
      : selectedMealGroup?.entries || [];

    if (entries.length === 0) {
      return;
    }

    setIsMergeDuplicatesLoading(true);
    await flushLoadingPaint();
    try {
      const grouped = new Map<string, typeof entries>();
      for (const entry of entries) {
        if (!entry.log.foodId) {
          continue;
        }

        const existing = grouped.get(entry.log.foodId) || [];
        existing.push(entry);
        grouped.set(entry.log.foodId, existing);
      }

      const toUpdate: { log: (typeof entries)[number]['log']; newAmount: number }[] = [];
      const toDelete: (typeof entries)[number]['log'][] = [];

      for (const group of grouped.values()) {
        if (group.length <= 1) {
          continue;
        }

        const totalGrams = group.reduce((sum, e) => sum + e.gramWeight, 0);
        toUpdate.push({ log: group[0].log, newAmount: totalGrams });
        for (let i = 1; i < group.length; i++) {
          toDelete.push(group[i].log);
        }
      }

      await NutritionService.mergeDuplicateNutritionLogs(toUpdate, toDelete);
      showSnackbar('success', t('food.actions.mergeDuplicatesSuccess'));
      await refresh();
    } catch (error) {
      await handleError(error, 'food.mergeDuplicateFoods', {
        snackbarMessage: t('food.actions.mergeDuplicatesError'),
        consoleMessage: 'Error merging duplicate foods:',
      });
    } finally {
      setIsMergeDuplicatesLoading(false);
      setIsMergeDuplicatesVisible(false);
      if (selectedMealForMenu) {
        setSelectedMealForMenu(null);
      }

      if (selectedMealGroup) {
        setSelectedMealGroup(null);
      }
    }
  };

  const handleConfirmMealAction = async (
    targetDate: Date,
    targetMealType: MealType,
    splitPercentage?: number
  ) => {
    if (!selectedMealForMenu) {
      return;
    }
    setIsMealActionLoading(true);
    await flushLoadingPaint();
    try {
      const mealFoods = mealsByType[selectedMealForMenu];
      const logs = mealFoods.map((e) => e.log);
      if (mealActionMode === 'move') {
        await NutritionService.moveNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.moveSuccess'));
      } else if (mealActionMode === 'copy') {
        await NutritionService.copyNutritionLogsToDate(logs, targetDate, targetMealType);
        showSnackbar('success', t('food.actions.copySuccess'));
      } else if (mealActionMode === 'split' && splitPercentage) {
        await NutritionService.splitNutritionLogsToDate(
          logs,
          targetDate,
          targetMealType,
          splitPercentage
        );
        showSnackbar('success', t('food.actions.splitSuccess'));
      }
      await refresh();
    } catch (error) {
      const errorKey = getMealActionErrorKey(mealActionMode);
      await handleError(error, 'food.performMealAction', {
        snackbarMessage: t(errorKey),
        consoleMessage: 'Error performing meal action:',
      });
    } finally {
      setIsMealActionLoading(false);
      setIsMealActionModalVisible(false);
      setSelectedMealForMenu(null);
    }
  };

  const handleGetMealInsights = () => {
    setIsMealMenuVisible(false);
    setIsMealInsightsVisible(true);
  };

  const handleSubmitMealInsights = async (userRemarks: string) => {
    if (!selectedMealForMenu) {
      return;
    }

    setIsMealInsightsLoading(true);
    await flushLoadingPaint();
    try {
      const aiConfig = await AiService.getAiConfig();
      if (!aiConfig) {
        showSnackbar('error', t('food.actions.getMealInsightsError'));
        return;
      }

      const mealFoods = mealsByType[selectedMealForMenu] || [];
      const foods = mealFoods.map((e) => ({ name: e.displayName, gramWeight: e.gramWeight }));
      const totals = mealFoods.reduce(
        (acc, e) => ({
          calories: acc.calories + e.nutrients.calories,
          protein: acc.protein + e.nutrients.protein,
          carbs: acc.carbs + e.nutrients.carbs,
          fat: acc.fat + e.nutrients.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      const response = await getMealCritique(
        aiConfig,
        selectedMealForMenu,
        foods,
        totals,
        userRemarks
      );

      if (!response) {
        showSnackbar('error', t('food.actions.getMealInsightsError'));
        return;
      }

      await ChatService.saveMessage({ sender: 'coach', message: response, context: 'nutrition' });
      await SettingsService.setCoachConversationContext('nutrition');
      setIsMealInsightsVisible(false);
      setSelectedMealForMenu(null);
      openCoach();
    } catch (error) {
      await handleError(error, 'food.getMealInsights', {
        snackbarMessage: t('food.actions.getMealInsightsError'),
        consoleMessage: 'Error getting meal insights:',
      });
    } finally {
      setIsMealInsightsLoading(false);
    }
  };

  const showMergeDuplicatesInMealMenu =
    selectedMealForMenu != null &&
    mealHasUngroupedDuplicateFoods(mealsByType[selectedMealForMenu] || []);

  // Meal group menu computed values
  const selectedMealGroupTotalGrams = useMemo(() => {
    if (!selectedMealGroup) {
      return 0;
    }
    return selectedMealGroup.entries.reduce((sum, e) => sum + e.gramWeight, 0);
  }, [selectedMealGroup]);

  const selectedMealGroupNutrients = useMemo(() => {
    if (!selectedMealGroup) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 };
    }

    return selectedMealGroup.entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.nutrients.calories,
        protein: acc.protein + e.nutrients.protein,
        carbs: acc.carbs + e.nutrients.carbs,
        fat: acc.fat + e.nutrients.fat,
        fiber: acc.fiber + e.nutrients.fiber,
        alcohol: acc.alcohol + e.nutrients.alcohol,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 }
    );
  }, [selectedMealGroup]);

  const selectedMealTotalGrams = useMemo(() => {
    if (!selectedMealForMenu) {
      return 0;
    }
    return (mealsByType[selectedMealForMenu] || []).reduce((sum, e) => sum + e.gramWeight, 0);
  }, [selectedMealForMenu, mealsByType]);

  const selectedMealNutrients = useMemo(() => {
    if (!selectedMealForMenu) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 };
    }
    return (mealsByType[selectedMealForMenu] || []).reduce(
      (acc, e) => ({
        calories: acc.calories + e.nutrients.calories,
        protein: acc.protein + e.nutrients.protein,
        carbs: acc.carbs + e.nutrients.carbs,
        fat: acc.fat + e.nutrients.fat,
        fiber: acc.fiber + e.nutrients.fiber,
        alcohol: acc.alcohol + e.nutrients.alcohol,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 }
    );
  }, [selectedMealForMenu, mealsByType]);

  const mealMenuItems = [
    ...(isAiConfigured
      ? [
          {
            icon: Sparkles,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('food.actions.getMealInsights'),
            description: t('food.actions.getMealInsightsDesc'),
            onPress: handleGetMealInsights,
          },
        ]
      : []),
    {
      icon: UtensilsCrossed,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.createMeal'),
      description: t('food.actions.createMealDesc'),
      onPress: handleCreateMealFromFood,
    },
    {
      icon: Scale,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.scaleMealPortion'),
      description: t('food.actions.scaleMealPortionDesc'),
      onPress: handleScaleMealPortion,
    },
    ...(showMergeDuplicatesInMealMenu
      ? [
          {
            icon: GitMerge,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('food.actions.mergeDuplicates'),
            description: t('food.actions.mergeDuplicatesDesc'),
            onPress: handleMergeDuplicates,
          },
        ]
      : []),
    {
      icon: Copy,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.copyToAnotherDay'),
      description: t('food.actions.copyToAnotherDayDesc'),
      onPress: handleCopyMealToAnotherDay,
    },
    {
      icon: ArrowRight,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      title: t('food.actions.moveToAnotherDay'),
      description: t('food.actions.moveToAnotherDayDesc'),
      onPress: handleMoveMealToAnotherDay,
    },
    {
      icon: Scissors,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      title: t('food.actions.splitMeal'),
      description: t('food.actions.splitMealDesc'),
      onPress: handleSplitMeal,
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.deleteAll'),
      description: t('food.actions.deleteAllDesc'),
      onPress: handleDeleteAllMeal,
    },
  ];

  return (
    <MasterLayout>
      <View className="flex-1 bg-bg-primary">
        <View className="border-b border-border-dark bg-bg-primary">
          <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-6 px-4 pt-6">
            {/* Loading State */}
            {isScreenLoading ? (
              <>
                {/* Calories Card Skeleton */}
                <View
                  className="rounded-lg border bg-bg-card p-5"
                  style={{ borderColor: theme.colors.background.white5 }}
                >
                  <View className="mb-4 flex-row items-center justify-between">
                    <View className="gap-2">
                      <SkeletonLoader width={theme.size['120']} height={theme.size['4']} />
                      <SkeletonLoader width={theme.size['20']} height={theme.size['8']} />
                    </View>
                    <SkeletonLoader width={theme.size['60']} height={theme.size['6']} />
                  </View>
                  <SkeletonLoader
                    width="100%"
                    height={theme.size['2']}
                    borderRadius={theme.borderRadius.xs}
                  />
                  <View className="mt-4 flex-row gap-2">
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                    <SkeletonLoader
                      width="33%"
                      height={theme.size['60']}
                      borderRadius={theme.borderRadius.sm}
                    />
                  </View>
                </View>

                {/* Food Item Skeletons */}
                {[1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="flex-row items-center justify-between rounded-lg border bg-bg-card p-4"
                    style={{ borderColor: theme.colors.background.white5 }}
                  >
                    <View className="flex-row items-center gap-3">
                      <SkeletonLoader
                        width={theme.size['10']}
                        height={theme.size['10']}
                        borderRadius={theme.borderRadius.xl}
                      />
                      <View className="gap-1">
                        <SkeletonLoader width={theme.size['96']} height={theme.size['4']} />
                        <SkeletonLoader width={theme.size['16']} height={theme.size['3']} />
                      </View>
                    </View>
                    <SkeletonLoader width={theme.size['12']} height={theme.size['4']} />
                  </View>
                ))}
              </>
            ) : null}

            {/* Empty State */}
            {!isScreenLoading && hasNoFood ? (
              <EmptyStateCard
                icon={UtensilsCrossed}
                title={t('emptyStates.foods.title')}
                description={t('emptyStates.foods.description')}
                buttonLabel={t('emptyStates.foods.buttonLabel')}
                buttonVariant="secondary"
                onButtonPress={() => setIsAddFoodModalVisible(true)}
              />
            ) : null}

            {/* Normal State */}
            {!isScreenLoading && !hasNoFood ? (
              <AnimatedContent style={{ gap: theme.spacing.gap['xl'] }}>
                <>
                  {/* Daily Summary Card */}
                  <DailySummaryCard
                    calories={{
                      consumed: caloriesData.consumed,
                      remaining: caloriesData.total - caloriesData.consumed,
                      goal: caloriesData.total,
                    }}
                    macros={{
                      protein: {
                        value: dailyNutrients?.protein || 0,
                        goal: nutritionGoal?.protein || 150,
                      },
                      carbs: {
                        value: dailyNutrients?.carbs || 0,
                        goal: nutritionGoal?.carbs || 250,
                      },
                      fats: {
                        value: dailyNutrients?.fat || 0,
                        goal: nutritionGoal?.fats || 80,
                      },
                      fiber: {
                        value: dailyNutrients?.fiber || 0,
                        goal: nutritionGoal?.fiber || 0,
                      },
                    }}
                    secondaryNutrients={secondaryNutrients}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      <MenuButton
                        onPress={() => setIsGoalsManagementModalVisible(true)}
                        size="sm"
                        color={theme.colors.text.primary}
                      />
                    }
                  />

                  {/* Scan Buttons */}
                  <View className="gap-4">
                    <View className="flex-row gap-4">
                      <Button
                        label={t('food.actions.scanBarcode')}
                        icon={ScanLine}
                        variant="secondary"
                        size="md"
                        width="flex-1"
                        onPress={() => {
                          openCamera({
                            mode: 'barcode-scan',
                            hideCameraModePicker: false,
                            logDate: selectedDate,
                          });
                        }}
                      />
                      {isAiConfigured ? (
                        <Button
                          label={t('food.actions.aiCamera')}
                          icon={Sparkles}
                          variant="secondaryGradient"
                          size="md"
                          width="flex-1"
                          onPress={() => {
                            openCamera({
                              mode: 'ai-meal-photo',
                              hideCameraModePicker: false,
                              logDate: selectedDate,
                            });
                          }}
                        />
                      ) : null}
                    </View>
                    <View className="flex-row gap-4">
                      <Button
                        // label={t('food.actions.goToToday')}
                        label={t('food.actions.myMeals')}
                        // icon={Calendar}
                        icon={UtensilsCrossed}
                        variant="secondary"
                        size="sm"
                        width="flex-1"
                        // onPress={goToToday}
                        onPress={() => setIsMyMealsModalVisible(true)}
                      />
                      <Button
                        label={t('food.actions.moreFoodOptions')}
                        icon={ListPlus}
                        variant="secondaryGradient"
                        size="sm"
                        width="flex-1"
                        onPress={() => setIsAddFoodModalVisible(true)}
                      />
                    </View>
                  </View>

                  {/* Breakfast Section */}
                  <MealSection
                    title={t('food.meals.breakfast')}
                    totalCalories={dailyNutrients?.byMealType?.breakfast?.calories || 0}
                    totalProtein={dailyNutrients?.byMealType?.breakfast?.protein || 0}
                    totalCarbs={dailyNutrients?.byMealType?.breakfast?.carbs || 0}
                    totalFat={dailyNutrients?.byMealType?.breakfast?.fat || 0}
                    onAddFood={() => handleAddFoodToMeal('breakfast')}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      mealsByType.breakfast.length > 0 || mealGroupsByType.breakfast.length > 0 ? (
                        <MenuButton
                          onPress={() => handleMealMenuPress('breakfast')}
                          size="sm"
                          color={theme.colors.text.primary}
                        />
                      ) : undefined
                    }
                  >
                    {mealGroupsByType.breakfast.map((group) => (
                      <MealGroupCard
                        key={group.groupId}
                        name={group.mealName}
                        calories={group.totalNutrients.calories}
                        protein={group.totalNutrients.protein}
                        carbs={group.totalNutrients.carbs}
                        fat={group.totalNutrients.fat}
                        mealType="breakfast"
                        onMorePress={() => handleMealGroupMenuPress(group)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                    {ungroupedByType.breakfast.map((entry) => (
                      <FoodItemCard
                        key={entry.log.id}
                        name={entry.displayName}
                        // description={getSimpleServingDisplay(entry.gramWeight, units)}
                        portion={entry.gramWeight}
                        calories={entry.nutrients.calories}
                        protein={entry.nutrients.protein}
                        carbs={entry.nutrients.carbs}
                        fat={entry.nutrients.fat}
                        image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                        mealType="breakfast"
                        onMorePress={() => handleFoodMenuPress(entry)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                  </MealSection>

                  {/* Lunch Section */}
                  <MealSection
                    title={t('food.meals.lunch')}
                    totalCalories={dailyNutrients?.byMealType?.lunch?.calories || 0}
                    totalProtein={dailyNutrients?.byMealType?.lunch?.protein || 0}
                    totalCarbs={dailyNutrients?.byMealType?.lunch?.carbs || 0}
                    totalFat={dailyNutrients?.byMealType?.lunch?.fat || 0}
                    onAddFood={() => handleAddFoodToMeal('lunch')}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      mealsByType.lunch.length > 0 || mealGroupsByType.lunch.length > 0 ? (
                        <MenuButton
                          onPress={() => handleMealMenuPress('lunch')}
                          size="sm"
                          color={theme.colors.text.primary}
                        />
                      ) : undefined
                    }
                  >
                    {mealGroupsByType.lunch.map((group) => (
                      <MealGroupCard
                        key={group.groupId}
                        name={group.mealName}
                        calories={group.totalNutrients.calories}
                        protein={group.totalNutrients.protein}
                        carbs={group.totalNutrients.carbs}
                        fat={group.totalNutrients.fat}
                        mealType="lunch"
                        onMorePress={() => handleMealGroupMenuPress(group)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                    {ungroupedByType.lunch.map((entry) => (
                      <FoodItemCard
                        key={entry.log.id}
                        name={entry.displayName}
                        // description={getSimpleServingDisplay(entry.gramWeight, units)}
                        portion={entry.gramWeight}
                        calories={entry.nutrients.calories}
                        protein={entry.nutrients.protein}
                        carbs={entry.nutrients.carbs}
                        fat={entry.nutrients.fat}
                        image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                        mealType="lunch"
                        onMorePress={() => handleFoodMenuPress(entry)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                  </MealSection>

                  {/* Dinner Section */}
                  <MealSection
                    title={t('food.meals.dinner')}
                    totalCalories={dailyNutrients?.byMealType?.dinner?.calories || 0}
                    totalProtein={dailyNutrients?.byMealType?.dinner?.protein || 0}
                    totalCarbs={dailyNutrients?.byMealType?.dinner?.carbs || 0}
                    totalFat={dailyNutrients?.byMealType?.dinner?.fat || 0}
                    onAddFood={() => handleAddFoodToMeal('dinner')}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      mealsByType.dinner.length > 0 || mealGroupsByType.dinner.length > 0 ? (
                        <MenuButton
                          onPress={() => handleMealMenuPress('dinner')}
                          size="sm"
                          color={theme.colors.text.primary}
                        />
                      ) : undefined
                    }
                  >
                    {mealGroupsByType.dinner.map((group) => (
                      <MealGroupCard
                        key={group.groupId}
                        name={group.mealName}
                        calories={group.totalNutrients.calories}
                        protein={group.totalNutrients.protein}
                        carbs={group.totalNutrients.carbs}
                        fat={group.totalNutrients.fat}
                        mealType="dinner"
                        onMorePress={() => handleMealGroupMenuPress(group)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                    {ungroupedByType.dinner.map((entry) => (
                      <FoodItemCard
                        key={entry.log.id}
                        name={entry.displayName}
                        // description={getSimpleServingDisplay(entry.gramWeight, units)}
                        portion={entry.gramWeight}
                        calories={entry.nutrients.calories}
                        protein={entry.nutrients.protein}
                        carbs={entry.nutrients.carbs}
                        fat={entry.nutrients.fat}
                        image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                        mealType="dinner"
                        onMorePress={() => handleFoodMenuPress(entry)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                  </MealSection>

                  {/* Snack Section */}
                  <MealSection
                    title={t('food.meals.snacks')}
                    totalCalories={dailyNutrients?.byMealType?.snack?.calories || 0}
                    totalProtein={dailyNutrients?.byMealType?.snack?.protein || 0}
                    totalCarbs={dailyNutrients?.byMealType?.snack?.carbs || 0}
                    totalFat={dailyNutrients?.byMealType?.snack?.fat || 0}
                    onAddFood={() => handleAddFoodToMeal('snack')}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      mealsByType.snack.length > 0 || mealGroupsByType.snack.length > 0 ? (
                        <MenuButton
                          onPress={() => handleMealMenuPress('snack')}
                          size="sm"
                          color={theme.colors.text.primary}
                        />
                      ) : undefined
                    }
                  >
                    {mealGroupsByType.snack.map((group) => (
                      <MealGroupCard
                        key={group.groupId}
                        name={group.mealName}
                        calories={group.totalNutrients.calories}
                        protein={group.totalNutrients.protein}
                        carbs={group.totalNutrients.carbs}
                        fat={group.totalNutrients.fat}
                        mealType="snack"
                        onMorePress={() => handleMealGroupMenuPress(group)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                    {ungroupedByType.snack.map((entry) => (
                      <FoodItemCard
                        key={entry.log.id}
                        name={entry.displayName}
                        // description={getSimpleServingDisplay(entry.gramWeight, units)}
                        portion={entry.gramWeight}
                        calories={entry.nutrients.calories}
                        protein={entry.nutrients.protein}
                        carbs={entry.nutrients.carbs}
                        fat={entry.nutrients.fat}
                        image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                        mealType="snack"
                        onMorePress={() => handleFoodMenuPress(entry)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                  </MealSection>

                  {/* Other Section */}
                  <MealSection
                    title={t('food.meals.other')}
                    totalCalories={dailyNutrients?.byMealType?.other?.calories || 0}
                    totalProtein={dailyNutrients?.byMealType?.other?.protein || 0}
                    totalCarbs={dailyNutrients?.byMealType?.other?.carbs || 0}
                    totalFat={dailyNutrients?.byMealType?.other?.fat || 0}
                    onAddFood={() => handleAddFoodToMeal('other')}
                    intuitiveMode={intuitiveEatingMode}
                    menuButton={
                      mealsByType.other.length > 0 || mealGroupsByType.other.length > 0 ? (
                        <MenuButton
                          onPress={() => handleMealMenuPress('other')}
                          size="sm"
                          color={theme.colors.text.primary}
                        />
                      ) : undefined
                    }
                  >
                    {mealGroupsByType.other.map((group) => (
                      <MealGroupCard
                        key={group.groupId}
                        name={group.mealName}
                        calories={group.totalNutrients.calories}
                        protein={group.totalNutrients.protein}
                        carbs={group.totalNutrients.carbs}
                        fat={group.totalNutrients.fat}
                        mealType="other"
                        onMorePress={() => handleMealGroupMenuPress(group)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                    {ungroupedByType.other.map((entry) => (
                      <FoodItemCard
                        key={entry.log.id}
                        name={entry.displayName}
                        // description={getSimpleServingDisplay(entry.gramWeight, units)}
                        portion={entry.gramWeight}
                        calories={entry.nutrients.calories}
                        protein={entry.nutrients.protein}
                        carbs={entry.nutrients.carbs}
                        fat={entry.nutrients.fat}
                        image={entry.food?.imageUrl ? { uri: entry.food.imageUrl } : undefined}
                        mealType="other"
                        onMorePress={() => handleFoodMenuPress(entry)}
                        intuitiveMode={intuitiveEatingMode}
                      />
                    ))}
                  </MealSection>
                </>
              </AnimatedContent>
            ) : null}

            {/* Bottom spacing for navigation */}
            <View className="h-32" />
          </View>
        </ScrollView>
      </View>

      {/* Add Food Modal */}
      <AddFoodModal
        isAiEnabled={isAiConfigured}
        visible={isAddFoodModalVisible}
        onClose={() => setIsAddFoodModalVisible(false)}
        onMealTypeSelect={(mealType) => {
          setSelectedMealType(mealType);
          setIsAddFoodModalVisible(false);
          setIsFoodSearchModalVisible(true);
        }}
        onAiCameraPress={() => {
          setIsAddFoodModalVisible(false);
          openCamera({ mode: 'ai-meal-photo', hideCameraModePicker: false, logDate: selectedDate });
        }}
        onScanBarcodePress={() => {
          setIsAddFoodModalVisible(false);
          openCamera({ mode: 'barcode-scan', hideCameraModePicker: false, logDate: selectedDate });
        }}
        onSearchFoodPress={() => {
          setIsAddFoodModalVisible(false);
          setIsFoodSearchModalVisible(true);
        }}
        onCreateCustomFoodPress={() => {
          // Open CreateCustomFoodModal
          setIsAddFoodModalVisible(false);
          setIsCreateCustomFoodVisible(true);
        }}
        onTrackCustomMealPress={() => {
          setIsMyMealsModalVisible(true);
          setIsAddFoodModalVisible(false);
        }}
        onQuickTrackMealPress={() => {
          setIsQuickTrackMealModalVisible(true);
          setIsAddFoodModalVisible(false);
        }}
      />

      {/* Quick Track Meal (CreateMealModal in quickTrack mode) */}
      <CreateMealModal
        visible={isQuickTrackMealModalVisible}
        onClose={() => setIsQuickTrackMealModalVisible(false)}
        mode="quickTrack"
        logDate={selectedDate}
        onTracked={() => {
          refresh();
          setIsQuickTrackMealModalVisible(false);
        }}
      />
      {/* Create Meal Modal (prefilled from current meal foods) */}
      <CreateMealModal
        visible={isCreateMealModalVisible}
        onClose={() => {
          setIsCreateMealModalVisible(false);
          setCreateMealInitialFoods([]);
          setSelectedMealForMenu(null);
        }}
        onSave={() => {
          refresh();
          setIsCreateMealModalVisible(false);
          setCreateMealInitialFoods([]);
          setSelectedMealForMenu(null);
        }}
        initialFoods={createMealInitialFoods}
      />

      {/* My Meals Modal */}
      <MyMealsModal
        visible={isMyMealsModalVisible}
        onClose={() => setIsMyMealsModalVisible(false)}
      />

      {/* Create Custom Food Modal */}
      <CreateCustomFoodModal
        visible={isCreateCustomFoodVisible}
        trackFoodAfterSave={true}
        onClose={() => setIsCreateCustomFoodVisible(false)}
        isAiEnabled={isAiConfigured}
      />

      {/* Food Search Modal */}
      <FoodSearchModal
        visible={isFoodSearchModalVisible}
        onClose={() => setIsFoodSearchModalVisible(false)}
        mealType={selectedMealType}
        logDate={selectedDate}
        onFoodTracked={refresh}
        onCreatePress={() => {
          // Open CreateCustomFoodModal
          setIsFoodSearchModalVisible(false);
          setIsCreateCustomFoodVisible(true);
        }}
        onBarcodeScanPress={() => {
          setIsFoodSearchModalVisible(false);
          openCamera({
            mode: 'barcode-scan',
            hideCameraModePicker: true,
            logDate: selectedDate,
            mealType: selectedMealType,
          });
        }}
        isAiEnabled={isAiConfigured}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        visible={isDeleteConfirmationVisible ? !!selectedFoodItem : false}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title={t('food.actions.deleteConfirmTitle')}
        message={t('food.actions.deleteConfirmMessage', {
          foodName: selectedFoodItem?.displayName || '',
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        isLoading={isDeleteFoodLoading}
      />

      {/* Goals Management Modal */}
      <GoalsManagementModal
        visible={isGoalsManagementModalVisible}
        onClose={() => setIsGoalsManagementModalVisible(false)}
        tab="nutrition"
      />

      {/* Food Menu Modal */}
      <BottomPopUpMenu
        visible={isFoodMenuVisible}
        onClose={() => setIsFoodMenuVisible(false)}
        title={selectedFoodItem?.displayName ?? ''}
        subtitle={`${getSimpleServingDisplay(selectedFoodItem?.gramWeight || 0, units, appLocale)} • ${formatInteger(Math.round(selectedFoodItem?.nutrients?.calories || 0), { useGrouping: false })} kcal`}
        items={foodMenuItems}
      />

      {/* Meal Menu Modal */}
      <BottomPopUpMenu
        visible={isMealMenuVisible}
        onClose={() => setIsMealMenuVisible(false)}
        title={selectedMealForMenu ? t(`food.meals.${selectedMealForMenu}`) : ''}
        subtitle={t('food.actions.mealMenuSubtitle')}
        items={mealMenuItems}
      />

      {/* Delete All Meal Confirmation Modal */}
      <ConfirmationModal
        visible={isDeleteAllMealVisible ? !!selectedMealForMenu : false}
        onClose={() => {
          setIsDeleteAllMealVisible(false);
          setSelectedMealForMenu(null);
        }}
        onConfirm={handleConfirmDeleteAllMeal}
        title={t('food.actions.deleteAllConfirmTitle')}
        message={t('food.actions.deleteAllConfirmMessage', {
          mealName: selectedMealForMenu
            ? t(`food.meals.${selectedMealForMenu === 'snack' ? 'snacks' : selectedMealForMenu}`)
            : '',
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        isLoading={isDeleteAllMealLoading}
      />

      {/* Merge Duplicates Confirmation Modal */}
      <ConfirmationModal
        visible={
          isMergeDuplicatesVisible
            ? selectedMealForMenu !== null || selectedMealGroup !== null
            : false
        }
        onClose={() => {
          setIsMergeDuplicatesVisible(false);
          if (selectedMealForMenu !== null) {
            setSelectedMealForMenu(null);
          }

          if (selectedMealGroup !== null) {
            setSelectedMealGroup(null);
          }
        }}
        onConfirm={handleConfirmMergeDuplicates}
        title={t('food.actions.mergeDuplicatesConfirmTitle')}
        message={t('food.actions.mergeDuplicatesConfirmMessage', {
          mealName: selectedMealGroup
            ? selectedMealGroup.mealName
            : selectedMealForMenu
              ? t(`food.meals.${selectedMealForMenu === 'snack' ? 'snacks' : selectedMealForMenu}`)
              : '',
        })}
        confirmLabel={t('food.actions.mergeDuplicatesConfirm')}
        cancelLabel={t('common.cancel')}
        isLoading={isMergeDuplicatesLoading}
      />

      {/* Meal Insights Modal */}
      <MealInsightsModal
        visible={isMealInsightsVisible}
        onClose={() => {
          setIsMealInsightsVisible(false);
          setSelectedMealForMenu(null);
        }}
        mealType={selectedMealForMenu || 'breakfast'}
        isLoading={isMealInsightsLoading}
        onSubmit={handleSubmitMealInsights}
      />

      {/* Move / Copy Meal Modal */}
      <MoveCopyMealModal
        visible={isMealActionModalVisible ? !!selectedMealForMenu : false}
        onClose={() => {
          setIsMealActionModalVisible(false);
          setSelectedMealForMenu(null);
        }}
        onConfirm={handleConfirmMealAction}
        mode={mealActionMode}
        sourceMealType={selectedMealForMenu || 'breakfast'}
        sourceDate={selectedDate}
        isLoading={isMealActionLoading}
      />

      {/* Scale meal total portion (grams) */}
      <ScaleMealPortionModal
        visible={isScaleMealPortionModalVisible ? !!selectedMealForMenu : false}
        onClose={() => {
          setIsScaleMealPortionModalVisible(false);
          setSelectedMealForMenu(null);
        }}
        onConfirm={handleConfirmScaleMealPortion}
        initialTotalGrams={selectedMealTotalGrams}
        mealNutrients={selectedMealNutrients}
        isLoading={isScaleMealPortionLoading}
      />

      {/* Move Food Modal */}
      <MoveCopyMealModal
        visible={isFoodMoveModalVisible ? !!selectedFoodItem : false}
        onClose={() => {
          setIsFoodMoveModalVisible(false);
          setSelectedFoodItem(null);
        }}
        onConfirm={handleConfirmFoodMove}
        mode="move"
        sourceMealType={selectedFoodItem?.log.type || 'breakfast'}
        sourceDate={
          selectedFoodItem
            ? localCalendarDayDateFromDayKeyMs(selectedFoodItem.log.date)
            : selectedDate
        }
        isLoading={isFoodMoveLoading}
      />

      {/* Split Food Modal */}
      <MoveCopyMealModal
        visible={isFoodSplitModalVisible ? !!selectedFoodItem : false}
        onClose={() => {
          setIsFoodSplitModalVisible(false);
          setSelectedFoodItem(null);
        }}
        onConfirm={handleConfirmFoodSplit}
        mode="split"
        title={t('food.actions.splitFoodModalTitle')}
        sourceMealType={selectedFoodItem?.log.type || 'breakfast'}
        sourceDate={
          selectedFoodItem
            ? localCalendarDayDateFromDayKeyMs(selectedFoodItem.log.date)
            : selectedDate
        }
        isLoading={isFoodSplitLoading}
      />

      {/* Food Details Modal (edit/duplicate mode) */}
      <FoodMealDetailsModal
        visible={isFoodDetailsModalVisible ? !!selectedFoodItem : false}
        onClose={() => {
          setIsFoodDetailsModalVisible(false);
          setIsDuplicateMode(false);
          setSelectedFoodItem(null);
        }}
        food={selectedFoodItem?.food || null}
        foodLog={selectedFoodItem && !isDuplicateMode ? selectedFoodItem.log : undefined}
        initialMealType={
          selectedFoodItem && isDuplicateMode ? selectedFoodItem.log.type : undefined
        }
        initialDate={
          selectedFoodItem && isDuplicateMode
            ? localCalendarDayDateFromDayKeyMs(selectedFoodItem.log.date)
            : undefined
        }
        initialServingSize={
          selectedFoodItem && isDuplicateMode ? selectedFoodItem.gramWeight : undefined
        }
        onAddFood={async (_data) => {
          try {
            await refresh();
          } catch (_error) {
            await handleError(_error, 'food.handleRefresh', {
              snackbarMessage: t('food.errors.refreshFailed'),
            });

            // Reload the current screen using expo-router
            router.replace('/nutrition/food');
          }
        }}
        isAiEnabled={isAiConfigured}
      />

      {/* Meal Group Options Menu */}
      <BottomPopUpMenu
        visible={isMealGroupMenuVisible}
        onClose={() => {
          setIsMealGroupMenuVisible(false);
          // Note: We don't clear selectedMealGroup here because the action handlers
          // need it to open their respective modals. It's cleared in the modals' onClose/onConfirm.
        }}
        title={selectedMealGroup?.mealName || t('food.mealGroup.mealOptions')}
        subtitle={t('food.actions.mealMenuSubtitle')}
        items={[
          ...(isAiConfigured
            ? [
                {
                  icon: Sparkles,
                  iconColor: theme.colors.accent.primary,
                  iconBgColor: theme.colors.accent.primary10,
                  title: t('food.actions.getMealInsights'),
                  description: t('food.actions.getMealInsightsDesc'),
                  onPress: handleMealGroupGetInsights,
                },
              ]
            : []),
          {
            icon: UtensilsCrossed,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('food.actions.createMeal'),
            description: t('food.actions.createMealDesc'),
            onPress: handleMealGroupCreateMeal,
          },
          {
            icon: Scale,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('food.actions.scaleMealPortion'),
            description: t('food.actions.scaleMealPortionDesc'),
            onPress: handleMealGroupScalePortion,
          },
          {
            icon: Copy,
            iconColor: theme.colors.status.purple,
            iconBgColor: theme.colors.status.purple10,
            title: t('food.actions.copyToAnotherDay'),
            description: t('food.actions.copyToAnotherDayDesc'),
            onPress: handleMealGroupCopy,
          },
          {
            icon: ArrowRight,
            iconColor: theme.colors.status.purple,
            iconBgColor: theme.colors.status.purple10,
            title: t('food.actions.moveToAnotherDay'),
            description: t('food.actions.moveToAnotherDayDesc'),
            onPress: handleMealGroupMove,
          },
          {
            icon: Scissors,
            iconColor: theme.colors.status.warning,
            iconBgColor: theme.colors.status.warning10,
            title: t('food.actions.splitMeal'),
            description: t('food.actions.splitMealDesc'),
            onPress: handleMealGroupSplit,
          },
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('food.actions.deleteAll'),
            description: t('food.actions.deleteAllDesc'),
            titleColor: theme.colors.status.error,
            onPress: () => {
              setIsMealGroupMenuVisible(false);
              setIsDeleteMealGroupVisible(true);
            },
          },
        ]}
      />

      {/* Meal Group Scale Portion Modal */}
      <ScaleMealPortionModal
        visible={isMealGroupScaleModalVisible ? selectedMealGroup !== null : false}
        onClose={() => {
          setIsMealGroupScaleModalVisible(false);
          setSelectedMealGroup(null);
        }}
        onConfirm={handleConfirmMealGroupScalePortion}
        initialTotalGrams={selectedMealGroupTotalGrams}
        mealNutrients={selectedMealGroupNutrients}
        isLoading={isMealGroupScaleLoading}
      />

      {/* Meal Group Move/Copy/Split Modal */}
      <MoveCopyMealModal
        visible={isMealGroupActionModalVisible ? selectedMealGroup !== null : false}
        onClose={() => {
          setIsMealGroupActionModalVisible(false);
          setSelectedMealGroup(null);
        }}
        onConfirm={handleConfirmMealGroupAction}
        mode={mealGroupActionMode}
        sourceMealType={selectedMealGroup?.entries[0]?.log.type || 'breakfast'}
        sourceDate={selectedDate}
        isLoading={isMealGroupActionLoading}
      />

      {/* Meal Group Create Meal Modal */}
      <CreateMealModal
        visible={isMealGroupCreateMealModalVisible}
        onClose={() => {
          setIsMealGroupCreateMealModalVisible(false);
          setMealGroupCreateMealInitialFoods([]);
          setSelectedMealGroup(null);
        }}
        onSave={() => {
          refresh();
          setIsMealGroupCreateMealModalVisible(false);
          setMealGroupCreateMealInitialFoods([]);
          setSelectedMealGroup(null);
        }}
        initialFoods={mealGroupCreateMealInitialFoods}
      />

      {/* Meal Group Insights Modal */}
      <MealInsightsModal
        visible={isMealGroupInsightsVisible ? selectedMealGroup !== null : false}
        onClose={() => {
          setIsMealGroupInsightsVisible(false);
          setSelectedMealGroup(null);
        }}
        mealType={selectedMealGroup?.entries[0]?.log.type || 'breakfast'}
        isLoading={isMealGroupInsightsLoading}
        onSubmit={handleSubmitMealGroupInsights}
      />

      {/* Delete Meal Group Confirmation */}
      <ConfirmationModal
        visible={isDeleteMealGroupVisible}
        onClose={() => {
          setIsDeleteMealGroupVisible(false);
          setSelectedMealGroup(null);
        }}
        onConfirm={handleConfirmDeleteMealGroup}
        title={t('food.mealGroup.deleteGroup')}
        message={t('food.mealGroup.deleteGroupWarning')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isDeleteMealGroupLoading}
      />
    </MasterLayout>
  );
}
