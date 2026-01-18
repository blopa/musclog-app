import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../theme';

type GoalType = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

const goalTypeStyles: Record<GoalType, { label: string }> = {
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

interface GoalTypeBadgeProps {
  type: GoalType;
  variant?: 'default' | 'compact';
  showBorder?: boolean;
}

export function GoalTypeBadge({
  type,
  variant = 'default',
  showBorder = true,
}: GoalTypeBadgeProps) {
  const styles = goalTypeStyles[type];
  const textSize = variant === 'compact' ? 'text-[9px]' : 'text-[10px]';
  const paddingY = variant === 'compact' ? 'py-0.5' : 'py-1';

  const backgroundColor =
    type === 'cutting'
      ? theme.colors.status.amber10
      : type === 'maintenance'
        ? theme.colors.status.indigo10
        : type === 'bulking'
          ? theme.colors.status.indigo10
          : theme.colors.accent.primary10;

  const borderColor =
    type === 'cutting'
      ? theme.colors.status.amber10
      : type === 'maintenance'
        ? theme.colors.status.indigo20
        : type === 'bulking'
          ? theme.colors.status.indigo20
          : theme.colors.accent.primary20;

  const textColor =
    type === 'cutting'
      ? theme.colors.status.amber
      : type === 'maintenance'
        ? theme.colors.status.indigoLight
        : type === 'bulking'
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
