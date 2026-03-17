import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight, Info, RefreshCw } from 'lucide-react-native';
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
import type NutritionLog from '../../database/models/NutritionLog';
import type UserMetric from '../../database/models/UserMetric';
import type WorkoutLog from '../../database/models/WorkoutLog';
import {
  NutritionCheckinService,
  NutritionGoalService,
  NutritionService,
  UserMetricService,
} from '../../database/services';
import { useTheme } from '../../hooks/useTheme';
import { kgToDisplay } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';
import { useSettings } from '../../hooks/useSettings';

export default function CheckinScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { checkinId } = useLocalSearchParams<{ checkinId: string }>();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const [isLoading, setIsLoading] = useState(true);
  const [checkin, setCheckin] = useState<NutritionCheckin | null>(null);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [weeklyWeight, setWeeklyWeight] = useState<number | null>(null);
  const [weightLogsCount, setWeightLogsCount] = useState(0);
  const [avgCalories, setAvgCalories] = useState<number | null>(null);
  const [workoutsCount, setWorkoutsCount] = useState(0);

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
        startDate.setDate(endDate.getDate() - 7);

        // Weight average
        const weightMetrics = await UserMetricService.getMetricsHistory('weight', {
          startDate: startDate.getTime(),
          endDate: endDate.getTime(),
        });

        if (weightMetrics.length > 0) {
          const weights = await Promise.all(
            weightMetrics.map(async (m) => (await m.getDecrypted()).value)
          );
          const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
          setWeeklyWeight(avg);
          setWeightLogsCount(weights.length);
        }

        // Calorie average
        const nutritionLogs = await NutritionService.getNutritionLogsForDateRange(
          startDate,
          endDate
        );
        if (nutritionLogs.length > 0) {
          let totalCals = 0;
          for (const log of nutritionLogs) {
            totalCals += (await log.getNutrients()).calories;
          }
          setAvgCalories(Math.round(totalCals / 7));
        } else {
          setAvgCalories(0);
        }

        // Workout count
        const workouts = await database
          .get<WorkoutLog>('workout_logs')
          .query(
            Q.where('completed_at', Q.between(startDate.getTime(), endDate.getTime())),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();
        setWorkoutsCount(workouts.length);
      } catch (error) {
        console.error('Error loading check-in data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [checkinId]);

  const status = useMemo(() => {
    if (!checkin || weeklyWeight === null) return null;

    const target = checkin.targetWeight;
    const actual = weeklyWeight;
    const diffPercent = Math.abs(actual - target) / target;

    // Threshold: 0.5% deviation
    if (diffPercent <= 0.005) return 'onTrack';

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

  const handleKeepMacros = async () => {
    if (!checkin) return;
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

  const isDataInsufficient = weightLogsCount < 4;

  const displayActualWeight = weeklyWeight !== null ? kgToDisplay(weeklyWeight, units) : 0;
  const displayTargetWeight = kgToDisplay(checkin.targetWeight, units);

  return (
    <MasterLayout>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.spacing.padding.lg }}>
        <Text className="mb-6 text-3xl font-black tracking-tight" style={{ color: theme.colors.text.primary }}>
          {t('nutrition.checkin.title')}
        </Text>

        {/* Status Section */}
        <GenericCard variant="elevated" containerStyle={{ marginBottom: theme.spacing.margin.lg, padding: theme.spacing.padding.xl, alignItems: 'center' }}>
          <View
            className="mb-4 h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: status === 'onTrack' ? theme.colors.status.emerald + '22' : status === 'ahead' ? theme.colors.status.blue + '22' : status === 'behind' ? theme.colors.status.orange + '22' : undefined }}
          >
            <MaterialIcons
              name={status === 'onTrack' ? 'check-circle' : status === 'ahead' ? 'trending-up' : 'error-outline'}
              size={48}
              color={status === 'onTrack' ? theme.colors.status.emerald : status === 'ahead' ? theme.colors.status.blue : status === 'behind' ? theme.colors.status.orange : undefined}
            />
          </View>
          <Text className="text-sm font-bold uppercase tracking-widest" style={{ color: theme.colors.text.tertiary }}>
            {t('nutrition.checkin.status')}
          </Text>
          <Text className="text-2xl font-black" style={{ color: status === 'onTrack' ? theme.colors.status.emerald : status === 'ahead' ? theme.colors.status.blue : status === 'behind' ? theme.colors.status.orange : undefined }}>
            {status ? t(`nutrition.checkin.${status}`) : '---'}
          </Text>
        </GenericCard>

        {/* Breakdown Section */}
        <View className="mb-6">
          <Text className="mb-3 ml-1 text-sm font-bold uppercase tracking-wider" style={{ color: theme.colors.text.tertiary }}>
            {t('nutrition.checkin.adherence')}
          </Text>
          <GenericCard variant="default" containerStyle={{ padding: theme.spacing.padding.lg }}>
            <Text className="mb-4 text-base leading-relaxed" style={{ color: theme.colors.text.primary }}>
              {t('nutrition.checkin.summary', {
                targetKcal: goal?.totalCalories ?? 0,
                actualKcal: avgCalories ?? 0,
                workouts: workoutsCount
              })}
            </Text>

            <View className="flex-row items-center justify-between border-t pt-4" style={{ borderTopColor: theme.colors.border.primary + '22' }}>
              <View>
                <Text className="text-xs font-medium" style={{ color: theme.colors.text.tertiary }}>
                  {t('nutrition.checkin.weightComparison', {
                    actual: displayActualWeight.toFixed(1),
                    target: displayTargetWeight.toFixed(1),
                    unit: t(weightUnitKey)
                  })}
                </Text>
              </View>
              {isDataInsufficient && (
                <View className="rounded-full bg-orange-500/10 px-2 py-1 flex-row items-center gap-1">
                  <Info size={12} color={theme.colors.status.orange} />
                  <Text className="text-[10px] font-bold text-orange-500">
                    LOW DATA
                  </Text>
                </View>
              )}
            </View>
          </GenericCard>
        </View>

        {isDataInsufficient && (
          <View className="mb-6 flex-row gap-3 rounded-2xl p-4" style={{ backgroundColor: theme.colors.status.orange + '15' }}>
            <Info color={theme.colors.status.orange} size={20} />
            <Text className="flex-1 text-xs font-medium leading-relaxed" style={{ color: theme.colors.status.orange }}>
              {t('nutrition.checkin.insufficientData')}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomButtonWrapper>
        <Button
          label={t('nutrition.checkin.keepMacros')}
          variant="outline"
          width="full"
          size="md"
          icon={Check}
          onPress={handleKeepMacros}
          style={{ marginBottom: theme.spacing.margin.md }}
        />
        <Button
          label={t('nutrition.checkin.readjust')}
          variant="gradientCta"
          width="full"
          size="md"
          icon={RefreshCw}
          onPress={handleReadjust}
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
