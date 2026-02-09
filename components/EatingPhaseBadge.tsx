import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

type EatingPhase = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

interface EatingPhaseBadgeProps {
  phase: EatingPhase;
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

  const backgroundColor =
    phase === 'cutting'
      ? theme.colors.status.amber10
      : phase === 'maintenance'
        ? theme.colors.status.indigo10
        : phase === 'bulking'
          ? theme.colors.status.indigo10
          : theme.colors.accent.primary10;

  const borderColor =
    phase === 'cutting'
      ? theme.colors.status.amber10
      : phase === 'maintenance'
        ? theme.colors.status.indigo20
        : phase === 'bulking'
          ? theme.colors.status.indigo20
          : theme.colors.accent.primary20;

  const textColor =
    phase === 'cutting'
      ? theme.colors.status.amber
      : phase === 'maintenance'
        ? theme.colors.status.indigoLight
        : phase === 'bulking'
          ? theme.colors.status.indigoLight
          : theme.colors.accent.primary;

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
