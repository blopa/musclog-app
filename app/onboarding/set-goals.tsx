import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from 'hooks/useTheme';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { GradientText } from '../../components/GradientText';
import { MasterLayout } from '../../components/MasterLayout';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { Button } from '../../components/theme/Button';
import { TEMP_NUTRITION_PLAN } from '../../constants/auth';
import { database } from '../../database';
import UserMetric from '../../database/models/UserMetric';
import { UserService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import {
  calculateNutritionPlan,
  inchesToCm,
  lbsToKg,
  normalizeFitnessGoal,
  normalizeWeightGoal,
  type NutritionCalculatorInput,
} from '../../utils/nutritionCalculator';
import { showSnackbar } from '../../utils/snackbarService';

const ILLUSTRATION_VIEWBOX = 400;

// Orbital Illustration Component – matches design: glass nodes, dashed gradient lines, orbit paths
function OrbitalIllustration() {
  const theme = useTheme();
  const [layoutSize, setLayoutSize] = useState(0);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      const size = Math.min(width, height);
      if (size > 0) setLayoutSize(size);
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
      className="relative mb-2 mt-2 aspect-square w-full items-center justify-center"
      onLayout={onLayout}
    >
      {/* Background blurs (blur-[100px] equivalent) */}
      <View
        className="absolute h-64 w-64 rounded-full"
        style={{
          backgroundColor: `${theme.colors.status.indigo}33`,
          width: 256,
          height: 256,
          borderRadius: 128,
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
            borderRadius: 64,
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
              marginLeft: 16,
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
            style={{ marginBottom: 2 }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: 10,
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
        style={[glassNodeStyle, { top: '20%', right: '8%', borderRadius: 32 }]}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <MaterialIcons
            name="fitness-center"
            size={30}
            color={theme.colors.status.indigoLight}
            style={{ marginBottom: 4 }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: 10,
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
            style={{ marginBottom: 2 }}
          />
          <Text
            className="text-[10px] font-bold tracking-wider"
            style={{
              color: theme.colors.text.primary,
              fontSize: 10,
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
  const { units } = useSettings();
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculateForMe = useCallback(async () => {
    setIsCalculating(true);
    try {
      const user = await UserService.getCurrentUser();
      if (!user) {
        showSnackbar('error', t('onboarding.setGoals.missingData'));
        return;
      }

      // Fetch latest weight metric
      const weightMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', 'weight'),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc)
        )
        .fetch();

      // Fetch latest height metric
      const heightMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', 'height'),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc)
        )
        .fetch();

      // Fetch latest body fat metric
      const bodyFatMetrics = await database
        .get<UserMetric>('user_metrics')
        .query(
          Q.where('type', 'bodyFat'),
          Q.where('deleted_at', Q.eq(null)),
          Q.sortBy('date', Q.desc)
        )
        .fetch();

      const rawWeight = weightMetrics.length > 0 ? weightMetrics[0].value : 0;
      const rawHeight = heightMetrics.length > 0 ? heightMetrics[0].value : 0;
      const rawBodyFat = bodyFatMetrics.length > 0 ? bodyFatMetrics[0].value : undefined;

      if (rawWeight <= 0 || rawHeight <= 0) {
        showSnackbar('error', t('onboarding.setGoals.missingData'));
        return;
      }

      // Convert to metric if stored in imperial
      const weightKg = units === 'imperial' ? lbsToKg(rawWeight) : rawWeight;
      const heightCm = units === 'imperial' ? inchesToCm(rawHeight) : rawHeight;
      const age = user.getAge();

      const input: NutritionCalculatorInput = {
        gender: user.gender,
        weightKg,
        heightCm,
        age: age > 0 ? age : 25, // fallback if DOB is placeholder
        activityLevel: (user.activityLevel || 3) as 1 | 2 | 3 | 4 | 5,
        weightGoal: normalizeWeightGoal(user.weightGoal),
        fitnessGoal: normalizeFitnessGoal(user.fitnessGoal),
        liftingExperience: user.liftingExperience || 'intermediate',
        // Pass body fat when available; calculator uses Katch-McArdle when valid
        ...(rawBodyFat !== undefined &&
          rawBodyFat >= 5 &&
          rawBodyFat <= 60 && { bodyFatPercent: rawBodyFat }),
      };

      const plan = calculateNutritionPlan(input);

      // Persist the AI-generated plan in AsyncStorage instead of passing large route params
      try {
        await AsyncStorage.setItem(TEMP_NUTRITION_PLAN, JSON.stringify(plan));
      } catch (e) {
        console.warn('Failed to persist nutrition plan to AsyncStorage', e);
      }

      // Navigate to the results screen; results screen will read the plan from AsyncStorage
      router.push({
        pathname: '/onboarding/nutrition-goals-results',
        params: {
          aiGenerated: 'true',
        },
      });
    } catch (error) {
      console.error('Error calculating nutrition plan:', error);
      showSnackbar('error', t('onboarding.setGoals.missingData'));
    } finally {
      setIsCalculating(false);
    }
  }, [units, router, t]);

  return (
    <MasterLayout showNavigationMenu={false}>
      {/* Main Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-2 px-6 py-6" />
        <View className="flex-col items-center px-6 pb-8">
          <OrbitalIllustration />

          {/* Header */}
          <Text
            className="mb-4 text-center text-[32px] font-bold leading-[1.1]"
            style={{
              color: theme.colors.text.primary,
              fontSize: 32,
              fontWeight: theme.typography.fontWeight.bold,
            }}
          >
            {t('onboarding.setGoals.title')}{' '}
            <GradientText
              colors={theme.colors.gradients.cta}
              style={{
                fontSize: 32,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {t('onboarding.setGoals.calculation')}
            </GradientText>
          </Text>

          <Text
            className="mb-8 text-center text-[16px] font-normal leading-relaxed"
            style={{
              color: theme.colors.text.secondary,
              fontSize: 16,
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
                  fontSize: 12,
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
                  fontSize: 12,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {t('onboarding.setGoals.dynamicAdjustments')}
              </Text>
            </View>
          </View>
        </View>
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
          onPress={() => {
            router.push('/onboarding/nutrition-goals');
          }}
        />

        <MaybeLaterButton
          onPress={() => {
            router.push('/onboarding/personal-info');
          }}
          text={t('onboarding.healthConnect.maybeLater')}
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
