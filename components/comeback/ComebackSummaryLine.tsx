import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ComebackService } from '@/database/services/ComebackService';
import { useComebackState } from '@/hooks/useComebackState';
import { handleError } from '@/utils/handleError';

/**
 * One quiet line on a finished workout's summary while a comeback is running. It stands in for a
 * second celebration (the summary already fires confetti for every workout) and is where graduation
 * is shown: once, right after the workout that earned it, after which the comeback is closed.
 */
export function ComebackSummaryLine() {
  const { t } = useTranslation();
  const { phase, week, rampWeeks, isLoading } = useComebackState();
  const closedRef = useRef(false);

  useEffect(() => {
    if (isLoading || phase !== 'graduated' || closedRef.current) {
      return;
    }

    // The message below renders from this render's `phase`; closing the comeback afterwards means
    // it is not shown again on the next workout.
    closedRef.current = true;
    void ComebackService.end().catch((error) => handleError(error, 'comebackSummaryLine.end'));
  }, [isLoading, phase]);

  if (isLoading || (phase !== 'ramp' && phase !== 'graduated')) {
    return null;
  }

  return (
    <View
      className="rounded-control border border-border-light bg-bg-card p-3"
      testID="comeback-summary-line"
    >
      <Text className="text-sm font-semibold text-text-primary">
        {phase === 'graduated'
          ? t('comeback.summary.graduated')
          : t('comeback.summary.week', { week, total: rampWeeks })}
      </Text>
    </View>
  );
}
