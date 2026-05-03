import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
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
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { calculateNutritionPlan } from '@/utils/nutritionCalculator';
import { displayToCm, displayToKg } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';

type QuickSetupData = {
  gender?: Gender;
  units?: 'metric' | 'imperial';
  fitnessGoal?: FitnessGoal;
  weightGoal?: WeightGoal;
};

const ADJECTIVES = [
  'Strong',
  'Fast',
  'Fit',
  'Iron',
  'Solid',
  'Peak',
  'Bold',
  'Swift',
  'Fierce',
  'Elite',
];
const NOUNS = ['Wolf', 'Bear', 'Eagle', 'Hawk', 'Lion', 'Tiger', 'Rhino', 'Bull', 'Fox', 'Ox'];

function generateRandomUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}${noun}${num}`;
}

export default function QuickBodyStatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

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
    AsyncStorage.getItem(QUICK_SETUP_DATA)
      .then((raw) => {
        if (raw) {
          setSetupData(JSON.parse(raw) as QuickSetupData);
        }
      })
      .catch(() => {});
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
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
      const randomName = generateRandomUsername();
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
        bodyFatPercent: bodyFat ?? undefined,
      });

      await AsyncStorage.setItem(TEMP_NUTRITION_PLAN, JSON.stringify(plan));
      router.navigate('/app/onboarding/nutrition-goals-results?aiGenerated=true&quickSetup=true');
    } catch (e) {
      console.error('Error in quick body stats:', e);
    } finally {
      setIsSaving(false);
    }
  }, [weight, height, units, bodyFat, birthday, setupData, router]);

  const isValid = parseFloat(weight) > 0 && parseFloat(height) > 0;

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar current={4} total={5} />

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
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
                  <Text
                    className="text-sm font-medium text-text-secondary"
                  >
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
        </ScrollView>

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
