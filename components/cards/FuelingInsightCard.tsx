import { Flame, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { theme } from '../../theme';

type FuelingStatus = 'low' | 'optimal' | 'loading';

interface FuelingInsightCardProps {
  status: FuelingStatus;
  totalCarbs: number;
  windowHours: number;
  onDismiss: () => void;
}

export function FuelingInsightCard({
  status,
  totalCarbs,
  windowHours,
  onDismiss,
}: FuelingInsightCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const accentColor =
    status === 'low' ? theme.colors.status.warning : theme.colors.status.success;

  return (
    <Pressable
      onPress={() => setIsExpanded(!isExpanded)}
      className="rounded-2xl border-2 p-4"
      style={{
        borderColor: `${accentColor}66`,
        backgroundColor: `${theme.colors.background.card}95`,
      }}
    >
      <View className="flex-row items-start gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: accentColor }}
        >
          <Flame
            size={20}
            color={status === 'low' ? theme.colors.text.white : theme.colors.text.black}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-sm font-bold uppercase tracking-wider"
              style={{ color: accentColor }}
            >
              {t('workoutSession.fuelingInsight')}
            </Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <X size={16} color={accentColor} />
            </Pressable>
          </View>
          <Text
            className="mt-0.5 font-medium text-text-primary"
            numberOfLines={isExpanded ? undefined : 1}
            ellipsizeMode="tail"
          >
            {status === 'low'
              ? t('workoutSession.lowFuelingMessage', {
                  carbs: Math.round(totalCarbs),
                  hours: Math.round(windowHours),
                })
              : t('workoutSession.fullyFueledMessage', {
                  carbs: Math.round(totalCarbs),
                  hours: Math.round(windowHours),
                })}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
