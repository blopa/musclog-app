import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckCircle, Pill, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { UserMetricService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useTodayMood } from '../../hooks/useTodayMood';
import { usePendingSupplements } from '../../hooks/usePendingSupplements';
import { useTheme } from '../../hooks/useTheme';
import { showSnackbar } from '../../utils/snackbarService';
import { Button } from '../theme/Button';
import { GenericCard } from './GenericCard';

export function HomeSupplementPrompt() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showDailyMoodPrompt } = useSettings();
  const { hasMoodToday, isLoading: isLoadingMood } = useTodayMood();
  const { pendingSupplements, isLoading: isLoadingSupplement } = usePendingSupplements();

  const [isSaving, setIsSaving] = useState(false);
  const [isActuallyVisible, setIsActuallyVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLocallyDismissed, setIsLocallyDismissed] = useState(false);
  const [moodDismissedToday, setMoodDismissedToday] = useState(false);

  const opacity = useSharedValue(0);
  const height = useSharedValue(0);
  const marginBottom = useSharedValue(0);

  const MAX_HEIGHT = 200;

  useEffect(() => {
    const checkDismissal = async () => {
      const today = new Date().toISOString().split('T')[0];

      const supDismissedDate = await AsyncStorage.getItem('supplement_prompt_dismissed_date');
      if (supDismissedDate === today) {
        setIsLocallyDismissed(true);
      }

      const moodDismissedDate = await AsyncStorage.getItem('mood_prompt_dismissed_date');
      if (moodDismissedDate === today) {
        setMoodDismissedToday(true);
      }
    };
    checkDismissal();

    const sub = DeviceEventEmitter.addListener('mood_dismissed', () => {
      setMoodDismissedToday(true);
    });
    return () => sub.remove();
  }, [isDismissed]);

  useEffect(() => {
    const isLoading = isLoadingMood || isLoadingSupplement;

    // Logic: show if:
    // 1. Supplements are pending
    // 2. Not dismissed today
    // 3. Mood prompt is either already done, not enabled, or dismissed
    const moodConditionMet = !showDailyMoodPrompt || hasMoodToday || moodDismissedToday;

    const shouldBeVisible =
      !isLoading &&
      pendingSupplements.length > 0 &&
      !isDismissed &&
      !isLocallyDismissed &&
      moodConditionMet;

    if (shouldBeVisible) {
      setIsActuallyVisible(true);
      opacity.value = withTiming(1, { duration: 400 });
      height.value = withSpring(MAX_HEIGHT, { damping: 20, stiffness: 90 });
      marginBottom.value = withTiming(24, { duration: 400 });
    } else {
      opacity.value = withTiming(0, { duration: 300 });
      height.value = withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsActuallyVisible, false);
        }
      });
      marginBottom.value = withTiming(0, { duration: 500 });
    }
  }, [
    isLoadingMood,
    isLoadingSupplement,
    pendingSupplements,
    isDismissed,
    isLocallyDismissed,
    showDailyMoodPrompt,
    hasMoodToday,
    moodDismissedToday,
    opacity,
    height,
    marginBottom,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    maxHeight: height.value,
    marginBottom: marginBottom.value,
    overflow: 'hidden',
  }));

  if (
    !isActuallyVisible &&
    (isLoadingMood || isLoadingSupplement || pendingSupplements.length === 0 || isLocallyDismissed)
  ) {
    return null;
  }

  const currentSupplement = pendingSupplements[0];

  const performSave = async () => {
    if (!currentSupplement) return;

    try {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      const dateTimestamp = now.getTime();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await UserMetricService.createMetric({
        type: 'supplement',
        value: 1,
        supplementId: currentSupplement.id,
        note: currentSupplement.name,
        date: dateTimestamp,
        timezone,
      });

      showSnackbar('success', t('bodyMetrics.addEntry.saveSuccess'));
    } catch (error) {
      console.error('Error saving supplement from home screen:', error);
      showSnackbar('error', t('bodyMetrics.addEntry.errorSaving'));
      setIsSaving(false);
      setIsDismissed(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setIsDismissed(true);
    setTimeout(performSave, 50);
  };

  const handleDismiss = async () => {
    setIsDismissed(true);
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem('supplement_prompt_dismissed_date', today);
  };

  return (
    <Animated.View style={animatedStyle}>
      <GenericCard variant="card" size="default">
        <View className="p-4">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Pill size={theme.iconSize.xl} color={theme.colors.status.emerald} />
              <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {currentSupplement
                  ? t('bodyMetrics.addEntry.supplementQuestionWithName', {
                      name: currentSupplement.name,
                    })
                  : t('bodyMetrics.addEntry.supplementQuestion')}
              </Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              className="rounded-full p-1"
              hitSlop={8}
              style={({ pressed }) => ({
                  backgroundColor: pressed ? theme.colors.background.white10 : 'transparent',
              })}
            >
              <X size={theme.iconSize.md} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>

          <Button
            label={t('bodyMetrics.addEntry.confirmTaken')}
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
      </GenericCard>
    </Animated.View>
  );
}
