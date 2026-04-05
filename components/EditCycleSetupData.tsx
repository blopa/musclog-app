import {
  Activity,
  CheckCircle2,
  HelpCircle,
  Pill,
  ShieldOff,
  Syringe,
  Target,
  Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { type BirthControlType } from '../database/models';
import { SyncGoal } from '../database/models/MenstrualCycle';
import { useTheme } from '../hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate } from '../utils/calendarDate';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from './BottomPopUpMenu';
import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';
import { NumericInput } from './theme/NumericInput';
import { PickerButton } from './theme/PickerButton';

export type CycleSetupData = {
  lastPeriodStartDate: Date;
  cycleLength: number;
  periodDuration: number;
  birthControlType: BirthControlType | 'none';
  syncGoal: SyncGoal;
};

type EditCycleSetupDataProps = {
  initialData?: Partial<CycleSetupData>;
  onFormChange?: (data: Partial<CycleSetupData>) => void;
};

export function EditCycleSetupData({ initialData, onFormChange }: EditCycleSetupDataProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    localCalendarDayDate(initialData?.lastPeriodStartDate ?? new Date())
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [cycleLength, setCycleLength] = useState(initialData?.cycleLength ?? 28);
  const [periodDuration, setPeriodDuration] = useState(initialData?.periodDuration ?? 5);
  const [selectedBirthControl, setSelectedBirthControl] = useState<BirthControlType | 'none'>(
    initialData?.birthControlType ?? 'none'
  );
  const [isBirthControlPickerVisible, setIsBirthControlPickerVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SyncGoal>(
    initialData?.syncGoal ?? 'performance'
  );
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);

  useEffect(() => {
    onFormChange?.({
      lastPeriodStartDate: selectedDate,
      cycleLength,
      periodDuration,
      birthControlType: selectedBirthControl,
      syncGoal: selectedGoal,
    });
  }, [selectedDate, cycleLength, periodDuration, selectedBirthControl, selectedGoal, onFormChange]);

  const birthControlOptions: (BottomPopUpMenuItem & { value: BirthControlType | 'none' })[] = [
    {
      value: 'none',
      title: t('onboarding.cycleSetup.birthControl.none'),
      description: t('onboarding.cycleSetup.birthControl.noneDescription'),
      icon: CheckCircle2,
      iconColor: theme.colors.status.success,
      iconBgColor: theme.colors.status.success20,
      onPress: () => setSelectedBirthControl('none'),
    },
    {
      value: 'pill',
      title: t('onboarding.cycleSetup.birthControl.pill'),
      description: t('onboarding.cycleSetup.birthControl.pillDescription'),
      icon: Pill,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      onPress: () => setSelectedBirthControl('pill'),
    },
    {
      value: 'iud',
      title: t('onboarding.cycleSetup.birthControl.iud'),
      description: t('onboarding.cycleSetup.birthControl.iudDescription'),
      icon: ShieldOff,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
      onPress: () => setSelectedBirthControl('iud'),
    },
    {
      value: 'implant',
      title: t('onboarding.cycleSetup.birthControl.implant'),
      description: t('onboarding.cycleSetup.birthControl.implantDescription'),
      icon: Syringe,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      onPress: () => setSelectedBirthControl('implant'),
    },
    {
      value: 'other',
      title: t('onboarding.cycleSetup.birthControl.other'),
      description: t('onboarding.cycleSetup.birthControl.otherDescription'),
      icon: HelpCircle,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      onPress: () => setSelectedBirthControl('other'),
    },
  ];

  const goalOptions: (BottomPopUpMenuItem & { value: SyncGoal })[] = [
    {
      value: 'performance',
      title: t('onboarding.cycleSetup.goal.performance'),
      description: t('onboarding.cycleSetup.goal.performanceDescription'),
      icon: Target,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
      onPress: () => setSelectedGoal('performance'),
    },
    {
      value: 'symptoms',
      title: t('onboarding.cycleSetup.goal.symptoms'),
      description: t('onboarding.cycleSetup.goal.symptomsDescription'),
      icon: Activity,
      iconColor: theme.colors.rose.brand,
      iconBgColor: theme.colors.rose.brand10,
      onPress: () => setSelectedGoal('symptoms'),
    },
    {
      value: 'energy',
      title: t('onboarding.cycleSetup.goal.energy'),
      description: t('onboarding.cycleSetup.goal.energyDescription'),
      icon: Zap,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      onPress: () => setSelectedGoal('energy'),
    },
  ];

  const selectedBC = birthControlOptions.find((o) => o.value === selectedBirthControl)!;
  const SelectedBCIcon = selectedBC.icon;
  const selectedGoalOption = goalOptions.find((g) => g.value === selectedGoal)!;
  const SelectedGoalIcon = selectedGoalOption.icon;

  return (
    <>
      <View className="gap-6">
        <DatePickerInput
          label={t('onboarding.cycleSetup.anchor.title')}
          selectedDate={selectedDate}
          onPress={() => setIsDatePickerVisible(true)}
        />

        {/* Cycle lengths */}
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.length.cycleLength')}
          </Text>
          <View className="flex-row gap-4">
            <NumericInput
              label={t('onboarding.cycleSetup.length.cycleLengthLabel')}
              value={cycleLength.toString()}
              onChangeText={(v) => setCycleLength(parseInt(v) || 0)}
              onIncrement={() => setCycleLength((v) => Math.min(45, v + 1))}
              onDecrement={() => setCycleLength((v) => Math.max(15, v - 1))}
              unit={t('common.days.label')}
            />
            <NumericInput
              label={t('onboarding.cycleSetup.length.periodDurationLabel')}
              value={periodDuration.toString()}
              onChangeText={(v) => setPeriodDuration(parseInt(v) || 0)}
              onIncrement={() => setPeriodDuration((v) => Math.min(10, v + 1))}
              onDecrement={() => setPeriodDuration((v) => Math.max(1, v - 1))}
              unit={t('common.days.label')}
            />
          </View>
        </View>

        {/* Birth control */}
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.birthControl.title')}
          </Text>
          <PickerButton
            label={selectedBC.title}
            icon={<SelectedBCIcon size={theme.iconSize.lg} color={selectedBC.iconColor} />}
            onPress={() => setIsBirthControlPickerVisible(true)}
          />
        </View>

        {/* Sync goal */}
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.goal.title')}
          </Text>
          <PickerButton
            label={selectedGoalOption.title}
            icon={
              <SelectedGoalIcon size={theme.iconSize.lg} color={selectedGoalOption.iconColor} />
            }
            onPress={() => setIsGoalPickerVisible(true)}
          />
        </View>
      </View>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setIsDatePickerVisible(false);
        }}
        maxYear={getLocalCalendarYear(new Date())}
      />

      <BottomPopUpMenu
        visible={isBirthControlPickerVisible}
        onClose={() => setIsBirthControlPickerVisible(false)}
        title={t('onboarding.cycleSetup.birthControl.title')}
        items={birthControlOptions.map((o) => ({
          ...o,
          onPress: () => {
            o.onPress();
            setIsBirthControlPickerVisible(false);
          },
        }))}
      />

      <BottomPopUpMenu
        visible={isGoalPickerVisible}
        onClose={() => setIsGoalPickerVisible(false)}
        title={t('onboarding.cycleSetup.goal.title')}
        items={goalOptions.map((g) => ({
          ...g,
          onPress: () => {
            g.onPress();
            setIsGoalPickerVisible(false);
          },
        }))}
      />
    </>
  );
}
