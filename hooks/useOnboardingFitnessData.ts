import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSnackbar } from '../context/SnackbarContext';
import type { FitnessDetails } from '../types/fitnessDetails';
import {
  defaultAdultDobDisplayString,
  loadFitnessDetailsInitialData,
  persistFitnessDetails,
} from '../utils/fitnessProfilePersistence';
import { useSettings } from './useSettings';

const DEFAULT_WEIGHT_KG = '70.0';
const DEFAULT_HEIGHT_CM = '170';

export function useOnboardingFitnessData() {
  const { t, i18n } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { units, isLoading: isSettingsLoading } = useSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialData, setInitialData] = useState<Partial<FitnessDetails> | undefined>(undefined);
  const [currentFormData, setCurrentFormData] = useState<Partial<FitnessDetails> | undefined>(
    undefined
  );

  const defaultDobFallback = useCallback(
    () => defaultAdultDobDisplayString(25, i18n.language),
    [i18n.language]
  );

  useEffect(() => {
    const loadFitnessData = async () => {
      try {
        const loaded = await loadFitnessDetailsInitialData(units, i18n.language);
        if (!loaded.dob?.trim()) {
          loaded.dob = defaultDobFallback();
        }
        setInitialData(loaded);
      } catch (error) {
        console.error('Error loading fitness data:', error);
        setInitialData({
          dob: defaultDobFallback(),
          units: 'metric',
          weight: DEFAULT_WEIGHT_KG,
          height: DEFAULT_HEIGHT_CM,
          weightGoal: 'maintain',
          fitnessGoal: 'general',
          activityLevel: 3,
          gender: 'other',
          experience: 'intermediate',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!isSettingsLoading) {
      loadFitnessData();
    }
  }, [units, isSettingsLoading, defaultDobFallback, i18n.language]);

  const saveFitnessData = useCallback(
    async (data: FitnessDetails): Promise<{ weightMetricId?: string; heightMetricId?: string }> => {
      setIsSaving(true);
      try {
        await persistFitnessDetails(data);
        return {};
      } catch (error) {
        console.error('Error saving fitness info:', error);
        showSnackbar('error', t('onboarding.fitnessInfo.errorSaving'));
        return {};
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
      dob: currentFormData?.dob ?? initialData?.dob ?? defaultDobFallback(),
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
  }, [initialData, currentFormData, defaultDobFallback]);

  return {
    isLoading: isLoading || isSettingsLoading,
    isSaving,
    initialData,
    setCurrentFormData,
    saveFitnessData,
    getMergedFitnessData,
  };
}
