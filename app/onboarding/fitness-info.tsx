import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { names, uniqueNamesGenerator } from 'unique-names-generator';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { EditFitnessDetailsBody, FitnessDetails } from '../../components/EditFitnessDetailsBody';
import { MasterLayout } from '../../components/MasterLayout';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { useSnackbar } from '../../components/SnackbarContext';
import { Button } from '../../components/theme/Button';
import { TEMP_GOOGLE_USER_NAME } from '../../constants/auth';
import { SettingsService, UserMetricService, UserService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  storedHeightToCm,
  storedWeightToKg,
} from '../../utils/unitConversion';

const DEFAULT_WEIGHT_KG = '70.0';
const DEFAULT_HEIGHT_CM = '170';
const DEFAULT_FAT_PERCENTAGE = 15;

export default function FitnessInfo() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { units, isLoading: isSettingsLoading } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<FitnessDetails> | undefined>(undefined);
  const [currentFormData, setCurrentFormData] = useState<Partial<FitnessDetails> | undefined>(
    undefined
  );

  // Load user data and metrics on mount (units come from useSettings)
  useEffect(() => {
    const loadFitnessData = async () => {
      try {
        const user = await UserService.getCurrentUser();

        const latestWeight = await UserMetricService.getLatest('weight');
        const latestHeight = await UserMetricService.getLatest('height');
        const latestBodyFat = await UserMetricService.getLatest('body_fat');

        const [weightDec, heightDec, bodyFatDec] = await Promise.all([
          latestWeight?.getDecrypted(),
          latestHeight?.getDecrypted(),
          latestBodyFat?.getDecrypted(),
        ]);

        const defaultWeightKg = parseFloat(DEFAULT_WEIGHT_KG);
        const defaultHeightCm = parseFloat(DEFAULT_HEIGHT_CM);
        const weightDisplay =
          weightDec != null
            ? kgToDisplay(storedWeightToKg(weightDec.value, weightDec.unit), units)
            : kgToDisplay(defaultWeightKg, units);
        const heightDisplay =
          heightDec != null
            ? cmToDisplay(storedHeightToCm(heightDec.value, heightDec.unit), units)
            : cmToDisplay(defaultHeightCm, units);

        if (user) {
          setInitialData({
            units,
            weight: String(weightDisplay),
            height: String(heightDisplay),
            fatPercentage: bodyFatDec ? bodyFatDec.value : DEFAULT_FAT_PERCENTAGE,
            weightGoal: user.weightGoal ?? 'maintain',
            fitnessGoal: user.fitnessGoal,
            activityLevel: user.activityLevel ?? 3,
            experience: user.liftingExperience ?? 'intermediate',
          });
        } else {
          setInitialData({
            units,
            weight: String(weightDisplay),
            height: String(heightDisplay),
            fatPercentage: bodyFatDec ? bodyFatDec.value : DEFAULT_FAT_PERCENTAGE,
            weightGoal: 'maintain',
            fitnessGoal: 'general',
            activityLevel: 3,
            experience: 'intermediate',
          });
        }
      } catch (error) {
        console.error('Error loading fitness data:', error);
        setInitialData({
          units: 'metric',
          weight: DEFAULT_WEIGHT_KG,
          height: DEFAULT_HEIGHT_CM,
          fatPercentage: DEFAULT_FAT_PERCENTAGE,
          weightGoal: 'maintain',
          fitnessGoal: 'general',
          activityLevel: 3,
          experience: 'intermediate',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!isSettingsLoading) {
      loadFitnessData();
    }
  }, [units, isSettingsLoading]);

  const handleSave = async (data: FitnessDetails) => {
    setIsSaving(true);
    try {
      // Get or ensure user exists
      let user = await UserService.getCurrentUser();
      if (!user) {
        // Try to use the temporary Google name saved during OAuth flow, otherwise generate one
        let fullName = uniqueNamesGenerator({
          dictionaries: [names],
          style: 'capital',
          separator: ' ',
        });

        try {
          const tempName = await AsyncStorage.getItem(TEMP_GOOGLE_USER_NAME);
          if (tempName && tempName.length > 0) {
            fullName = tempName;
          }
        } catch (e) {
          console.warn('Failed to read TEMP_GOOGLE_USER_NAME from storage', e);
        }

        user = await UserService.initializeUser({
          fullName,
          dateOfBirth: new Date().getTime(),
          gender: 'other',
          fitnessGoal: data.fitnessGoal,
          weightGoal: data.weightGoal,
          activityLevel: data.activityLevel,
          liftingExperience: data.experience,
        });
      } else {
        // Update user fitness info
        await user.updateProfile({
          fitnessGoal: data.fitnessGoal,
          weightGoal: data.weightGoal,
          activityLevel: data.activityLevel,
          liftingExperience: data.experience,
        });
      }

      const currentDate = new Date().setHours(0, 0, 0, 0); // Set to midnight of today for date tracking
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // Get user's current timezone

      if (data.weight && parseFloat(data.weight) > 0) {
        const weightValueKg = displayToKg(parseFloat(data.weight), data.units);

        const existingWeight = await UserMetricService.getMetricsHistory(
          'weight',
          { startDate: currentDate, endDate: currentDate },
          1
        );
        if (existingWeight.length > 0) {
          await UserMetricService.updateMetric(existingWeight[0].id, {
            value: weightValueKg,
            unit: 'kg',
            date: currentDate,
          });
        } else {
          await UserMetricService.createMetric({
            type: 'weight',
            value: weightValueKg,
            unit: 'kg',
            date: currentDate,
            timezone,
          });
        }
      }

      if (data.height && parseFloat(data.height) > 0) {
        const heightValueCm = displayToCm(parseFloat(data.height), data.units);
        const existingHeight = await UserMetricService.getMetricsHistory(
          'height',
          { startDate: currentDate, endDate: currentDate },
          1
        );
        if (existingHeight.length > 0) {
          await UserMetricService.updateMetric(existingHeight[0].id, {
            value: heightValueCm,
            unit: 'cm',
            date: currentDate,
          });
        } else {
          await UserMetricService.createMetric({
            type: 'height',
            value: heightValueCm,
            unit: 'cm',
            date: currentDate,
            timezone,
          });
        }
      }

      if (data.fatPercentage != null && data.fatPercentage > 0) {
        const fatValue = data.fatPercentage;
        const existingBodyFat = await UserMetricService.getMetricsHistory(
          'body_fat',
          { startDate: currentDate, endDate: currentDate },
          1
        );
        if (existingBodyFat.length > 0) {
          await UserMetricService.updateMetric(existingBodyFat[0].id, {
            value: fatValue,
            unit: '%',
            date: currentDate,
          });
        } else {
          await UserMetricService.createMetric({
            type: 'body_fat',
            value: fatValue,
            unit: '%',
            date: currentDate,
            timezone,
          });
        }
      }

      // Persist units setting via SettingsService
      await SettingsService.setUnits(data.units);

      // Navigate to next step (set-goals)
      router.push('/onboarding/set-goals');
    } catch (error) {
      console.error('Error saving fitness info:', error);
      showSnackbar('error', t('onboarding.fitnessInfo.errorSaving'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = useCallback(async () => {
    // Navigate to set-goals even when skipping
    router.push('/onboarding/set-goals');
  }, [router]);

  const handleFloatingSave = async () => {
    // Use currentFormData if available and complete, otherwise fall back to initialData
    const dataToSave =
      currentFormData &&
      currentFormData.units &&
      currentFormData.weight &&
      currentFormData.height &&
      currentFormData.fitnessGoal &&
      currentFormData.activityLevel &&
      currentFormData.experience
        ? currentFormData
        : initialData;

    if (
      dataToSave &&
      dataToSave.units &&
      dataToSave.weight &&
      dataToSave.height &&
      dataToSave.fitnessGoal &&
      dataToSave.activityLevel &&
      dataToSave.experience
    ) {
      await handleSave(dataToSave as FitnessDetails);
    }
  };

  if (isSettingsLoading || isLoading) {
    return (
      <MasterLayout showNavigationMenu={false}>
        <ActivityIndicator size="large" color={theme.colors.accent.primary} />
      </MasterLayout>
    );
  }

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding.bottomButton,
          }}
        >
          <View className="px-6 pb-2 pt-4">
            <Text
              className="text-2xl font-bold tracking-tight"
              style={{ color: theme.colors.text.white }}
            >
              {t('onboarding.fitnessInfo.title')}
            </Text>
          </View>
          <EditFitnessDetailsBody
            onClose={() => {}}
            onSave={handleSave}
            onFormChange={setCurrentFormData}
            initialData={initialData}
            isLoading={isSaving}
            onMaybeLater={handleSkip}
            hideSaveButton
            hideMaybeLaterButton
          />
        </ScrollView>

        {/* Floating Action Buttons */}
        <BottomButtonWrapper>
          <View className="gap-3">
            <Button
              label={t('onboarding.fitnessInfo.save')}
              onPress={handleFloatingSave}
              variant="accent"
              size="md"
              width="full"
              loading={isSaving}
            />
            <MaybeLaterButton onPress={handleSkip} text={t('onboarding.fitnessInfo.maybeLater')} />
            <View style={{ height: theme.spacing.gap.xs }} />
          </View>
        </BottomButtonWrapper>
      </View>
    </MasterLayout>
  );
}
