import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { type EatingPhaseUI } from '@/types/EatingPhaseUI';

function getPhaseColors(phase: EatingPhaseUI, theme: ReturnType<typeof useTheme>) {
  switch (phase) {
    case 'cutting':
      return {
        backgroundColor: theme.colors.status.amber10,
        borderColor: theme.colors.status.amber10,
        textColor: theme.colors.status.amber,
      };
    case 'maintenance':
      return {
        backgroundColor: theme.colors.status.indigo10,
        borderColor: theme.colors.status.indigo20,
        textColor: theme.colors.status.indigoLight,
      };
    case 'bulking':
      return {
        backgroundColor: theme.colors.status.indigo10,
        borderColor: theme.colors.status.indigo20,
        textColor: theme.colors.status.indigoLight,
      };
    default:
      return {
        backgroundColor: theme.colors.accent.primary10,
        borderColor: theme.colors.accent.primary20,
        textColor: theme.colors.accent.primary,
      };
  }
}

interface EatingPhaseBadgeProps {
  phase: EatingPhaseUI;
  variant?: 'default' | 'compact';
  showBorder?: boolean;
}

export function EatingPhaseBadge({
  phase,
  variant = 'default',
  showBorder = true,
}: EatingPhaseBadgeProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const fontSize =
    variant === 'compact' ? theme.typography.fontSize.xxs : theme.typography.fontSize.xs;
  const paddingY = variant === 'compact' ? theme.spacing.padding.xsHalf : theme.spacing.padding.xs;

  const label = t(`eatingPhaseBadge.${phase}`);

  const phaseColors = getPhaseColors(phase, theme);
  const { backgroundColor, borderColor, textColor } = phaseColors;

  return (
    <View
      className={`rounded px-2 ${showBorder ? 'border' : ''} uppercase`}
      style={{
        backgroundColor,
        paddingVertical: paddingY,
        ...(showBorder && { borderColor }),
      }}
    >
      <Text className="font-bold" style={{ color: textColor, fontSize }}>
        {label}
      </Text>
    </View>
  );
}
