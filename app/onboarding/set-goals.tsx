import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'hooks/useTheme';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { GradientText } from '@/components/GradientText';
import { MasterLayout } from '@/components/MasterLayout';
import { MaybeLaterButton } from '@/components/MaybeLaterButton';
import { Button } from '@/components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '@/constants/misc';
import { type EatingPhase } from '@/database/models';
import { UserMetricService, UserService } from '@/database/services';
import { useSettings } from '@/hooks/useSettings';
import {
  localDayClosedRangeMaxMs,
  localDayKeyPlusCalendarDaysFromNow,
  localDayStartMs,
} from '@/utils/calendarDate';
import { getHistoricalNutritionParams } from '@/utils/historicalNutritionParams';
import {
  bmiFromWeightAndHeightM,
  calculateNutritionPlan,
  estimateTargetBodyFatWhenCutting,
  ffmiFromWeightHeightAndBodyFat,
  inchesToCm,
  lbsToKg,
  normalizeFitnessGoal,
  normalizeWeightGoal,
  type NutritionCalculatorInput,
  type NutritionPlan,
} from '@/utils/nutritionCalculator';
import { showSnackbar } from '@/utils/snackbarService';

const ILLUSTRATION_VIEWBOX = 400;

// Orbital Illustration Component – matches design: glass nodes, dashed gradient lines, orbit paths
function OrbitalIllustration() {
  const theme = useTheme();
  const [layoutSize, setLayoutSize] = useState(0);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      const size = Math.min(width, height);
      if (size > 0) {
        setLayoutSize(size);
      }
    },
    []
  );

  const glassNodeStyle = {
    backgroundColor: `${theme.colors.text.white}0D` as const,
    borderColor: `${theme.colors.text.white}1A` as const,
    borderWidth: 1,
    shadowColor: theme.colors.text.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 5,
  };

  return (
    <View
      className="relative mb-2 mt-2 w-full items-center justify-center"
      style={{ height: Dimensions.get('window').height * 0.3 }}
      onLayout={onLayout}
    >
      {/* Background blurs (blur-[100px] equivalent) */}
      <View
        className="absolute h-64 w-64 rounded-full"
        style={{
          backgroundColor: `${theme.colors.status.indigo}33`,
          width: 256,
          height: 256,
          borderRadius: theme.borderRadius.full,
          shadowColor: theme.colors.status.indigo,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 100,
          elevation: 0,
        }}
      />

      {/* Central icon – brand gradient, auto_awesome, decorative dots */}
      <View className="relative z-20 h-32 w-32 items-center justify-center">
        <View
          className="absolute inset-0 rounded-full"
          style={{
            backgroundColor: `${theme.colors.status.indigo}33`,
            opacity: 0.2,
            borderRadius: theme.borderRadius.full,
            shadowColor: theme.colors.status.indigo,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 80,
            elevation: 0,
          }}
        />
        <View
          className="relative h-24 w-24 items-center justify-center rounded-3xl"
          style={{
            borderRadius: theme.borderRadius['3xl'],
            shadowColor: theme.colors.status.indigo,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 40,
            elevation: 5,
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
          <MaterialIcons
            name="auto-awesome"
            size={56}
            color={theme.colors.text.white}
            style={{ position: 'relative', zIndex: 1 }}
          />
          <View
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full"
            style={{
              backgroundColor: theme.colors.text.white,
              width: 12,
              height: 12,
              marginTop: -4,
              marginRight: -4,
            }}
          />
          <View
            className="absolute -bottom-2 left-4 h-2 w-2 rounded-full"
            style={{
              backgroundColor: `${theme.colors.accent.primary}80`,
              width: 8,
              height: 8,
              marginBottom: -8,
              marginLeft: theme.spacing.margin.base,
            }}
          />
        </View>
      </View>

      {/* Glass nodes – design: orange KCAL, indigo PROTEIN, emerald MACROS */}
      <View
        className="absolute left-[10%] top-[15%] z-30 h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-2xl"
        style={[
          glassNodeStyle,
          { top: '15%', left: '10%', borderRadius: theme.borderRadius['2xl'] },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <MaterialIcons
            name="local-fire-department"
            size={24}
            color={theme.colors.status.warning}
            style={{ marginBottom: theme.spacing.margin['2'] }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.xxs,
              fontWeight: theme.typography.fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            KCAL
          </Text>
        </View>
      </View>

      <View
        className="absolute right-[8%] top-[20%] z-30 h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-[2rem]"
        style={[
          glassNodeStyle,
          { top: '20%', right: '8%', borderRadius: theme.borderRadius['3xl'] },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <MaterialIcons
            name="fitness-center"
            size={30}
            color={theme.colors.status.indigoLight}
            style={{ marginBottom: theme.spacing.margin.xs }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.xxs,
              fontWeight: theme.typography.fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            PROTEIN
          </Text>
        </View>
      </View>

      <View
        className="absolute bottom-[20%] right-[15%] z-30 h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-2xl"
        style={[
          glassNodeStyle,
          { bottom: '20%', right: '15%', borderRadius: theme.borderRadius['2xl'] },
        ]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <MaterialIcons
            name="eco"
            size={24}
            color={theme.colors.status.emeraldLight}
            style={{ marginBottom: theme.spacing.margin['2'] }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.xxs,
              fontWeight: theme.typography.fontWeight.bold,
              letterSpacing: 2,
            }}
          >
            MACROS
          </Text>
        </View>
      </View>

      {/* Dashed gradient connection lines – design SVG paths (viewBox 0 0 400 400) */}
      {layoutSize > 0 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Svg
            width={layoutSize}
            height={layoutSize}
            viewBox={`0 0 ${ILLUSTRATION_VIEWBOX} ${ILLUSTRATION_VIEWBOX}`}
            fill="none"
            preserveAspectRatio="xMidYMid meet"
          >
            <Defs>
              <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={theme.colors.status.indigo} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={theme.colors.accent.primary} stopOpacity="0.3" />
              </SvgLinearGradient>
            </Defs>
            <Path
              d="M160 140 L110 110"
              stroke="url(#lineGrad)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Path
              d="M240 160 L290 140"
              stroke="url(#lineGrad)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Path
              d="M220 240 L260 280"
              stroke="url(#lineGrad)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

export default function SetGoals() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ weightMetricId?: string; heightMetricId?: string }>();
  const { units } = useSettings();
  const [isCalculating, setIsCalculating] = useState(false);

  /** Fetch user + metrics, calculate plan, save to AsyncStorage. Returns plan or null. */
  const calculateAndStorePlan = useCallback(async () => {
    const user = await UserService.getCurrentUser();
    if (!user) {
      return null;
    }

    let weightKg: number;
    let heightCm: number;

    if (params?.weightMetricId && params?.heightMetricId) {
      const [weightMetric, heightMetric] = await Promise.all([
        UserMetricService.getMetricById(params.weightMetricId),
        UserMetricService.getMetricById(params.heightMetricId),
      ]);
      const [weightDec, heightDec] = await Promise.all([
        weightMetric?.getDecrypted(),
        heightMetric?.getDecrypted(),
      ]);
      const w = weightDec?.value ?? 0;
      const h = heightDec?.value ?? 0;
      if (w > 0 && h > 0) {
        weightKg = w;
        heightCm = h;
      } else {
        return null;
      }
    } else {
      const [latestWeight, latestHeight] = await Promise.all([
        UserMetricService.getLatest('weight'),
        UserMetricService.getLatest('height'),
      ]);
      const [weightDec, heightDec] = await Promise.all([
        latestWeight?.getDecrypted(),
        latestHeight?.getDecrypted(),
      ]);

      let rawWeight = weightDec?.value ?? 0;
      let rawHeight = heightDec?.value ?? 0;

      const todayStart = localDayStartMs(new Date());
      const todayEnd = localDayClosedRangeMaxMs(new Date());
      if (rawWeight <= 0) {
        const todayWeights = await UserMetricService.getMetricsHistory(
          'weight',
          { startDate: todayStart, endDate: todayEnd },
          10
        );
        for (const m of todayWeights) {
          const d = await m.getDecrypted();
          if (d.value > 0) {
            rawWeight = d.value;
            break;
          }
        }
      }

      if (rawHeight <= 0) {
        const todayHeights = await UserMetricService.getMetricsHistory(
          'height',
          { startDate: todayStart, endDate: todayEnd },
          10
        );
        for (const m of todayHeights) {
          const d = await m.getDecrypted();
          if (d.value > 0) {
            rawHeight = d.value;
            break;
          }
        }
      }

      if (rawWeight <= 0 || rawHeight <= 0) {
        return null;
      }

      weightKg = rawWeight;
      heightCm = rawHeight;
    }

    const latestBodyFat = await UserMetricService.getLatest('body_fat');
    const rawBodyFat = latestBodyFat ? (await latestBodyFat.getDecrypted())?.value : undefined;

    const age = user.getAge();

    const historical = await getHistoricalNutritionParams({});

    const input: NutritionCalculatorInput = {
      gender: user.gender,
      weightKg,
      heightCm,
      age: age > 0 ? age : 25,
      activityLevel: (user.activityLevel || 3) as 1 | 2 | 3 | 4 | 5,
      weightGoal: normalizeWeightGoal(user.weightGoal),
      fitnessGoal: normalizeFitnessGoal(user.fitnessGoal),
      liftingExperience: user.liftingExperience || 'intermediate',
      ...(rawBodyFat !== undefined &&
        rawBodyFat >= 5 &&
        rawBodyFat <= 60 && { bodyFatPercent: rawBodyFat }),
      ...(historical ?? {}),
    };

    const plan = calculateNutritionPlan(input);
    const heightM = convert(heightCm, 'cm').to('m') as number;

    const targetBMI = heightM > 0 ? bmiFromWeightAndHeightM(plan.projectedWeightKg, heightM) : 0;
    const eatingPhase: EatingPhase =
      plan.targetCalories < plan.tdee
        ? 'cut'
        : plan.targetCalories > plan.tdee
          ? 'bulk'
          : 'maintain';
    let targetBodyFat = 0;
    if (eatingPhase === 'cut' && rawBodyFat != null && rawBodyFat >= 1 && rawBodyFat <= 99) {
      targetBodyFat = estimateTargetBodyFatWhenCutting(
        plan.currentWeightKg,
        plan.projectedWeightKg,
        rawBodyFat
      );
    } else if (eatingPhase === 'maintain' && rawBodyFat != null) {
      targetBodyFat = rawBodyFat;
    }
    const bodyFatForFfmi = targetBodyFat > 0 ? targetBodyFat : (rawBodyFat ?? 0);
    const targetFFMI =
      heightM > 0 && bodyFatForFfmi >= 0
        ? ffmiFromWeightHeightAndBodyFat(plan.projectedWeightKg, heightM, bodyFatForFfmi)
        : 0;

    // Set a goal date for 90 days from now if the eatingPhase is either cut or bulk
    const goalDate =
      eatingPhase === 'cut' || eatingPhase === 'bulk'
        ? new Date(localDayKeyPlusCalendarDaysFromNow(90))
        : undefined;

    const planWithTargets: NutritionPlan = {
      ...plan,
      targetBodyFat,
      targetBMI,
      targetFFMI,
      goalDate,
    };

    try {
      await AsyncStorage.setItem(TEMP_NUTRITION_PLAN, JSON.stringify(planWithTargets));
    } catch (e) {
      console.warn('Failed to persist nutrition plan to AsyncStorage', e);
    }

    return planWithTargets;
  }, [params]);

  const handleCalculateForMe = useCallback(async () => {
    setIsCalculating(true);
    try {
      const plan = await calculateAndStorePlan();
      if (!plan) {
        showSnackbar('error', t('onboarding.setGoals.missingData'));
        return;
      }

      router.navigate({
        pathname: '/onboarding/nutrition-goals-results',
        params: { aiGenerated: 'true' },
      });
    } catch (error) {
      console.error('Error calculating nutrition plan:', error);
      showSnackbar('error', t('onboarding.setGoals.missingData'));
    } finally {
      setIsCalculating(false);
    }
  }, [calculateAndStorePlan, router, t]);

  const handleSetThemMyself = useCallback(async () => {
    setIsCalculating(true);
    try {
      await calculateAndStorePlan();
      router.navigate('/onboarding/nutrition-goals');
    } catch (error) {
      console.error('Error calculating nutrition plan:', error);
      showSnackbar('error', t('onboarding.setGoals.missingData'));
    } finally {
      setIsCalculating(false);
    }
  }, [calculateAndStorePlan, router, t]);

  return (
    <MasterLayout showNavigationMenu={false}>
      {/* Main Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-2 px-6 py-6" />
        <View className="flex-col items-center px-6 pb-8">
          <OrbitalIllustration />

          {/* Header */}
          <View className="mb-4 flex-row flex-wrap items-center justify-center" style={{ gap: 6 }}>
            <Text
              className="text-center text-[32px] font-bold leading-[1.1]"
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize['3xl'],
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {t('onboarding.setGoals.title')}
            </Text>
            <GradientText
              colors={theme.colors.gradients.cta}
              style={{
                fontSize: theme.typography.fontSize['3xl'],
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {t('onboarding.setGoals.calculation')}
            </GradientText>
          </View>

          <Text
            className="mb-8 text-center text-[16px] font-normal leading-relaxed"
            style={{
              color: theme.colors.text.secondary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.normal,
              maxWidth: '90%',
            }}
          >
            {t('onboarding.setGoals.description')}
          </Text>

          {/* Feature Tags */}
          <View className="mb-8 flex flex-wrap justify-center gap-2">
            <View
              className="flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: `${theme.colors.status.indigo}0D`,
                borderColor: `${theme.colors.status.indigo}1A`,
                borderWidth: 1,
              }}
            >
              <MaterialIcons name="restaurant" size={14} color={theme.colors.status.indigo} />
              <Text
                className="text-xs font-medium"
                style={{
                  color: theme.colors.status.indigoLight,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {t('onboarding.setGoals.personalizedMacros')}
              </Text>
            </View>

            <View
              className="flex-row items-center gap-2 rounded-full px-4 py-2"
              style={{
                backgroundColor: `${theme.colors.accent.primary}0D`,
                borderColor: `${theme.colors.accent.primary}1A`,
                borderWidth: 1,
              }}
            >
              <MaterialIcons name="auto-graph" size={14} color={theme.colors.accent.primary} />
              <Text
                className="text-xs font-medium"
                style={{
                  color: theme.colors.accent.secondary,
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {t('onboarding.setGoals.dynamicAdjustments')}
              </Text>
            </View>
          </View>
        </View>
        <View pointerEvents="none" style={{ height: theme.spacing.margin['8xl'] }} />
      </ScrollView>

      {/* Bottom Actions */}
      <BottomButtonWrapper>
        <Button
          label={t('onboarding.setGoals.calculateForMe')}
          variant="gradientCta"
          width="full"
          size="md"
          icon={() => (
            <MaterialIcons name="auto-awesome" size={20} color={theme.colors.text.white} />
          )}
          onPress={handleCalculateForMe}
          loading={isCalculating}
          disabled={isCalculating}
          style={{ marginBottom: theme.spacing.margin.sm }}
        />

        {/* explicit spacer so spacing shows reliably inside the wrapper */}
        <View style={{ height: theme.spacing.margin.sm }} />

        <Button
          label={t('onboarding.setGoals.setThemMyself')}
          variant="secondary"
          width="full"
          size="sm"
          onPress={handleSetThemMyself}
          loading={isCalculating}
          disabled={isCalculating}
        />

        <MaybeLaterButton
          onPress={() => {
            router.navigate('/onboarding/personal-info');
          }}
          text={t('onboarding.healthConnect.maybeLater')}
        />
        <View style={{ height: theme.spacing.margin.md }} />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
