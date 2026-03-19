import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GenericCard } from '../../components/cards/GenericCard';
import { BarChart, type BarChartDataPoint } from '../../components/charts/BarChart';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import type { Units } from '../../constants/settings';
import type NutritionCheckin from '../../database/models/NutritionCheckin';
import {
  CheckinMetrics,
  NutritionCheckinService,
} from '../../database/services/NutritionCheckinService';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { kgToDisplay } from '../../utils/unitConversion';

export default function CheckinReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { goal: currentGoal } = useCurrentNutritionGoal();
  const { weightUnit } = useSettings();
  const [checkin, setCheckin] = useState<NutritionCheckin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<CheckinMetrics | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        return;
      }
      try {
        const c = await NutritionCheckinService.getById(id);
        if (c) {
          setCheckin(c);
          const m = await NutritionCheckinService.getCheckinMetrics(c);
          setMetrics(m);
        }
      } catch (err) {
        console.error('Failed to load check-in data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleReadjust = async () => {
    if (!checkin || !metrics) {
      return;
    }
    // Mark check-in as reviewed first
    await NutritionCheckinService.update(checkin.id, { status: metrics.status });
    // Navigate to onboarding-style goal setting with readjust=true
    router.push({
      pathname: '/onboarding/nutrition-goals',
      params: { readjust: 'true' },
    });
  };

  const handleKeepMacros = async () => {
    if (checkin && metrics) {
      await NutritionCheckinService.update(checkin.id, { status: metrics.status });
      router.back();
    }
  };

  if (isLoading || !checkin || !metrics) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View
          className="flex-1 items-center justify-center p-6"
          style={{ backgroundColor: theme.colors.background.primary }}
        >
          <ActivityIndicator color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  const {
    avgWeight,
    trend,
    avgCalories,
    consistency,
    avgBodyFat,
    activeMinutes,
    activeMinutesTrend,
    dailyWeights,
    workoutsCount,
    weekInfo,
    status,
    hasEnoughData,
  } = metrics;

  const units: Units = weightUnit === 'kg' ? 'metric' : 'imperial';
  const displayActualWeight = kgToDisplay(avgWeight, units);
  const displayTargetWeight = kgToDisplay(checkin.targetWeight, units);
  const displayTrend = kgToDisplay(Math.abs(trend), units);
  const trendColor = trend <= 0 ? theme.colors.status.emerald : theme.colors.status.warning;
  const weightUnitKey = weightUnit === 'kg' ? 'common.weightFormatKg' : 'common.weightFormatLbs';

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4">
          <ChevronLeft color={theme.colors.text.primary} onPress={() => router.back()} />
          <Text className="text-lg font-bold text-white">{t('nutrition.checkin.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 160 }}>
          {/* Status Ring */}
          <View className="mb-12 items-center">
            <View
              className="h-48 w-48 items-center justify-center rounded-full border-[10px]"
              style={{
                borderColor:
                  status === 'onTrack'
                    ? theme.colors.status.emerald
                    : status === 'ahead'
                      ? theme.colors.status.info
                      : theme.colors.status.warning,
                shadowColor:
                  status === 'onTrack'
                    ? theme.colors.status.emerald
                    : status === 'ahead'
                      ? theme.colors.status.info
                      : theme.colors.status.warning,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 15,
                elevation: 10,
              }}
            >
              <Text
                className="text-center text-2xl font-black uppercase leading-7 tracking-tighter text-white"
                style={{ fontSize: 28 }}
              >
                {status ? t(`nutrition.checkin.${status}`).replace(' ', '\n') : '---'}
              </Text>
            </View>
            <Text className="mt-8 text-3xl font-black text-white">
              {status ? t(`nutrition.checkin.headline.${status}`) : '---'}
            </Text>
            <Text
              className="mt-2 px-4 text-center text-base font-medium opacity-60"
              style={{ color: theme.colors.text.secondary }}
            >
              {status ? t(`nutrition.checkin.subtext.${status}`) : '---'}
            </Text>
          </View>

          {/* Warning if not enough data */}
          {!hasEnoughData ? (
            <View
              className="mb-8 flex-row items-center gap-3 rounded-2xl border p-4"
              style={{ backgroundColor: theme.colors.status.amber10, borderColor: theme.colors.status.amber }}
            >
              <AlertCircle size={20} color={theme.colors.status.amber} />
              <Text className="flex-1 text-sm font-medium" style={{ color: theme.colors.status.amber }}>
                {t('nutrition.checkin.notEnoughDataWarning')}
              </Text>
            </View>
          ) : null}

          {/* Weight Trend Card */}
          <GenericCard
            variant="card"
            containerStyle={{
              padding: 20,
              marginBottom: 32,
              backgroundColor: theme.colors.background.darkGray,
              borderColor: theme.colors.border.accent,
            }}
          >
            <View className="flex-row justify-between">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.weightTrend')}
                </Text>
                <View className="mt-1 flex-row items-baseline">
                  <Text className="text-3xl font-black text-white">
                    {displayActualWeight.toFixed(1)}
                  </Text>
                  <Text className="ml-1 text-base font-bold text-gray-400">
                    {t(weightUnitKey, { value: '' })}
                  </Text>
                  <View
                    className="ml-3 rounded-md px-2 py-0.5"
                    style={{ backgroundColor: trendColor + '22' }}
                  >
                    <Text className="text-xs font-bold" style={{ color: trendColor }}>
                      {trend > 0 ? '+' : '-'}
                      {displayTrend.toFixed(1)}
                      {t(weightUnitKey, { value: '' })}
                    </Text>
                  </View>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.target')}
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {displayTargetWeight.toFixed(1)}
                  <Text className="text-sm font-medium text-gray-400">
                    {' '}
                    {t(weightUnitKey, { value: '' })}
                  </Text>
                </Text>
              </View>
            </View>

            <BarChart
              data={dailyWeights.map((y: number, i: number): BarChartDataPoint => ({ x: i, y }))}
              height={100}
              barColor={theme.colors.status.emerald}
              innerPadding={0.3}
              xAxisLabels={dailyWeights.map((_w: number, i: number) => ({
                label: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][
                  new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).getDay()
                ],
                positionPercent: (i / 6) * 100,
              }))}
              marginTop={24}
              showGridLines={false}
            />
          </GenericCard>

          {/* Weekly Breakdown */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-black text-white">
              {t('nutrition.checkin.weeklyBreakdown')}
            </Text>
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: theme.colors.background.card }}
            >
              <Text
                className="text-[10px] font-bold uppercase"
                style={{ color: theme.colors.accent.primary }}
              >
                {t('nutrition.checkin.weekProgress', {
                  current: weekInfo.current,
                  total: weekInfo.total,
                })}
              </Text>
            </View>
          </View>

          <GenericCard
            variant="card"
            containerStyle={{
              padding: 20,
              marginBottom: 24,
              backgroundColor: theme.colors.background.darkGray,
              borderColor: theme.colors.border.accent,
            }}
          >
            <Text className="text-base font-medium leading-relaxed text-gray-300">
              {t('nutrition.checkin.summaryIntro', { target: currentGoal?.totalCalories ?? 0 })}
              <Text style={{ color: theme.colors.status.warning }}>
                {' '}
                {avgCalories} {t('common.kcal')}/day
              </Text>
              . {t('nutrition.checkin.summaryOutro')}
              <Text style={{ color: theme.colors.status.emerald }}>
                {' '}
                {workoutsCount} {t('nutrition.checkin.workoutsCount')}
              </Text>{' '}
              {t('nutrition.checkin.withHighIntensity')}
            </Text>

            <View className="mt-8 flex-row gap-4">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border.accent,
                  backgroundColor: theme.colors.background.primary,
                }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.avgIntake')}
                </Text>
                <Text className="mt-1 text-xl font-black text-white">
                  {avgCalories}{' '}
                  <Text className="text-xs font-medium text-gray-500">{t('common.kcal')}</Text>
                </Text>
              </View>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border.accent,
                  backgroundColor: theme.colors.background.primary,
                }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.consistency')}
                </Text>
                <Text className="mt-1 text-xl font-black text-white">
                  {consistency}%{' '}
                  <Text className="text-xs font-medium text-gray-500">
                    {t('nutrition.checkin.rate')}
                  </Text>
                </Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-4">
              <View
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border.accent,
                  backgroundColor: theme.colors.background.primary,
                }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.avgBodyFat')}
                </Text>
                <Text className="mt-1 text-xl font-black text-white">
                  {avgBodyFat?.toFixed(1) ?? '--'}%
                </Text>
                <Text className="mt-1 text-[10px] font-medium text-gray-500">
                  {t('nutrition.checkin.targetShort', { value: checkin.targetBodyFat.toFixed(1) })}
                </Text>
              </View>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border.accent,
                  backgroundColor: theme.colors.background.primary,
                }}
              >
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.activeMinutes')}
                </Text>
                <Text className="mt-1 text-xl font-black text-white">{activeMinutes}</Text>
                {activeMinutesTrend !== null ? (
                  <Text
                    className="mt-1 text-[10px] font-medium"
                    style={{
                      color:
                        activeMinutesTrend >= 0
                          ? theme.colors.status.emerald
                          : theme.colors.status.warning,
                    }}
                  >
                    {t('nutrition.checkin.vsLastWeek', {
                      prefix: activeMinutesTrend >= 0 ? '+' : '',
                      value: activeMinutesTrend,
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
          </GenericCard>
          <View pointerEvents="none" style={{ height: theme.spacing.margin['3xl'] }} />
        </ScrollView>

        <BottomButtonWrapper>
          <Button
            label={t('nutrition.checkin.readjust')}
            variant="gradientCta"
            width="full"
            size="md"
            onPress={handleReadjust}
            style={{ marginBottom: 12 }}
          />
          <Button
            label={t('nutrition.checkin.keepMacros')}
            variant="outline"
            width="full"
            size="md"
            onPress={handleKeepMacros}
            style={{ backgroundColor: theme.colors.background.card, borderColor: 'transparent' }}
          />
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
