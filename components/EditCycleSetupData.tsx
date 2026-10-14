import { subWeeks } from 'date-fns';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { ContextFields } from '@/components/cycle/ContextFields';
import { CycleGoals } from '@/components/cycle/CycleGoals';
import { useTheme } from '@/hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate } from '@/utils/calendarDate';
import type { ContraceptionMethod, CycleGoal, CycleLifeStage } from '@/utils/cycle/types';

import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';
import { NumericInput } from './theme/NumericInput';

export type CycleSetupData = {
  lastPeriodStartDate: Date | null;
  cycleLength: number;
  periodDuration: number;
  contraception: ContraceptionMethod;
  lifeStage: CycleLifeStage;
  goals?: CycleGoal[];
};

type EditCycleSetupDataProps = {
  initialData?: Partial<CycleSetupData>;
  onFormChange?: (data: Partial<CycleSetupData>) => void;
  showDatePicker?: boolean;
  /** Life stage and contraception are changed through the context history, not on this form. */
  showContext?: boolean;
};

export function EditCycleSetupData({
  initialData,
  onFormChange,
  showDatePicker = true,
  showContext = true,
}: EditCycleSetupDataProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    initialData?.lastPeriodStartDate ? localCalendarDayDate(initialData.lastPeriodStartDate) : null
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [cycleLength, setCycleLength] = useState(initialData?.cycleLength ?? 28);
  const [periodDuration, setPeriodDuration] = useState(initialData?.periodDuration ?? 5);
  const [contraception, setContraception] = useState<ContraceptionMethod>(
    initialData?.contraception ?? 'none'
  );
  const [lifeStage, setLifeStage] = useState<CycleLifeStage>(initialData?.lifeStage ?? 'regular');

  const [goals, setGoals] = useState<CycleGoal[]>(initialData?.goals ?? []);

  useEffect(() => {
    onFormChange?.({
      lastPeriodStartDate: selectedDate,
      cycleLength,
      periodDuration,
      contraception,
      lifeStage,
      goals,
    });
  }, [selectedDate, cycleLength, periodDuration, contraception, lifeStage, goals, onFormChange]);

  return (
    <>
      <View className="gap-6">
        {showContext ? <CycleGoals value={goals} onChange={setGoals} /> : null}
        {showDatePicker && lifeStage !== 'no_bleeding' ? (
          <View>
            {selectedDate != null ? (
              <DatePickerInput
                label={t('onboarding.cycleSetup.anchor.title')}
                selectedDate={selectedDate}
                onPress={() => setIsDatePickerVisible(true)}
              />
            ) : (
              <View className="gap-2">
                <Text className="text-base font-semibold text-text-secondary">
                  {t('onboarding.cycleSetup.anchor.title')}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsDatePickerVisible(true)}
                  className="rounded-xl border border-border-default px-4 py-4"
                  style={{ borderColor: theme.colors.border.default }}
                >
                  <Text style={{ color: theme.colors.text.secondary }}>
                    {t('onboarding.cycleSetup.anchor.tapToSelect')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {selectedDate != null ? (
              <TouchableOpacity onPress={() => setSelectedDate(null)} className="mt-2 self-start">
                <Text style={{ color: theme.colors.accent.primary }} className="text-sm">
                  {t('onboarding.cycleSetup.anchor.skipInstead')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Usual lengths are unnecessary for symptom-only setup. */}
        {lifeStage !== 'no_bleeding' || !showContext ? (
          <View>
            <Text className="mb-3 text-base font-semibold text-text-secondary">
              {t('onboarding.cycleSetup.length.cycleLength')}
            </Text>
            <View className="flex-row gap-4">
              <NumericInput
                label={t('onboarding.cycleSetup.length.cycleLengthLabel')}
                value={cycleLength.toString()}
                onChangeText={(value) => setCycleLength(parseInt(value, 10) || 0)}
                onIncrement={() => setCycleLength((value) => Math.min(120, value + 1))}
                onDecrement={() => setCycleLength((value) => Math.max(15, value - 1))}
                unit={t('common.days.label')}
              />
              <NumericInput
                label={t('onboarding.cycleSetup.length.periodDurationLabel')}
                value={periodDuration.toString()}
                onChangeText={(value) => setPeriodDuration(parseInt(value, 10) || 0)}
                onIncrement={() => setPeriodDuration((value) => Math.min(30, value + 1))}
                onDecrement={() => setPeriodDuration((value) => Math.max(1, value - 1))}
                unit={t('common.days.label')}
              />
            </View>
          </View>
        ) : null}

        {showContext ? (
          <ContextFields
            lifeStage={lifeStage}
            contraception={contraception}
            onLifeStageChange={setLifeStage}
            onContraceptionChange={setContraception}
          />
        ) : null}
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate ?? new Date()}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setIsDatePickerVisible(false);
        }}
        maxDate={localCalendarDayDate(new Date())}
        maxYear={getLocalCalendarYear(new Date())}
        quickDates={[
          {
            label: t('common.oneWeekAgo'),
            date: localCalendarDayDate(subWeeks(new Date(), 1)),
          },
          {
            label: t('common.weeksAgo', { count: 2 }),
            date: localCalendarDayDate(subWeeks(new Date(), 2)),
          },
          {
            label: t('common.weeksAgo', { count: 4 }),
            date: localCalendarDayDate(subWeeks(new Date(), 4)),
          },
        ]}
      />
    </>
  );
}
