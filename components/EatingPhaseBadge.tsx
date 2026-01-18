import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../theme';

type EatingPhase = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

const eatingPhaseStyles: Record<EatingPhase, { label: string }> = {
  cutting: {
    label: 'CUTTING',
  },
  maintenance: {
    label: 'MAINTENANCE',
  },
  bulking: {
    label: 'BULKING',
  },
  'lean-bulk': {
    label: 'LEAN BULK',
  },
};

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
  const styles = eatingPhaseStyles[phase];
  const textSize = variant === 'compact' ? 'text-[9px]' : 'text-[10px]';
  const paddingY = variant === 'compact' ? 'py-0.5' : 'py-1';

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
      className={`rounded px-2 ${paddingY} ${showBorder ? 'border' : ''} uppercase`}
      style={{
        backgroundColor,
        ...(showBorder && { borderColor }),
      }}>
      <Text className={`${textSize} font-bold`} style={{ color: textColor }}>
        {styles.label}
      </Text>
    </View>
  );
}
