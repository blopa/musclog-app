import { CheckCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { useTodayMood } from '../../hooks/useTodayMood';
import { UserMetricService } from '../../database/services';
import { MoodSelectorCard } from './MoodSelectorCard';
import { Button } from '../theme/Button';
import { showSnackbar } from '../../utils/snackbarService';

export function HomeMoodPrompt() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showDailyMoodPrompt } = useSettings();
  const { hasMoodToday, isLoading } = useTodayMood();
  const [mood, setMood] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isActuallyVisible, setIsActuallyVisible] = useState(false);

  const opacity = useSharedValue(0);
  const height = useSharedValue(0);

  const MAX_HEIGHT = 280; // Estimated height for MoodSelectorCard + Save button

  useEffect(() => {
    const shouldBeVisible = !isLoading && showDailyMoodPrompt && !hasMoodToday;

    if (shouldBeVisible) {
      setIsActuallyVisible(true);
      opacity.value = withTiming(1, { duration: 400 });
      height.value = withTiming(MAX_HEIGHT, { duration: 500 });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      height.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(setIsActuallyVisible)(false);
        }
      });
    }
  }, [isLoading, showDailyMoodPrompt, hasMoodToday, opacity, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    maxHeight: height.value,
    overflow: 'hidden',
  }));

  if (!isActuallyVisible && (isLoading || !showDailyMoodPrompt || hasMoodToday)) {
    return null;
  }

  const performSave = async () => {
    if (mood === null) return;

    try {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      const dateTimestamp = now.getTime();
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (mood === null) return;
    setIsSaving(true);
    // Use setTimeout hack to ensure loading state is rendered before blocking DB write
    setTimeout(performSave, 50);
  };

  return (
    <Animated.View className="mb-6 px-4" style={animatedStyle}>
      <MoodSelectorCard value={mood ?? 2} onChange={(val) => setMood(val)} />
      {mood !== null && (
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
      )}
    </Animated.View>
  );
}
