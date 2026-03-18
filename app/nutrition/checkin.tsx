import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GenericCard } from '../../components/cards/GenericCard';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { database } from '../../database';
import type NutritionCheckin from '../../database/models/NutritionCheckin';
import type NutritionGoal from '../../database/models/NutritionGoal';
import type WorkoutLog from '../../database/models/WorkoutLog';
import {
  NutritionCheckinService,
  NutritionService,
  UserMetricService,
} from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';

export default function CheckinScreen() {
  const theme = useTheme();
  const [activeMinutesTrend, setActiveMinutesTrend] = useState<number | null>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const [isLoading, setIsLoading] = useState(true);
  const [checkin, setCheckin] = useState<NutritionCheckin | null>(null);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [weeklyWeight, setWeeklyWeight] = useState<number | null>(null);
  const [avgCalories, setAvgCalories] = useState<number | null>(null);
  const [workoutsCount, setWorkoutsCount] = useState(0);
  const [dailyWeights, setDailyWeights] = useState<(number | null)[]>([]);
  const [activeMinutes, setActiveMinutes] = useState(0);
  const [consistency, setConsistency] = useState(0);
  const [avgBodyFat, setAvgBodyFat] = useState<number | null>(null);
  const [weekInfo, setWeekInfo] = useState({ current: 0, total: 0 });

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        let currentCheckin: NutritionCheckin | null = null;
        if (checkinId) {
          currentCheckin = await NutritionCheckinService.getById(checkinId);
        } else {
          // Find the most recent pending check-in that is due (date <= now)
          const pending = await database
            .get<NutritionCheckin>('nutrition_checkins')
            .query(
              Q.where('completed', Q.notEq(true)),
              Q.where('checkin_date', Q.lte(Date.now())),
              Q.where('deleted_at', Q.eq(null)),
              Q.sortBy('checkin_date', Q.desc),
              Q.take(1)
            )
            .fetch();
          currentCheckin = pending[0] ?? null;
        }

        if (!currentCheckin) {
          setIsLoading(false);
          return;
        }

        setCheckin(currentCheckin);
        const currentGoal = await currentCheckin.nutritionGoal;
        setGoal(currentGoal);

        // Fetch data for the last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);

        // Weight data
        const weightMetrics = await UserMetricService.getMetricsHistory('weight', {
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
        });

        const weights: (number | null)[] = new Array(7).fill(null);
        let weightSum = 0;
        let weightCount = 0;

        for (let i = 0; i < 7; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const metric = weightMetrics.find((m) => {
            const mDate = new Date(m.date);
            return (
              mDate.getFullYear() === d.getFullYear() &&
              mDate.getMonth() === d.getMonth() &&
              mDate.getDate() === d.getDate()
            );
          });
          if (metric) {
            const val = (await metric.getDecrypted()).value;
            weights[i] = val;
            weightSum += val;
            weightCount++;
          }
        }
        setDailyWeights(weights);
        setWeeklyWeight(weightCount > 0 ? weightSum / weightCount : null);

        // Body fat data
        const fatMetrics = await UserMetricService.getMetricsHistory('body_fat', {
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
        });
        let fatSum = 0;
        let fatCount = 0;
        for (const m of fatMetrics) {
          const val = (await m.getDecrypted()).value;
          fatSum += val;
          fatCount++;
        }
        setAvgBodyFat(fatCount > 0 ? fatSum / fatCount : null);

        // Calorie and consistency
        const nutritionLogs = await NutritionService.getNutritionLogsForDateRange(
          startDate,
          endDate
        );
        let totalCals = 0;
        const loggedDays = new Set<string>();
        for (const log of nutritionLogs) {
          totalCals += (await log.getNutrients()).calories;
          loggedDays.add(new Date(log.date).toDateString());
        }
        setAvgCalories(Math.round(totalCals / 7));
        setConsistency(Math.round((loggedDays.size / 7) * 100));

        // Workouts and active minutes (Current Week)
        const workouts = await database
          .get<WorkoutLog>('workout_logs')
          .query(
            Q.where('completed_at', Q.between(startDate.getTime(), endDate.getTime())),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();
        setWorkoutsCount(workouts.length);
        let mins = 0;
        for (const w of workouts) {
          if (w.completedAt && w.startedAt) {
            mins += (w.completedAt - w.startedAt) / 60000;
          }
        }
        setActiveMinutes(Math.round(mins));

        // Active Minutes (Previous Week) for trend
        const prevEndDate = new Date(startDate);
        prevEndDate.setMilliseconds(prevEndDate.getMilliseconds() - 1);
        const prevStartDate = new Date(prevEndDate);
        prevStartDate.setDate(prevStartDate.getDate() - 6);
        prevStartDate.setHours(0, 0, 0, 0);

        const prevWorkouts = await database
          .get<WorkoutLog>('workout_logs')
          .query(
            Q.where('completed_at', Q.between(prevStartDate.getTime(), prevEndDate.getTime())),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();
        let prevMins = 0;
        for (const w of prevWorkouts) {
          if (w.completedAt && w.startedAt) {
            prevMins += (w.completedAt - w.startedAt) / 60000;
          }
        }
        if (prevMins > 0) {
          setActiveMinutesTrend(Math.round(((mins - prevMins) / prevMins) * 100));
        } else {
          setActiveMinutesTrend(null);
        }

        // Week info
        if (currentGoal) {
          const start = currentGoal.createdAt;
          const end = currentGoal.targetDate || Date.now() + 90 * 24 * 60 * 60 * 1000;
          const totalWeeks = Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000));
          const currentWeek = Math.ceil((Date.now() - start) / (7 * 24 * 60 * 60 * 1000));
          setWeekInfo({ current: Math.min(currentWeek, totalWeeks), total: totalWeeks });
        }
      } catch (error) {
        console.error('Error loading check-in data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [checkinId]);

  const status = useMemo(() => {
    if (!checkin || weeklyWeight === null) {
      return null;
    }

    const target = checkin.targetWeight;
    const actual = weeklyWeight;
    const diffPercent = Math.abs(actual - target) / target;

    // Threshold: 0.5% deviation
    if (diffPercent <= 0.005) {
      return 'onTrack';
    }

    const goalType = goal?.eatingPhase; // 'cut', 'maintain', 'bulk'

    if (goalType === 'cut') {
      return actual < target ? 'ahead' : 'behind';
    } else if (goalType === 'bulk') {
      return actual > target ? 'ahead' : 'behind';
    } else {
      // maintain
      return 'behind'; // outside threshold is "behind" for maintenance
    }
  }, [checkin, weeklyWeight, goal]);

  const trend = useMemo(() => {
    const validWeights = dailyWeights.filter((w): w is number => w !== null);
    if (validWeights.length < 2) {
      return 0;
    }
    return validWeights[validWeights.length - 1] - validWeights[0];
  }, [dailyWeights]);

  const handleKeepMacros = async () => {
    if (!checkin) {
      return;
    }
    await NutritionCheckinService.update(checkin.id, { completed: true });
    router.replace('/progress');
  };

  const handleReadjust = () => {
    // Navigate to nutrition-goals with adjustment flag
    router.push({
      pathname: '/onboarding/nutrition-goals',
      params: { isCheckinAdjusting: 'true', checkinId: checkin?.id },
    });
  };

  if (isLoading) {
    return (
      <MasterLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  if (!checkin) {
    return (
      <MasterLayout>
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="check-circle-outline" size={64} color={theme.colors.text.tertiary} />
          <Text className="mt-4 text-center text-lg font-medium" style={{ color: theme.colors.text.secondary }}>
            {t('nutrition.checkin.noCheckinFound')}
          </Text>
          <Button
            label={t('common.back')}
            variant="outline"
            className="mt-6"
            onPress={() => router.back()}
          />
        </View>
      </MasterLayout>
    );
  }

  const displayActualWeight = weeklyWeight !== null ? kgToDisplay(weeklyWeight, units) : 0;
  const displayTargetWeight = kgToDisplay(checkin.targetWeight, units);
  const displayTrend = kgToDisplay(Math.abs(trend), units);
  const trendColor = trend <= 0 ? theme.colors.status.emerald : theme.colors.status.warning;

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1 bg-[#0F172A]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-4">
          <ChevronLeft color={theme.colors.text.primary} onPress={() => router.back()} />
          <Text className="text-lg font-bold text-white">{t('nutrition.checkin.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          {/* Status Ring */}
          <View className="mb-12 items-center">
            <View
              className="h-48 w-48 items-center justify-center rounded-full border-[10px]"
              style={{
                borderColor: status === 'onTrack' ? theme.colors.status.emerald : status === 'ahead' ? theme.colors.status.info : theme.colors.status.warning,
                shadowColor: status === 'onTrack' ? theme.colors.status.emerald : status === 'ahead' ? theme.colors.status.info : theme.colors.status.warning,
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
                {status ? t(`nutrition.checkin.${status}`) : '---'}
              </Text>
            </View>
            <Text className="mt-8 text-3xl font-black text-white">
              {t(`nutrition.checkin.headline.${status || 'onTrack'}`)}
            </Text>
            <Text className="mt-2 text-center text-base font-medium opacity-60 px-4" style={{ color: theme.colors.text.secondary }}>
              {t(`nutrition.checkin.subtext.${status || 'onTrack'}`)}
            </Text>
          </View>

          {/* Weight Trend Card */}
          <GenericCard variant="card" containerStyle={{ padding: 20, marginBottom: 32, backgroundColor: '#1E293B44', borderColor: '#1E293B' }}>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {t('nutrition.checkin.weightTrend')}
                </Text>
                <View className="mt-1 flex-row items-baseline">
                  <Text className="text-3xl font-black text-white">{displayActualWeight.toFixed(1)}</Text>
                  <Text className="ml-1 text-base font-bold text-gray-400">{t(weightUnitKey)}</Text>
                  <View className="ml-3 rounded-md px-2 py-0.5" style={{ backgroundColor: trendColor + '22' }}>
                    <Text className="text-xs font-bold" style={{ color: trendColor }}>
                      {trend > 0 ? '+' : '-'}{displayTrend.toFixed(1)}{t(weightUnitKey)}
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
                  <Text className="text-sm font-medium text-gray-400"> {t(weightUnitKey)}</Text>
                </Text>
              </View>
            </View>

            {/* Simple Bar Chart */}
            <View className="mt-8 h-24 flex-row items-end justify-between px-2">
              {dailyWeights.map((w, i) => {
                const weights = dailyWeights.filter((x): x is number => x !== null);
                const minW = weights.length > 0 ? Math.min(...weights) : 0;
                const maxW = weights.length > 0 ? Math.max(...weights) : 1;
                const range = maxW - minW || 1;
                // Normalize height between 20% and 80% of container
                const height = w ? 20 + ((w - minW) / range) * 60 : 10;
                const isToday = i === 6;
                return (
                  <View key={i} className="items-center">
                    <View
                      className="w-8 rounded-t-lg"
                      style={{
                        height: `${height}%`,
                        backgroundColor: isToday ? theme.colors.status.emerald : (i >= 5 ? '#6366F1' : '#1E293B')
                      }}
                    />
                    <Text
                      className="mt-2 text-[10px] font-bold uppercase"
                      style={{ color: isToday ? theme.colors.status.emerald : theme.colors.text.tertiary }}
                    >
                      {isToday ? t('common.today') : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][(new Date(Date.now() - (6-i)*24*60*60*1000)).getDay()]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </GenericCard>

          {/* Weekly Breakdown */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-black text-white">{t('nutrition.checkin.weeklyBreakdown')}</Text>
            <View className="rounded-full bg-[#1E293B] px-3 py-1">
              <Text className="text-[10px] font-bold text-[#6366F1] uppercase">
                {t('nutrition.checkin.weekProgress', { current: weekInfo.current, total: weekInfo.total })}
              </Text>
            </View>
          </View>

          <GenericCard variant="card" containerStyle={{ padding: 20, marginBottom: 24, backgroundColor: '#1E293B44', borderColor: '#1E293B' }}>
            <Text className="text-base font-medium leading-relaxed text-gray-300">
              {t('nutrition.checkin.summaryIntro', { target: goal?.totalCalories ?? 0 })}
              <Text style={{ color: theme.colors.status.warning }}> {avgCalories} {t('common.kcal')}/day</Text>.
              {t('nutrition.checkin.summaryOutro')}
              <Text style={{ color: theme.colors.status.emerald }}> {workoutsCount} {t('nutrition.checkin.workoutsCount')}</Text> {t('nutrition.checkin.withHighIntensity')}
            </Text>

            <View className="mt-8 flex-row gap-4">
              <View className="flex-1 rounded-2xl bg-[#0F172A] p-4 border border-[#1E293B]">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('nutrition.checkin.avgIntake')}</Text>
                <Text className="mt-1 text-xl font-black text-white">{avgCalories} <Text className="text-xs font-medium text-gray-500">{t('common.kcal')}</Text></Text>
              </View>
              <View className="flex-1 rounded-2xl bg-[#0F172A] p-4 border border-[#1E293B]">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('nutrition.checkin.consistency')}</Text>
                <Text className="mt-1 text-xl font-black text-white">{consistency}% <Text className="text-xs font-medium text-gray-500">{t('nutrition.checkin.rate')}</Text></Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-4">
              <View className="flex-1 rounded-2xl bg-[#0F172A] p-4 border border-[#1E293B]">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('nutrition.checkin.avgBodyFat')}</Text>
                <Text className="mt-1 text-xl font-black text-white">{avgBodyFat?.toFixed(1) ?? '--'}%</Text>
                <Text className="mt-1 text-[10px] font-medium text-gray-500">{t('nutrition.checkin.targetShort', { value: checkin.targetBodyFat.toFixed(1) })}</Text>
              </View>
              <View className="flex-1 rounded-2xl bg-[#0F172A] p-4 border border-[#1E293B]">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{t('nutrition.checkin.activeMinutes')}</Text>
                <Text className="mt-1 text-xl font-black text-white">{activeMinutes}</Text>
                {activeMinutesTrend !== null ? (
                  <Text className="mt-1 text-[10px] font-medium" style={{ color: activeMinutesTrend >= 0 ? theme.colors.status.emerald : theme.colors.status.warning }}>
                    {t('nutrition.checkin.vsLastWeek', { prefix: activeMinutesTrend >= 0 ? '+' : '', value: activeMinutesTrend })}
                  </Text>
                ) : null}
              </View>
            </View>
          </GenericCard>

          <View className="h-32" />
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
            style={{ backgroundColor: '#1E293B', borderColor: 'transparent' }}
            textStyle={{ color: 'white' }}
          />
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
