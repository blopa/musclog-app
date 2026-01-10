import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronDown,
  Dumbbell,
  CheckCircle2,
  Save,
  Trophy,
  Medal,
  Activity,
  Zap,
  Timer,
  Target,
  Heart,
} from 'lucide-react-native';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { TextInput } from './theme/TextInput';
import { SegmentedControl } from './theme/SegmentedControl';
import { Button } from './theme/Button';
import { Slider } from './theme/Slider';
import { PickerButton } from './theme/PickerButton';
import { BottomPopUpMenu } from './BottomPopUpMenu';

type EditFitnessDetailsModalProps = {
  visible: boolean;
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

export function EditFitnessDetailsModal({
  visible,
  onClose,
  onSave,
  initialData,
}: EditFitnessDetailsModalProps) {
  const [units, setUnits] = useState<'imperial' | 'metric'>(initialData?.units ?? 'metric');
  const [weight, setWeight] = useState(initialData?.weight ?? '0.0');
  const [height, setHeight] = useState(initialData?.height ?? '0');
  const [fitnessGoal, setFitnessGoal] = useState(
    initialData?.fitnessGoal ?? 'Hypertrophy (Build Muscle)'
  );
  const [eatingPhase, setEatingPhase] = useState<'cut' | 'maintain' | 'bulk'>(
    initialData?.eatingPhase ?? 'maintain'
  );
  const [activityLevel, setActivityLevel] = useState(initialData?.activityLevel ?? 3);
  const [experience, setExperience] = useState<'beginner' | 'intermediate' | 'advanced'>(
    initialData?.experience ?? 'intermediate'
  );
  const [isGoalPickerVisible, setIsGoalPickerVisible] = useState(false);

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

  const activityLevelLabels = ['Sedentary', 'Light', 'Moderate', 'Active', 'Super Active'];
  const currentActivityLabel = activityLevelLabels[activityLevel - 1];

  const fitnessGoalOptions = [
    {
      title: 'Hypertrophy (Build Muscle)',
      description: 'Focus on muscle size and definition',
      icon: Activity,
      iconColor: theme.colors.accent.primary,
      iconBgColor: theme.colors.accent.primary10,
    },
    {
      title: 'Strength (Lift Heavier)',
      description: 'Focus on maximum strength and power',
      icon: Zap,
      iconColor: theme.colors.status.warning,
      iconBgColor: 'rgba(249, 115, 22, 0.1)',
    },
    {
      title: 'Endurance (Stamina)',
      description: 'Focus on cardiovascular fitness',
      icon: Timer,
      iconColor: theme.colors.status.info,
      iconBgColor: 'rgba(59, 130, 246, 0.1)',
    },
    {
      title: 'Weight Loss (Burn Fat)',
      description: 'Focus on fat loss and toning',
      icon: Target,
      iconColor: theme.colors.rose.brand,
      iconBgColor: 'rgba(218, 37, 82, 0.1)',
    },
    {
      title: 'General Fitness',
      description: 'Maintain overall health and wellness',
      icon: Heart,
      iconColor: theme.colors.status.purple,
      iconBgColor: theme.colors.status.purple20,
    },
  ];

  const experienceOptions = [
    {
      id: 'beginner' as const,
      title: 'Beginner',
      description: '0-1 years of consistent training',
      icon: Dumbbell,
    },
    {
      id: 'intermediate' as const,
      title: 'Intermediate',
      description: '1-3 years of consistent training',
      icon: Trophy,
    },
    {
      id: 'advanced' as const,
      title: 'Advanced',
      description: '3+ years of consistent training',
      icon: Medal,
    },
  ];

  return (
    <>
      <FullScreenModal visible={visible} onClose={onClose} title="Edit Fitness Details">
        <View className="flex-1 gap-8 px-4 pb-6 pt-2">
          {/* Units Section */}
          <View className="gap-2">
            <Text className="ml-1 text-sm font-semibold text-text-tertiary">Units</Text>
            <SegmentedControl
              options={[
                { label: 'Imperial', value: 'imperial' },
                { label: 'Metric', value: 'metric' },
              ]}
              value={units}
              onValueChange={(val) => setUnits(val as 'imperial' | 'metric')}
            />
          </View>

          {/* Body Stats Section */}
          <View className="gap-4">
            <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
              Body Stats
            </Text>
            <View className="flex-row gap-4">
              <View className="flex-1">
                <TextInput
                  label="Current Weight"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0.0"
                  keyboardType="numeric"
                  icon={<Text className="text-sm font-medium text-text-tertiary">kg</Text>}
                />
              </View>
              <View className="flex-1">
                <TextInput
                  label="Height"
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
              Goals & Strategy
            </Text>
            <View className="gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">Fitness Goal</Text>
              <PickerButton
                label={fitnessGoal}
                icon={<Activity size={20} color={theme.colors.accent.primary} />}
                onPress={() => setIsGoalPickerVisible(true)}
              />
            </View>
            <View className="gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">Eating Phase</Text>
              <SegmentedControl
                options={[
                  { label: 'Cut', value: 'cut' },
                  { label: 'Maintain', value: 'maintain' },
                  { label: 'Bulk', value: 'bulk' },
                ]}
                value={eatingPhase}
                onValueChange={(val) => setEatingPhase(val as 'cut' | 'maintain' | 'bulk')}
              />
            </View>
          </View>

          {/* Lifestyle Context Section */}
          <View className="gap-6">
            <Text className="ml-1 text-xl font-bold tracking-tight text-text-primary">
              Lifestyle Context
            </Text>

            {/* Activity Level */}
            <View className="rounded-xl border border-white/5 bg-bg-card p-5">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-sm font-medium text-text-secondary">Activity Level</Text>
                <View className="rounded-md bg-accent-primary/10 px-2 py-1">
                  <Text className="text-sm font-bold text-accent-primary">
                    {currentActivityLabel}
                  </Text>
                </View>
              </View>
              <Slider value={activityLevel} min={1} max={5} onChange={setActivityLevel} />
              <View className="mt-2 flex-row justify-between">
                <Text className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                  Sedentary
                </Text>
                <Text className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                  Super Active
                </Text>
              </View>
            </View>

            {/* Lifting Experience */}
            <View className="gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">
                Lifting Experience
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
              label="Save Changes"
              icon={Save}
              variant="accent"
              size="md"
              width="full"
              onPress={handleSave}
            />
          </View>
        </View>
      </FullScreenModal>

      <BottomPopUpMenu
        visible={isGoalPickerVisible}
        onClose={() => setIsGoalPickerVisible(false)}
        title="Select Fitness Goal"
        subtitle="Choose the goal that best fits your training"
        items={fitnessGoalOptions.map((option) => ({
          ...option,
          onPress: () => {
            setFitnessGoal(option.title);
            setIsGoalPickerVisible(false);
          },
        }))}
      />
    </>
  );
}
