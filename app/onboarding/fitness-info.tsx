import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { names, uniqueNamesGenerator } from 'unique-names-generator';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { EditFitnessDetailsBody, FitnessDetails } from '../../components/EditFitnessDetailsBody';
import { MasterLayout } from '../../components/MasterLayout';
import { MaybeLaterButton } from '../../components/MaybeLaterButton';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { Button } from '../../components/theme/Button';
import { TEMP_GOOGLE_USER_NAME } from '../../constants/misc';
import { useSnackbar } from '../../context/SnackbarContext';
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

function formatTimestampToDob(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function parseDobToTimestamp(dob: string): number {
  const parts = dob.split('/');
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day).getTime();
}

function parseDobToDate(dob: string): Date {
  if (!dob) {
    return new Date();
  }
  const parts = dob.split('/');
  if (parts.length !== 3) {
    return new Date();
  }
  return new Date(parseInt(parts[2], 10), parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
}

function formatDateToDob(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/** Merge initial data with current form state; use defaults for any missing fields so we always have a complete FitnessDetails. */
function getMergedFitnessData(
  initial: Partial<FitnessDetails> | undefined,
  current: Partial<FitnessDetails> | undefined
): FitnessDetails {
  const weight =
    current?.weight != null && String(current.weight).trim() !== ''
      ? current.weight
      : (initial?.weight ?? DEFAULT_WEIGHT_KG);
  const height =
    current?.height != null && String(current.height).trim() !== ''
      ? current.height
      : (initial?.height ?? DEFAULT_HEIGHT_CM);

  return {
    units: current?.units ?? initial?.units ?? 'metric',
    weight: typeof weight === 'string' ? weight : String(weight),
    height: typeof height === 'string' ? height : String(height),
    fatPercentage: current?.fatPercentage ?? initial?.fatPercentage,
    weightGoal: current?.weightGoal ?? initial?.weightGoal ?? 'maintain',
    fitnessGoal: current?.fitnessGoal ?? initial?.fitnessGoal ?? 'general',
    activityLevel: current?.activityLevel ?? initial?.activityLevel ?? 3,
    gender: current?.gender ?? initial?.gender ?? 'other',
    experience: current?.experience ?? initial?.experience ?? 'intermediate',
  };
}

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
  const defaultDob = formatDateToDob(new Date(new Date().getFullYear() - 25, new Date().getMonth(), new Date().getDate()));
  const [dob, setDob] = useState(defaultDob);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

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
          // Only pre-fill DOB if the user has a real date (age > 0 means it's not a default timestamp)
          if (user.getAge() > 0) {
            setDob(formatTimestampToDob(user.dateOfBirth));
          }
          setInitialData({
            units,
            weight: String(weightDisplay),
            height: String(heightDisplay),
            fatPercentage: bodyFatDec ? bodyFatDec.value : undefined,
            weightGoal: user.weightGoal ?? 'maintain',
            fitnessGoal: user.fitnessGoal,
            activityLevel: user.activityLevel ?? 3,
            gender: user.gender,
            experience: user.liftingExperience ?? 'intermediate',
          });
        } else {
          setInitialData({
            units,
            weight: String(weightDisplay),
            height: String(heightDisplay),
            fatPercentage: bodyFatDec ? bodyFatDec.value : undefined,
            weightGoal: 'maintain',
            fitnessGoal: 'general',
            activityLevel: 3,
            gender: 'other',
            experience: 'intermediate',
          });
        }
      } catch (error) {
        console.error('Error loading fitness data:', error);
        setInitialData({
          units: 'metric',
          weight: DEFAULT_WEIGHT_KG,
          height: DEFAULT_HEIGHT_CM,
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

  const handleSave = useCallback(
    async (
      data: FitnessDetails,
      options?: { navigate?: boolean }
    ): Promise<{ weightMetricId?: string; heightMetricId?: string }> => {
      const shouldNavigate = options?.navigate !== false;
      const result: { weightMetricId?: string; heightMetricId?: string } = {};
      setIsSaving(true);
      try {
        const dateOfBirth = dob ? parseDobToTimestamp(dob) : new Date().getTime();

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
            dateOfBirth,
            gender: data.gender,
            fitnessGoal: data.fitnessGoal,
            weightGoal: data.weightGoal,
            activityLevel: data.activityLevel,
            liftingExperience: data.experience,
          });
        } else {
          // Update user fitness info and DOB
          await user.updateProfile({
            dateOfBirth,
            gender: data.gender,
            fitnessGoal: data.fitnessGoal,
            weightGoal: data.weightGoal,
            activityLevel: data.activityLevel,
            liftingExperience: data.experience,
          });
        }

        const currentDate = new Date().setUTCHours(0, 0, 0, 0); // Set to midnight of today for date tracking
        const now = Date.now();
        const endOfDay = currentDate + 24 * 60 * 60 * 1000 - 1;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (data.weight && parseFloat(data.weight) > 0) {
          const weightValueKg = displayToKg(parseFloat(data.weight), data.units);
          const existingWeight = await UserMetricService.getMetricsHistory(
            'weight',
            { startDate: currentDate, endDate: endOfDay },
            1
          );
          if (existingWeight.length > 0) {
            const updated = await UserMetricService.updateMetric(existingWeight[0].id, {
              value: weightValueKg,
              unit: 'kg',
              date: now,
            });
            result.weightMetricId = updated.id;
          } else {
            const created = await UserMetricService.createMetric({
              type: 'weight',
              value: weightValueKg,
              unit: 'kg',
              date: now,
              timezone,
            });
            result.weightMetricId = created.id;
          }
        }

        if (data.height && parseFloat(data.height) > 0) {
          const heightValueCm = displayToCm(parseFloat(data.height), data.units);
          const existingHeight = await UserMetricService.getMetricsHistory(
            'height',
            { startDate: currentDate, endDate: endOfDay },
            1
          );
          if (existingHeight.length > 0) {
            const updated = await UserMetricService.updateMetric(existingHeight[0].id, {
              value: heightValueCm,
              unit: 'cm',
              date: now,
            });
            result.heightMetricId = updated.id;
          } else {
            const created = await UserMetricService.createMetric({
              type: 'height',
              value: heightValueCm,
              unit: 'cm',
              date: now,
              timezone,
            });
            result.heightMetricId = created.id;
          }
        }

        if (data.fatPercentage != null && data.fatPercentage > 0) {
          const fatValue = data.fatPercentage;
          const existingBodyFat = await UserMetricService.getMetricsHistory(
            'body_fat',
            { startDate: currentDate, endDate: endOfDay },
            1
          );
          if (existingBodyFat.length > 0) {
            await UserMetricService.updateMetric(existingBodyFat[0].id, {
              value: fatValue,
              unit: '%',
              date: now,
            });
          } else {
            await UserMetricService.createMetric({
              type: 'body_fat',
              value: fatValue,
              unit: '%',
              date: now,
              timezone,
            });
          }
        }

        // Persist units setting via SettingsService
        await SettingsService.setUnits(data.units);

        if (shouldNavigate) {
          router.push({
            pathname: '/onboarding/set-goals',
            params:
              result.weightMetricId && result.heightMetricId
                ? { weightMetricId: result.weightMetricId, heightMetricId: result.heightMetricId }
                : undefined,
          });
        }
        return result;
      } catch (error) {
        console.error('Error saving fitness info:', error);
        showSnackbar('error', t('onboarding.fitnessInfo.errorSaving'));
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [dob, router, showSnackbar, t]
  );

  const handleSkip = useCallback(async () => {
    const merged = getMergedFitnessData(initialData, currentFormData);
    try {
      const { weightMetricId, heightMetricId } = await handleSave(merged, { navigate: false });
      router.push({
        pathname: '/onboarding/set-goals',
        params: weightMetricId && heightMetricId ? { weightMetricId, heightMetricId } : undefined,
      });
    } catch {
      // Error already shown in handleSave
    }
  }, [initialData, currentFormData, router, handleSave]);

  const handleFloatingSave = async () => {
    const merged = getMergedFitnessData(initialData, currentFormData);
    await handleSave(merged);
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

          {/* Date of Birth */}
          <View className="px-4 pb-2 pt-4">
            <View className="gap-2">
              <Text className="ml-1 text-sm font-semibold text-text-tertiary">
                {t('editPersonalInfo.dateOfBirth')}
              </Text>
              <Pressable
                className="h-14 w-full flex-row items-center rounded-lg border-2 border-white/10 bg-bg-card px-4 active:opacity-80"
                onPress={() => setIsDatePickerVisible(true)}
              >
                <View className="ml-3 flex-1">
                  <Text className={`text-base ${dob ? 'text-text-primary' : 'text-text-tertiary'}`}>
                    {dob || t('editPersonalInfo.dateOfBirthPlaceholder')}
                  </Text>
                </View>
                <Calendar size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
              </Pressable>
            </View>
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

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={dob ? parseDobToDate(dob) : new Date(new Date().getFullYear() - 25, 0, 1)}
        onDateSelect={(date) => setDob(formatDateToDob(date))}
        minYear={1900}
        maxYear={new Date().getFullYear() - 10}
      />
    </MasterLayout>
  );
}
