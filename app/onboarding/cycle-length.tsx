import { useRouter } from 'expo-router';
import {
  Activity,
  Calendar as CalendarIcon,
  CheckCircle2,
  HelpCircle,
  Pill,
  ShieldOff,
  Syringe,
  Target,
  Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { BottomPopUpMenu, type BottomPopUpMenuItem } from '../../components/BottomPopUpMenu';
import { GenericCard } from '../../components/cards/GenericCard';
import { MasterLayout } from '../../components/MasterLayout';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { Button } from '../../components/theme/Button';
import { NumericInput } from '../../components/theme/NumericInput';
import { PickerButton } from '../../components/theme/PickerButton';
import { type BirthControlType } from '../../database/models/MenstrualCycle';
import { SyncGoal } from '../../database/models/MenstrualCycle';
import { MenstrualCycleRepository } from '../../database/repositories/MenstrualCycleRepository';
import { theme } from '../../theme';
import { setOnboardingCompleted } from '../../utils/onboardingService';

export default function CycleSetup() {
  const { t } = useTranslation();
  const router = useRouter();

  // Last period date
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  // Cycle lengths
  const [cycleLength, setCycleLength] = useState(28);
  const [periodDuration, setPeriodDuration] = useState(5);

  // Birth control
  const [selectedBirthControl, setSelectedBirthControl] = useState<BirthControlType | 'none'>(
    'none'
  );
  const [isBirthControlPickerVisible, setIsBirthControlPickerVisible] = useState(false);

  // Sync goal
  const [selectedGoal, setSelectedGoal] = useState<SyncGoal>('performance');
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const formatDate = (date: Date): string =>
    date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

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

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      await MenstrualCycleRepository.createNewCycle({
        lastPeriodStartDate: selectedDate.getTime(),
        useHormonalBirthControl: selectedBirthControl !== 'none',
        birthControlType: selectedBirthControl !== 'none' ? selectedBirthControl : undefined,
        avgCycleLength: cycleLength,
        avgPeriodDuration: periodDuration,
        syncGoal: selectedGoal,
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

        {/* Last period date */}
        <Text className="mb-3 text-base font-semibold text-text-secondary">
          {t('onboarding.cycleSetup.anchor.title')}
        </Text>
        <GenericCard isPressable onPress={() => setIsDatePickerVisible(true)} variant="card">
          <View className="flex-row items-center p-6">
            <View
              className="mr-4 h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.accent.primary20 }}
            >
              <CalendarIcon size={24} color={theme.colors.accent.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm text-text-secondary">
                {t('onboarding.cycleSetup.anchor.title')}
              </Text>
              <Text className="text-xl font-bold text-text-primary">
                {formatDate(selectedDate)}
              </Text>
            </View>
          </View>
        </GenericCard>

        {/* Cycle lengths */}
        <Text className="mb-3 mt-6 text-base font-semibold text-text-secondary">
          {t('onboarding.cycleSetup.length.cycleLength')}
        </Text>
        <View className="flex-row gap-4">
          <NumericInput
            label={t('onboarding.cycleSetup.length.cycleLength')}
            value={cycleLength.toString()}
            onChangeText={(v) => setCycleLength(parseInt(v) || 0)}
            onIncrement={() => setCycleLength((v) => Math.min(45, v + 1))}
            onDecrement={() => setCycleLength((v) => Math.max(15, v - 1))}
            unit={t('common.days', 'Days')}
          />
          <NumericInput
            label={t('onboarding.cycleSetup.length.periodDuration')}
            value={periodDuration.toString()}
            onChangeText={(v) => setPeriodDuration(parseInt(v) || 0)}
            onIncrement={() => setPeriodDuration((v) => Math.min(10, v + 1))}
            onDecrement={() => setPeriodDuration((v) => Math.max(1, v - 1))}
            unit={t('common.days', 'Days')}
          />
        </View>

        {/* Birth control */}
        <Text className="mb-3 mt-6 text-base font-semibold text-text-secondary">
          {t('onboarding.cycleSetup.birthControl.title')}
        </Text>
        <PickerButton
          label={selectedBC.title}
          icon={<SelectedBCIcon size={theme.iconSize.lg} color={selectedBC.iconColor} />}
          onPress={() => setIsBirthControlPickerVisible(true)}
        />

        {/* Sync goal */}
        <Text className="mb-3 mt-6 text-base font-semibold text-text-secondary">
          {t('onboarding.cycleSetup.goal.title')}
        </Text>
        <PickerButton
          label={selectedGoalOption.title}
          icon={<SelectedGoalIcon size={theme.iconSize.lg} color={selectedGoalOption.iconColor} />}
          onPress={() => setIsGoalPickerVisible(true)}
        />

        <View className="h-6" />
      </ScrollView>

      <DatePickerModal
        visible={isDatePickerVisible}
        onClose={() => setIsDatePickerVisible(false)}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setIsDatePickerVisible(false);
        }}
        maxYear={new Date().getFullYear()}
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
