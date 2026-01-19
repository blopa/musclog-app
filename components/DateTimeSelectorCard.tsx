import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Calendar, Clock, LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { GenericCard } from './cards/GenericCard';

type DateTimeSelectorCardProps = {
  type: 'date' | 'time';
  value: Date;
  onEdit: () => void;
  label: string;
  formattedValue: string;
};

export function DateTimeSelectorCard({
  type,
  value,
  onEdit,
  label,
  formattedValue,
}: DateTimeSelectorCardProps) {
  const { t } = useTranslation();
  const Icon: LucideIcon = type === 'date' ? Calendar : Clock;
  const iconBg =
    type === 'date' ? theme.colors.status.indigo10 : theme.colors.accent.primary10;
  const iconColor = type === 'date' ? theme.colors.status.indigo : theme.colors.accent.primary;

  return (
    <GenericCard variant="card" size="default">
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg }}>
            <Icon size={theme.iconSize.xl} color={iconColor} />
          </View>
          <View>
            <Text className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
              {label}
            </Text>
            <Text className="text-sm font-semibold text-text-primary">{formattedValue}</Text>
          </View>
        </View>
        <Pressable onPress={onEdit}>
          <Text className="text-sm font-bold text-accent-primary">{t('common.edit')}</Text>
        </Pressable>
      </View>
    </GenericCard>
  );
}
