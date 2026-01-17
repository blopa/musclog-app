import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { theme } from '../../theme';
import { EditFitnessDetailsBody, FitnessDetails } from '../../components/EditFitnessDetailsBody';
import { UserService } from '../../database/services/UserService';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import UserMetric from '../../database/models/UserMetric';
import Setting from '../../database/models/Setting';

export default function FitnessInfo() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<FitnessDetails> | undefined>(undefined);

  // Load user data, settings, and metrics on mount
  useEffect(() => {
    const loadFitnessData = async () => {
      try {
        // Fetch user
        const user = await UserService.getCurrentUser();

        // Fetch settings (units)
        const settings = await database
          .get<Setting>('settings')
          .query(Q.where('type', 'units'), Q.where('deleted_at', Q.eq(null)))
          .fetch();
        const unitsSetting = settings.length > 0 ? settings[0] : null;
        const units = unitsSetting?.value === 1 ? 'imperial' : 'metric';

        // Fetch latest weight metric
        const weightMetrics = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'weight'),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc)
          )
          .fetch();
        const latestWeight = weightMetrics.length > 0 ? weightMetrics[0] : null;

        // Fetch latest height metric
        const heightMetrics = await database
          .get<UserMetric>('user_metrics')
          .query(
            Q.where('type', 'height'),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('date', Q.desc)
          )
          .fetch();
        const latestHeight = heightMetrics.length > 0 ? heightMetrics[0] : null;

        // Convert to FitnessDetails format
        if (user) {
          setInitialData({
            units,
            weight: latestWeight ? String(latestWeight.value) : '0.0',
            height: latestHeight ? String(latestHeight.value) : '0',
            fitnessGoal: user.fitnessGoal || '',
            eatingPhase: user.eatingPhase || 'maintain',
            activityLevel: user.activityLevel || 3,
            experience: user.liftingExperience || 'intermediate',
          });
        } else {
          // No user, but still set defaults
          setInitialData({
            units,
            weight: latestWeight ? String(latestWeight.value) : '0.0',
            height: latestHeight ? String(latestHeight.value) : '0',
            fitnessGoal: '',
            eatingPhase: 'maintain',
            activityLevel: 3,
            experience: 'intermediate',
          });
        }
      } catch (error) {
        console.error('Error loading fitness data:', error);
        // Continue with defaults if loading fails
        setInitialData({
          units: 'metric',
          weight: '0.0',
          height: '0',
          fitnessGoal: '',
          eatingPhase: 'maintain',
          activityLevel: 3,
          experience: 'intermediate',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFitnessData();
  }, []);

  const handleSave = async (data: FitnessDetails) => {
    setIsSaving(true);
    try {
      // Get or ensure user exists
      let user = await UserService.getCurrentUser();
      if (!user) {
        // If no user exists, create one with minimal data
        // This shouldn't happen if personal-info was completed first
        user = await UserService.initializeUser({
          fullName: 'User',
          dateOfBirth: new Date().getTime(),
          gender: 'other',
          fitnessGoal: data.fitnessGoal,
          activityLevel: data.activityLevel,
          liftingExperience: data.experience,
          eatingPhase: data.eatingPhase,
        });
      } else {
        // Update user fitness info
        await user.updateProfile({
          fitnessGoal: data.fitnessGoal,
          activityLevel: data.activityLevel,
          liftingExperience: data.experience,
          eatingPhase: data.eatingPhase,
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

      // Save units to settings table
      const existingUnitsSetting = await database
        .get<Setting>('settings')
        .query(Q.where('type', 'units'), Q.where('deleted_at', Q.eq(null)))
        .fetch();

      // Convert units to numeric value (0 = metric, 1 = imperial)
      const unitsValue = data.units === 'imperial' ? 1 : 0;

      await database.write(async () => {
        if (existingUnitsSetting.length > 0) {
          // Update existing setting
          await existingUnitsSetting[0].update((setting) => {
            setting.value = unitsValue;
            setting.updatedAt = now;
          });
        } else {
          // Create new setting
          await database.get<Setting>('settings').create((setting) => {
            setting.type = 'units';
            setting.value = unitsValue;
            setting.createdAt = now;
            setting.updatedAt = now;
          });
        }
      });

      // Navigate to next step or home
      router.push('/');
    } catch (error) {
      console.error('Error saving fitness info:', error);
      // TODO: Show error message to user
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.colors.accent.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <ScrollView>
        <View className="px-6 pb-2 pt-4">
          <Text
            className="text-2xl font-bold tracking-tight"
            style={{ color: theme.colors.text.white }}>
            {t('onboarding.fitnessInfo.title')}
          </Text>
        </View>
        <EditFitnessDetailsBody
          onClose={() => {}}
          onSave={handleSave}
          initialData={initialData}
          isLoading={isSaving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
