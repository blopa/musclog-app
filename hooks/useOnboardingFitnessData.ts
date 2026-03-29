import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { names, uniqueNamesGenerator } from 'unique-names-generator';

import { FitnessDetails } from '../components/EditFitnessDetailsBody';
import { TEMP_GOOGLE_USER_NAME } from '../constants/misc';
import { useSnackbar } from '../context/SnackbarContext';
import { SettingsService, UserMetricService, UserService } from '../database/services';
import { localDayClosedRangeMaxMs, localDayStartMs } from '../utils/calendarDate';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  storedHeightToCm,
  storedWeightToKg,
} from '../utils/unitConversion';
import { useSettings } from './useSettings';

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
  return localDayStartMs(new Date(year, month, day));
}

function formatDateToDob(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function useOnboardingFitnessData() {
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

  const defaultDob = formatDateToDob(
    new Date(new Date().getFullYear() - 25, new Date().getMonth(), new Date().getDate())
  );

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
            dob: user.getAge() > 0 ? formatTimestampToDob(user.dateOfBirth) : defaultDob,
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
            dob: defaultDob,
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
          dob: defaultDob,
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
  }, [units, isSettingsLoading, defaultDob]);

  const saveFitnessData = useCallback(
    async (data: FitnessDetails): Promise<{ weightMetricId?: string; heightMetricId?: string }> => {
      const result: { weightMetricId?: string; heightMetricId?: string } = {};
      setIsSaving(true);
      try {
        const dateOfBirth = data.dob ? parseDobToTimestamp(data.dob) : new Date().getTime();

        // Get or ensure user exists
        let user = await UserService.getCurrentUser();
        if (!user) {
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
          await user.updateProfile({
            dateOfBirth,
            gender: data.gender,
            fitnessGoal: data.fitnessGoal,
            weightGoal: data.weightGoal,
            activityLevel: data.activityLevel,
            liftingExperience: data.experience,
          });
        }

        const dayStart = localDayStartMs(new Date());
        const now = Date.now();
        const dayEnd = localDayClosedRangeMaxMs(new Date());
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (data.weight && parseFloat(data.weight) > 0) {
          const weightValueKg = displayToKg(parseFloat(data.weight), data.units);
          const existingWeight = await UserMetricService.getMetricsHistory(
            'weight',
            { startDate: dayStart, endDate: dayEnd },
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
            { startDate: dayStart, endDate: dayEnd },
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
            { startDate: dayStart, endDate: dayEnd },
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

        await SettingsService.setUnits(data.units);

        return result;
      } catch (error) {
        console.error('Error saving fitness info:', error);
        showSnackbar('error', t('onboarding.fitnessInfo.errorSaving'));
        return result;
      } finally {
        setIsSaving(false);
      }
    },
    [showSnackbar, t]
  );

  const getMergedFitnessData = useCallback((): FitnessDetails => {
    const weight =
      currentFormData?.weight != null && String(currentFormData.weight).trim() !== ''
        ? currentFormData.weight
        : (initialData?.weight ?? DEFAULT_WEIGHT_KG);
    const height =
      currentFormData?.height != null && String(currentFormData.height).trim() !== ''
        ? currentFormData.height
        : (initialData?.height ?? DEFAULT_HEIGHT_CM);

    return {
      dob: currentFormData?.dob ?? initialData?.dob,
      units: currentFormData?.units ?? initialData?.units ?? 'metric',
      weight: typeof weight === 'string' ? weight : String(weight),
      height: typeof height === 'string' ? height : String(height),
      fatPercentage: currentFormData?.fatPercentage ?? initialData?.fatPercentage,
      weightGoal: currentFormData?.weightGoal ?? initialData?.weightGoal ?? 'maintain',
      fitnessGoal: currentFormData?.fitnessGoal ?? initialData?.fitnessGoal ?? 'general',
      activityLevel: currentFormData?.activityLevel ?? initialData?.activityLevel ?? 3,
      gender: currentFormData?.gender ?? initialData?.gender ?? 'other',
      experience: currentFormData?.experience ?? initialData?.experience ?? 'intermediate',
    };
  }, [initialData, currentFormData]);

  return {
    isLoading: isLoading || isSettingsLoading,
    isSaving,
    initialData,
    setCurrentFormData,
    saveFitnessData,
    getMergedFitnessData,
  };
}
