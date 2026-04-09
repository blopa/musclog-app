import {
  Activity,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  Medal,
  Move,
  Ruler,
  Scale,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FitnessGoal, LiftingExperience, WeightGoal } from '@/database/models';
import { useTheme } from '@/hooks/useTheme';

import { BottomPopUpMenu } from './BottomPopUpMenu';
import { OptionsSelector } from './OptionsSelector';
import { PickerButton } from './theme/PickerButton';
import { SegmentedControl } from './theme/SegmentedControl';

export type FitnessGoals = {
  units: 'imperial' | 'metric';
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
  activityLevel: number;
  experience: LiftingExperience;
};

type EditFitnessGoalsBodyProps = {
  initialData?: Partial<FitnessGoals>;
  onFormChange?: (data: FitnessGoals) => void;
};

export function EditFitnessGoalsBody({ initialData, onFormChange }: EditFitnessGoalsBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [units, setUnits] = useState<'imperial' | 'metric'>(initialData?.units ?? 'metric');
  const [weightGoal, setWeightGoal] = useState<WeightGoal>(initialData?.weightGoal ?? 'maintain');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(
    initialData?.fitnessGoal ?? 'general'
  );
  const [activityLevel, setActivityLevel] = useState(initialData?.activityLevel ?? 3);
  const [experience, setExperience] = useState<LiftingExperience>(
    initialData?.experience ?? 'intermediate'
  );
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);
  const [isActivityPickerVisible, setIsActivityPickerVisible] = useState(false);

  useEffect(() => {
    onFormChange?.({
      units,
      weightGoal,
      fitnessGoal,
      activityLevel,
      experience,
    });
  }, [units, weightGoal, fitnessGoal, activityLevel, experience, onFormChange]);

  const activityLevelOptions = [
    {
      level: 1,
      title: t('editFitnessDetails.activityLevelLabels.sedentary'),
      description: t('editFitnessDetails.activityLevelDescriptions.sedentary'),
      icon: Coffee,
      iconColor: theme.colors.text.tertiary,
      iconBgColor: theme.colors.background.white5,
    },
    {
      level: 2,
      title: t('editFitnessDetails.activityLevelLabels.light'),
      description: t('editFitnessDetails.activityLevelDescriptions.light'),
      icon: Move,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
    },
    {
      level: 3,
      title: t('editFitnessDetails.activityLevelLabels.moderate'),
      description: t('editFitnessDetails.activityLevelDescriptions.moderate'),
      icon: Activity,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
    },
    {
      level: 4,
      title: t('editFitnessDetails.activityLevelLabels.active'),
      description: t('editFitnessDetails.activityLevelDescriptions.active'),
      icon: Zap,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
    },
    {
      level: 5,
      title: t('editFitnessDetails.activityLevelLabels.superActive'),
      description: t('editFitnessDetails.activityLevelDescriptions.superActive'),
      icon: Flame,
      iconColor: theme.colors.rose.brand,
      iconBgColor: theme.colors.rose.brand10,
    },
  ];

  const currentActivityLabel =
    activityLevelOptions.find((opt) => opt.level === activityLevel)?.title || '';

  const fitnessGoalOptions: {
    value: FitnessGoal;
    title: string;
    description: string;
    icon: typeof Activity;
    iconColor: string;
    iconBgColor: string;
  }[] = [
    {
      value: 'hypertrophy',
      title: t('editFitnessDetails.fitnessGoalLabels.hypertrophy'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.hypertrophy'),
      icon: Activity,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
    },
    {
      value: 'strength',
      title: t('editFitnessDetails.fitnessGoalLabels.strength'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.strength'),
      icon: Zap,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
    },
    {
      value: 'endurance',
      title: t('editFitnessDetails.fitnessGoalLabels.endurance'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.endurance'),
      icon: Timer,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
    },
    {
      value: 'weight_loss',
      title: t('editFitnessDetails.fitnessGoalLabels.weightLoss'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.weightLoss'),
      icon: Target,
      iconColor: theme.colors.rose.brand,
      iconBgColor: theme.colors.rose.brand10,
    },
    {
      value: 'general',
      title: t('editFitnessDetails.fitnessGoalLabels.general'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.general'),
      icon: Heart,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple20,
    },
  ];

  const experienceOptions = [
    {
      id: 'beginner' as const,
      label: t('editFitnessDetails.experienceLabels.beginner'),
      description: t('editFitnessDetails.experienceDescriptions.beginner'),
      icon: Dumbbell,
      iconBgColor: theme.colors.background.white5,
      iconColor: theme.colors.text.tertiary,
    },
    {
      id: 'intermediate' as const,
      label: t('editFitnessDetails.experienceLabels.intermediate'),
      description: t('editFitnessDetails.experienceDescriptions.intermediate'),
      icon: Trophy,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
    },
    {
      id: 'advanced' as const,
      label: t('editFitnessDetails.experienceLabels.advanced'),
      description: t('editFitnessDetails.experienceDescriptions.advanced'),
      icon: Medal,
      iconBgColor: theme.colors.rose.brand10,
      iconColor: theme.colors.rose.brand,
    },
  ];

  const selectedActivityOption =
    activityLevelOptions.find((opt) => opt.level === activityLevel) || activityLevelOptions[2];
  const SelectedActivityIcon = selectedActivityOption.icon;

  const selectedGoalOption =
    fitnessGoalOptions.find((opt) => opt.value === fitnessGoal) || fitnessGoalOptions[0];
  const SelectedGoalIcon = selectedGoalOption.icon;

  return (
    <>
      <View className="gap-8 px-4 pb-6 pt-2">
        {/* Units */}
        <View className="gap-2">
          <Text className="ml-1 text-sm font-semibold text-text-tertiary">
            {t('editFitnessDetails.units')}
          </Text>
          <SegmentedControl
            options={[
              {
                label: t('editFitnessDetails.imperial'),
                value: 'imperial',
                icon: (
                  <Scale
                    size={theme.iconSize.md}
                    color={
                      units === 'imperial'
                        ? theme.colors.accent.primary
                        : theme.colors.text.tertiary
                    }
                  />
                ),
              },
              {
                label: t('editFitnessDetails.metric'),
                value: 'metric',
                icon: (
                  <Ruler
                    size={theme.iconSize.md}
                    color={
                      units === 'metric' ? theme.colors.accent.primary : theme.colors.text.tertiary
                    }
                  />
                ),
              },
            ]}
            value={units}
            onValueChange={(val) => setUnits(val as 'imperial' | 'metric')}
          />
        </View>

        {/* Goals & Strategy */}
        <View className="gap-4">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.goalsStrategy')}
          </Text>
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.weightGoal')}
            </Text>
            <SegmentedControl
              options={[
                { label: t('editFitnessDetails.weightGoalLabels.lose'), value: 'lose' },
                { label: t('editFitnessDetails.weightGoalLabels.maintain'), value: 'maintain' },
                { label: t('editFitnessDetails.weightGoalLabels.gain'), value: 'gain' },
              ]}
              value={weightGoal}
              onValueChange={(val) => setWeightGoal(val as WeightGoal)}
            />
          </View>
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.fitnessGoal')}
            </Text>
            <PickerButton
              label={selectedGoalOption.title}
              icon={
                <SelectedGoalIcon
                  size={theme.iconSize.lg}
                  color={selectedGoalOption.iconColor || theme.colors.accent.primary}
                />
              }
              onPress={() => setIsGoalPickerVisible(true)}
            />
          </View>
        </View>

        {/* Lifestyle Context */}
        <View className="gap-6">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.lifestyleContext')}
          </Text>

          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.activityLevel')}
            </Text>
            <PickerButton
              label={currentActivityLabel}
              icon={
                <SelectedActivityIcon
                  size={theme.iconSize.lg}
                  color={selectedActivityOption.iconColor || theme.colors.accent.primary}
                />
              }
              onPress={() => setIsActivityPickerVisible(true)}
            />
          </View>

          <OptionsSelector
            title={t('editFitnessDetails.liftingExperience')}
            options={experienceOptions}
            selectedId={experience}
            onSelect={setExperience}
          />
        </View>
      </View>

      <BottomPopUpMenu
        visible={isGoalPickerVisible}
        onClose={() => setIsGoalPickerVisible(false)}
        title={t('editFitnessDetails.selectGoal')}
        subtitle={t('editFitnessDetails.selectGoalSubtitle')}
        items={fitnessGoalOptions.map((option) => ({
          ...option,
          onPress: () => {
            setFitnessGoal(option.value);
            setIsGoalPickerVisible(false);
          },
        }))}
      />
      <BottomPopUpMenu
        visible={isActivityPickerVisible}
        onClose={() => setIsActivityPickerVisible(false)}
        title={t('editFitnessDetails.selectActivity')}
        subtitle={t('editFitnessDetails.selectActivitySubtitle')}
        items={activityLevelOptions.map((option) => ({
          ...option,
          onPress: () => {
            setActivityLevel(option.level);
            setIsActivityPickerVisible(false);
          },
        }))}
      />
    </>
  );
}
