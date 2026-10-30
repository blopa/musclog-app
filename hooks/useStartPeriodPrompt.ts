import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '@/context/SnackbarContext';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { isBleeding } from '@/utils/cycle/dayLog';
import { periodCoversDay } from '@/utils/cycle/periodRules';
import type { BleedingLevel } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

/**
 * Bleeding logged on a day no period covers is the commonest way a period start gets missed, so
 * after saving one the person is offered to start a period there. One implementation for the day
 * sheet and the quick-log row.
 */
export function useStartPeriodPrompt() {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { periods, startPeriod, guidance, isActive } = useMenstrualCycle();

  return useCallback(
    (day: number, bleeding: BleedingLevel | null) => {
      if (
        !isBleeding(bleeding) ||
        !isActive ||
        guidance.hidePeriodActions ||
        periodCoversDay(periods, day) ||
        day > Date.now()
      ) {
        return;
      }

      showSnackbar('success', t('cycle.daySheet.startPeriodPrompt'), {
        action: t('cycle.daySheet.startPeriod'),
        duration: 8000,
        onAction: () => {
          void startPeriod(day).catch((error) =>
            handleError(error, 'useStartPeriodPrompt.startPeriod', {
              snackbarMessage: t('errors.somethingWentWrong'),
            })
          );
        },
      });
    },
    [guidance.hidePeriodActions, isActive, periods, showSnackbar, startPeriod, t]
  );
}
