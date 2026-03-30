import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { type CycleSetupData, EditCycleSetupData } from '../../components/EditCycleSetupData';
import { MasterLayout } from '../../components/MasterLayout';
import { Button } from '../../components/theme/Button';
import { MenstrualCycleRepository } from '../../database/repositories/MenstrualCycleRepository';
import { useTheme } from '../../hooks/useTheme';
import { localDayStartMs } from '../../utils/calendarDate';
import { setOnboardingCompleted } from '../../utils/onboardingService';

const DEFAULT_CYCLE_DATA: CycleSetupData = {
  lastPeriodStartDate: new Date(),
  cycleLength: 28,
  periodDuration: 5,
  birthControlType: 'none',
  syncGoal: 'performance',
};

export default function CycleSetup() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [currentFormData, setCurrentFormData] = useState<Partial<CycleSetupData>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleFinish = async () => {
    const data: CycleSetupData = { ...DEFAULT_CYCLE_DATA, ...currentFormData };
    setIsSaving(true);
    try {
      await MenstrualCycleRepository.createNewCycle({
        lastPeriodStartDate: localDayStartMs(data.lastPeriodStartDate),
        useHormonalBirthControl: data.birthControlType !== 'none',
        birthControlType: data.birthControlType !== 'none' ? data.birthControlType : undefined,
        avgCycleLength: data.cycleLength,
        avgPeriodDuration: data.periodDuration,
        syncGoal: data.syncGoal,
      });

      await setOnboardingCompleted();
      router.push('/');
    } catch (error) {
      console.error('Error saving cycle setup:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
        <Text
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}
        >
          {t('onboarding.cycleSetup.length.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.length.description')}
        </Text>
        <EditCycleSetupData onFormChange={setCurrentFormData} />
        <View pointerEvents="none" style={{ height: theme.spacing.margin['6xl'] }} />
      </ScrollView>

      <BottomButtonWrapper>
        <Button
          label={t('onboarding.personalInfo.finish')}
          onPress={handleFinish}
          variant="accent"
          size="md"
          width="full"
          loading={isSaving}
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
