import { useCallback, useEffect, useState } from 'react';

import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';

/** Local hour (24h) after which the current day may be offered as a fasting day. */
const FASTING_DAY_TODAY_MIN_HOUR = 20;

type UseFastingDayParams = {
  enabled: boolean;
  selectedDate: Date;
  hasLoggedFoodOnSelectedDay: boolean;
};

type UseFastingDayResult = {
  confirmVisible: boolean;
  fastingLoading: boolean;
  isFastedDayView: boolean;
  showFastingMarkPrompt: boolean;
  openConfirm: () => void;
  closeConfirm: () => void;
  markFastedDay: () => Promise<void>;
  unmarkFastedDay: () => Promise<void>;
};

export function useFastingDay({
  enabled,
  selectedDate,
  hasLoggedFoodOnSelectedDay,
}: UseFastingDayParams): UseFastingDayResult {
  // The looked-up flag, tagged with the day it belongs to. Keying by day lets us derive a
  // "not yet known" state during render (see `isSelectedDayFasted`) without a synchronous
  // setState in the effect — so switching days never briefly flashes the previous day's flag.
  const [resolved, setResolved] = useState<{ dayKey: number; fasted: boolean } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [fastingLoading, setFastingLoading] = useState(false);

  const selectedDayKey = utcDayKeyFromLocalDate(selectedDate);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    FastedDayRepository.isFasted(selectedDate)
      .then((fasted) => {
        if (!cancelled) {
          setResolved({ dayKey: selectedDayKey, fasted });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setResolved({ dayKey: selectedDayKey, fasted: false });
        }
        handleError(error, 'food.loadFastedDay');
      });

    return () => {
      cancelled = true;
    };
    // Re-check when the day changes or its logs change (e.g. food added/removed).
  }, [enabled, selectedDate, selectedDayKey, hasLoggedFoodOnSelectedDay]);

  const markFastedDay = useCallback(async () => {
    setFastingLoading(true);
    try {
      await FastedDayRepository.markFasted(selectedDate);
      setResolved({ dayKey: utcDayKeyFromLocalDate(selectedDate), fasted: true });
    } catch (error) {
      handleError(error, 'food.markFastedDay');
    } finally {
      setFastingLoading(false);
      setConfirmVisible(false);
    }
  }, [selectedDate]);

  const unmarkFastedDay = useCallback(async () => {
    setFastingLoading(true);
    try {
      await FastedDayRepository.unmarkFasted(selectedDate);
      setResolved({ dayKey: utcDayKeyFromLocalDate(selectedDate), fasted: false });
    } catch (error) {
      handleError(error, 'food.unmarkFastedDay');
    } finally {
      setFastingLoading(false);
    }
  }, [selectedDate]);

  // `null` until the lookup for *this* day resolves, so neither affordance renders while the
  // feature is off or the flag is still loading.
  const isSelectedDayFasted =
    enabled && resolved?.dayKey === selectedDayKey ? resolved.fasted : null;

  const now = new Date();
  const todayKey = utcDayKeyFromLocalDate(now);
  const isPastDay = selectedDayKey < todayKey;
  const isToday = selectedDayKey === todayKey;
  const isTodayEvening = isToday && now.getHours() >= FASTING_DAY_TODAY_MIN_HOUR;
  const canOfferFastingMark = isPastDay || isTodayEvening;

  return {
    confirmVisible,
    fastingLoading,
    isFastedDayView: enabled && !hasLoggedFoodOnSelectedDay && isSelectedDayFasted === true,
    showFastingMarkPrompt:
      enabled &&
      !hasLoggedFoodOnSelectedDay &&
      isSelectedDayFasted === false &&
      canOfferFastingMark,
    openConfirm: () => setConfirmVisible(true),
    closeConfirm: () => setConfirmVisible(false),
    markFastedDay,
    unmarkFastedDay,
  };
}
