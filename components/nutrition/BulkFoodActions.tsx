import { randomUUID } from 'expo-crypto';
import {
  ArrowRight,
  Combine,
  Copy,
  Save,
  Scale,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { CombineIntoMealModal } from '@/components/modals/CombineIntoMealModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import {
  KEEP_MEAL_TYPES,
  type MealTypeTarget,
  MoveCopyMealModal,
} from '@/components/modals/MoveCopyMealModal';
import { ScaleMealPortionModal } from '@/components/modals/ScaleMealPortionModal';
import { useSnackbar } from '@/context/SnackbarContext';
import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import type { MealType } from '@/database/models/NutritionLog';
import {
  NutritionService,
  scaleMealNutritionLogsToTotalGrams,
} from '@/database/services/NutritionService';
import { useTheme } from '@/hooks/useTheme';
import { handleError } from '@/utils/handleError';

import type { DiarySelection } from './foodDiarySelection';
import { FoodSelectionBar } from './FoodSelectionBar';
import { mealFoodsFromEntries } from './foodTypes';

/** The one sheet open at a time — a single slot, so no two modals are ever mounted together. */
type BulkPanel =
  | { kind: 'menu' }
  | { kind: 'copy' }
  | { kind: 'move' }
  | { kind: 'scale' }
  | { kind: 'combine' }
  | { kind: 'delete' };

/**
 * Whole translation keys per transfer mode, so `check-translations` can see every one (it
 * cannot read a key assembled in a ternary inside `t()`).
 */
const TRANSFER_COPY = {
  copy: {
    titleKey: 'food.selection.copyModalTitle',
    messageKey: 'food.selection.copySuccess',
    errorKey: 'food.actions.copyError',
  },
  move: {
    titleKey: 'food.selection.moveModalTitle',
    messageKey: 'food.selection.moveSuccess',
    errorKey: 'food.actions.moveError',
  },
} as const;

type BulkFoodActionsProps = {
  selection: DiarySelection;
  selectedDate: Date;
  intuitiveMode: boolean;
  /** Ends selection mode; called after an action has gone through. */
  onClearSelection: () => void;
  /** Opens the screen's own CreateMealModal, prefilled. */
  onCreateMeal: (foods: { food: Food; amount: number }[]) => void;
  /** Hands the logs to the screen's existing save-for-later flow. */
  onSaveForLater: (logs: NutritionLog[], mealType: MealType) => void;
  refresh: () => Promise<unknown>;
};

/**
 * Everything the food diary can do with a long-press selection: the pinned bar, its action
 * menu and the sheet each action opens. Lives outside `food.tsx` so the screen only wires the
 * selection in. Every action ends the selection only once its write has gone through; a
 * failure keeps the selection so the user can try again.
 */
export function BulkFoodActions({
  selection,
  selectedDate,
  intuitiveMode,
  onClearSelection,
  onCreateMeal,
  onSaveForLater,
  refresh,
}: BulkFoodActionsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [panel, setPanel] = useState<BulkPanel | null>(null);

  const { entries, itemCount, mealTypes, commonMealType, totalGrams, groups } = selection;
  const logs = entries.map((entry) => entry.log);
  const firstMealType = commonMealType ?? mealTypes[0] ?? 'other';
  const isMixed = mealTypes.length > 1;

  const closePanel = () => setPanel(null);
  // BottomPopUpMenu calls onClose right after an item's own onPress; only close the menu if
  // that item did not already move on to another sheet.
  const closeMenu = () => setPanel((current) => (current?.kind === 'menu' ? null : current));

  const finish = async (successMessage: string) => {
    showSnackbar('success', successMessage);
    onClearSelection();
    closePanel();
    await refresh();
  };

  const handleMoveOrCopy =
    (mode: 'copy' | 'move') => async (targetDate: Date, target: MealTypeTarget) => {
      try {
        if (mode === 'copy') {
          await (target === KEEP_MEAL_TYPES
            ? NutritionService.copyNutritionLogsPreservingMealType(logs, targetDate)
            : NutritionService.copyNutritionLogsToDate(logs, targetDate, target));
        } else {
          await (target === KEEP_MEAL_TYPES
            ? NutritionService.moveNutritionLogsPreservingMealType(logs, targetDate)
            : NutritionService.moveNutritionLogsToDate(logs, targetDate, target));
        }

        await finish(t(TRANSFER_COPY[mode].messageKey, { count: itemCount }));
      } catch (error) {
        await handleError(error, `food.bulk.${mode}`, {
          snackbarMessage: t(TRANSFER_COPY[mode].errorKey),
        });
      }
    };

  const handleScale = async (newTotalGrams: number) => {
    if (newTotalGrams < 1) {
      showSnackbar('error', t('food.actions.scaleMealPortionInvalid'));
      return;
    }

    try {
      await scaleMealNutritionLogsToTotalGrams(
        entries.map((entry) => ({ log: entry.log, gramWeight: entry.gramWeight })),
        newTotalGrams
      );
      await finish(t('food.actions.scaleMealPortionSuccess'));
    } catch (error) {
      await handleError(error, 'food.bulk.scale', {
        snackbarMessage: t('food.actions.scaleMealPortionError'),
      });
    }
  };

  const handleCombine = async (mealName: string, mealType: MealType) => {
    try {
      await NutritionService.groupNutritionLogs(logs, {
        groupId: randomUUID(),
        mealName,
        mealType,
      });
      await finish(t('food.selection.combineSuccess', { name: mealName }));
    } catch (error) {
      await handleError(error, 'food.bulk.combine', {
        snackbarMessage: t('food.selection.combineError'),
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    try {
      await NutritionService.deleteNutritionLogsBatch(logs);
      await finish(t('food.selection.deleteSuccess', { count: itemCount }));
    } catch (error) {
      await handleError(error, 'food.bulk.delete', {
        snackbarMessage: t('food.actions.deleteAllError'),
      });
    }
  };

  const handleCreateMeal = () => {
    const foods = mealFoodsFromEntries(entries);
    if (foods.length === 0) {
      showSnackbar('error', t('food.createMeal.noFoods'));
      return;
    }

    onCreateMeal(foods);
    onClearSelection();
  };

  const handleSaveForLater = () => {
    onSaveForLater(logs, firstMealType);
    onClearSelection();
  };

  // A selection that is already exactly one meal card has nothing to combine.
  const canCombine = !(groups.length === 1 && itemCount === 1);

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Copy,
      title: t('food.actions.copyToAnotherDay'),
      description: t('food.selection.copyDesc'),
      onPress: () => setPanel({ kind: 'copy' }),
    },
    {
      icon: ArrowRight,
      title: t('food.actions.moveToAnotherDay'),
      description: t('food.selection.moveDesc'),
      onPress: () => setPanel({ kind: 'move' }),
    },
    // Per-serving foods have no gram weight, so a selection made only of them has no total
    // to scale from.
    ...(totalGrams > 0
      ? [
          {
            icon: Scale,
            title: t('food.selection.scale'),
            description: t('food.selection.scaleDesc'),
            onPress: () => setPanel({ kind: 'scale' }),
          },
        ]
      : []),
    ...(canCombine
      ? [
          {
            icon: Combine,
            title: t('food.selection.combine'),
            description: t('food.selection.combineDesc'),
            onPress: () => setPanel({ kind: 'combine' }),
          },
        ]
      : []),
    {
      icon: UtensilsCrossed,
      title: t('food.actions.createMeal'),
      description: t('food.selection.createMealDesc'),
      onPress: handleCreateMeal,
    },
    {
      icon: Save,
      title: t('food.mealGroup.saveForLater'),
      description: t('food.mealGroup.saveForLaterDesc'),
      onPress: handleSaveForLater,
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      title: t('food.selection.delete'),
      titleColor: theme.colors.status.error,
      onPress: () => setPanel({ kind: 'delete' }),
    },
  ];

  const renderPanel = () => {
    switch (panel?.kind) {
      case 'menu':
        return (
          <BottomPopUpMenu
            visible
            onClose={closeMenu}
            title={t('food.selection.count', { count: itemCount })}
            items={menuItems}
          />
        );
      case 'copy':
      case 'move':
        return (
          <MoveCopyMealModal
            visible
            onClose={closePanel}
            onConfirm={handleMoveOrCopy(panel.kind)}
            allowKeepMealTypes={isMixed}
            mode={panel.kind}
            title={t(TRANSFER_COPY[panel.kind].titleKey, { count: itemCount })}
            sourceMealType={firstMealType}
            sourceDate={selectedDate}
          />
        );
      case 'scale':
        return (
          <ScaleMealPortionModal
            visible
            onClose={closePanel}
            onConfirm={handleScale}
            initialTotalGrams={totalGrams}
            mealNutrients={selection.totalNutrients}
          />
        );
      case 'combine':
        return (
          <CombineIntoMealModal
            visible
            onClose={closePanel}
            onConfirm={handleCombine}
            initialMealType={firstMealType}
            itemCount={itemCount}
          />
        );
      case 'delete':
        return (
          <ConfirmationModal
            visible
            onClose={closePanel}
            onConfirm={handleDelete}
            title={t('food.selection.deleteConfirmTitle', { count: itemCount })}
            message={t('food.selection.deleteConfirmMessage', { count: itemCount })}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            variant="destructive"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <FoodSelectionBar
        itemCount={itemCount}
        calories={selection.totalNutrients.calories}
        intuitiveMode={intuitiveMode}
        onClose={onClearSelection}
        onActionsPress={() => setPanel({ kind: 'menu' })}
      />
      {renderPanel()}
    </>
  );
}
