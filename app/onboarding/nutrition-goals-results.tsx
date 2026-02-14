import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'hooks/useTheme';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GenericCard } from '../../components/cards/GenericCard';
import { LineChart } from '../../components/LineChart';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '../../constants/auth';
import { database } from '../../database';
import UserMetric from '../../database/models/UserMetric';
import { NutritionGoalService } from '../../database/services';
import { useCurrentNutritionGoal } from '../../hooks/useCurrentNutritionGoal';
import {
  bmiFromWeightAndHeightM,
  estimateTargetBodyFatWhenCutting,
  ffmiFromWeightHeightAndBodyFat,
  fiberFromCalories,
  inchesToCm,
  NutritionPlan,
} from '../../utils/nutritionCalculator';
import { showSnackbar } from '../../utils/snackbarService';

export default function NutritionGoalsResults() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const params = useLocalSearchParams<{ aiGenerated?: string; plan?: string }>();
  const aiGenerated = params.aiGenerated === 'true';
  const [isSaving, setIsSaving] = useState(false);
  const [storedPlan, setStoredPlan] = useState<NutritionPlan | null>(null);

  // Parse the plan from route params (AI-generated) or fall back to DB (manual)
  // prefer AsyncStorage when aiGenerated; fall back to route param for backwards compatibility
  const parsedPlanFromParams = useMemo<NutritionPlan | null>(() => {
    if (params.plan) {
      try {
        return JSON.parse(params.plan) as NutritionPlan;
      } catch {
        return null;
      }
    }
    return null;
  }, [params.plan]);

  useEffect(() => {
    let isMounted = true;

    const loadPlan = async () => {
      if (aiGenerated) {
        try {
          const raw = await AsyncStorage.getItem(TEMP_NUTRITION_PLAN);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as NutritionPlan;
              if (isMounted) setStoredPlan(parsed);
              return;
            } catch {
              // ignore parse errors and fall back to params
            }
          }
        } catch (e) {
          console.warn('Failed to read stored nutrition plan:', e);
        }
      }

      // fallback to param-based plan
      if (parsedPlanFromParams && isMounted) {
        setStoredPlan(parsedPlanFromParams);
      }
    };

    loadPlan();

    return () => {
      isMounted = false;
    };
  }, [aiGenerated, parsedPlanFromParams]);

  const parsedPlan = storedPlan;

  // For manual entry, load saved goal from DB
  const { goal: savedGoal, isLoading: isLoadingGoal } = useCurrentNutritionGoal({
    mode: 'current',
  });

  // Resolve display data: prefer parsedPlan (AI), fall back to savedGoal (manual)
  const displayData = useMemo(() => {
    if (parsedPlan) {
      return {
        targetCalories: parsedPlan.targetCalories,
        minTargetCalories: parsedPlan.minTargetCalories,
        maxTargetCalories: parsedPlan.maxTargetCalories,
        protein: parsedPlan.protein,
        carbs: parsedPlan.carbs,
        fats: parsedPlan.fats,
        proteinPct: parsedPlan.proteinPct,
        carbsPct: parsedPlan.carbsPct,
        fatsPct: parsedPlan.fatsPct,
        goalLabel: parsedPlan.goalLabel,
        startWeight: parsedPlan.currentWeightKg,
        projectedWeight: parsedPlan.projectedWeightKg,
        weightChange: parseFloat(
          (parsedPlan.projectedWeightKg - parsedPlan.currentWeightKg).toFixed(1)
        ),
        projectionDays: parsedPlan.projectionDays,
        hasProjection: true,
      };
    }

    if (savedGoal) {
      const totalMacroCals = savedGoal.protein * 4 + savedGoal.carbs * 4 + savedGoal.fats * 9;
      const effectiveTotal = totalMacroCals > 0 ? totalMacroCals : savedGoal.totalCalories || 1;

      return {
        targetCalories: savedGoal.totalCalories,
        protein: savedGoal.protein,
        carbs: savedGoal.carbs,
        fats: savedGoal.fats,
        proteinPct: Math.round((savedGoal.protein * 4 * 100) / effectiveTotal),
        carbsPct: Math.round((savedGoal.carbs * 4 * 100) / effectiveTotal),
        fatsPct: Math.round((savedGoal.fats * 9 * 100) / effectiveTotal),
        goalLabel: null,
        startWeight: 0,
        projectedWeight: 0,
        weightChange: 0,
        projectionDays: 0,
        hasProjection: false,
      };
    }

    return null;
  }, [parsedPlan, savedGoal]);

  // Build projection chart data
  const projectionLength = 10;
  const projectionData = useMemo(() => {
    if (!displayData?.hasProjection) {
      return [];
    }

    const { startWeight, projectedWeight } = displayData;
    return Array.from({ length: projectionLength }).map((_, i) => {
      const progress = i / (projectionLength - 1);
      const weight = startWeight + (projectedWeight - startWeight) * progress;
      return {
        marker: `${weight.toFixed(1)} kg`,
        x: i,
        y: parseFloat(weight.toFixed(1)),
      };
    });
  }, [displayData]);

  // Determine eating phase from the calorie delta
  const eatingPhase = useMemo(() => {
    if (!parsedPlan) {
      return savedGoal?.eatingPhase ?? 'maintain';
    }

    if (parsedPlan.targetCalories < parsedPlan.tdee) {
      return 'cut';
    }

    if (parsedPlan.targetCalories > parsedPlan.tdee) {
      return 'bulk';
    }

    return 'maintain';
  }, [parsedPlan, savedGoal]);

  // Trending icon and memoized weight change label must be declared as hooks here
  const weightChangeLabel = useMemo(() => {
    if (!displayData) {
      return '';
    }

    if (displayData.weightChange > 0) {
      return t('nutritionGoals.results.estimatedWeightGain');
    }

    if (displayData.weightChange < 0) {
      return t('nutritionGoals.results.estimatedWeightLoss');
    }

    return t('nutritionGoals.results.estimatedMaintenance');
  }, [displayData, t]);

  const trendingIcon = displayData && displayData.weightChange > 0 ? 'trending-up' : 'trending-down';

  const handleAccept = async () => {
    if (!displayData) {
      return;
    }

    setIsSaving(true);
    try {
      // Only save if this is an AI-generated plan (manual already saved in nutrition-goals screen)
      if (aiGenerated && parsedPlan) {
        let heightM = 0;
        let currentBodyFatPercent: number | null = null;

        try {
          const heightMetrics = await database
            .get<UserMetric>('user_metrics')
            .query(
              Q.where('type', 'height'),
              Q.where('deleted_at', Q.eq(null)),
              Q.sortBy('date', Q.desc)
            )
            .fetch();

          const bodyFatMetrics = await database
            .get<UserMetric>('user_metrics')
            .query(
              Q.where('type', 'bodyFat'),
              Q.where('deleted_at', Q.eq(null)),
              Q.sortBy('date', Q.desc)
            )
            .fetch();

          if (heightMetrics.length > 0) {
            const rawHeight = heightMetrics[0].value;
            const heightUnit = heightMetrics[0].unit;
            const heightCm = heightUnit === 'in' ? inchesToCm(rawHeight) : rawHeight;
            heightM = heightCm / 100;
          }

          if (
            bodyFatMetrics.length > 0 &&
            bodyFatMetrics[0].value >= 1 &&
            bodyFatMetrics[0].value <= 99
          ) {
            currentBodyFatPercent = bodyFatMetrics[0].value;
          }
        } catch (e) {
          console.warn('Could not fetch height/bodyFat for target metrics:', e);
        }

        const fiber = fiberFromCalories(parsedPlan.targetCalories);
        const targetBMI =
          heightM > 0 ? bmiFromWeightAndHeightM(parsedPlan.projectedWeightKg, heightM) : 0;

        let targetBodyFat = 0;
        if (eatingPhase === 'cut' && currentBodyFatPercent != null) {
          targetBodyFat = estimateTargetBodyFatWhenCutting(
            parsedPlan.currentWeightKg,
            parsedPlan.projectedWeightKg,
            currentBodyFatPercent
          );
        } else if (eatingPhase === 'maintain' && currentBodyFatPercent != null) {
          targetBodyFat = currentBodyFatPercent;
        }

        const bodyFatForFfmi = targetBodyFat > 0 ? targetBodyFat : (currentBodyFatPercent ?? 0);
        const targetFFMI =
          heightM > 0 && bodyFatForFfmi > 0
            ? ffmiFromWeightHeightAndBodyFat(parsedPlan.projectedWeightKg, heightM, bodyFatForFfmi)
            : 0;

        await NutritionGoalService.saveGoals({
          totalCalories: parsedPlan.targetCalories,
          protein: parsedPlan.protein,
          carbs: parsedPlan.carbs,
          fats: parsedPlan.fats,
          fiber,
          eatingPhase: eatingPhase as 'cut' | 'maintain' | 'bulk',
          targetWeight: parsedPlan.projectedWeightKg,
          targetBodyFat,
          targetBMI,
          targetFFMI,
          targetDate: Date.now() + parsedPlan.projectionDays * 24 * 60 * 60 * 1000,
        });

        // clear the temporary plan storage to avoid stale data
        try {
          await AsyncStorage.removeItem(TEMP_NUTRITION_PLAN);
        } catch (e) {
          console.warn('Failed to clear temp nutrition plan:', e);
        }
      }

      router.push('/onboarding/personal-info');
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      showSnackbar('error', t('nutritionGoals.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state for manual flow
  if (!aiGenerated && isLoadingGoal) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </MasterLayout>
    );
  }

  // Format calorie number with comma separator
  const formattedCalories = displayData ? displayData.targetCalories.toLocaleString() : '0';

  // Whether we have a meaningful calorie range from body fat uncertainty
  const hasCalorieRange =
    displayData?.minTargetCalories !== undefined &&
    displayData?.maxTargetCalories !== undefined &&
    displayData.minTargetCalories !== displayData.maxTargetCalories;

  const formattedCalorieRange = hasCalorieRange
    ? `${displayData!.minTargetCalories!.toLocaleString()} – ${displayData!.maxTargetCalories!.toLocaleString()}`
    : null;

  // Formatted weight change with sign
  const formattedWeightChange = displayData
    ? `${displayData.weightChange > 0 ? '+' : ''}${displayData.weightChange.toFixed(1)}`
    : '0';

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.padding['xl'] }}
      >
        <View className="px-6 py-2" />
        <View className="flex-col items-center px-6 pb-8">
          {/* Header */}
          <View className="mb-8 items-center text-center">
            {aiGenerated ? (
              <View
                className="mb-3 flex-row items-center gap-1.5 rounded-full px-3 py-1"
                style={{ backgroundColor: theme.colors.accent.primary10 }}
              >
                <MaterialIcons name="auto-awesome" size={14} color={theme.colors.accent.primary} />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{
                    color: theme.colors.accent.primary,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                  }}
                >
                  {t('nutritionGoals.results.aiCalculationComplete')}
                </Text>
              </View>
            ) : null}

            <Text
              className="mb-2 text-center text-[32px] font-bold leading-[1.1]"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize['3xl'],
                fontWeight: theme.typography.fontWeight.black,
              }}
            >
              {t('nutritionGoals.results.your')}{' '}
              <Text
                style={{
                  color: theme.colors.status.indigoLight,
                  fontSize: theme.typography.fontSize['3xl'],
                  fontWeight: theme.typography.fontWeight.black,
                }}
              >
                {t('nutritionGoals.results.nutritionPlan')}
              </Text>
            </Text>

            <Text
              className="max-w-[300px] text-center text-[15px] font-normal leading-relaxed"
              style={{
                color: theme.colors.text.secondary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.normal,
              }}
            >
              {aiGenerated
                ? t('nutritionGoals.results.aiDescription')
                : t('nutritionGoals.results.manualDescription')}
            </Text>
          </View>

          {/* Daily Calorie Target Card */}
          <View
            className="relative mb-6 w-full overflow-hidden rounded-3xl p-8"
            style={{
              borderRadius: theme.borderRadius['3xl'],
              padding: theme.spacing.padding['2xl'],
              marginBottom: theme.spacing.margin.lg,
            }}
          >
            <LinearGradient
              colors={theme.colors.gradients.cta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: theme.borderRadius['3xl'],
              }}
            />

            {/* Bolt Icon */}
            <View className="absolute right-0 top-0 p-4">
              <MaterialIcons
                name="bolt"
                size={96}
                color={theme.colors.text.white}
                style={{ opacity: 0.2 }}
              />
            </View>

            <View className="relative z-10">
              <Text
                className="mb-1 text-sm font-semibold uppercase tracking-widest text-white/80"
                style={{
                  color: `${theme.colors.text.white}CC`,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.semibold,
                  letterSpacing: 2,
                }}
              >
                {t('nutritionGoals.results.dailyCalorieTarget')}
              </Text>

              <View className="flex-row items-baseline gap-2">
                <Text
                  className="text-5xl font-black text-white"
                  style={{
                    color: theme.colors.text.white,
                    fontSize: theme.typography.fontSize['5xl'],
                    fontWeight: theme.typography.fontWeight.black,
                  }}
                >
                  {formattedCalories}
                </Text>
                <Text
                  className="text-xl font-bold text-white/90"
                  style={{
                    color: `${theme.colors.text.white}E6`,
                    fontSize: theme.typography.fontSize.xl,
                    fontWeight: theme.typography.fontWeight.bold,
                  }}
                >
                  {t('nutritionGoals.results.kcal')}
                </Text>
              </View>

              {hasCalorieRange ? (
                <View className="mt-2">
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: `${theme.colors.text.white}B3`,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    {t('nutritionGoals.results.calorieRange', {
                      range: formattedCalorieRange,
                    })}
                  </Text>
                  <Text
                    className="mt-1 text-xs"
                    style={{
                      color: `${theme.colors.text.white}80`,
                      fontSize: theme.typography.fontSize.xxs,
                      fontWeight: theme.typography.fontWeight.normal,
                    }}
                  >
                    {t('nutritionGoals.results.bodyFatUncertaintyNote')}
                  </Text>
                </View>
              ) : null}

              {displayData?.goalLabel ? (
                <View
                  className="mt-4 flex-row items-center justify-between border-t pt-4"
                  style={{
                    borderTopColor: `${theme.colors.text.white}1A`,
                    borderTopWidth: 1,
                    marginTop: theme.spacing.margin.md,
                    paddingTop: theme.spacing.padding.md,
                  }}
                >
                  <Text
                    className="text-xs font-medium text-white/70"
                    style={{
                      color: `${theme.colors.text.white}B3`,
                      fontSize: theme.typography.fontSize.xxs,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    {t(`nutritionGoals.results.goalLabels.${displayData.goalLabel}`)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Macros Grid */}
          <View className="mb-8 w-full flex-row gap-3">
            {/* Protein */}
            <GenericCard
              variant="default"
              size="sm"
              containerStyle={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.padding.md,
              }}
            >
              <Text
                className="mb-1 text-center text-[10px] font-bold uppercase tracking-tighter text-indigo-400"
                style={{
                  color: theme.colors.status.indigo,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: -0.5,
                  marginBottom: theme.spacing.margin.xs,
                }}
              >
                {t('nutritionGoals.results.protein')}
              </Text>
              <Text
                className="text-center text-lg font-bold leading-tight text-white"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                {displayData?.protein ?? 0}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {displayData?.proteinPct ?? 0}%
              </Text>
            </GenericCard>

            {/* Carbs */}
            <GenericCard
              variant="default"
              size="sm"
              containerStyle={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.padding.md,
              }}
            >
              <Text
                className="text-primary mb-1 text-center text-[10px] font-bold uppercase tracking-tighter"
                style={{
                  color: theme.colors.accent.primary,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: -0.5,
                  marginBottom: theme.spacing.margin.xs,
                }}
              >
                {t('nutritionGoals.results.carbs')}
              </Text>
              <Text
                className="text-center text-lg font-bold leading-tight text-white"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                {displayData?.carbs ?? 0}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {displayData?.carbsPct ?? 0}%
              </Text>
            </GenericCard>

            {/* Fats */}
            <GenericCard
              variant="default"
              size="sm"
              containerStyle={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: theme.spacing.padding.md,
              }}
            >
              <Text
                className="mb-1 text-center text-[10px] font-bold uppercase tracking-tighter text-pink-400"
                style={{
                  color: theme.colors.status.pink500,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.bold,
                  letterSpacing: -0.5,
                  marginBottom: theme.spacing.margin.xs,
                }}
              >
                {t('nutritionGoals.results.fats')}
              </Text>
              <Text
                className="text-center text-lg font-bold leading-tight text-white"
                style={{
                  color: theme.colors.text.primary,
                  fontSize: theme.typography.fontSize.lg,
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                {displayData?.fats ?? 0}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {displayData?.fatsPct ?? 0}%
              </Text>
            </GenericCard>
          </View>

          {/* 90-Day Projection Card (only for AI-generated plans) */}
          {displayData?.hasProjection ? (
            <GenericCard
              variant="default"
              containerStyle={{
                width: '100%',
                borderWidth: 1,
                borderColor: `${theme.colors.accent.primary}33`,
                padding: theme.spacing.padding.sm,
              }}
            >
              <View className="mb-2 flex-row items-center gap-2">
                <MaterialIcons
                  name={trendingIcon as 'trending-down' | 'trending-up'}
                  size={18}
                  color={theme.colors.accent.primary}
                />
                <Text
                  className="text-sm font-bold text-white"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.bold,
                  }}
                >
                  {t('nutritionGoals.results.projectionTitle', {
                    days: displayData.projectionDays,
                  })}
                </Text>
              </View>

              <View className="flex-col items-center justify-center py-1">
                <Text
                  className="mb-1 text-xs font-medium text-slate-400"
                  style={{
                    color: theme.colors.text.secondary,
                    fontSize: theme.typography.fontSize.xxs,
                    fontWeight: theme.typography.fontWeight.medium,
                    marginBottom: theme.spacing.margin.xs,
                  }}
                >
                  {weightChangeLabel}
                </Text>
                <View className="flex-row items-baseline">
                  <Text
                    className="mr-2 text-4xl font-black tracking-tight text-white"
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: theme.typography.fontSize['4xl'],
                      fontWeight: theme.typography.fontWeight.black,
                      letterSpacing: -0.5,
                    }}
                  >
                    {formattedWeightChange}
                  </Text>
                  <Text
                    className="text-primary text-xl font-bold"
                    style={{
                      color: theme.colors.accent.primary,
                      fontSize: theme.typography.fontSize.xl,
                      fontWeight: theme.typography.fontWeight.bold,
                    }}
                  >
                    kg
                  </Text>
                </View>
                <Text
                  className="max-w-[200px] text-center text-[11px] text-slate-500"
                  style={{
                    color: theme.colors.text.tertiary,
                    fontSize: theme.typography.fontSize.xxs,
                    fontWeight: theme.typography.fontWeight.medium,
                    textAlign: 'center',
                    maxWidth: 200,
                  }}
                >
                  {t('nutritionGoals.results.projectionDescription', {
                    weight: displayData.projectedWeight.toFixed(1),
                    days: displayData.projectionDays,
                  })}
                </Text>
              </View>

              {/* Projection line chart */}
              {projectionData.length > 0 ? (
                <View className="relative mt-0 w-full">
                  <LineChart
                    data={projectionData.map(({ x, y }) => ({ x, y }))}
                    height={96}
                    chartHeight={72}
                    marginTop={-12}
                    lineColor={theme.colors.accent.primary}
                    areaColor={theme.colors.accent.primary30}
                    lineWidth={3}
                    showLastPoint={true}
                    lastPointSize={6}
                    lastPointStrokeColor={theme.colors.background.card}
                    xDomain={[0, projectionLength - 1]}
                    yDomain={[
                      Math.floor(Math.min(...projectionData.map((d) => d.y)) * 0.95),
                      Math.ceil(Math.max(...projectionData.map((d) => d.y)) * 1.05),
                    ]}
                    marginBottom={4}
                  />
                </View>
              ) : null}
            </GenericCard>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <BottomButtonWrapper>
        <Button
          label={aiGenerated ? t('nutritionGoals.acceptAndContinue') : t('nutritionGoals.continue')}
          variant="gradientCta"
          width="full"
          size="md"
          icon={() => (
            <MaterialIcons name="arrow-forward" size={20} color={theme.colors.text.white} />
          )}
          iconPosition="right"
          onPress={handleAccept}
          loading={isSaving}
          disabled={isSaving}
          style={{ marginBottom: theme.spacing.margin.sm }}
        />

        {aiGenerated ? (
          <>
            <View style={{ height: theme.spacing.margin.md }} />
            <Button
              label={t('nutritionGoals.adjustGoalsManually')}
              variant="outline"
              width="full"
              size="sm"
              onPress={() => {
                // await AsyncStorage.removeItem(TEMP_NUTRITION_PLAN);
                router.push('/onboarding/nutrition-goals');
              }}
            />
          </>
        ) : null}
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
