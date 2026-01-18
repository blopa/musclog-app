import React from 'react';
import { View, Text } from 'react-native';
import { History } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';
import { EatingPhaseBadge } from '../EatingPhaseBadge';

type EatingPhase = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

interface GoalHistoryItem {
  id: number;
  dateRange: string;
  phase: EatingPhase;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weight: number;
  bodyFat: number;
}

interface GoalHistoryCardProps {
  goal: GoalHistoryItem;
  isLast?: boolean;
}

export function GoalHistoryCard({ goal, isLast = false }: GoalHistoryCardProps) {
  const { t } = useTranslation();
  
  return (
    <View className="relative mb-6 flex-row gap-4">
      {/* Timeline line */}
      {!isLast && (
        <View
          className="absolute left-[19px] top-10"
          style={{
            bottom: -24,
            width: 0.5,
            backgroundColor: theme.colors.border.emerald,
          }}
        />
      )}

      {/* Timeline dot */}
      <View
        className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-bg-card"
        style={{ borderColor: theme.colors.border.emerald }}>
        <History size={theme.iconSize.lg} color={theme.colors.text.secondary} />
      </View>

      {/* Content */}
      <View className="flex-1 pb-2">
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-text-secondary">{goal.dateRange}</Text>
          <EatingPhaseBadge phase={goal.phase} variant="compact" showBorder={true} />
        </View>

        <GenericCard variant="card">
          <View className="p-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-col">
                <Text className="text-lg font-bold text-text-primary">
                  {goal.calories.toLocaleString()}{' '}
                  <Text className="text-[10px] font-normal text-text-secondary">{t('goalHistoryCard.kcal')}</Text>
                </Text>
                <Text className="text-[10px] text-text-secondary">
                  {t('goalHistoryCard.proteinPrefix')}:{goal.protein}{t('goalHistoryCard.g')} • {t('goalHistoryCard.carbsPrefix')}:{goal.carbs}{t('goalHistoryCard.g')} • {t('goalHistoryCard.fatPrefix')}:{goal.fat}{t('goalHistoryCard.g')}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-text-secondary">{goal.weight} {t('goalHistoryCard.kg')}</Text>
                <Text className="text-[10px] text-text-secondary">{goal.bodyFat}% {t('goalHistoryCard.bf')}</Text>
              </View>
            </View>
          </View>
        </GenericCard>
      </View>
    </View>
  );
}
