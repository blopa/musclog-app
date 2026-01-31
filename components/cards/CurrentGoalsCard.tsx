import { Activity, Calculator, Calendar, Percent, Scale } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { theme } from '../../theme';
import { EatingPhaseBadge } from '../EatingPhaseBadge';
import { GenericCard } from './GenericCard';

type EatingPhase = 'cutting' | 'maintenance' | 'bulking' | 'lean-bulk';

interface CurrentGoal {
  phase: EatingPhase;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetWeight?: number;
  bodyFat?: number;
  ffmi?: number;
  bmi?: number;
  goalDate?: string;
}

interface CurrentGoalsCardProps {
  goal: CurrentGoal;
}

export function CurrentGoalsCard({ goal }: CurrentGoalsCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="card">
      <View className="relative p-5">
        {/* Eating Phase Badge */}
        <View className="absolute right-0 top-0 p-4">
          <EatingPhaseBadge phase={goal.phase} variant="default" showBorder={false} />
        </View>

        {/* Daily Target */}
        <View className="mb-6">
          <Text
            className="mb-1 font-medium uppercase tracking-wider text-text-secondary"
            style={{ fontSize: theme.typography.fontSize.xs }}
          >
            {t('currentGoalsCard.dailyTarget')}
          </Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="text-4xl font-extrabold tracking-tighter text-text-primary">
              {goal.calories.toLocaleString()}
            </Text>
            <Text className="text-sm font-bold uppercase text-accent-primary">
              {t('currentGoalsCard.kcal')}
            </Text>
          </View>
        </View>

        {/* Macros Grid */}
        <View className="border-border flex-row gap-4 border-t pt-4">
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {t('currentGoalsCard.protein')}
            </Text>
            <Text className="font-bold text-text-primary">
              {goal.protein}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {t('currentGoalsCard.carbs')}
            </Text>
            <Text className="font-bold text-text-primary">
              {goal.carbs}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className="font-bold uppercase text-text-secondary"
              style={{ fontSize: theme.typography.fontSize.xxs }}
            >
              {t('currentGoalsCard.fats')}
            </Text>
            <Text className="font-bold text-text-primary">
              {goal.fat}
              <Text
                className="ml-0.5 text-text-secondary"
                style={{ fontSize: theme.typography.fontSize.xs }}
              >
                {t('currentGoalsCard.g')}
              </Text>
            </Text>
          </View>
        </View>

        {/* Goal Date */}
        {goal.goalDate ? (
          <View className="mt-4">
            <View className="flex-row items-center gap-2">
              <Calendar size={theme.iconSize.md} color={theme.colors.text.secondary} />
              <Text className="text-xs font-semibold text-text-secondary">{goal.goalDate}</Text>
            </View>
          </View>
        ) : null}

        {/* Target Metrics */}
        {goal.targetWeight !== undefined ||
        goal.bodyFat !== undefined ||
        goal.ffmi !== undefined ||
        goal.bmi !== undefined ? (
          <View
            className="mt-4 flex-row flex-wrap gap-4 rounded-lg p-3"
            style={{ backgroundColor: theme.colors.background.darkGreen50 }}
          >
            {goal.targetWeight !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Scale size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.targetWeight')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {goal.targetWeight}{' '}
                    <Text
                      className="text-text-secondary"
                      style={{ fontSize: theme.typography.fontSize.xs }}
                    >
                      {t('currentGoalsCard.kg')}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.bodyFat !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Percent size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.bodyFat')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {goal.bodyFat}{' '}
                    <Text
                      className="text-text-secondary"
                      style={{ fontSize: theme.typography.fontSize.xs }}
                    >
                      {t('currentGoalsCard.percent')}
                    </Text>
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.ffmi !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Activity size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.ffmi')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">
                    {goal.ffmi.toFixed(1)}
                  </Text>
                </View>
              </View>
            ) : null}
            {goal.bmi !== undefined ? (
              <View className="min-w-[45%] flex-1 flex-row items-center gap-3">
                <Calculator size={theme.iconSize.lg} color={theme.colors.accent.primary} />
                <View>
                  <Text
                    className="font-bold uppercase text-text-secondary"
                    style={{ fontSize: theme.typography.fontSize.xxs }}
                  >
                    {t('currentGoalsCard.bmi')}
                  </Text>
                  <Text className="text-sm font-bold text-text-primary">{goal.bmi.toFixed(1)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </GenericCard>
  );
}
