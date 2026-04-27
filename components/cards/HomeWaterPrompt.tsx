import { CheckCircle2, CircleOff, Droplets } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/theme/Button';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localDayStartMs } from '@/utils/calendarDate';
import { getProposedDailyWaterIntake } from '@/utils/nutritionCalculator';
import { showSnackbar } from '@/utils/snackbarService';

import { GenericCard } from './GenericCard';

type HomeWaterPromptProps = {
  tdee: number;
  blockedByHigherPriorityPrompt?: boolean;
  onVisibilityChange?: (isVisible: boolean) => void;
};

export function HomeWaterPrompt({
  tdee,
  blockedByHigherPriorityPrompt = false,
  onVisibilityChange,
}: HomeWaterPromptProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { formatRoundedDecimal } = useFormatAppNumber();
  const { showDailyWaterPrompt } = useSettings();

  const [now, setNow] = useState(() => new Date());
  const [isLoadingAnswerState, setIsLoadingAnswerState] = useState(true);
  const [lastAnsweredDayMs, setLastAnsweredDayMs] = useState<number | null>(null);
  const [isActuallyVisible, setIsActuallyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const opacity = useSharedValue(0);
  const height = useSharedValue(0);
  const marginBottom = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;

    SettingsService.getLastHomeWaterPromptAnsweredDay()
      .then((value) => {
        if (!cancelled) {
          setLastAnsweredDayMs(value);
          setIsLoadingAnswerState(false);
        }
      })
      .catch((error) => {
        console.error('Error loading home water prompt state:', error);
        if (!cancelled) {
          setIsLoadingAnswerState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncNow = () => setNow(new Date());

    syncNow();
    const intervalId = setInterval(syncNow, 60_000);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncNow();
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, []);

  const todayDayStartMs = useMemo(() => localDayStartMs(now), [now]);
  const isAfterPromptTime = now.getHours() >= 20;
  const proposedWaterIntakeLiters = useMemo(() => getProposedDailyWaterIntake(tdee), [tdee]);
  const formattedWaterIntake = useMemo(
    () => formatRoundedDecimal(proposedWaterIntakeLiters, 1),
    [formatRoundedDecimal, proposedWaterIntakeLiters]
  );
  const hasAnsweredToday = lastAnsweredDayMs === todayDayStartMs;

  useEffect(() => {
    const shouldBeVisible =
      !isLoadingAnswerState &&
      showDailyWaterPrompt &&
      !blockedByHigherPriorityPrompt &&
      !hasAnsweredToday &&
      !isSaving &&
      isAfterPromptTime &&
      proposedWaterIntakeLiters > 0;

    if (shouldBeVisible) {
      setIsActuallyVisible(true);
      opacity.value = withTiming(1, { duration: 400 });
      height.value = withSpring(220, { damping: 20, stiffness: 90 });
      marginBottom.value = withTiming(24, { duration: 400 });
    } else {
      opacity.value = withTiming(0, { duration: 250 });
      height.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsActuallyVisible, false);
        }
      });
      marginBottom.value = withTiming(0, { duration: 400 });
    }
  }, [
    blockedByHigherPriorityPrompt,
    hasAnsweredToday,
    height,
    isAfterPromptTime,
    isLoadingAnswerState,
    isSaving,
    marginBottom,
    opacity,
    proposedWaterIntakeLiters,
    showDailyWaterPrompt,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    maxHeight: height.value,
    marginBottom: marginBottom.value,
    overflow: 'hidden',
  }));

  useEffect(() => {
    onVisibilityChange?.(isActuallyVisible);
  }, [isActuallyVisible, onVisibilityChange]);

  if (
    !isActuallyVisible &&
    (!showDailyWaterPrompt ||
      isLoadingAnswerState ||
      blockedByHigherPriorityPrompt ||
      hasAnsweredToday ||
      !isAfterPromptTime ||
      proposedWaterIntakeLiters <= 0)
  ) {
    return null;
  }

  const persistAnswer = async (
    value: 0 | 1,
    dayStartMs: number,
    previousAnsweredDayMs: number | null
  ) => {
    try {
      await Promise.all([
        UserMetricService.createMetric({
          type: 'water',
          value,
          date: dayStartMs,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        SettingsService.setLastHomeWaterPromptAnsweredDay(dayStartMs),
      ]);
    } catch (error) {
      console.error('Error saving home water prompt answer:', error);
      setLastAnsweredDayMs(previousAnsweredDayMs);
      showSnackbar('error', t('bodyMetrics.addEntry.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnswer = (value: 0 | 1) => {
    if (isSaving) {
      return;
    }

    const previousAnsweredDayMs = lastAnsweredDayMs;
    setIsSaving(true);
    setLastAnsweredDayMs(todayDayStartMs);

    setTimeout(() => {
      void persistAnswer(value, todayDayStartMs, previousAnsweredDayMs);
    }, 50);
  };

  return (
    <Animated.View style={animatedStyle}>
      <GenericCard variant="card" size="default">
        <View className="p-4">
          <View className="mb-4 flex-row items-start gap-3">
            <Droplets
              size={theme.iconSize.xl}
              color={theme.colors.status.info}
              style={{ flexShrink: 0 }}
            />
            <Text className="text-text-secondary flex-1 text-xs font-bold tracking-wider uppercase">
              {t('bodyMetrics.addEntry.waterQuestionWithAmount', {
                amount: formattedWaterIntake,
              })}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Button
              label={t('bodyMetrics.addEntry.no')}
              onPress={() => handleAnswer(0)}
              icon={CircleOff}
              variant="outline"
              size="sm"
              width="flex-1"
              loading={isSaving}
              disabled={isSaving}
            />
            <Button
              label={t('bodyMetrics.addEntry.yes')}
              onPress={() => handleAnswer(1)}
              icon={CheckCircle2}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              loading={isSaving}
              disabled={isSaving}
            />
          </View>
        </View>
      </GenericCard>
    </Animated.View>
  );
}
