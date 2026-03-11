import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ProgressInsights } from '../../database/services/ProgressService';
import { GenericCard } from '../cards/GenericCard';

interface ProgressInsightsSectionProps {
  insights: ProgressInsights;
}

export function ProgressInsightsSection({ insights }: ProgressInsightsSectionProps) {
  const { t } = useTranslation();

  const renderStat = (label: string, value: string, colorClass: string) => (
    <View className="flex-1 items-center justify-center p-2">
      <Text className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</Text>
      <Text className={`text-lg font-bold ${colorClass}`}>{value}</Text>
    </View>
  );

  return (
    <View className="mb-4">
      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="mb-2 ml-2 mt-2 text-sm font-bold text-text-primary">
            {t('progress.metabolicSummary')}
          </Text>
          <View className="flex-row flex-wrap">
            <View className="flex-1 items-center justify-center border-r border-border-light p-2">
              <Text className="text-center text-[10px] uppercase tracking-wider text-text-tertiary">
                {t('progress.empiricalTdee')}
              </Text>
              <Text className="text-lg font-bold text-accent-primary">
                {Math.round(insights.empiricalTdee)}
              </Text>
              <Text className="text-center text-[8px] uppercase text-text-tertiary">
                {t('progress.basedOnRecentActivity')}
              </Text>
            </View>
            <View className="flex-1 items-center justify-center p-2">
              <Text className="text-center text-[10px] uppercase tracking-wider text-text-tertiary">
                {t('progress.statisticalTdee')}
              </Text>
              <Text className="text-lg font-bold text-accent-secondary">
                {Math.round(insights.statisticalTdee)}
              </Text>
              <Text className="text-center text-[8px] uppercase text-text-tertiary">
                {t('progress.basedOnActivityLevel')}
              </Text>
            </View>
          </View>
        </View>
      </GenericCard>

      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="flex-row flex-wrap p-2">
          {renderStat(
            t('progress.weeklyWeightChange'),
            `${insights.weightChangeWeekly > 0 ? '+' : ''}${insights.weightChangeWeekly.toFixed(2)}`,
            insights.weightChangeWeekly > 0 ? 'text-red-500' : 'text-green-500'
          )}
          {renderStat(
            t('progress.fatMassChange'),
            `${insights.fatMassChange > 0 ? '+' : ''}${insights.fatMassChange.toFixed(2)}`,
            insights.fatMassChange > 0 ? 'text-red-500' : 'text-green-500'
          )}
          {renderStat(
            t('progress.leanMassChange'),
            `${insights.leanBodyMassChange > 0 ? '+' : ''}${insights.leanBodyMassChange.toFixed(2)}`,
            insights.leanBodyMassChange > 0 ? 'text-green-500' : 'text-red-500'
          )}
        </View>
      </GenericCard>

      <GenericCard variant="card" containerStyle={{ marginBottom: 16 }}>
        <View className="p-2">
          <Text className="mb-2 ml-2 mt-2 text-sm font-bold text-text-primary">
            {t('progress.bodyFatGoalWeights')}
          </Text>
          <View className="flex-row flex-wrap">
            {[5, 10, 15, 20].map((bf) => (
              <View key={bf} className="flex-1 items-center justify-center p-2">
                <Text className="text-[10px] text-text-tertiary">{bf}%</Text>
                <Text className="text-lg font-bold text-text-primary">
                  {(insights.targetWeights as any)[`bf${bf}`].toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </GenericCard>
    </View>
  );
}
