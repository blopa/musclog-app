import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CombineIntoMealModal } from '@/components/modals/CombineIntoMealModal';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { MoveCopyMealModal } from '@/components/modals/MoveCopyMealModal';
import { ScaleMealPortionModal } from '@/components/modals/ScaleMealPortionModal';
import { useSnackbar } from '@/context/SnackbarContext';
import { KEEP_MEAL_TYPES, type MealTypeTarget } from '@/database/models/mealTypeTarget';
import type { MealType } from '@/database/models/NutritionLog';
import {
  NutritionService,
  scaleMealNutritionLogsToTotalGrams,
} from '@/database/services/NutritionService';
import { handleError } from '@/utils/handleError';

import {
  DIARY_SCOPE_COPY,
  DIARY_TRANSFER_ERROR_KEYS,
  type DiaryActionRequest,
  type DiaryTransferMode,
} from './diaryActions';

type DiaryActionPanelsProps = {
  /** What to act on and with which sheet; null mounts nothing. */
  request: DiaryActionRequest | null;
  /** The diary day the logs are on, which the move/copy sheet starts from. */
  selectedDate: Date;
  /** The sheet was dismissed without changing anything. */
  onClose: () => void;
  /** A write went through: end whatever picked the logs (a selection) and close the sheet. */
  onDone: () => void;
  /** Reloads the diary after a write. */
  refresh: () => Promise<unknown>;
};

/**
 * The one place the food diary writes to logs a user picked, whichever surface picked them:
 * a food's menu, a meal section's menu, a grouped meal's menu or a long-press selection.
 * The surfaces only build a `DiaryActionRequest`; this owns the sheet, the write, the
 * snackbars and the failure behaviour, so the four of them cannot drift apart again.
 *
 * Failure rules, shared by every panel: the error is reported once here. A sheet that holds
 * the user's input (day and meal, grams, a meal name) stays open and keeps it, because it
 * rethrows to the sheet; a confirmation has nothing to keep and closes. A write that went
 * through is never reported as failed because the reload after it did not.
 *
 * Mounted only while a request exists, so every opening starts from the sheet's defaults.
 */
export function DiaryActionPanels({
  request,
  selectedDate,
  onClose,
  onDone,
  refresh,
}: DiaryActionPanelsProps) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  // State alone cannot stop a second tap in the same frame, before the re-render that disables it.
  const isDeleting = useRef(false);
  const [deleting, setDeleting] = useState(false);

  if (!request) {
    return null;
  }

  const { scope, panel, selection } = request;
  const { itemCount: count, totalGrams, totalNutrients } = selection;
  const logs = selection.entries.map((entry) => entry.log);
  const sourceMealType: MealType = selection.commonMealType ?? selection.mealTypes[0] ?? 'other';
  const scopeCopy = DIARY_SCOPE_COPY[scope];

  const attempt = async (context: string, errorMessage: string, write: () => Promise<unknown>) => {
    try {
      await write();
    } catch (error) {
      await handleError(error, context, { snackbarMessage: errorMessage });
      throw error;
    }
  };

  const finish = async (message: string) => {
    showSnackbar('success', message);
    onDone();
    try {
      await refresh();
    } catch (error) {
      await handleError(error, 'food.diary.refresh', {
        snackbarMessage: t('food.errors.refreshFailed'),
      });
    }
  };

  const confirmTransfer =
    (mode: DiaryTransferMode) =>
    async (targetDate: Date, target: MealTypeTarget, splitPercentage?: number) => {
      await attempt(`food.diary.${mode}`, t(DIARY_TRANSFER_ERROR_KEYS[mode]), () => {
        if (mode !== 'split') {
          return NutritionService.transferNutritionLogs(logs, mode, targetDate, target);
        }

        // The sheet offers "keep" only outside a split and always sends a percentage for one.
        if (target === KEEP_MEAL_TYPES || splitPercentage === undefined) {
          throw new Error('A split needs one concrete meal and a percentage');
        }

        return NutritionService.splitNutritionLogsToDate(logs, targetDate, target, splitPercentage);
      });
      await finish(t(scopeCopy.transfer[mode].successKey, { count }));
    };

  const confirmScale = async (newTotalGrams: number) => {
    if (newTotalGrams < 1) {
      showSnackbar('error', t('food.actions.scaleMealPortionInvalid'));
      return;
    }

    // Per-serving foods have no gram weight, so a set of only those has nothing to scale from.
    if (totalGrams <= 0) {
      showSnackbar('error', t('food.actions.scaleMealPortionError'));
      onClose();
      return;
    }

    await attempt('food.diary.scale', t('food.actions.scaleMealPortionError'), () =>
      scaleMealNutritionLogsToTotalGrams(
        selection.entries.map((entry) => ({ log: entry.log, gramWeight: entry.gramWeight })),
        newTotalGrams
      )
    );
    await finish(t('food.actions.scaleMealPortionSuccess'));
  };

  const confirmCombine = async (mealName: string, mealType: MealType) => {
    await attempt('food.diary.combine', t('food.selection.combineError'), () =>
      NutritionService.groupNutritionLogs(logs, { groupId: randomUUID(), mealName, mealType })
    );
    await finish(t('food.selection.combineSuccess', { name: mealName }));
  };

  const confirmDelete = async () => {
    if (isDeleting.current) {
      return;
    }

    isDeleting.current = true;
    setDeleting(true);
    try {
      const { successKey, errorKey, params } = scopeCopy.delete;
      try {
        await NutritionService.deleteNutritionLogsBatch(logs);
      } catch (error) {
        // A confirmation holds no input, so it closes after reporting rather than rethrowing.
        await handleError(error, 'food.diary.delete', { snackbarMessage: t(errorKey) });
        return;
      }

      await finish(t(successKey, { count, ...params(request) }));
    } finally {
      isDeleting.current = false;
      setDeleting(false);
    }
  };

  switch (panel) {
    case 'copy':
    case 'move':
    case 'split': {
      const { titleKey } = scopeCopy.transfer[panel] as { titleKey?: string };

      return (
        <MoveCopyMealModal
          visible
          onClose={onClose}
          onConfirm={confirmTransfer(panel)}
          allowKeepMealTypes={selection.mealTypes.length > 1}
          mode={panel}
          title={titleKey ? t(titleKey, { count }) : undefined}
          sourceMealType={sourceMealType}
          sourceDate={selectedDate}
        />
      );
    }

    case 'scale':
      return (
        <ScaleMealPortionModal
          visible
          onClose={onClose}
          onConfirm={confirmScale}
          initialTotalGrams={totalGrams}
          mealNutrients={totalNutrients}
        />
      );

    case 'combine':
      return (
        <CombineIntoMealModal
          visible
          onClose={onClose}
          onConfirm={confirmCombine}
          initialMealType={sourceMealType}
          itemCount={count}
        />
      );

    case 'delete': {
      const { titleKey, messageKey, params } = scopeCopy.delete;

      return (
        <ConfirmationModal
          visible
          onClose={onClose}
          onConfirm={confirmDelete}
          title={t(titleKey, params(request))}
          message={t(messageKey, params(request))}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          variant="destructive"
          isLoading={deleting}
        />
      );
    }
  }
}
