import { CheckCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button } from '@/components/theme/Button';
import { UserMetricService } from '@/database/services';
import { useSettings } from '@/hooks/useSettings';
import { useTodayMood } from '@/hooks/useTodayMood';
import { localDayStartMs } from '@/utils/calendarDate';
import { showSnackbar } from '@/utils/snackbarService';

import { MoodSelectorCard } from './MoodSelectorCard';

type HomeMoodPromptProps = {
  onVisibilityChange?: (isVisible: boolean) => void;
};

export function HomeMoodPrompt({ onVisibilityChange }: HomeMoodPromptProps) {
  const { t } = useTranslation();
  const { showDailyMoodPrompt } = useSettings();
  const { hasMoodToday, isLoading } = useTodayMood();
  const [mood, setMood] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isActuallyVisible, setIsActuallyVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const opacity = useSharedValue(0);
  const height = useSharedValue(0);
  const marginBottom = useSharedValue(0);

  const MAX_HEIGHT = 450; // Increased to ensure no clipping during animation

  useEffect(() => {
    const shouldBeVisible = !isLoading && showDailyMoodPrompt && !hasMoodToday && !isDismissed;

    if (shouldBeVisible) {
      setIsActuallyVisible(true);
      opacity.value = withTiming(1, { duration: 400 });
      height.value = withSpring(MAX_HEIGHT, { damping: 20, stiffness: 90 });
      marginBottom.value = withTiming(24, { duration: 400 }); // 24 is mb-6
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      height.value = withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsActuallyVisible, false);
        }
      });
      marginBottom.value = withTiming(0, { duration: 500 });
    }
  }, [isLoading, showDailyMoodPrompt, hasMoodToday, isDismissed, opacity, height, marginBottom]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    maxHeight: height.value,
    marginBottom: marginBottom.value,
    overflow: 'hidden',
  }));

  useEffect(() => {
    onVisibilityChange?.(isActuallyVisible);
  }, [isActuallyVisible, onVisibilityChange]);

  if (!isActuallyVisible && (isLoading || !showDailyMoodPrompt || hasMoodToday)) {
    return null;
  }

  const performSave = async () => {
    if (mood === null) {
      return;
    }

    try {
      const dateTimestamp = localDayStartMs(new Date());
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await UserMetricService.createMetric({
        type: 'mood',
        value: mood,
        date: dateTimestamp,
        timezone,
      });

      showSnackbar('success', t('bodyMetrics.addEntry.saveSuccess'));
    } catch (error) {
      console.error('Error saving mood from home screen:', error);
      showSnackbar('error', t('bodyMetrics.addEntry.errorSaving'));
      setIsSaving(false);
      setIsDismissed(false);
    }
    // We don't set isSaving(false) on success because the component is unmounting anyway
  };

  const handleSave = () => {
    if (mood === null) {
      return;
    }
    setIsSaving(true);
    setIsDismissed(true); // Trigger animation immediately
    // Use setTimeout hack to ensure loading state is rendered before blocking DB write
    setTimeout(performSave, 50);
  };

  return (
    <Animated.View style={animatedStyle}>
      <MoodSelectorCard value={mood ?? 2} onChange={(val) => setMood(val)} />
      {mood !== null ? (
        <View className="mt-3">
          <Button
            label={t('bodyMetrics.addEntry.saveEntry')}
            onPress={handleSave}
            icon={CheckCircle}
            iconPosition="right"
            variant="gradientCta"
            size="sm"
            width="full"
            loading={isSaving}
            disabled={isSaving}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}
