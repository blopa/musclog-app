import { subWeeks } from 'date-fns';
import {
  Activity,
  Baby,
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
import { Text, TouchableOpacity, View } from 'react-native';

import { type BirthControlType, type LifeStage } from '@/database/models';
import { SyncGoal } from '@/database/models/MenstrualCycle';
import { useTheme } from '@/hooks/useTheme';
import { getLocalCalendarYear, localCalendarDayDate } from '@/utils/calendarDate';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from './BottomPopUpMenu';
import { DatePickerInput } from './modals/DatePickerInput';
import { DatePickerModal } from './modals/DatePickerModal';
import { PickerButton } from './theme/PickerButton';

export type CycleSetupData = {
  lastPeriodStartDate: Date | null;
  birthControlType: BirthControlType | 'none';
  syncGoal: SyncGoal;
  lifeStage: LifeStage;
};

type EditCycleSetupDataProps = {
  initialData?: Partial<CycleSetupData>;
  onFormChange?: (data: Partial<CycleSetupData>) => void;
  showDatePicker?: boolean;
};

export function EditCycleSetupData({
  initialData,
  onFormChange,
  showDatePicker = true,
}: EditCycleSetupDataProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    initialData?.lastPeriodStartDate ? localCalendarDayDate(initialData.lastPeriodStartDate) : null
  );
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [selectedBirthControl, setSelectedBirthControl] = useState<BirthControlType | 'none'>(
    initialData?.birthControlType ?? 'none'
  );
  const [isBirthControlPickerVisible, setIsBirthControlPickerVisible] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SyncGoal>(
    initialData?.syncGoal ?? 'performance'
  );
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);
  const [selectedLifeStage, setSelectedLifeStage] = useState<LifeStage>(
    initialData?.lifeStage ?? 'regular'
  );
  const [isLifeStagePickerVisible, setIsLifeStagePickerVisible] = useState(false);

  useEffect(() => {
    onFormChange?.({
      lastPeriodStartDate: selectedDate,
      birthControlType: selectedBirthControl,
      syncGoal: selectedGoal,
      lifeStage: selectedLifeStage,
    });
  }, [selectedDate, selectedBirthControl, selectedGoal, selectedLifeStage, onFormChange]);

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

  const lifeStageOptions: (BottomPopUpMenuItem & { value: LifeStage })[] = [
    {
      value: 'regular',
      title: t('onboarding.cycleSetup.lifeStage.regular'),
      description: t('onboarding.cycleSetup.lifeStage.regularDescription'),
      icon: CheckCircle2,
      iconColor: theme.colors.status.success,
      iconBgColor: theme.colors.status.success20,
      onPress: () => setSelectedLifeStage('regular'),
    },
    {
      value: 'pcos',
      title: t('onboarding.cycleSetup.lifeStage.pcos'),
      description: t('onboarding.cycleSetup.lifeStage.pcosDescription'),
      icon: Activity,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      onPress: () => setSelectedLifeStage('pcos'),
    },
    {
      value: 'perimenopause',
      title: t('onboarding.cycleSetup.lifeStage.perimenopause'),
      description: t('onboarding.cycleSetup.lifeStage.perimenopauseDescription'),
      icon: Zap,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple10,
      onPress: () => setSelectedLifeStage('perimenopause'),
    },
    {
      value: 'postpartum',
      title: t('onboarding.cycleSetup.lifeStage.postpartum'),
      description: t('onboarding.cycleSetup.lifeStage.postpartumDescription'),
      icon: Baby,
      iconColor: theme.colors.rose.brand,
      iconBgColor: theme.colors.rose.brand10,
      onPress: () => setSelectedLifeStage('postpartum'),
    },
    {
      value: 'post_pill',
      title: t('onboarding.cycleSetup.lifeStage.postPill'),
      description: t('onboarding.cycleSetup.lifeStage.postPillDescription'),
      icon: Pill,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
      onPress: () => setSelectedLifeStage('post_pill'),
    },
  ];

  const selectedBC = birthControlOptions.find((o) => o.value === selectedBirthControl)!;
  const SelectedBCIcon = selectedBC.icon;
  const selectedGoalOption = goalOptions.find((g) => g.value === selectedGoal)!;
  const SelectedGoalIcon = selectedGoalOption.icon;
  const selectedLifeStageOption = lifeStageOptions.find((o) => o.value === selectedLifeStage)!;
  const SelectedLifeStageIcon = selectedLifeStageOption.icon;

  return (
    <>
      <View className="gap-6">
        {showDatePicker ? (
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

        {/* Life stage */}
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.lifeStage.title')}
          </Text>
          <PickerButton
            label={selectedLifeStageOption.title}
            icon={
              <SelectedLifeStageIcon
                size={theme.iconSize.lg}
                color={selectedLifeStageOption.iconColor}
              />
            }
            onPress={() => setIsLifeStagePickerVisible(true)}
          />
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
        selectedDate={selectedDate ?? new Date()}
        onDateSelect={(date) => {
          setSelectedDate(localCalendarDayDate(date));
          setIsDatePickerVisible(false);
        }}
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

      <BottomPopUpMenu
        visible={isLifeStagePickerVisible}
        onClose={() => setIsLifeStagePickerVisible(false)}
        title={t('onboarding.cycleSetup.lifeStage.title')}
        items={lifeStageOptions.map((o) => ({
          ...o,
          onPress: () => {
            o.onPress();
            setIsLifeStagePickerVisible(false);
          },
        }))}
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
