import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { CYCLE_TRACKING_CHOICES, type CycleTrackingMode } from '@/utils/cycle/trackingMode';
import { handleError } from '@/utils/handleError';

export function CycleTrackingModeSettings({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { cycle, pausedCycle, activeContext, isLoading, setTrackingMode } = useMenstrualCycle();
  const [busy, setBusy] = useState(false);
  let selected: CycleTrackingMode = 'skip';
  if (cycle) {
    selected = activeContext?.lifeStage === 'no_bleeding' ? 'symptoms' : 'bleeding';
  }

  const select = async (mode: CycleTrackingMode) => {
    if (busy || isLoading || mode === selected) {
      return;
    }

    if (!cycle && !pausedCycle) {
      onClose();
      router.navigate({
        pathname: '/app/onboarding/cycle-setup',
        params: {
          symptomOnly: String(mode === 'symptoms'),
          nextRoute: encodeURIComponent('/app/settings'),
        },
      } as never);
      return;
    }

    setBusy(true);
    try {
      await setTrackingMode(mode);
    } catch (error) {
      await handleError(error, 'CycleTrackingModeSettings.select', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-text-primary">{t('cycle.personalize.question')}</Text>
      {CYCLE_TRACKING_CHOICES.map(({ value, labelKey, hintKey }) => (
        <View key={value} className="gap-2">
          <Chip
            label={t(labelKey)}
            selected={selected === value}
            disabled={busy || isLoading}
            onPress={() => void select(value)}
          />
          <Text className="text-xs text-text-secondary">{t(hintKey)}</Text>
        </View>
      ))}
      {busy ? <ActivityIndicator color={theme.colors.accent.primary} /> : null}
      {pausedCycle ? (
        <Text className="text-xs text-text-secondary">{t('cycle.settings.pauseHint')}</Text>
      ) : null}
    </View>
  );
}
