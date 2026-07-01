import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { type CycleSetupData, EditCycleSetupData } from '@/components/EditCycleSetupData';
import { MasterLayout } from '@/components/MasterLayout';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import { MenstrualCycleRepository } from '@/database/repositories/MenstrualCycleRepository';
import { useTheme } from '@/hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { getPastPeriodQuickDates } from '@/utils/cycleUtils';
import { handleError } from '@/utils/handleError';
import { setOnboardingCompleted } from '@/utils/onboardingService';

type PastPeriod = {
  startDate: Date;
};

const DEFAULT_CYCLE_DATA: CycleSetupData = {
  lastPeriodStartDate: null,
  cycleLength: 28,
  periodDuration: 5,
  birthControlType: 'none',
  syncGoal: 'performance',
  lifeStage: 'regular',
};

export default function CycleSetup() {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const params = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
  }>();

  const nextRoute = params.nextRoute ? decodeURIComponent(params.nextRoute) : undefined;
  const quickStep = params.quickStep ? parseInt(params.quickStep, 10) : undefined;
  const quickTotal = params.quickTotal ? parseInt(params.quickTotal, 10) : undefined;

  const [currentFormData, setCurrentFormData] = useState<Partial<CycleSetupData>>({});
  const [pastPeriods, setPastPeriods] = useState<PastPeriod[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPastPeriodPickerVisible, setIsPastPeriodPickerVisible] = useState(false);

  const handleAddPastPeriod = () => {
    setIsPastPeriodPickerVisible(true);
  };

  const handlePastPeriodDateSelect = (date: Date) => {
    const localDate = localCalendarDayDate(date);
    const today = localCalendarDayDate(new Date());

    if (localDate.getTime() > today.getTime()) {
      setIsPastPeriodPickerVisible(false);
      return;
    }

    setPastPeriods((prev) => [...prev, { startDate: localDate }]);
    setIsPastPeriodPickerVisible(false);
  };

  const handleRemovePastPeriod = (index: number) => {
    setPastPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    const data: CycleSetupData = { ...DEFAULT_CYCLE_DATA, ...currentFormData };
    setIsSaving(true);

    try {
      await MenstrualCycleRepository.replaceActiveCycle(
        {
          avgCycleLength: data.cycleLength,
          avgPeriodDuration: data.periodDuration,
          useHormonalBirthControl: data.birthControlType !== 'none',
          birthControlType: data.birthControlType !== 'none' ? data.birthControlType : undefined,
          syncGoal: data.syncGoal,
          lifeStage: data.lifeStage !== 'regular' ? data.lifeStage : undefined,
        },
        [
          ...(data.lastPeriodStartDate
            ? [{ startDate: localDayStartMs(data.lastPeriodStartDate) }]
            : []),
          ...pastPeriods.map((past) => ({ startDate: localDayStartMs(past.startDate) })),
        ]
      );

      if (nextRoute) {
        router.navigate(nextRoute as never);
      } else {
        await setOnboardingCompleted();
        router.navigate('/app');
      }
    } catch (error) {
      const snackbarMessage =
        error instanceof Error && error.message === 'period_log_overlaps_existing'
          ? t('onboarding.cycleSetup.errors.overlappingPeriods')
          : error instanceof Error && error.message === 'period_date_in_future'
            ? t('onboarding.cycleSetup.errors.futureDate')
            : t('errors.somethingWentWrong');

      await handleError(error, 'CycleSetup.handleFinish', {
        snackbarMessage,
        consoleMessage: 'Error saving cycle setup:',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      {quickStep !== undefined && quickTotal !== undefined ? (
        <QuickSetupProgressBar current={quickStep} total={quickTotal} />
      ) : null}

      <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false}>
        <Text
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}
        >
          {t('onboarding.cycleSetup.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.description')}
        </Text>

        <EditCycleSetupData onFormChange={setCurrentFormData} />

        {/* Past periods section */}
        <View className="mt-8 gap-3">
          <Text className="text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.pastPeriods.title')}
          </Text>
          <Text className="text-sm text-text-secondary">
            {t('onboarding.cycleSetup.pastPeriods.description')}
          </Text>

          {pastPeriods.map((period, index) => (
            <View
              key={period.startDate.getTime()}
              className="flex-row items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: theme.colors.background.card }}
            >
              <Text style={{ color: theme.colors.text.primary }}>
                {period.startDate.toLocaleDateString()}
              </Text>
              <TouchableOpacity onPress={() => handleRemovePastPeriod(index)} className="p-1">
                <Trash2 size={theme.iconSize.md} color={theme.colors.status.error} />
              </TouchableOpacity>
            </View>
          ))}

          {pastPeriods.length < 6 ? (
            <TouchableOpacity
              onPress={handleAddPastPeriod}
              className="flex-row items-center gap-2 rounded-xl border px-4 py-3"
              style={{ borderColor: theme.colors.border.default }}
            >
              <Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />
              <Text style={{ color: theme.colors.accent.primary }}>
                {t('onboarding.cycleSetup.pastPeriods.addPastPeriod')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View pointerEvents="none" style={{ height: theme.spacing.margin['6xl'] }} />
      </ScrollView>

      <BottomButtonWrapper>
        <Button
          label={
            nextRoute ? t('onboarding.fitnessInfo.continue') : t('onboarding.personalInfo.finish')
          }
          onPress={handleFinish}
          variant="accent"
          size="md"
          width="full"
          loading={isSaving}
        />
      </BottomButtonWrapper>

      <DatePickerModal
        visible={isPastPeriodPickerVisible}
        onClose={() => setIsPastPeriodPickerVisible(false)}
        selectedDate={new Date()}
        onDateSelect={handlePastPeriodDateSelect}
        maxDate={localCalendarDayDate(new Date())}
        maxYear={getLocalCalendarYear(new Date())}
        quickDates={getPastPeriodQuickDates(t)}
      />
    </MasterLayout>
  );
}
