import { Q } from '@nozbe/watermelondb';
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
import { database } from '../../database';
import UserMetric from '../../database/models/UserMetric';
import { SettingsService, UserService } from '../../database/services';
import { useSettings } from '../../hooks/useSettings';
import { theme } from '../../theme';

const DEFAULT_WEIGHT = '60.0';
const DEFAULT_HEIGHT = '165';
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

        const weightMetrics = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'weight'),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc)
          )
          .fetch();
        const latestWeight = weightMetrics.length > 0 ? weightMetrics[0] : null;

        const heightMetrics = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'height'),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc)
          )
          .fetch();
        const latestHeight = heightMetrics.length > 0 ? heightMetrics[0] : null;

        const bodyFatMetrics = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'body_fat'),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc)
          )
          .fetch();
        const latestBodyFat = bodyFatMetrics.length > 0 ? bodyFatMetrics[0] : null;

        if (user) {
          setInitialData({
            units,
            weight: latestWeight ? String(latestWeight.value) : DEFAULT_WEIGHT,
            height: latestHeight ? String(latestHeight.value) : DEFAULT_HEIGHT,
            fatPercentage: latestBodyFat ? latestBodyFat.value : DEFAULT_FAT_PERCENTAGE,
            weightGoal: user.weightGoal ?? 'maintain',
            fitnessGoal: user.fitnessGoal,
            activityLevel: user.activityLevel ?? 3,
            experience: user.liftingExperience ?? 'intermediate',
          });
        } else {
          setInitialData({
            units,
            weight: latestWeight ? String(latestWeight.value) : DEFAULT_WEIGHT,
            height: latestHeight ? String(latestHeight.value) : DEFAULT_HEIGHT,
            fatPercentage: latestBodyFat ? latestBodyFat.value : DEFAULT_FAT_PERCENTAGE,
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
          weight: DEFAULT_WEIGHT,
          height: DEFAULT_HEIGHT,
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

      // Save weight and height to user_metrics (if provided)
      // Use current date/time for the metric date
      const now = Date.now();
      const currentDate = new Date().setHours(0, 0, 0, 0); // Set to midnight of today for date tracking
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // Get user's current timezone

      if (data.weight && parseFloat(data.weight) > 0) {
        const weightValue = parseFloat(data.weight);

        // Check if weight metric exists for today
        const existingWeight = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'weight'),
            Q.where('date', currentDate),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();

        await database.write(async () => {
          if (existingWeight.length > 0) {
            // Update existing weight for today
            await existingWeight[0].update((metric) => {
              metric.value = weightValue;
              metric.unit = data.units === 'imperial' ? 'lbs' : 'kg';
              metric.timezone = timezone;
              metric.updatedAt = now;
            });
          } else {
            // Create new weight metric with current date
            await database.get<UserMetric>('user_metrics').create((metric) => {
              metric.type = 'weight';
              metric.value = weightValue;
              metric.unit = data.units === 'imperial' ? 'lbs' : 'kg';
              metric.date = currentDate;
              metric.timezone = timezone;
              metric.createdAt = now;
              metric.updatedAt = now;
            });
          }
        });
      }

      if (data.height && parseFloat(data.height) > 0) {
        const heightValue = parseFloat(data.height);

        // Check if height metric exists for today
        const existingHeight = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'height'),
            Q.where('date', currentDate),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();

        await database.write(async () => {
          if (existingHeight.length > 0) {
            // Update existing height for today
            await existingHeight[0].update((metric) => {
              metric.value = heightValue;
              metric.unit = data.units === 'imperial' ? 'in' : 'cm';
              metric.timezone = timezone;
              metric.updatedAt = now;
            });
          } else {
            // Create new height metric with current date
            await database.get<UserMetric>('user_metrics').create((metric) => {
              metric.type = 'height';
              metric.value = heightValue;
              metric.unit = data.units === 'imperial' ? 'in' : 'cm';
              metric.date = currentDate;
              metric.timezone = timezone;
              metric.createdAt = now;
              metric.updatedAt = now;
            });
          }
        });
      }

      // Save body fat percentage to user_metrics
      if (data.fatPercentage != null && data.fatPercentage > 0) {
        const fatValue = data.fatPercentage;

        // Check if body fat metric exists for today
        const existingBodyFat = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'body_fat'),
            Q.where('date', currentDate),
            Q.where('deleted_at', Q.eq(null))
          )
          .fetch();

        await database.write(async () => {
          if (existingBodyFat.length > 0) {
            // Update existing body fat for today
            await existingBodyFat[0].update((metric) => {
              metric.value = fatValue;
              metric.unit = '%';
              metric.timezone = timezone;
              metric.updatedAt = now;
            });
          } else {
            // Create new body fat metric with current date
            await database.get<UserMetric>('user_metrics').create((metric) => {
              metric.type = 'body_fat';
              metric.value = fatValue;
              metric.unit = '%';
              metric.date = currentDate;
              metric.timezone = timezone;
              metric.createdAt = now;
              metric.updatedAt = now;
            });
          }
        });
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
    if (
      currentFormData &&
      currentFormData.units &&
      currentFormData.weight &&
      currentFormData.height &&
      currentFormData.fitnessGoal &&
      currentFormData.activityLevel &&
      currentFormData.experience
    ) {
      await handleSave(currentFormData as FitnessDetails);
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
