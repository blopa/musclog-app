import {
  Activity,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  Medal,
  Move,
  Ruler,
  Save,
  Scale,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FitnessGoal, LiftingExperience, WeightGoal } from '../database/models';
import { useTheme } from '../hooks/useTheme';
import { getHeightUnit, getWeightUnit } from '../utils/units';
import { BottomPopUpMenu } from './BottomPopUpMenu';
import { MaybeLaterButton } from './MaybeLaterButton';
import { OptionsSelector } from './OptionsSelector';
import { Button } from './theme/Button';
import { PickerButton } from './theme/PickerButton';
import { SegmentedControl } from './theme/SegmentedControl';
import { Slider } from './theme/Slider';
import { TextInput } from './theme/TextInput';

type EditFitnessDetailsBodyProps = {
  onClose: () => void;
  onSave?: (data: FitnessDetails) => void;
  onFormChange?: (data: Partial<FitnessDetails>) => void;
  initialData?: Partial<FitnessDetails>;
  isLoading?: boolean;
  onMaybeLater?: () => void;
  hideSaveButton?: boolean;
  hideMaybeLaterButton?: boolean;
};

export type FitnessDetails = {
  units: 'imperial' | 'metric';
  weight: string;
  height: string;
  fatPercentage: number;
  weightGoal: WeightGoal;
  fitnessGoal: FitnessGoal;
  activityLevel: number;
  experience: LiftingExperience;
};

export function EditFitnessDetailsBody({
  onClose,
  onSave,
  onFormChange,
  initialData,
  isLoading,
  onMaybeLater,
  hideSaveButton = false,
  hideMaybeLaterButton = false,
}: EditFitnessDetailsBodyProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [units, setUnits] = useState<'imperial' | 'metric'>(initialData?.units ?? 'metric');
  const [weight, setWeight] = useState(initialData?.weight ?? '0.0');
  const [height, setHeight] = useState(initialData?.height ?? '0');
  const [weightGoal, setWeightGoal] = useState<WeightGoal>(initialData?.weightGoal ?? 'maintain');
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(
    initialData?.fitnessGoal ?? 'general'
  );
  const [activityLevel, setActivityLevel] = useState(initialData?.activityLevel ?? 3);
  const [experience, setExperience] = useState<LiftingExperience>(
    initialData?.experience ?? 'intermediate'
  );
  const [fatPercentage, setFatPercentage] = useState(initialData?.fatPercentage ?? 15);

  // Call onFormChange whenever form data changes
  useEffect(() => {
    if (onFormChange) {
      onFormChange({
        units,
        weight,
        height,
        fatPercentage,
        weightGoal,
        fitnessGoal,
        activityLevel,
        experience,
      });
    }
  }, [
    units,
    weight,
    height,
    fatPercentage,
    weightGoal,
    fitnessGoal,
    activityLevel,
    experience,
    onFormChange,
  ]);
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);
  const [isActivityPickerVisible, setIsActivityPickerVisible] = useState(false);

  const handleSave = () => {
    onSave?.({
      units,
      weight,
      height,
      fatPercentage,
      weightGoal,
      fitnessGoal,
      activityLevel,
      experience,
    });
    onClose();
  };

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
      <View className="flex-1 gap-8 px-4 pb-6 pt-2">
        {/* Units Section */}
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
                    color={units === 'imperial' ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  />
                ),
              },
              { 
                label: t('editFitnessDetails.metric'), 
                value: 'metric',
                icon: (
                  <Ruler
                    size={theme.iconSize.md}
                    color={units === 'metric' ? theme.colors.accent.primary : theme.colors.text.tertiary}
                  />
                ),
              },
            ]}
            value={units}
            onValueChange={(val) => setUnits(val as 'imperial' | 'metric')}
          />
        </View>

        {/* Body Stats Section */}
        <View className="gap-4">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.bodyStats')}
          </Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <TextInput
                label={t('editFitnessDetails.currentWeight')}
                value={parseFloat(weight).toFixed(1)}
                onChangeText={setWeight}
                placeholder="0.0"
                keyboardType="numeric"
                selectTextOnFocus={true}
                icon={
                  <Text className="text-center text-sm font-medium text-text-tertiary">
                    {getWeightUnit(units)}
                  </Text>
                }
              />
            </View>
            <View className="flex-1">
              <TextInput
                label={t('editFitnessDetails.height')}
                value={parseFloat(height).toFixed(0)}
                onChangeText={setHeight}
                placeholder="0"
                keyboardType="numeric"
                selectTextOnFocus={true}
                icon={
                  <Text className="text-center text-sm font-medium text-text-tertiary">
                    {getHeightUnit(units)}
                  </Text>
                }
              />
            </View>
          </View>
          {/* Fat Percentage Slider */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-secondary">
                {t('editFitnessDetails.fatPercentage')}
              </Text>
              <Text className="text-sm font-medium text-text-primary">
                {fatPercentage.toFixed(1)}%
              </Text>
            </View>
            <Slider
              value={fatPercentage}
              min={5}
              max={50}
              step={0.5}
              onChange={setFatPercentage}
              variant="gradient"
              useGradient={true}
            />
          </View>
        </View>

        {/* Goals & Strategy Section */}
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

        {/* Lifestyle Context Section */}
        <View className="gap-6">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.lifestyleContext')}
          </Text>

          {/* Activity Level */}
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

          {/* Lifting Experience */}
          <OptionsSelector
            title={t('editFitnessDetails.liftingExperience')}
            options={experienceOptions}
            selectedId={experience}
            onSelect={setExperience}
          />
        </View>

        {!hideSaveButton ? (
          <View className="px-4 pb-8 pt-4">
            <Button
              label={t('editFitnessDetails.saveChanges')}
              icon={Save}
              variant="accent"
              size="md"
              width="full"
              loading={isLoading}
              onPress={handleSave}
            />
          </View>
        ) : null}
        {!hideMaybeLaterButton && onMaybeLater ? (
          <View className="px-4 pb-4">
            <MaybeLaterButton
              onPress={onMaybeLater}
              text={t('onboarding.healthConnect.maybeLater')}
            />
          </View>
        ) : null}
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
