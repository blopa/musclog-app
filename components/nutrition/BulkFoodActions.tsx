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
import { useSnackbar } from '@/context/SnackbarContext';
import type Food from '@/database/models/Food';
import type NutritionLog from '@/database/models/NutritionLog';
import type { MealType } from '@/database/models/NutritionLog';
import { useTheme } from '@/hooks/useTheme';

import type { DiaryPanelKind } from './diaryActions';
import type { DiarySelection } from './foodDiarySelection';
import { FoodSelectionBar } from './FoodSelectionBar';
import { mealFoodsFromEntries } from './foodTypes';

type BulkFoodActionsProps = {
  selection: DiarySelection;
  intuitiveMode: boolean;
  /** Ends selection mode. */
  onClearSelection: () => void;
  /** Hands the selection to `DiaryActionPanels`, which owns the sheet and the write. */
  onRequestPanel: (panel: DiaryPanelKind) => void;
  /** Opens the screen's own CreateMealModal, prefilled. */
  onCreateMeal: (foods: { food: Food; amount: number }[]) => void;
  /** Hands the logs to the screen's existing save-for-later flow. */
  onSaveForLater: (logs: NutritionLog[], mealType: MealType) => void;
};

/**
 * The pinned bar of a long-press selection and the menu of what can be done with it. It only
 * chooses: the move/copy, scale, combine and delete sheets and their writes belong to
 * `DiaryActionPanels`, the same host a food's, a meal's and a grouped meal's menus use.
 */
export function BulkFoodActions({
  selection,
  intuitiveMode,
  onClearSelection,
  onRequestPanel,
  onCreateMeal,
  onSaveForLater,
}: BulkFoodActionsProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [menuOpen, setMenuOpen] = useState(false);

  const { entries, itemCount, groups, totalGrams, commonMealType, mealTypes } = selection;
  const firstMealType = commonMealType ?? mealTypes[0] ?? 'other';

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
    onSaveForLater(
      entries.map((entry) => entry.log),
      firstMealType
    );
    onClearSelection();
  };

  // A selection that is already exactly one meal card has nothing to combine.
  const canCombine = !(groups.length === 1 && itemCount === 1);

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Copy,
      title: t('food.actions.copyToAnotherDay'),
      description: t('food.selection.copyDesc'),
      onPress: () => onRequestPanel('copy'),
    },
    {
      icon: ArrowRight,
      title: t('food.actions.moveToAnotherDay'),
      description: t('food.selection.moveDesc'),
      onPress: () => onRequestPanel('move'),
    },
    // Per-serving foods have no gram weight, so a selection made only of them has no total
    // to scale from.
    ...(totalGrams > 0
      ? [
          {
            icon: Scale,
            title: t('food.selection.scale'),
            description: t('food.selection.scaleDesc'),
            onPress: () => onRequestPanel('scale'),
          },
        ]
      : []),
    ...(canCombine
      ? [
          {
            icon: Combine,
            title: t('food.selection.combine'),
            description: t('food.selection.combineDesc'),
            onPress: () => onRequestPanel('combine'),
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
      onPress: () => onRequestPanel('delete'),
    },
  ];

  return (
    <>
      <FoodSelectionBar
        itemCount={itemCount}
        calories={selection.totalNutrients.calories}
        intuitiveMode={intuitiveMode}
        onClose={onClearSelection}
        onActionsPress={() => setMenuOpen(true)}
      />
      <BottomPopUpMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t('food.selection.count', { count: itemCount })}
        items={menuItems}
      />
    </>
  );
}
