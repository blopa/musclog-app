import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { MasterLayout } from '@/components/MasterLayout';
import { DatePickerInput } from '@/components/modals/DatePickerInput';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { HeightPickerInput } from '@/components/modals/HeightPickerInput';
import { HeightPickerModal } from '@/components/modals/HeightPickerModal';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { StepperInlineInput } from '@/components/theme/StepperInlineInput';
import { TextInput } from '@/components/theme/TextInput';
import { QUICK_SETUP_DATA, TEMP_NUTRITION_PLAN } from '@/constants/misc';
import { type FitnessGoal, type Gender, type WeightGoal } from '@/database/models/User';
import { UserMetricService, UserService } from '@/database/services';
import { getHealthBodyMetricsPrefill } from '@/hooks/useHealthBodyMetricsPrefill';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { calculateNutritionPlan } from '@/utils/nutritionCalculator';
import { getCurrentTimezone } from '@/utils/timezone';
import { displayToCm, displayToKg } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';
import { getDefaultUsernameForGender } from '@/utils/usernameUtils';

type QuickSetupData = {
  gender?: Gender;
  units?: 'metric' | 'imperial';
  fitnessGoal?: FitnessGoal;
  weightGoal?: WeightGoal;
};

export default function QuickBodyStatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { useBfForCalculations } = useSettings();

  const [setupData, setSetupData] = useState<QuickSetupData>({});
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthday, setBirthday] = useState<Date>(localCalendarDayDate(new Date(1990, 0, 1)));
  const [isBirthdayPickerVisible, setIsBirthdayPickerVisible] = useState(false);
  const [isHeightPickerVisible, setIsHeightPickerVisible] = useState(false);
  const [bodyFat, setBodyFat] = useState<number | null>(25);
  const [isSaving, setIsSaving] = useState(false);

  const units = setupData.units ?? 'metric';
  const weightUnit = getWeightUnit(units);
  const heightUnit = getHeightUnit(units);

  useEffect(() => {
    async function load() {
      let resolvedUnits: 'metric' | 'imperial' = 'metric';
      try {
        const raw = await AsyncStorage.getItem(QUICK_SETUP_DATA);
        if (raw) {
          const parsed = JSON.parse(raw) as QuickSetupData;
          setSetupData(parsed);
          resolvedUnits = parsed.units ?? 'metric';
        }
      } catch {
        // ignore
      }

      const prefill = await getHealthBodyMetricsPrefill(resolvedUnits);
      if (prefill.weight) {
        setWeight(prefill.weight);
      }

      if (prefill.height) {
        setHeight(prefill.height);
      }

      if (prefill.bodyFat != null) {
        setBodyFat(prefill.bodyFat);
      }
    }

    load();
  }, []);

  const handleContinue = useCallback(async () => {
    setIsSaving(true);
    try {
      const weightValue = parseFloat(weight);
      const heightValue = parseFloat(height);

      if (!weightValue || !heightValue) {
        return;
      }

      const weightKg = displayToKg(weightValue, units);
      const heightCm = displayToCm(heightValue, units);
      const now = Date.now();
      const timezone = getCurrentTimezone();

      // Save user metrics
      await Promise.all([
        UserMetricService.createMetric({
          type: 'weight',
          value: weightKg,
          unit: 'kg',
          date: now,
          timezone,
        }),
        UserMetricService.createMetric({
          type: 'height',
          value: heightCm,
          unit: 'cm',
          date: now,
          timezone,
        }),
        bodyFat !== null
          ? UserMetricService.createMetric({
              type: 'body_fat',
              value: bodyFat,
              unit: '%',
              date: now,
              timezone,
            })
          : Promise.resolve(),
      ]);

      // Compute age from birthday
      const todayYear = new Date().getFullYear();
      const birthYear = birthday.getFullYear();
      const age = Math.max(1, todayYear - birthYear);

      const gender = setupData.gender ?? 'other';
      const fitnessGoal = setupData.fitnessGoal ?? 'general';
      const weightGoal = setupData.weightGoal ?? 'maintain';

      // Create or update user profile
      const existingUser = await UserService.getCurrentUser();
      const randomName = getDefaultUsernameForGender(gender);
      const dob = localDayStartMs(birthday);

      if (existingUser) {
        await UserService.updateUserProfile({
          gender,
          fitnessGoal,
          weightGoal,
          activityLevel: 2,
          liftingExperience: 'beginner',
          dateOfBirth: dob,
        });
      } else {
        await UserService.initializeUser({
          fullName: randomName,
          dateOfBirth: dob,
          gender,
          fitnessGoal,
          weightGoal,
          activityLevel: 2,
          liftingExperience: 'beginner',
        });
      }

      // Calculate nutrition plan
      const plan = calculateNutritionPlan({
        gender,
        weightKg,
        heightCm,
        age,
        activityLevel: 2,
        weightGoal,
        fitnessGoal,
        liftingExperience: 'beginner',
        bodyFatPercent: useBfForCalculations ? (bodyFat ?? undefined) : undefined,
      });

      await AsyncStorage.setItem(TEMP_NUTRITION_PLAN, JSON.stringify(plan));
      router.navigate(
        `/app/onboarding/musclog-api?nextRoute=${encodeURIComponent('/app/onboarding/nutrition-goals-results?aiGenerated=true&quickSetup=true')}&quickStep=5&quickTotal=6`
      );
    } catch (e) {
      console.error('Error in quick body stats:', e);
    } finally {
      setIsSaving(false);
    }
  }, [weight, height, units, bodyFat, birthday, setupData, router, useBfForCalculations]);

  const isValid = parseFloat(weight) > 0 && parseFloat(height) > 0;

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={4} total={6} />

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          bottomOffset={16}
        >
          <View className="gap-6 px-6 pt-6">
            {/* Title */}
            <View>
              <Text
                className="mb-1 text-3xl font-black tracking-tight"
                style={{ color: theme.colors.text.white }}
              >
                {t('onboarding.quickBodyStats.title')}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {t('onboarding.quickBodyStats.subtitle')}
              </Text>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <TextInput
                  label={t('onboarding.quickBodyStats.weight')}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0.0"
                  keyboardType="numeric"
                  selectTextOnFocus={true}
                  required
                  icon={
                    <Text className="text-center text-sm font-medium text-text-tertiary">
                      {weightUnit}
                    </Text>
                  }
                />
              </View>
              <View className="flex-1">
                {units === 'imperial' ? (
                  <HeightPickerInput
                    label={t('onboarding.quickBodyStats.height')}
                    totalInches={parseFloat(height) || 67}
                    onPress={() => setIsHeightPickerVisible(true)}
                  />
                ) : (
                  <TextInput
                    label={t('onboarding.quickBodyStats.height')}
                    value={height}
                    onChangeText={(text) => {
                      const dotIndex = text.indexOf('.');
                      if (dotIndex !== -1 && text.length - dotIndex > 3) {
                        return;
                      }
                      setHeight(text);
                    }}
                    placeholder="0"
                    keyboardType="numeric"
                    selectTextOnFocus={true}
                    required
                    icon={
                      <Text className="text-center text-sm font-medium text-text-tertiary">
                        {heightUnit}
                      </Text>
                    }
                  />
                )}
              </View>
            </View>

            {/* Birthday */}
            <View className="gap-2">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.quickBodyStats.birthday').toUpperCase()}
              </Text>
              <DatePickerInput
                hideLabel
                selectedDate={birthday}
                onPress={() => setIsBirthdayPickerVisible(true)}
              />
              <Text
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {t('onboarding.quickBodyStats.birthdayHelper')}
              </Text>
            </View>

            {/* Body Fat % */}
            <View className="gap-3">
              <Text
                className="text-xs font-semibold tracking-widest"
                style={{ color: theme.colors.text.tertiary }}
              >
                {t('onboarding.quickBodyStats.bodyFat').toUpperCase()}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.gray500,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {t('onboarding.quickBodyStats.bodyFatHelper')}
              </Text>
              <View className="mt-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium text-text-secondary">
                    {t('onboarding.quickBodyStats.bodyFat')}
                  </Text>
                  {bodyFat === null ? (
                    <Pressable onPress={() => setBodyFat(20)} className="active:opacity-70">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        {t('editFitnessDetails.fatPercentageNotSet')}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => setBodyFat(null)} className="active:opacity-70">
                      <Text
                        className="text-sm font-medium"
                        style={{ color: theme.colors.text.tertiary }}
                      >
                        {t('common.clear')}
                      </Text>
                    </Pressable>
                  )}
                </View>
                {bodyFat !== null ? (
                  <View className="mt-3">
                    <StepperInlineInput
                      label={t('onboarding.quickBodyStats.bodyFat')}
                      value={bodyFat}
                      maxFractionDigits={1}
                      onIncrement={() => setBodyFat((prev) => Math.min(50, (prev ?? 20) + 0.5))}
                      onDecrement={() => setBodyFat((prev) => Math.max(5, (prev ?? 20) - 0.5))}
                      onChangeValue={(value) => setBodyFat(Math.min(50, Math.max(5, value)))}
                      unit="%"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>

        <BottomButtonWrapper>
          {isSaving ? (
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          ) : (
            <Button
              label={t('onboarding.quickBodyStats.continue')}
              onPress={handleContinue}
              variant="gradientCta"
              size="md"
              width="full"
              disabled={!isValid || isSaving}
            />
          )}
          <View style={{ height: theme.spacing.margin.md }} />
        </BottomButtonWrapper>

        <DatePickerModal
          visible={isBirthdayPickerVisible}
          onClose={() => setIsBirthdayPickerVisible(false)}
          selectedDate={birthday}
          onDateSelect={(date) => {
            setBirthday(localCalendarDayDate(date));
            setIsBirthdayPickerVisible(false);
          }}
          minYear={1920}
          maxYear={new Date().getFullYear() - 10}
        />

        <HeightPickerModal
          visible={isHeightPickerVisible}
          onClose={() => setIsHeightPickerVisible(false)}
          totalInches={parseFloat(height) || 67}
          onHeightSelect={(totalInches) => {
            setHeight(String(totalInches));
            setIsHeightPickerVisible(false);
          }}
          title={t('heightPicker.selectHeight')}
        />
      </SafeAreaView>
    </MasterLayout>
  );
}
