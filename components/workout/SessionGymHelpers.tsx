import { Clock, Dumbbell, Flame } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type SessionGymHelpersProps = {
  /** The load as shown on the weight card, when the plate calculator applies to this lift. */
  plateCalculatorLoad: { weight: string; unit: string } | null;
  onOpenPlateCalculator: () => void;
  /** Seconds of rest waiting for a tap, when the rest timer does not start on its own. */
  pendingRestSeconds: number | null;
  onStartRest: () => void;
  canAddWarmups: boolean;
  onAddWarmups: () => void;
  canRemoveWarmups: boolean;
  onRemoveWarmups: () => void;
  isSaving: boolean;
};

/**
 * The row of small actions under the set's numbers: the plate calculator for a bar-loaded lift,
 * the "Start rest" pill when auto-start is off, and adding or removing warm-ups.
 */
export function SessionGymHelpers({
  plateCalculatorLoad,
  onOpenPlateCalculator,
  pendingRestSeconds,
  onStartRest,
  canAddWarmups,
  onAddWarmups,
  canRemoveWarmups,
  onRemoveWarmups,
  isSaving,
}: SessionGymHelpersProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const chip = (
    key: string,
    onPress: () => void,
    content: ReactNode,
    options: { primary?: boolean; disabled?: boolean } = {}
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      disabled={options.disabled}
      className="flex-row items-center gap-2 rounded-full px-4 py-2"
      style={{
        backgroundColor: options.primary
          ? theme.colors.accent.primary
          : theme.colors.background.ink5,
      }}
    >
      {content}
    </Pressable>
  );

  return (
    <View className="mt-3 flex-row flex-wrap justify-center gap-2 px-6">
      {plateCalculatorLoad
        ? chip(
            'plates',
            onOpenPlateCalculator,
            <>
              <Dumbbell size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="text-sm font-medium text-text-primary">
                {t('workoutSettings.plateCalculator.open', plateCalculatorLoad)}
              </Text>
            </>
          )
        : null}
      {pendingRestSeconds !== null
        ? chip(
            'rest',
            onStartRest,
            <>
              <Clock size={theme.iconSize.sm} color={theme.colors.text.onAccent} />
              <Text className="text-sm font-bold text-text-on-accent">
                {t('workoutSession.startRest', { seconds: pendingRestSeconds })}
              </Text>
            </>,
            { primary: true }
          )
        : null}
      {canAddWarmups
        ? chip(
            'add-warmups',
            onAddWarmups,
            <>
              <Flame size={theme.iconSize.sm} color={theme.colors.accent.primary} />
              <Text className="text-sm font-medium text-text-primary">
                {t('workoutSession.warmup.add')}
              </Text>
            </>,
            { disabled: isSaving }
          )
        : null}
      {canRemoveWarmups
        ? chip(
            'remove-warmups',
            onRemoveWarmups,
            <Text className="text-sm font-medium text-text-secondary">
              {t('workoutSession.warmup.remove')}
            </Text>,
            { disabled: isSaving }
          )
        : null}
    </View>
  );
}
