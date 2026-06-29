import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Copy,
  Edit,
  GitMerge,
  ListPlus,
  Save,
  Scale,
  ScanLine,
  Scissors,
  Sparkles,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { DailySummaryCard } from '@/components/cards/DailySummaryCard/DailySummaryCard';
import { useCoach } from '@/components/CoachContext';
import ConfettiOverlay from '@/components/ConfettiOverlay';
import { DailySummaryBottomMenu } from '@/components/DailySummaryBottomMenu';
import { DateNavigator } from '@/components/DateNavigator';
import { MasterLayout } from '@/components/MasterLayout';
import { AddFoodModal } from '@/components/modals/AddFoodModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import CreateCustomFoodModal from '@/components/modals/CreateCustomFoodModal';
import { CreateMealModal } from '@/components/modals/CreateMealModal';
import { FoodMealDetailsModal } from '@/components/modals/FoodMealDetailsModal';
import { FoodMealTrackingDetailsModal } from '@/components/modals/FoodMealTrackingDetailsModal';
import { FoodSearchModal } from '@/components/modals/FoodSearchModal';
import GoalsManagementModal from '@/components/modals/GoalsManagementModal';
import { MealGroupDetailsModal } from '@/components/modals/MealGroupDetailsModal';
import { MealInsightsModal } from '@/components/modals/MealInsightsModal';
import { MoveCopyMealModal } from '@/components/modals/MoveCopyMealModal';
import MyMealsModal from '@/components/modals/MyMealsModal';
import { type NutritionGoals, NutritionGoalsModal } from '@/components/modals/NutritionGoalsModal';
import { SavedForLaterModal } from '@/components/modals/SavedForLaterModal';
import { SaveForLaterPortionModal } from '@/components/modals/SaveForLaterPortionModal';
import { ScaleMealPortionModal } from '@/components/modals/ScaleMealPortionModal';
import {
  type MealGroup,
  type ResolvedLogEntry,
  sumMacros,
  sumNutrients,
} from '@/components/nutrition/foodTypes';
import { MealSectionsList } from '@/components/nutrition/MealSectionsList';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { MenuButton } from '@/components/theme/MenuButton';
import { SkeletonLoader } from '@/components/theme/SkeletonLoader';
import { ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { useSmartCamera } from '@/context/SmartCameraContext';
import { useSnackbar } from '@/context/SnackbarContext';
import Food from '@/database/models/Food';
import NutritionLog, { type MealType } from '@/database/models/NutritionLog';
import {
  ChatService,
  MealService,
  NutritionGoalService,
  NutritionService,
  SavedForLaterService,
  scaleMealNutritionLogsToTotalGrams,
  SettingsService,
} from '@/database/services';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useDailyNutritionSummary } from '@/hooks/useDailyNutritionSummary';
import { useFoodScreenState } from '@/hooks/useFoodScreenState';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import AiService from '@/services/AiService';
import {
  calendarDateFromRecordDay,
  formatLocalCalendarDayIso,
  localCalendarDayDate,
} from '@/utils/calendarDate';
import { digestibleCarbs } from '@/utils/carbsConvention';
import { getMealCritique } from '@/utils/coachAI';
import { flushLoadingPaint } from '@/utils/flushLoadingPaint';
import { getSimpleServingDisplay } from '@/utils/foodDisplay';
import { handleError } from '@/utils/handleError';
import { nutritionGoalsToInput, nutritionGoalToInitialValues } from '@/utils/nutritionGoals';

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

/**
 * Move / copy / split a set of logs to a target day+meal. Returns the success
 * translation key for the performed action, or null if nothing ran.
 */
const applyMealAction = async (
  logs: NutritionLog[],
  mode: 'move' | 'copy' | 'split',
  targetDate: Date,
  targetMealType: MealType,
  splitPercentage?: number
): Promise<string | null> => {
  if (mode === 'move') {
    await NutritionService.moveNutritionLogsToDate(logs, targetDate, targetMealType);
    return 'food.actions.moveSuccess';
  }

  if (mode === 'copy') {
    await NutritionService.copyNutritionLogsToDate(logs, targetDate, targetMealType);
    return 'food.actions.copySuccess';
  }

  if (mode === 'split' && splitPercentage) {
    await NutritionService.splitNutritionLogsToDate(
      logs,
      targetDate,
      targetMealType,
      splitPercentage
    );

    return 'food.actions.splitSuccess';
  }

  return null;
};

export default function FoodScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger, locale: appLocale } = useFormatAppNumber();
  const { units, isAiConfigured, intuitiveEatingMode, nutritionDisplay } = useSettings();
  const { triggerConfetti, showConfetti } = useConfettiTrigger();
  const { openCoach } = useCoach();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const { openCamera, setCurrentDate } = useSmartCamera();
  const {
    addFoodModalPreselectedMealType,
    createMealInitialFoods,
    foodSearchInitialTab,
    handleAddFoodToMeal,
    handleFoodCardPress,
    handleFoodMenuPress,
    handleMealGroupCardPress,
    handleMealGroupMenuPress,
    handleMealMenuPress,
    hasSavedForLaterItems,
    isAddFoodModalVisible,
    isCreateCustomFoodVisible,
    isCreateMealModalVisible,
    isDailySummaryMenuVisible,
    isDeleteAllMealLoading,
    isDeleteAllMealVisible,
    isDeleteConfirmationVisible,
    isDeleteFoodLoading,
    isDeleteMealGroupLoading,
    isDeleteMealGroupVisible,
    isDuplicateMode,
    isEditCurrentGoalVisible,
    isFoodDetailsModalVisible,
    isFoodMenuVisible,
    isFoodMoveLoading,
    isFoodMoveModalVisible,
    isFoodSearchModalVisible,
    isFoodSplitLoading,
    isFoodSplitModalVisible,
    isGoalsManagementModalVisible,
    isMealActionLoading,
    isMealActionModalVisible,
    isMealGroupActionLoading,
    isMealGroupActionModalVisible,
    isMealGroupDetailsVisible,
    isMealGroupInsightsLoading,
    isMealGroupInsightsVisible,
    isMealGroupMenuVisible,
    isMealGroupScaleLoading,
    isMealGroupScaleModalVisible,
    isMealInsightsLoading,
    isMealInsightsVisible,
    isMealMenuVisible,
    isMergeDuplicatesLoading,
    isMergeDuplicatesVisible,
    isMyMealsModalVisible,
    isQuickTrackMealModalVisible,
    isSaveForLaterLoading,
    isSaveForLaterPortionVisible,
    isSavedForLaterModalVisible,
    isScaleMealPortionLoading,
    isScaleMealPortionModalVisible,
    mealActionMode,
    mealGroupActionMode,
    requestSaveForLater,
    saveForLaterPendingLogs,
    saveForLaterPendingMealType,
    selectedFoodItem,
    selectedFoodLogDetails,
    selectedMealForMenu,
    selectedMealGroup,
    selectedMealGroupForDetails,
    selectedMealType,
    setAddFoodModalPreselectedMealType,
    setCreateMealInitialFoods,
    setFoodSearchInitialTab,
    setHasSavedForLaterItems,
    setIsAddFoodModalVisible,
    setIsCreateCustomFoodVisible,
    setIsCreateMealModalVisible,
    setIsDailySummaryMenuVisible,
    setIsDeleteAllMealLoading,
    setIsDeleteAllMealVisible,
    setIsDeleteConfirmationVisible,
    setIsDeleteFoodLoading,
    setIsDeleteMealGroupLoading,
    setIsDeleteMealGroupVisible,
    setIsDuplicateMode,
    setIsEditCurrentGoalVisible,
    setIsFoodDetailsModalVisible,
    setIsFoodMenuVisible,
    setIsFoodMoveLoading,
    setIsFoodMoveModalVisible,
    setIsFoodSearchModalVisible,
    setIsFoodSplitLoading,
    setIsFoodSplitModalVisible,
    setIsGoalsManagementModalVisible,
    setIsMealActionLoading,
    setIsMealActionModalVisible,
    setIsMealGroupActionLoading,
    setIsMealGroupActionModalVisible,
    setIsMealGroupDetailsVisible,
    setIsMealGroupInsightsLoading,
    setIsMealGroupInsightsVisible,
    setIsMealGroupMenuVisible,
    setIsMealGroupScaleLoading,
    setIsMealGroupScaleModalVisible,
    setIsMealInsightsLoading,
    setIsMealInsightsVisible,
    setIsMealMenuVisible,
    setIsMergeDuplicatesLoading,
    setIsMergeDuplicatesVisible,
    setIsMyMealsModalVisible,
    setIsQuickTrackMealModalVisible,
    setIsSaveForLaterLoading,
    setIsSaveForLaterPortionVisible,
    setIsSavedForLaterModalVisible,
    setIsScaleMealPortionLoading,
    setIsScaleMealPortionModalVisible,
    setMealActionMode,
    setMealGroupActionMode,
    setSaveForLaterPendingLogs,
    setSaveForLaterPendingMealType,
    setSelectedFoodItem,
    setSelectedFoodLogDetails,
    setSelectedMealForMenu,
    setSelectedMealGroup,
    setSelectedMealGroupForDetails,
    setSelectedMealType,
  } = useFoodScreenState();
  const [selectedDate, setSelectedDate] = useState(() => localCalendarDayDate(new Date()));

  // Keep camera context aware of the current date so the nav-bar camera button
  // (which has no logDate) also opens FoodMealTrackingDetailsModal on the right date.
  useEffect(() => {
    setCurrentDate(selectedDate);
    return () => setCurrentDate(undefined);
  }, [selectedDate, setCurrentDate]);
  const {
    logs,
    dailyNutrients,
    secondaryNutrients,
    isLoading,
    refresh,
    totalCount,
    nutritionGoal,
    resolvedMacros,
  } = useDailyNutritionSummary({
    date: selectedDate,
    enableReactivity: true,
    visible: true,
  });
  const { goal: currentNutritionGoal } = useCurrentNutritionGoal();

  const [resolvedLogs, setResolvedLogs] = useState<ResolvedLogEntry[]>([]);
  const [isResolvingRelations, setIsResolvingRelations] = useState(false);

  // Show skeleton until data is loaded
  const isScreenLoading = isLoading || isResolvingRelations;

  const handleSaveCurrentNutritionGoal = useCallback(
    async (goals: NutritionGoals) => {
      if (!currentNutritionGoal) {
        return;
      }

      try {
        await NutritionGoalService.updateGoal(
          currentNutritionGoal.id,
          nutritionGoalsToInput(goals),
          true
        );
        setIsEditCurrentGoalVisible(false);
      } catch (error) {
        await handleError(error, 'food.saveCurrentNutritionGoal', {
          snackbarMessage: t('errors.somethingWentWrong'),
          consoleMessage: 'Failed to update current nutrition goal:',
        });
      }
    },
    [currentNutritionGoal, t]
  );

  const checkSavedMeals = useCallback(async () => {
    try {
      const hasGroups = await SavedForLaterService.hasAnyGroups();
      setHasSavedForLaterItems(hasGroups);
    } catch (error) {
      console.error('Error checking saved meals:', error);
    }
  }, []);

  useEffect(() => {
    SavedForLaterService.hasAnyGroups()
      .then((hasGroups) => setHasSavedForLaterItems(hasGroups))
      .catch((error) => console.error('Error checking saved meals:', error));
  }, []);

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

  // Calculate calories consumed and macros — prefer resolved macros for dynamic goals
  const effectiveGoalCalories =
    resolvedMacros?.totalCalories ?? nutritionGoal?.totalCalories ?? 2500;
  const effectiveGoalProtein = resolvedMacros?.protein ?? nutritionGoal?.protein ?? 150;
  const effectiveGoalCarbs = resolvedMacros?.carbs ?? nutritionGoal?.carbs ?? 250;
  const effectiveGoalFats = resolvedMacros?.fats ?? nutritionGoal?.fats ?? 80;
  const effectiveGoalFiber = resolvedMacros?.fiber ?? nutritionGoal?.fiber ?? 0;

  const caloriesData = useMemo(() => {
    const consumedCalories = dailyNutrients?.calories || 0;
    const percentage = Math.round((consumedCalories / effectiveGoalCalories) * 100);

    return {
      consumed: consumedCalories,
      total: effectiveGoalCalories,
      percentage,
    };
  }, [dailyNutrients, effectiveGoalCalories]);

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
        groups[type].push({
          groupId,
          mealName: entries[0]?.log.loggedMealName || entries[0]?.displayName || '',
          entries,
          totalNutrients: sumMacros(entries),
        });
      });
    });

    return groups;
  }, [resolvedLogs]);

  const [mealGroupImageUrls, setMealGroupImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadMealGroupImageUrls() {
      const allGroupIds = new Set<string>();
      for (const groups of Object.values(mealGroupsByType)) {
        for (const group of groups) {
          allGroupIds.add(group.groupId);
        }
      }

      if (allGroupIds.size === 0) {
        if (isMounted) {
          setMealGroupImageUrls({});
        }

        return;
      }

      const results = await Promise.all(
        [...allGroupIds].map(async (id) => {
          const url = await MealService.getMealImageUrl(id);
          return [id, url] as const;
        })
      );

      if (!isMounted) {
        return;
      }

      const map: Record<string, string> = {};
      for (const [id, url] of results) {
        if (url) {
          map[id] = url;
        }
      }
      setMealGroupImageUrls(map);
    }

    void loadMealGroupImageUrls();

    return () => {
      isMounted = false;
    };
  }, [mealGroupsByType]);

  // Check if all meals are empty AND no food has ever been tracked
  const hasNoFood = !isScreenLoading && totalCount === 0;

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
      handleError(error, 'food.scaleMealGroupPortions', {
        snackbarMessage: t('food.actions.scaleMealPortionError'),
      });
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
      const successKey = await applyMealAction(
        logs,
        mealGroupActionMode,
        targetDate,
        targetMealType,
        splitPercentage
      );
      if (successKey) {
        showSnackbar('success', t(successKey));
      }
      await refresh();
    } catch (error) {
      handleError(error, 'food.performMealGroupAction', {
        snackbarMessage: t(getMealActionErrorKey(mealGroupActionMode)),
      });
    } finally {
      setIsMealGroupActionLoading(false);
      setIsMealGroupActionModalVisible(false);
      setSelectedMealGroup(null);
    }
  };

  const handleMealGroupGetInsights = () => {
    setIsMealGroupMenuVisible(false);
    setIsMealGroupInsightsVisible(true);
  };

  const handleSaveMealForLater = async (
    logs: NutritionLog[],
    mealType: MealType,
    percentage: number = 100,
    note?: string
  ) => {
    setIsSaveForLaterLoading(true);
    try {
      const dateStr = formatLocalCalendarDayIso(new Date(selectedDate));
      const defaultName = t('food.mealGroup.savedMealDefaultName', {
        date: dateStr,
        mealType: t(`food.meals.${mealType as any}`),
      });

      await SavedForLaterService.saveGroupForLater(
        logs,
        defaultName,
        mealType,
        selectedDate.getTime(),
        percentage,
        note
      );

      showSnackbar('success', t('food.mealGroup.saveForLaterSuccess'));
      await refresh();
      await checkSavedMeals();
    } catch (error) {
      handleError(error, 'food.handleSaveMealForLater', {
        snackbarMessage: t('food.mealGroup.saveForLaterError'),
      });
    } finally {
      setIsSaveForLaterLoading(false);
    }
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
      const totals = sumMacros(selectedMealGroup.entries);

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
      handleError(error, 'food.getMealGroupInsights', {
        snackbarMessage: t('food.actions.getMealInsightsError'),
      });
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

  const handleFoodCreateMeal = () => {
    setIsFoodMenuVisible(false);
    if (!selectedFoodItem || !selectedFoodItem.food) {
      return;
    }

    const items = [
      {
        food: selectedFoodItem.food,
        amount:
          selectedFoodItem.food.resolvedNutritionBasis === 'per_serving'
            ? selectedFoodItem.log.amount
            : Math.round(selectedFoodItem.gramWeight),
      },
    ];

    setCreateMealInitialFoods(items);
    setIsCreateMealModalVisible(true);
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
      handleError(error, 'food.handleMoveFood');
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
      handleError(error, 'food.handleSplitFood');
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
      handleError(error, 'food.handleDeleteFood');
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
      icon: UtensilsCrossed,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.actions.createMeal'),
      description: t('food.actions.createMealDesc'),
      onPress: handleFoodCreateMeal,
    },
    {
      icon: Save,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.mealGroup.saveForLater'),
      description: t('food.mealGroup.saveForLaterDesc'),
      onPress: () => {
        setIsFoodMenuVisible(false);
        if (selectedFoodItem) {
          requestSaveForLater([selectedFoodItem.log], selectedFoodItem.log.type);
          setSelectedFoodItem(null);
        }
      },
    },
    // delete should always be the last one
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.delete'),
      description: t('food.actions.deleteDesc'),
      onPress: handleDeleteFood,
    },
  ];

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
      handleError(error, 'food.handleDeleteAllMealItems');
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

        return {
          food: entry.food,
          amount:
            entry.food.resolvedNutritionBasis === 'per_serving'
              ? entry.log.amount
              : Math.round(entry.gramWeight),
        };
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
      const successKey = await applyMealAction(
        logs,
        mealActionMode,
        targetDate,
        targetMealType,
        splitPercentage
      );
      if (successKey) {
        showSnackbar('success', t(successKey));
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
      const totals = sumMacros(mealFoods);

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

  const selectedMealGroupNutrients = useMemo(
    () => sumNutrients(selectedMealGroup?.entries ?? []),
    [selectedMealGroup]
  );

  const selectedMealTotalGrams = useMemo(() => {
    if (!selectedMealForMenu) {
      return 0;
    }
    return (mealsByType[selectedMealForMenu] || []).reduce((sum, e) => sum + e.gramWeight, 0);
  }, [selectedMealForMenu, mealsByType]);

  const selectedMealNutrients = useMemo(
    () => sumNutrients(selectedMealForMenu ? mealsByType[selectedMealForMenu] || [] : []),
    [selectedMealForMenu, mealsByType]
  );

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
      icon: Save,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.mealGroup.saveForLater'),
      description: t('food.mealGroup.saveForLaterDesc'),
      onPress: () => {
        setIsMealMenuVisible(false);
        if (selectedMealForMenu) {
          const mealFoods = mealsByType[selectedMealForMenu] || [];
          requestSaveForLater(
            mealFoods.map((e) => e.log),
            selectedMealForMenu
          );
          setSelectedMealForMenu(null);
        }
      },
    },
    // delete should always be the last one
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('food.actions.deleteAll'),
      description: t('food.actions.deleteAllDesc'),
      onPress: handleDeleteAllMeal,
    },
  ];

  const mealGroupMenuItems = [
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
      icon: Save,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      title: t('food.mealGroup.saveForLater'),
      description: t('food.mealGroup.saveForLaterDesc'),
      onPress: () => {
        setIsMealGroupMenuVisible(false);
        if (selectedMealGroup) {
          requestSaveForLater(
            selectedMealGroup.entries.map((e) => e.log),
            selectedMealGroup.entries[0]?.log.type || 'other'
          );
          setSelectedMealGroup(null);
        }
      },
    },
    // delete should always be the last one
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
                  {nutritionGoal?.isDynamic ? (
                    <View
                      className="mb-1 self-start rounded-full px-2 py-0.5"
                      style={{ backgroundColor: theme.colors.status.emerald20 }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: theme.colors.status.emeraldLight }}
                      >
                        {t('nutritionGoals.dynamicBadge')}
                      </Text>
                    </View>
                  ) : null}
                  <DailySummaryCard
                    calories={{
                      consumed: caloriesData.consumed,
                      remaining: caloriesData.total - caloriesData.consumed,
                      goal: caloriesData.total,
                    }}
                    macros={{
                      protein: {
                        value: dailyNutrients?.protein || 0,
                        goal: effectiveGoalProtein,
                      },
                      carbs: {
                        // Digestible/net carbs: the goal is net and fiber has its own bar/goal,
                        // while food-log carbs include fiber. Show net to compare like-for-like
                        // (avoids double-counting fiber).
                        value: digestibleCarbs(dailyNutrients?.carbs, dailyNutrients?.fiber),
                        goal: effectiveGoalCarbs,
                      },
                      fats: {
                        value: dailyNutrients?.fat || 0,
                        goal: effectiveGoalFats,
                      },
                      fiber: {
                        value: dailyNutrients?.fiber || 0,
                        goal: effectiveGoalFiber,
                      },
                    }}
                    secondaryNutrients={secondaryNutrients}
                    intuitiveMode={intuitiveEatingMode}
                    nutritionDisplay={nutritionDisplay}
                    menuButton={
                      <MenuButton
                        onPress={() => setIsDailySummaryMenuVisible(true)}
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
                            showBarcodeTextSearch: true,
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
                        onPress={() => {
                          setAddFoodModalPreselectedMealType(null);
                          setIsAddFoodModalVisible(true);
                        }}
                      />
                    </View>
                  </View>

                  <MealSectionsList
                    byMealType={dailyNutrients?.byMealType}
                    ungroupedByType={ungroupedByType}
                    mealGroupsByType={mealGroupsByType}
                    mealGroupImageUrls={mealGroupImageUrls}
                    intuitiveMode={intuitiveEatingMode}
                    onAddFood={handleAddFoodToMeal}
                    onMealMenuPress={handleMealMenuPress}
                    onFoodCardPress={handleFoodCardPress}
                    onFoodMenuPress={handleFoodMenuPress}
                    onMealGroupCardPress={handleMealGroupCardPress}
                    onMealGroupMenuPress={handleMealGroupMenuPress}
                  />
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
        showTrackByMealType={!addFoodModalPreselectedMealType}
        hasSavedMeals={hasSavedForLaterItems}
        onTrackFromSavedPress={() => {
          setIsSavedForLaterModalVisible(true);
        }}
        onClose={() => setIsAddFoodModalVisible(false)}
        onMealTypeSelect={(mealType) => {
          setSelectedMealType(mealType);
          setIsAddFoodModalVisible(false);
          setFoodSearchInitialTab('all');
          setIsFoodSearchModalVisible(true);
        }}
        onAiCameraPress={() => {
          setIsAddFoodModalVisible(false);
          openCamera({
            mode: 'ai-meal-photo',
            hideCameraModePicker: false,
            logDate: selectedDate,
            mealType: selectedMealType,
          });
        }}
        onScanBarcodePress={() => {
          setIsAddFoodModalVisible(false);
          openCamera({
            mode: 'barcode-scan',
            hideCameraModePicker: false,
            showBarcodeTextSearch: true,
            logDate: selectedDate,
            mealType: selectedMealType,
          });
        }}
        onSearchFoodPress={() => {
          setIsAddFoodModalVisible(false);
          setFoodSearchInitialTab('all');
          setIsFoodSearchModalVisible(true);
        }}
        onCreateCustomFoodPress={() => {
          // Open CreateCustomFoodModal
          setIsAddFoodModalVisible(false);
          setIsCreateCustomFoodVisible(true);
        }}
        onTrackCustomMealPress={() => {
          setIsAddFoodModalVisible(false);
          setFoodSearchInitialTab('meals');
          setIsFoodSearchModalVisible(true);
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
        initialMealType={selectedMealType}
        onTracked={() => {
          refresh();
          setIsQuickTrackMealModalVisible(false);
        }}
        onFirstNutritionLog={() => triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG)}
        onFirstMealCreated={() => triggerConfetti(ConfettiActivity.FIRST_MEAL_CREATED)}
      />
      {/* Create Meal Modal (prefilled from current meal foods) */}
      <CreateMealModal
        visible={isCreateMealModalVisible}
        onClose={() => {
          setIsCreateMealModalVisible(false);
          setCreateMealInitialFoods([]);
          setSelectedMealForMenu(null);
          setSelectedFoodItem(null);
        }}
        onSave={() => {
          refresh();
          setIsCreateMealModalVisible(false);
          setCreateMealInitialFoods([]);
          setSelectedMealForMenu(null);
          setSelectedFoodItem(null);
        }}
        initialFoods={createMealInitialFoods}
        onFirstMealCreated={() => triggerConfetti(ConfettiActivity.FIRST_MEAL_CREATED)}
      />

      {/* My Meals Modal */}
      <MyMealsModal
        visible={isMyMealsModalVisible}
        onClose={() => setIsMyMealsModalVisible(false)}
        initialMealType={selectedMealType}
      />

      {/* Create Custom Food Modal */}
      <CreateCustomFoodModal
        visible={isCreateCustomFoodVisible}
        trackFoodAfterSave={true}
        onClose={() => setIsCreateCustomFoodVisible(false)}
        isAiEnabled={isAiConfigured}
        initialMealType={selectedMealType}
      />

      {/* Food Search Modal */}
      <FoodSearchModal
        visible={isFoodSearchModalVisible}
        onClose={() => setIsFoodSearchModalVisible(false)}
        mealType={selectedMealType}
        logDate={selectedDate}
        initialTab={foodSearchInitialTab}
        onFoodTracked={refresh}
        onFirstNutritionLog={() => triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG)}
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
            showBarcodeTextSearch: true,
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

      {currentNutritionGoal ? (
        <NutritionGoalsModal
          visible={isEditCurrentGoalVisible}
          onClose={() => setIsEditCurrentGoalVisible(false)}
          onSave={handleSaveCurrentNutritionGoal}
          initialGoals={nutritionGoalToInitialValues(currentNutritionGoal)}
          isEditing={true}
        />
      ) : null}

      <DailySummaryBottomMenu
        visible={isDailySummaryMenuVisible}
        onClose={() => setIsDailySummaryMenuVisible(false)}
        onEditCurrentGoalPress={() => setIsEditCurrentGoalVisible(true)}
        onGoalsManagementPress={() => setIsGoalsManagementModalVisible(true)}
        showEditCurrentGoal={currentNutritionGoal != null}
      />

      {/* Food Menu Modal */}
      <BottomPopUpMenu
        visible={isFoodMenuVisible}
        onClose={() => setIsFoodMenuVisible(false)}
        title={selectedFoodItem?.displayName ?? t('food.generic')}
        subtitle={`${getSimpleServingDisplay(selectedFoodItem?.gramWeight || 0, units, appLocale)} • ${t('common.amount_kcal', { amount: formatInteger(Math.round(selectedFoodItem?.nutrients?.calories || 0), { useGrouping: false }) })}`}
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
            ? calendarDateFromRecordDay(selectedFoodItem.log.date, selectedFoodItem.log.timezone)
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
            ? calendarDateFromRecordDay(selectedFoodItem.log.date, selectedFoodItem.log.timezone)
            : selectedDate
        }
        isLoading={isFoodSplitLoading}
      />

      {/* Save for Later Portion Modal */}
      <SaveForLaterPortionModal
        visible={isSaveForLaterPortionVisible}
        onClose={() => {
          setIsSaveForLaterPortionVisible(false);
          setSaveForLaterPendingLogs(null);
          setSaveForLaterPendingMealType(null);
        }}
        onConfirm={async (percentage, note) => {
          if (saveForLaterPendingLogs && saveForLaterPendingMealType) {
            await handleSaveMealForLater(
              saveForLaterPendingLogs,
              saveForLaterPendingMealType,
              percentage,
              note
            );
          }
          setSaveForLaterPendingLogs(null);
          setSaveForLaterPendingMealType(null);
        }}
        isLoading={isSaveForLaterLoading}
        mealType={saveForLaterPendingMealType || undefined}
      />

      {/* Food Details Modal (edit/duplicate mode) */}
      <SavedForLaterModal
        visible={isSavedForLaterModalVisible}
        onClose={() => setIsSavedForLaterModalVisible(false)}
        onTracked={async () => {
          await refresh();
          await checkSavedMeals();
        }}
        initialMealType={selectedMealType}
        initialDate={selectedDate}
      />

      <FoodMealTrackingDetailsModal
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
            ? calendarDateFromRecordDay(selectedFoodItem.log.date, selectedFoodItem.log.timezone)
            : undefined
        }
        initialServingSize={
          selectedFoodItem && isDuplicateMode ? selectedFoodItem.gramWeight : undefined
        }
        onNutritionLogTracked={() => triggerConfetti(ConfettiActivity.FIRST_NUTRITION_LOG)}
        onAddFood={async (_data) => {
          try {
            await refresh();
          } catch (_error) {
            await handleError(_error, 'food.handleRefresh', {
              snackbarMessage: t('food.errors.refreshFailed'),
            });

            // Reload the current screen using expo-router
            router.replace('/app/nutrition/food');
          }
        }}
        isAiEnabled={isAiConfigured}
      />

      <FoodMealDetailsModal
        visible={selectedFoodLogDetails !== null}
        onClose={() => setSelectedFoodLogDetails(null)}
        entry={selectedFoodLogDetails}
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
        items={mealGroupMenuItems}
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

      {/* Meal Group Details Modal */}
      <MealGroupDetailsModal
        visible={isMealGroupDetailsVisible}
        onClose={() => {
          setIsMealGroupDetailsVisible(false);
          setSelectedMealGroupForDetails(null);
        }}
        mealName={selectedMealGroupForDetails?.mealName ?? ''}
        entries={selectedMealGroupForDetails?.entries ?? []}
        totalNutrients={
          selectedMealGroupForDetails?.totalNutrients ?? {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          }
        }
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
      {showConfetti ? <ConfettiOverlay /> : null}
    </MasterLayout>
  );
}
