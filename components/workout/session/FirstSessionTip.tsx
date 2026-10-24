import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lightbulb } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { WORKOUT_FIRST_TIP_SEEN } from '@/constants/misc';
import { WorkoutService } from '@/database/services/WorkoutService';
import { useTheme } from '@/hooks/useTheme';

/**
 * Teaches the three conventions people trip over in their first session (what the check means,
 * what the rest timer does, what warm-ups count for) once, in context, instead of in a tour.
 * Shown only to someone who has never finished a workout and never dismissed it.
 */
export function FirstSessionTip({ view }: { view: 'inline' | 'guided' }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if ((await AsyncStorage.getItem(WORKOUT_FIRST_TIP_SEEN)) === 'true') {
          return;
        }

        if ((await WorkoutService.getCompletedWorkoutCount()) > 0) {
          // An existing lifter never needs it; remember that so the count is not re-read.
          await AsyncStorage.setItem(WORKOUT_FIRST_TIP_SEEN, 'true');
          return;
        }

        if (!cancelled) {
          setVisible(true);
        }
      } catch {
        // A tip is never worth an error.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(WORKOUT_FIRST_TIP_SEEN, 'true').catch(() => undefined);
  };

  return (
    <View
      className="mb-3 gap-2 p-4"
      style={{
        backgroundColor: theme.colors.background.cardElevated,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border.accent,
      }}
    >
      <View className="flex-row items-center gap-2">
        <Lightbulb size={16} color={theme.colors.accent.primary} />
        <Text
          className="font-semibold"
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.sm }}
        >
          {t('workoutSession.firstTip.title')}
        </Text>
      </View>
      <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
        {t(view === 'inline' ? 'workoutSession.firstTip.inline' : 'workoutSession.firstTip.guided')}
      </Text>
      <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
        {t('workoutSession.firstTip.common')}
      </Text>
      <View className="items-end">
        <TextButton label={t('workoutSession.firstTip.dismiss')} onPress={dismiss} tone="accent" />
      </View>
    </View>
  );
}
