import { CheckCircle2, CircleOff, Pill } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/theme/Button';
import { UserMetricService } from '@/database/services';
import { usePendingSupplements } from '@/hooks/usePendingSupplements';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { useTodayMood } from '@/hooks/useTodayMood';
import { localDayStartMs } from '@/utils/calendarDate';
import { showSnackbar } from '@/utils/snackbarService';

import { GenericCard } from './GenericCard';

type HomeSupplementPromptProps = {
  blockedByHigherPriorityPrompt?: boolean;
};

export function HomeSupplementPrompt({
  blockedByHigherPriorityPrompt = false,
}: HomeSupplementPromptProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showDailyMoodPrompt, showDailySupplementPrompt } = useSettings();
  const { hasMoodToday, isLoading: isMoodLoading } = useTodayMood();
  const { pendingSupplements, isLoading: isSupplementsLoading } = usePendingSupplements();

  const [isActuallyVisible, setIsActuallyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resolvingSupplementId, setResolvingSupplementId] = useState<string | null>(null);

  const opacity = useSharedValue(0);
  const height = useSharedValue(0);
  const marginBottom = useSharedValue(0);

  const currentSupplement = useMemo(() => pendingSupplements[0] ?? null, [pendingSupplements]);

  useEffect(() => {
    if (
      resolvingSupplementId &&
      !pendingSupplements.some((supplement) => supplement.id === resolvingSupplementId)
    ) {
      setResolvingSupplementId(null);
      setIsSaving(false);
    }
  }, [pendingSupplements, resolvingSupplementId]);

  const moodPromptStillHasPriority = showDailyMoodPrompt && (isMoodLoading || !hasMoodToday);
  const isLoading = isMoodLoading || isSupplementsLoading;

  useEffect(() => {
    const shouldBeVisible =
      !isLoading &&
      showDailySupplementPrompt &&
      !moodPromptStillHasPriority &&
      !blockedByHigherPriorityPrompt &&
      currentSupplement != null &&
      resolvingSupplementId == null;

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
    currentSupplement,
    height,
    isLoading,
    marginBottom,
    moodPromptStillHasPriority,
    opacity,
    resolvingSupplementId,
    showDailySupplementPrompt,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    maxHeight: height.value,
    marginBottom: marginBottom.value,
    overflow: 'hidden',
  }));

  if (
    !isActuallyVisible &&
    (!showDailySupplementPrompt || isLoading || currentSupplement == null)
  ) {
    return null;
  }

  const saveResponse = async (value: 0 | 1) => {
    if (!currentSupplement) {
      return;
    }

    try {
      await UserMetricService.createMetric({
        type: 'supplement',
        value,
        note: currentSupplement.name,
        supplementId: currentSupplement.id,
        date: localDayStartMs(new Date()),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      showSnackbar('success', t('bodyMetrics.addEntry.saveSuccess'));
    } catch (error) {
      console.error('Error saving supplement from home screen:', error);
      showSnackbar('error', t('bodyMetrics.addEntry.errorSaving'));
      setResolvingSupplementId(null);
      setIsSaving(false);
    }
  };

  const handleAnswer = (value: 0 | 1) => {
    if (!currentSupplement || isSaving) {
      return;
    }

    setIsSaving(true);
    setResolvingSupplementId(currentSupplement.id);
    setTimeout(() => {
      void saveResponse(value);
    }, 50);
  };

  return (
    <Animated.View style={animatedStyle}>
      <GenericCard variant="card" size="default">
        <View className="p-4">
          <View className="mb-4 flex-row items-start gap-3">
            <Pill
              size={theme.iconSize.xl}
              color={theme.colors.status.emerald}
              style={{ flexShrink: 0 }}
            />
            <Text className="text-text-secondary flex-1 text-xs font-bold tracking-wider uppercase">
              {t('bodyMetrics.addEntry.supplementQuestionWithName', {
                name: currentSupplement?.name ?? '',
              })}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Button
              label={t('bodyMetrics.addEntry.notTaken')}
              onPress={() => handleAnswer(0)}
              icon={CircleOff}
              variant="outline"
              size="sm"
              width="flex-1"
              loading={isSaving}
              disabled={isSaving}
            />
            <Button
              label={t('bodyMetrics.addEntry.taken')}
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
