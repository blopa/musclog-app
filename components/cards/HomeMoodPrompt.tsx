import { CheckCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

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

  if (isLoading || !showDailyMoodPrompt || hasMoodToday) {
    return null;
  }

  const handleSave = async () => {
    if (mood === null) return;

    setIsSaving(true);
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

  return (
    <View className="mb-6 px-4">
      <MoodSelectorCard
        value={mood ?? 2}
        onChange={(val) => setMood(val)}
      />
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
    </View>
  );
}
