import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomButtonWrapper } from '@/components/BottomButtonWrapper';
import { type CycleSetupData, EditCycleSetupData } from '@/components/EditCycleSetupData';
import { MasterLayout } from '@/components/MasterLayout';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { QuickSetupProgressBar } from '@/components/QuickSetupProgressBar';
import { Button } from '@/components/theme/Button';
import DashedButton from '@/components/theme/DashedButton';
import { IconButton } from '@/components/theme/IconButton';
import { useSnackbar } from '@/context/SnackbarContext';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate, localDayStartMs } from '@/utils/calendarDate';
import { periodErrorKey } from '@/utils/cycle/periodErrors';
import type { CycleTrackingMode } from '@/utils/cycle/trackingMode';
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
  contraception: 'none',
  lifeStage: 'regular',
};

export default function CycleSetup() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { createCycle } = useMenstrualCycle();

  const params = useLocalSearchParams<{
    nextRoute?: string;
    quickStep?: string;
    quickTotal?: string;
    tracking?: CycleTrackingMode;
  }>();
  // The tracking choice made on the previous screen decides the starting life stage, once.
  const initialLifeStage = params.tracking === 'symptoms' ? 'no_bleeding' : 'regular';

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

    setIsPastPeriodPickerVisible(false);
    // The picker already stops at today; this guards anything that bypasses it.
    if (localDate.getTime() > today.getTime()) {
      showSnackbar('error', t('cycle.errors.future'));
      return;
    }

    // Said now, next to the list, rather than as an overlap error after "Finish".
    const sameDay = (d: Date | null | undefined) =>
      d != null && localDayStartMs(d) === localDayStartMs(localDate);
    if (
      pastPeriods.some((p) => sameDay(p.startDate)) ||
      sameDay(currentFormData.lastPeriodStartDate)
    ) {
      showSnackbar('error', t('onboarding.cycleSetup.pastPeriods.duplicate'));
      return;
    }

    setPastPeriods((prev) => [...prev, { startDate: localDate }]);
  };

  const handleRemovePastPeriod = (index: number) => {
    setPastPeriods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    const data: CycleSetupData = {
      ...DEFAULT_CYCLE_DATA,
      lifeStage: initialLifeStage,
      ...currentFormData,
    };
    setIsSaving(true);

    try {
      await createCycle({
        config: {
          fallbackCycleLength: data.cycleLength,
          cycleLengthKnown: data.cycleLengthKnown,
          fallbackPeriodDuration: data.periodDuration,
          goals: data.goals ?? [],
        },
        context: {
          lifeStage: data.lifeStage,
          contraception: data.contraception,
        },
        periods: [
          ...(data.lastPeriodStartDate
            ? [{ startDate: localDayStartMs(data.lastPeriodStartDate) }]
            : []),
          ...pastPeriods.map((past) => ({ startDate: localDayStartMs(past.startDate) })),
        ],
      });

      if (nextRoute) {
        router.navigate(nextRoute as never);
      } else {
        await setOnboardingCompleted();
        router.navigate('/app');
      }
    } catch (error) {
      const snackbarMessage = t(periodErrorKey(error));

      await handleError(error, 'CycleSetup.handleFinish', {
        snackbarMessage,
        consoleMessage: 'Error saving cycle setup:',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isSymptomOnly = (currentFormData.lifeStage ?? initialLifeStage) === 'no_bleeding';
  const dateFormat = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <MasterLayout showNavigationMenu={false}>
      {quickStep !== undefined && quickTotal !== undefined ? (
        <QuickSetupProgressBar current={quickStep} total={quickTotal} />
      ) : null}

      <KeyboardAwareScrollView
        bottomOffset={16}
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-8">
          <Text
            className="mb-2 text-3xl font-bold tracking-tight"
            style={{ color: theme.colors.text.primary }}
          >
            {t('onboarding.cycleSetup.title')}
          </Text>
          <Text className="mb-8 text-lg text-text-secondary">
            {t(
              isSymptomOnly
                ? 'cycle.personalize.trackSymptomsHint'
                : 'onboarding.cycleSetup.description'
            )}
          </Text>

          <EditCycleSetupData
            initialData={params.tracking === 'symptoms' ? { lifeStage: 'no_bleeding' } : undefined}
            onFormChange={setCurrentFormData}
          />

          {/* Historical bleeding can be added later from the cycle history. */}
          {!isSymptomOnly ? (
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
                    {dateFormat.format(period.startDate)}
                  </Text>
                  <IconButton
                    icon={Trash2}
                    variant="ghost"
                    size="sm"
                    color={theme.colors.status.error}
                    accessibilityLabel={t('onboarding.cycleSetup.pastPeriods.remove')}
                    onPress={() => handleRemovePastPeriod(index)}
                  />
                </View>
              ))}

              {pastPeriods.length < 6 ? (
                <DashedButton
                  label={t('onboarding.cycleSetup.pastPeriods.addPastPeriod')}
                  icon={<Plus size={theme.iconSize.md} color={theme.colors.accent.primary} />}
                  onPress={handleAddPastPeriod}
                />
              ) : null}
            </View>
          ) : null}

          <View pointerEvents="none" style={{ height: theme.spacing.margin['6xl'] }} />
        </View>
      </KeyboardAwareScrollView>

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
