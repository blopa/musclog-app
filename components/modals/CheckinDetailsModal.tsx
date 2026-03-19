import { AlertCircle } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import type { Units } from '../../constants/settings';
import { EatingPhase } from '../../database/models';
import type NutritionCheckin from '../../database/models/NutritionCheckin';
import { NutritionGoalService, UserMetricService } from '../../database/services';
import {
  CheckinMetrics,
  NutritionCheckinService,
} from '../../database/services/NutritionCheckinService';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { calculateNutritionPlan, generateWeeklyCheckins } from '../../utils/nutritionCalculator';
import { showSnackbar } from '../../utils/snackbarService';
import { kgToDisplay } from '../../utils/unitConversion';
import { GenericCard } from '../cards/GenericCard';
import { BarChart, type BarChartDataPoint } from '../charts/BarChart';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';
import { NutritionGoals, NutritionGoalsModal } from './NutritionGoalsModal';

type CheckinModalProps = {
  checkinId: string | null;
  visible: boolean;
  onClose: () => void;
};

export function CheckinDetailsModal({ checkinId, visible, onClose }: CheckinModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { goal: currentGoal } = useCurrentNutritionGoal();
  const { weightUnit } = useSettings();
  const [checkin, setCheckin] = useState<NutritionCheckin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<CheckinMetrics | null>(null);
  const [isNutritionGoalsModalVisible, setIsNutritionGoalsModalVisible] = useState(false);

  const initialGoals = useMemo<Partial<NutritionGoals> | undefined>(() => {
    if (!currentGoal) {
      return undefined;
    }

    return {
      totalCalories: currentGoal.totalCalories,
      protein: currentGoal.protein,
      carbs: currentGoal.carbs,
      fats: currentGoal.fats,
      fiber: currentGoal.fiber,
      eatingPhase: currentGoal.eatingPhase as EatingPhase,
      targetWeight: currentGoal.targetWeight,
      targetBodyFat: currentGoal.targetBodyFat,
      targetBMI: currentGoal.targetBmi,
      targetFFMI: currentGoal.targetFfmi,
      targetDate: currentGoal.targetDate ?? null,
    };
  }, [currentGoal]);

  useEffect(() => {
    async function loadData() {
      if (!checkinId) {
        return;
      }
      setIsLoading(true);
      try {
        const c = await NutritionCheckinService.getById(checkinId);
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
  }, [checkinId]);

  const handleReadjust = async () => {
    if (!checkin || !metrics) {
      return;
    }
    // Mark check-in as reviewed first
    await NutritionCheckinService.update(checkin.id, { status: metrics.status });
    setIsNutritionGoalsModalVisible(true);
  };

  const handleGoalsSave = async (goals: NutritionGoals) => {
    try {
      const newGoal = await NutritionGoalService.saveGoals({
        totalCalories: goals.totalCalories,
        protein: goals.protein,
        carbs: goals.carbs,
        fats: goals.fats,
        fiber: goals.fiber,
        eatingPhase: goals.eatingPhase,
        targetWeight: goals.targetWeight,
        targetBodyFat: goals.targetBodyFat,
        targetBMI: goals.targetBMI,
        targetFFMI: goals.targetFFMI,
        targetDate: goals.targetDate ?? null,
      });

      // Generate new check-ins for the new goal
      const userMetric = await UserMetricService.getLatest('weight');
      const heightMetric = await UserMetricService.getLatest('height');
      const bodyFatMetric = await UserMetricService.getLatest('body_fat');

      if (userMetric && heightMetric) {
        const userDecrypted = await userMetric.getDecrypted();
        const heightDecrypted = await heightMetric.getDecrypted();
        const bodyFatDecrypted = bodyFatMetric ? await bodyFatMetric.getDecrypted() : null;

        const plan = calculateNutritionPlan({
          gender: 'other',
          weightKg: userDecrypted.value,
          heightCm: heightDecrypted.value,
          age: 25,
          activityLevel: 3,
          weightGoal:
          // TODO: move this to a helper function to avoid nested ternary
            goals.eatingPhase === 'cut'
              ? 'lose'
              : goals.eatingPhase === 'bulk'
                ? 'gain'
                : 'maintain',
          fitnessGoal: 'general',
          liftingExperience: 'intermediate',
          bodyFatPercent: bodyFatDecrypted?.value,
        });

        // TODO: after generating new check-ins, we should mark the ones for the previous goal as deleted, right? Or not? Analyze code and decide it.
        const checkins = generateWeeklyCheckins(
          plan,
          Date.now(),
          goals.targetDate ?? Date.now() + 90 * 24 * 60 * 60 * 1000,
          heightDecrypted.value / 100,
          bodyFatDecrypted?.value ?? null
        );

        if (checkins.length > 0) {
          await NutritionCheckinService.createBatch(newGoal.id, checkins);
        }
      }

      onClose();
    } catch (e) {
      showSnackbar('error', t('nutritionGoals.errorSaving'));
      console.error('Error saving nutrition goals:', e);
    }
  };

  const handleKeepMacros = async () => {
    if (checkin && metrics) {
      await NutritionCheckinService.update(checkin.id, { status: metrics.status });
      onClose();
    }
  };

  if (isLoading || !checkin || !metrics) {
    return (
      <>
        <FullScreenModal visible={visible} onClose={onClose} title={t('nutrition.checkin.title')}>
          <View className="items-center justify-center" style={{ paddingVertical: 80 }}>
            <ActivityIndicator color={theme.colors.accent.primary} />
          </View>
        </FullScreenModal>
        <NutritionGoalsModal
          visible={isNutritionGoalsModalVisible}
          onClose={() => setIsNutritionGoalsModalVisible(false)}
          onSave={handleGoalsSave}
          initialGoals={initialGoals}
        />
      </>
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
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={t('nutrition.checkin.title')}
        footer={
          <>
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
          </>
        }
      >
        <View style={{ padding: 24 }}>
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
              style={{
                backgroundColor: theme.colors.status.amber10,
                borderColor: theme.colors.status.amber,
              }}
            >
              <AlertCircle size={20} color={theme.colors.status.amber} />
              <Text
                className="flex-1 text-sm font-medium"
                style={{ color: theme.colors.status.amber }}
              >
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
        </View>
      </FullScreenModal>

      <NutritionGoalsModal
        visible={isNutritionGoalsModalVisible}
        onClose={() => setIsNutritionGoalsModalVisible(false)}
        onSave={handleGoalsSave}
        initialGoals={initialGoals}
      />
    </>
  );
}
