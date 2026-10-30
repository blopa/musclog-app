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
import { getHealthBodyMetricsPrefill } from '@/hooks/useHealthBodyMetricsPrefill';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { commitOnboardingProfile } from '@/services/onboardingAnswersApply';
import { toBodyStatsDraft } from '@/utils/aiOnboarding/answers';
import type { CompleteOnboardingAnswers } from '@/utils/aiOnboarding/contract';
import {
  formatLocalCalendarDayIso,
  localCalendarDayDate,
  parseLocalCalendarDate,
} from '@/utils/calendarDate';
import {
  type PersonalizedSetupData,
  readBodyStatsDraft,
  readPersonalizedSetup,
  writeBodyStatsDraft,
} from '@/utils/onboardingDraft';
import { PERSONALIZED_SETUP_STEPS, PERSONALIZED_STEP } from '@/utils/onboardingRoutes';
import { setCurrentOnboardingStep } from '@/utils/onboardingService';
import { cmToDisplay, displayToCm, displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';

/** A measurement as the text field shows it: one decimal at most, no trailing zero. */
const toFieldText = (value: number): string => String(Math.round(value * 10) / 10);

export default function PersonalizedBodyStatsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { useBfForCalculations } = useSettings();

  const [setupData, setSetupData] = useState<PersonalizedSetupData>({});
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthday, setBirthday] = useState<Date>(localCalendarDayDate(new Date(1990, 0, 1)));
  const [birthdayEstimated, setBirthdayEstimated] = useState(false);
  const [isBirthdayPickerVisible, setIsBirthdayPickerVisible] = useState(false);
  const [isHeightPickerVisible, setIsHeightPickerVisible] = useState(false);
  const [bodyFat, setBodyFat] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const units = setupData.units ?? 'metric';
  const weightUnit = getWeightUnit(units);
  const heightUnit = getHeightUnit(units);

  useEffect(() => {
    async function load() {
      const saved = await readPersonalizedSetup();
      setSetupData(saved);
      const resolvedUnits = saved.units ?? 'metric';

      // What the person already answered (here before, or in the AI setup) wins over a Health
      // prefill, which only fills the gaps.
      const draft = await readBodyStatsDraft();
      const prefill = await getHealthBodyMetricsPrefill(resolvedUnits);

      if (draft.weightKg !== undefined) {
        setWeight(toFieldText(kgToDisplay(draft.weightKg, resolvedUnits)));
      } else if (prefill.weight) {
        setWeight(prefill.weight);
      }

      if (draft.heightCm !== undefined) {
        setHeight(toFieldText(cmToDisplay(draft.heightCm, resolvedUnits)));
      } else if (prefill.height) {
        setHeight(prefill.height);
      }

      if (draft.bodyFatPercent !== undefined) {
        setBodyFat(draft.bodyFatPercent);
      } else if (prefill.bodyFat != null) {
        setBodyFat(prefill.bodyFat);
      }

      if (draft.birthDate) {
        setBirthday(localCalendarDayDate(parseLocalCalendarDate(draft.birthDate)));
        setBirthdayEstimated(draft.dobEstimated === true);
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

      const answers: CompleteOnboardingAnswers = {
        ...(setupData.fullName?.trim() ? { fullName: setupData.fullName.trim() } : {}),
        units,
        gender: setupData.gender ?? 'other',
        birthDate: formatLocalCalendarDayIso(birthday),
        ...(birthdayEstimated ? { dobEstimated: true } : {}),
        heightCm: displayToCm(heightValue, units),
        weightKg: displayToKg(weightValue, units),
        ...(bodyFat !== null ? { bodyFatPercent: bodyFat } : {}),
        liftingExperience: setupData.liftingExperience ?? 'beginner',
        activityLevel: setupData.activityLevel ?? 2,
        fitnessGoal: setupData.fitnessGoal ?? 'general',
        weightGoal: setupData.weightGoal ?? 'maintain',
      };

      // Kept so going back and forth shows what was typed, and saved through the one profile
      // writer, which updates today's readings instead of stacking new ones.
      await writeBodyStatsDraft(toBodyStatsDraft(answers));
      await commitOnboardingProfile(answers, { useBodyFat: useBfForCalculations });
      await setCurrentOnboardingStep('/app/onboarding/personalized-body-stats');
      router.navigate('/app/onboarding/personalized-cycle');
    } catch (e) {
      console.error('Error in personalized body stats:', e);
    } finally {
      setIsSaving(false);
    }
  }, [
    weight,
    height,
    units,
    bodyFat,
    birthday,
    birthdayEstimated,
    setupData,
    router,
    useBfForCalculations,
  ]);

  const isValid = parseFloat(weight) > 0 && parseFloat(height) > 0;

  return (
    <MasterLayout showNavigationMenu={false}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <QuickSetupProgressBar
          current={PERSONALIZED_STEP.bodyStats}
          total={PERSONALIZED_SETUP_STEPS}
        />

        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          bottomOffset={16}
        >
          <View className="gap-6 px-6 pt-6">
            <View>
              <Text
                className="mb-1 text-2xl font-bold"
                style={{ color: theme.colors.text.primary }}
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
                    unset={!height}
                    unsetPlaceholder={t('heightPicker.selectHeight')}
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
              <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
                {t('onboarding.quickBodyStats.birthday').toUpperCase()}
              </Text>
              <DatePickerInput
                hideLabel
                selectedDate={birthday}
                onPress={() => setIsBirthdayPickerVisible(true)}
              />
              <Text
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.xs,
                }}
              >
                {birthdayEstimated
                  ? t('onboarding.quickBodyStats.birthdayEstimated')
                  : t('onboarding.quickBodyStats.birthdayHelper')}
              </Text>
            </View>

            {/* Body Fat % */}
            <View className="gap-3">
              <Text className="text-xs font-semibold" style={{ color: theme.colors.text.tertiary }}>
                {t('onboarding.quickBodyStats.bodyFat').toUpperCase()}
              </Text>
              <Text
                style={{
                  color: theme.colors.text.tertiary,
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
            setBirthdayEstimated(false);
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
