import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'hooks/useTheme';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { GenericCard } from '@/components/cards/GenericCard';
import { LineChart } from '@/components/charts/LineChart';
import { MasterLayout } from '@/components/MasterLayout';
import { Button } from '@/components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '@/constants/misc';
import { type EatingPhase } from '@/database/models';
import {
  NutritionCheckinService,
  NutritionGoalService,
  UserMetricService,
} from '@/database/services';
import { useCurrentNutritionGoal } from '@/hooks/useCurrentNutritionGoal';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import {
  bmiFromWeightAndHeightM,
  estimateTargetBodyFatWhenCutting,
  ffmiFromWeightHeightAndBodyFat,
  fiberFromCalories,
  generateWeeklyCheckins,
  inchesToCm,
  NutritionPlan,
} from '@/utils/nutritionCalculator';
import { roundToDecimalPlaces } from '@/utils/roundDecimal';
import { showSnackbar } from '@/utils/snackbarService';
import { kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';

export default function NutritionGoalsResults() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const { formatDecimal, formatInteger } = useFormatAppNumber();

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
              if (isMounted) {
                setStoredPlan(parsed);
              }
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
      const weightChange = roundToDecimalPlaces(
        parsedPlan.projectedWeightKg - parsedPlan.currentWeightKg,
        1
      );
      return {
        targetCalories: parsedPlan.targetCalories,
        tdee: parsedPlan.tdee,
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
        weightChange,
        projectionDays: parsedPlan.projectionDays,
        hasProjection: true,
        dailyCalorieDeficit: parsedPlan.dailyCalorieDeficit,
        dailyCalorieSurplus: parsedPlan.dailyCalorieSurplus,
        estimatedFatChangeKg: parsedPlan.estimatedFatChangeKg,
        estimatedLeanChangeKg: parsedPlan.estimatedLeanChangeKg,
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

  // Build projection chart data (marker in display unit)
  const projectionLength = 10;
  const projectionData = useMemo(() => {
    if (!displayData?.hasProjection) {
      return [];
    }

    const { startWeight, projectedWeight } = displayData;
    return Array.from({ length: projectionLength }).map((_, i) => {
      const progress = i / (projectionLength - 1);
      const weightKg = startWeight + (projectedWeight - startWeight) * progress;
      const weightDisplay = kgToDisplay(weightKg, units);
      return {
        marker: `${formatDecimal(weightDisplay, 1)} ${t(weightUnitKey)}`,
        x: i,
        y: roundToDecimalPlaces(weightKg, 1),
      };
    });
  }, [displayData, units, t, weightUnitKey, formatDecimal]);

  // Determine eating phase from the calorie delta
  const eatingPhase = useMemo<EatingPhase>(() => {
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

  const trendingIcon =
    displayData && displayData.weightChange > 0 ? 'trending-up' : 'trending-down';

  const isMaintenance = displayData != null && displayData.weightChange === 0;

  const maintenanceMuscleRange = useMemo(() => {
    const exp = parsedPlan?.liftingExperience ?? 'intermediate';
    const ranges: Record<string, string> = {
      beginner: '0.5–2',
      intermediate: '0.25–1',
      advanced: '0.1–0.5',
    };

    return ranges[exp] ?? ranges.intermediate;
  }, [parsedPlan?.liftingExperience]);

  const maintenanceMuscleRangeDisplay = useMemo(() => {
    const parts = maintenanceMuscleRange.split('–').map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
      return maintenanceMuscleRange;
    }

    const lowDisplay = kgToDisplay(parts[0], units);
    const highDisplay = kgToDisplay(parts[1], units);
    const fmt = (n: number) =>
      n % 1 === 0 ? formatInteger(n, { useGrouping: false }) : formatDecimal(n, 1);
    return `${fmt(lowDisplay)}–${fmt(highDisplay)}`;
  }, [maintenanceMuscleRange, units, formatDecimal, formatInteger]);

  // Helper functions to format weight values consistently
  const formatProjectedWeight = useMemo(() => {
    if (!displayData) {
      return '0';
    }

    const d = kgToDisplay(displayData.projectedWeight, units);
    return d % 1 === 0 ? formatInteger(d, { useGrouping: false }) : formatDecimal(d, 1);
  }, [displayData, units, formatDecimal, formatInteger]);

  const formatEstimatedFatChange = useMemo(() => {
    if (!displayData) {
      return '0';
    }

    const d = kgToDisplay(displayData.estimatedFatChangeKg ?? 0, units);
    return d % 1 === 0 ? formatInteger(d, { useGrouping: false }) : formatDecimal(d, 1);
  }, [displayData, units, formatDecimal, formatInteger]);

  const formatEstimatedLeanChange = useMemo(() => {
    if (!displayData) {
      return '0';
    }

    const d = kgToDisplay(displayData.estimatedLeanChangeKg ?? 0, units);
    return d % 1 === 0 ? formatInteger(d, { useGrouping: false }) : formatDecimal(d, 1);
  }, [displayData, units, formatDecimal, formatInteger]);

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
          const [latestHeight, latestBodyFat] = await Promise.all([
            UserMetricService.getLatest('height'),
            UserMetricService.getLatest('body_fat'),
          ]);
          const heightDec = await latestHeight?.getDecrypted();
          const bodyFatDec = await latestBodyFat?.getDecrypted();

          if (heightDec) {
            const rawHeight = heightDec.value;
            const heightUnit = heightDec.unit;
            const heightCm = heightUnit === 'in' ? inchesToCm(rawHeight) : rawHeight;
            heightM = convert(heightCm, 'cm').to('m') as number;
          }

          if (bodyFatDec && bodyFatDec.value >= 1 && bodyFatDec.value <= 99) {
            currentBodyFatPercent = bodyFatDec.value;
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

        const startDate = Date.now();
        const targetDate = localDayKeyPlusCalendarDays(
          localDayStartMs(new Date(startDate)),
          parsedPlan.projectionDays
        );

        const savedGoal = await NutritionGoalService.saveGoals({
          totalCalories: parsedPlan.targetCalories,
          protein: parsedPlan.protein,
          carbs: parsedPlan.carbs,
          fats: parsedPlan.fats,
          fiber,
          eatingPhase: eatingPhase,
          targetWeight: parsedPlan.projectedWeightKg,
          targetBodyFat,
          targetBMI,
          targetFFMI,
          targetDate,
        });

        if (parsedPlan.projectionDays > 7) {
          const weeklyData = generateWeeklyCheckins(
            parsedPlan,
            startDate,
            targetDate,
            heightM,
            currentBodyFatPercent
          );

          if (weeklyData.length > 0) {
            await NutritionCheckinService.createBatch(savedGoal.id, weeklyData);
          }
        }
        // TEMP_NUTRITION_PLAN is cleared when onboarding completes (onboardingService.setOnboardingCompleted)
      }

      router.navigate('/onboarding/personal-info');
    } catch (error) {
      console.error('Error saving nutrition goals:', error);
      showSnackbar('error', t('nutritionGoals.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  // Formatted weight change with sign, numeric only (unit shown separately)
  const formattedWeightChange = useMemo(() => {
    if (!displayData) {
      return '0';
    }

    const startDisplay = kgToDisplay(displayData.startWeight, units);
    const endDisplay = kgToDisplay(displayData.startWeight + displayData.weightChange, units);
    const changeDisplay = endDisplay - startDisplay;
    const sign = changeDisplay > 0 ? '+' : '';
    const body =
      changeDisplay % 1 === 0
        ? formatInteger(changeDisplay, { useGrouping: false })
        : formatDecimal(changeDisplay, 1);
    return `${sign}${body}`;
  }, [displayData, units, formatDecimal, formatInteger]);

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

  // Whether we have a meaningful calorie range from body fat uncertainty
  const hasCalorieRange =
    displayData?.minTargetCalories !== undefined &&
    displayData?.maxTargetCalories !== undefined &&
    displayData.minTargetCalories !== displayData.maxTargetCalories;

  const formattedCalories = displayData ? formatInteger(displayData.targetCalories) : '0';

  const formattedCalorieRange = hasCalorieRange
    ? `${formatInteger(displayData!.minTargetCalories!)} – ${formatInteger(displayData!.maxTargetCalories!)}`
    : null;

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView
        ref={scrollViewRef}
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
            ) : (
              <View
                className="mb-3 flex-row items-center gap-1.5 rounded-full px-3 py-1"
                style={{ backgroundColor: theme.colors.status.indigo10 }}
              >
                <MaterialIcons name="tune" size={14} color={theme.colors.status.indigoLight} />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{
                    color: theme.colors.status.indigoLight,
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                  }}
                >
                  {t('nutritionGoals.results.manualPlanBadge')}
                </Text>
              </View>
            )}

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

              {displayData?.dailyCalorieDeficit != null ||
              displayData?.dailyCalorieSurplus != null ? (
                <View className="mt-3">
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: `${theme.colors.text.white}E6`,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    {displayData.dailyCalorieDeficit != null
                      ? t('nutritionGoals.results.dailyDeficit', {
                          kcal: formatInteger(displayData.dailyCalorieDeficit),
                        })
                      : t('nutritionGoals.results.dailySurplus', {
                          kcal: formatInteger(displayData.dailyCalorieSurplus!),
                        })}
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
                {/*TODO: use i18n*/}
                {formatInteger(displayData?.protein ?? 0)}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {formatInteger(displayData?.proteinPct ?? 0)}%
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
                {/*TODO: use i18n*/}
                {formatInteger(displayData?.carbs ?? 0)}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {formatInteger(displayData?.carbsPct ?? 0)}%
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
                {/*TODO: use i18n*/}
                {formatInteger(displayData?.fats ?? 0)}g
              </Text>
              <Text
                className="text-center text-[11px] font-medium text-slate-500"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {formatInteger(displayData?.fatsPct ?? 0)}%
              </Text>
            </GenericCard>
          </View>

          {/* Macro Sources Note */}
          {aiGenerated ? (
            <View className="mb-6 w-full px-2">
              <Text
                className="text-center text-[10px] font-normal italic"
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: theme.typography.fontWeight.normal,
                  lineHeight: 14,
                }}
              >
                {t('nutritionGoals.results.macroSourcesNote')}
              </Text>
            </View>
          ) : null}

          {/* Manual plan: macro split bar + tips (when aiGenerated is false) */}
          {!aiGenerated && displayData ? (
            <>
              <View className="mb-6 w-full">
                <Text
                  className="mb-2 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{
                    color: theme.colors.text.tertiary,
                    fontSize: theme.typography.fontSize.xxs,
                    fontWeight: theme.typography.fontWeight.semibold,
                    letterSpacing: 1.5,
                    marginBottom: theme.spacing.margin.sm,
                  }}
                >
                  {t('nutritionGoals.results.macroSplit')}
                </Text>
                <View
                  className="h-3 w-full flex-row overflow-hidden rounded-full"
                  style={{
                    borderRadius: theme.borderRadius.full,
                    backgroundColor: theme.colors.background.card,
                  }}
                >
                  <View
                    style={{
                      width: `${displayData.proteinPct ?? 0}%`,
                      backgroundColor: theme.colors.status.indigo,
                      minWidth: displayData.proteinPct ? 4 : 0,
                    }}
                  />
                  <View
                    style={{
                      width: `${displayData.carbsPct ?? 0}%`,
                      backgroundColor: theme.colors.accent.primary,
                      minWidth: displayData.carbsPct ? 4 : 0,
                    }}
                  />
                  <View
                    style={{
                      width: `${displayData.fatsPct ?? 0}%`,
                      backgroundColor: theme.colors.status.pink500,
                      minWidth: displayData.fatsPct ? 4 : 0,
                    }}
                  />
                </View>
                <View className="mt-2 flex-row justify-between px-0.5">
                  <Text
                    className="text-[10px] font-medium"
                    style={{
                      color: theme.colors.status.indigo,
                      fontSize: theme.typography.fontSize.xxs,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    P {displayData.proteinPct ?? 0}%
                  </Text>
                  <Text
                    className="text-[10px] font-medium"
                    style={{
                      color: theme.colors.accent.primary,
                      fontSize: theme.typography.fontSize.xxs,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    C {displayData.carbsPct ?? 0}%
                  </Text>
                  <Text
                    className="text-[10px] font-medium"
                    style={{
                      color: theme.colors.status.pink500,
                      fontSize: theme.typography.fontSize.xxs,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}
                  >
                    F {displayData.fatsPct ?? 0}%
                  </Text>
                </View>
              </View>

              <GenericCard
                variant="default"
                containerStyle={{
                  width: '100%',
                  marginBottom: theme.spacing.margin.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.accent.primary + '22',
                  padding: theme.spacing.padding.md,
                }}
              >
                <View className="flex-row items-start gap-3">
                  <View
                    className="mt-0.5 rounded-full p-1.5"
                    style={{ backgroundColor: theme.colors.accent.primary10 }}
                  >
                    <MaterialIcons
                      name="lightbulb-outline"
                      size={18}
                      color={theme.colors.accent.primary}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="mb-1 text-sm font-bold"
                      style={{
                        color: theme.colors.text.primary,
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.bold,
                      }}
                    >
                      {t('nutritionGoals.results.manualTipsTitle')}
                    </Text>
                    <Text
                      className="text-xs leading-relaxed"
                      style={{
                        color: theme.colors.text.secondary,
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.normal,
                        lineHeight: 18,
                      }}
                    >
                      {t('nutritionGoals.results.manualTipsDescription')}
                    </Text>
                  </View>
                </View>
              </GenericCard>
            </>
          ) : null}

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
                  name={
                    isMaintenance
                      ? 'fitness-center'
                      : (trendingIcon as 'trending-down' | 'trending-up')
                  }
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

              {isMaintenance ? (
                <View className="flex-col items-center justify-center py-2">
                  <Text
                    className="mb-2 text-base font-semibold text-white"
                    style={{
                      color: theme.colors.text.primary,
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginBottom: theme.spacing.margin.sm,
                    }}
                  >
                    {t('nutritionGoals.results.projectionMaintenanceTitle')}
                  </Text>
                  <Text
                    className="max-w-[280px] text-center text-sm leading-relaxed text-slate-400"
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.normal,
                      textAlign: 'center',
                      lineHeight: 20,
                    }}
                  >
                    {t('nutritionGoals.results.projectionMaintenanceMuscleGain', {
                      days: displayData.projectionDays,
                      range: maintenanceMuscleRangeDisplay,
                      unit: t(weightUnitKey),
                    })}
                  </Text>
                </View>
              ) : (
                <>
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
                        {t(weightUnitKey)}
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
                        value: formatProjectedWeight,
                        unit: t(weightUnitKey),
                        days: displayData.projectionDays,
                      })}
                    </Text>

                    {displayData.estimatedFatChangeKg != null ||
                    displayData.estimatedLeanChangeKg != null ? (
                      <View
                        className="mt-3 items-center"
                        style={{ marginTop: theme.spacing.margin.sm }}
                      >
                        <View className="flex-row justify-center gap-4">
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: theme.colors.text.secondary,
                              fontSize: theme.typography.fontSize.xs,
                              fontWeight: theme.typography.fontWeight.medium,
                            }}
                          >
                            {t('nutritionGoals.results.projectionFat', {
                              value: formatEstimatedFatChange,
                              unit: t(weightUnitKey),
                            })}
                          </Text>
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: theme.colors.text.secondary,
                              fontSize: theme.typography.fontSize.xs,
                              fontWeight: theme.typography.fontWeight.medium,
                            }}
                          >
                            {t('nutritionGoals.results.projectionLean', {
                              value: formatEstimatedLeanChange,
                              unit: t(weightUnitKey),
                            })}
                          </Text>
                        </View>
                        <Text
                          className="mt-1.5 max-w-[260px] text-center text-[10px]"
                          style={{
                            color: theme.colors.text.tertiary,
                            fontSize: theme.typography.fontSize.xxs,
                            marginTop: theme.spacing.margin.xs,
                            textAlign: 'center',
                          }}
                        >
                          {t('nutritionGoals.results.leanMassClarification')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

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
                        onInteractionStart={() =>
                          scrollViewRef.current?.setNativeProps({ scrollEnabled: false })
                        }
                        onInteractionEnd={() =>
                          scrollViewRef.current?.setNativeProps({ scrollEnabled: true })
                        }
                      />
                    </View>
                  ) : null}

                  <Text
                    className="mt-3 text-center text-[10px]"
                    style={{
                      color: theme.colors.text.tertiary,
                      fontSize: theme.typography.fontSize.xxs,
                      marginTop: theme.spacing.margin.sm,
                      textAlign: 'center',
                    }}
                  >
                    {t('nutritionGoals.results.formulasBasedOn')}
                  </Text>
                </>
              )}
            </GenericCard>
          ) : null}
        </View>
        <View pointerEvents="none" style={{ height: theme.spacing.margin['7xl'] }} />
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
                router.navigate({
                  pathname: '/onboarding/nutrition-goals',
                  params: { isAdjusting: 'true' },
                });
              }}
            />
            <View style={{ height: theme.spacing.margin.md }} />
          </>
        ) : null}
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
