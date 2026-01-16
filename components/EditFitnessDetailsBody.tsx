import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Dumbbell,
  CheckCircle2,
  Save,
  Trophy,
  Medal,
  Activity,
  Zap,
  Timer,
  Heart,
  Coffee,
  Move,
  Flame,
  Target,
} from 'lucide-react-native';
import { theme } from '../theme';
import { TextInput } from './theme/TextInput';
import { SegmentedControl } from './theme/SegmentedControl';
import { Button } from './theme/Button';
import { PickerButton } from './theme/PickerButton';
import { BottomPopUpMenu } from './BottomPopUpMenu';

type EditFitnessDetailsBodyProps = {
  onClose: () => void;
  onSave?: (data: FitnessDetails) => void;
  initialData?: Partial<FitnessDetails>;
};

export type FitnessDetails = {
  units: 'imperial' | 'metric';
  weight: string;
  height: string;
  fitnessGoal: string;
  eatingPhase: 'cut' | 'maintain' | 'bulk';
  activityLevel: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
};

export function EditFitnessDetailsBody({
  onClose,
  onSave,
  initialData,
}: EditFitnessDetailsBodyProps) {
  const { t } = useTranslation();
  const [units, setUnits] = useState<'imperial' | 'metric'>(initialData?.units ?? 'metric');
  const [weight, setWeight] = useState(initialData?.weight ?? '0.0');
  const [height, setHeight] = useState(initialData?.height ?? '0');
  const [fitnessGoal, setFitnessGoal] = useState(
    initialData?.fitnessGoal ?? t('editFitnessDetails.fitnessGoalLabels.hypertrophy')
  );
  const [eatingPhase, setEatingPhase] = useState<'cut' | 'maintain' | 'bulk'>(
    initialData?.eatingPhase ?? 'maintain'
  );
  const [activityLevel, setActivityLevel] = useState(initialData?.activityLevel ?? 3);
  const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    initialData?.experience ?? 'intermediate'
  );
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);
  const [isActivityPickerVisible, setIsActivityPickerVisible] = useState(false);

  const handleSave = () => {
    onSave?.({
      units,
      weight,
      height,
      fitnessGoal,
      eatingPhase,
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

  const fitnessGoalOptions = [
    {
      title: t('editFitnessDetails.fitnessGoalLabels.hypertrophy'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.hypertrophy'),
      icon: Activity,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
    },
    {
      title: t('editFitnessDetails.fitnessGoalLabels.strength'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.strength'),
      icon: Zap,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
    },
    {
      title: t('editFitnessDetails.fitnessGoalLabels.endurance'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.endurance'),
      icon: Timer,
      iconColor: theme.colors.status.info,
      iconBgColor: theme.colors.status.info10,
    },
    {
      title: t('editFitnessDetails.fitnessGoalLabels.weightLoss'),
      description: t('editFitnessDetails.fitnessGoalDescriptions.weightLoss'),
      icon: Target,
      iconColor: theme.colors.rose.brand,
      iconBgColor: theme.colors.rose.brand10,
    },
    {
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
      title: t('editFitnessDetails.experienceLabels.beginner'),
      description: t('editFitnessDetails.experienceDescriptions.beginner'),
      icon: Dumbbell,
    },
    {
      id: 'intermediate' as const,
      title: t('editFitnessDetails.experienceLabels.intermediate'),
      description: t('editFitnessDetails.experienceDescriptions.intermediate'),
      icon: Trophy,
    },
    {
      id: 'advanced' as const,
      title: t('editFitnessDetails.experienceLabels.advanced'),
      description: t('editFitnessDetails.experienceDescriptions.advanced'),
      icon: Medal,
    },
  ];

  const selectedActivityOption =
    activityLevelOptions.find((opt) => opt.level === activityLevel) || activityLevelOptions[2];
  const SelectedActivityIcon = selectedActivityOption.icon;

  const selectedGoalOption =
    fitnessGoalOptions.find((opt) => opt.title === fitnessGoal) || fitnessGoalOptions[0];
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
              { label: t('editFitnessDetails.imperial'), value: 'imperial' },
              { label: t('editFitnessDetails.metric'), value: 'metric' },
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
                value={weight}
                onChangeText={setWeight}
                placeholder="0.0"
                keyboardType="numeric"
                icon={<Text className="text-sm font-medium text-text-tertiary">kg</Text>}
              />
            </View>
            <View className="flex-1">
              <TextInput
                label={t('editFitnessDetails.height')}
                value={height}
                onChangeText={setHeight}
                placeholder="0"
                keyboardType="numeric"
                icon={<Text className="text-sm font-medium text-text-tertiary">cm</Text>}
              />
            </View>
          </View>
        </View>

        {/* Goals & Strategy Section */}
        <View className="gap-4">
          <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
            {t('editFitnessDetails.goalsStrategy')}
          </Text>
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.fitnessGoal')}
            </Text>
            <PickerButton
              label={fitnessGoal}
              icon={
                <SelectedGoalIcon
                  size={20}
                  color={selectedGoalOption.iconColor || theme.colors.accent.primary}
                />
              }
              onPress={() => setIsGoalPickerVisible(true)}
            />
          </View>
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.eatingPhase')}
            </Text>
            <SegmentedControl
              options={[
                { label: t('editFitnessDetails.cut'), value: 'cut' },
                { label: t('editFitnessDetails.maintain'), value: 'maintain' },
                { label: t('editFitnessDetails.bulk'), value: 'bulk' },
              ]}
              value={eatingPhase}
              onValueChange={(val) => setEatingPhase(val as 'cut' | 'maintain' | 'bulk')}
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
                  size={20}
                  color={selectedActivityOption.iconColor || theme.colors.accent.primary}
                />
              }
              onPress={() => setIsActivityPickerVisible(true)}
            />
          </View>

          {/* Lifting Experience */}
          <View className="gap-2">
            <Text className="ml-1 text-sm font-medium text-text-secondary">
              {t('editFitnessDetails.liftingExperience')}
            </Text>
            <View className="gap-2">
              {experienceOptions.map((option) => {
                const isSelected = experience === option.id;
                const Icon = option.icon;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setExperience(option.id)}
                    className={`flex-row items-center gap-3 rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-accent-primary bg-bg-card'
                        : 'border-white/5 bg-bg-card active:bg-white/5'
                    }`}>
                    <View
                      className={`h-10 w-10 items-center justify-center rounded-full ${
                        isSelected ? 'bg-accent-primary' : 'bg-white/5'
                      }`}>
                      <Icon size={20} color={isSelected ? 'black' : theme.colors.text.tertiary} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-text-primary">{option.title}</Text>
                      <Text className="text-xs text-text-tertiary">{option.description}</Text>
                    </View>
                    {isSelected && <CheckCircle2 size={20} color={theme.colors.accent.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View className="px-4 pb-8 pt-4">
          <Button
            label={t('editFitnessDetails.saveChanges')}
            icon={Save}
            variant="accent"
            size="md"
            width="full"
            onPress={handleSave}
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
            setFitnessGoal(option.title);
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
