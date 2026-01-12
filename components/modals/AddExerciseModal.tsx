import React, { useState } from 'react';
import { View, Text, TextInput, Switch } from 'react-native';
import { Search, Dumbbell, User, PlusCircle } from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { Button } from '../theme/Button';
import { OptionsSelector, SelectorOption } from '../OptionsSelector';
import { FilterTabs } from '../FilterTabs';
import { NumericInput } from '../theme/NumericInput';

type MuscleGroup = 'chest' | 'back' | 'legs' | 'arms';

type ExerciseId = string;

type ExerciseOption = SelectorOption<ExerciseId> & {
  category: string;
  type: 'compound' | 'isolation' | 'bodyweight';
};

const exercises: Record<MuscleGroup, ExerciseOption[]> = {
  chest: [
    {
      id: 'bench-press',
      label: 'Barbell Bench Press',
      description: 'Chest • Compound',
      icon: Dumbbell,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
      category: 'Chest',
      type: 'compound',
    },
    {
      id: 'incline-press',
      label: 'Incline Dumbbell Press',
      description: 'Chest • Isolation',
      icon: Dumbbell,
      iconBgColor: theme.colors.background.white5,
      iconColor: theme.colors.text.secondary,
      category: 'Chest',
      type: 'isolation',
    },
    {
      id: 'push-up',
      label: 'Push Up',
      description: 'Chest • Bodyweight',
      icon: User,
      iconBgColor: theme.colors.background.white5,
      iconColor: theme.colors.text.secondary,
      category: 'Chest',
      type: 'bodyweight',
    },
  ],
  back: [],
  legs: [],
  arms: [],
};

type AddExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onAddExercise?: (data: any) => void;
};

export function AddExerciseModal({ visible, onClose, onAddExercise }: AddExerciseModalProps) {
  const [activeMuscle, setActiveMuscle] = useState<MuscleGroup>('chest');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId>('bench-press');
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('60');
  const [extraWeight, setExtraWeight] = useState('0');

  const muscleTabs = [
    { id: 'chest', label: 'Chest' },
    { id: 'back', label: 'Back' },
    { id: 'legs', label: 'Legs' },
    { id: 'arms', label: 'Arms' },
  ];

  const filteredExercises = exercises[activeMuscle].filter((ex) =>
    ex.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = () => {
    onAddExercise?.({
      exerciseId: selectedExerciseId,
      sets: parseInt(sets),
      reps: parseInt(reps),
      weight: parseFloat(weight),
      isBodyweight,
    });
    onClose();
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="Add Exercise" scrollable={true}>
      <View className="flex-1 px-4 py-6">
        {/* Target Muscle Section */}
        <View className="mb-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
              Target Muscle
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
              MULTI-SELECT
            </Text>
          </View>
          <FilterTabs
            tabs={muscleTabs}
            activeTab={activeMuscle}
            onTabChange={(id) => setActiveMuscle(id as MuscleGroup)}
            showContainer={false}
            withCheckmark={true}
            scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>

        {/* Search Bar */}
        <View
          className="mb-6 flex-row items-center rounded-xl border border-white/5 bg-bg-card px-4 py-3"
          style={{ height: 56 }}>
          <Search size={20} color={theme.colors.text.tertiary} />
          <TextInput
            className="ml-3 flex-1 text-base text-text-primary"
            placeholder={`Search ${activeMuscle} exercises...`}
            placeholderTextColor={theme.colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Exercise List */}
        <View className="mb-8">
          <OptionsSelector
            title=""
            options={filteredExercises}
            selectedId={selectedExerciseId}
            onSelect={(id) => setSelectedExerciseId(id)}
          />
        </View>

        {/* Create Set Card */}
        <View className="rounded-2xl border border-white/5 bg-bg-card p-5">
          <View className="mb-6 flex-row items-center justify-between">
            <Text
              style={{
                fontSize: theme.typography.fontSize.lg,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.primary,
              }}>
              Create Set
            </Text>
            <View className="flex-row items-center gap-2">
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.secondary,
                }}>
                Bodyweight
              </Text>
              <Switch
                value={isBodyweight}
                onValueChange={setIsBodyweight}
                trackColor={{
                  false: theme.colors.background.overlay,
                  true: theme.colors.accent.primary,
                }}
                thumbColor={theme.colors.text.white}
              />
            </View>
          </View>

          <View className="gap-6">
            {/* Sets & Reps */}
            <View className="flex-row gap-4">
              <NumericInput
                label="Sets"
                value={sets}
                onChangeText={setSets}
                unit=""
                onIncrement={() => setSets((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setSets((prev) => Math.max(1, parseInt(prev) - 1).toString())}
              />
              <NumericInput
                label="Reps"
                value={reps}
                onChangeText={setReps}
                unit=""
                onIncrement={() => setReps((prev) => (parseInt(prev) + 1).toString())}
                onDecrement={() => setReps((prev) => Math.max(1, parseInt(prev) - 1).toString())}
              />
            </View>

            {/* Weight */}
            <View className="flex-row">
              <NumericInput
                label="Weight"
                value={weight}
                onChangeText={setWeight}
                unit="KG"
                onIncrement={() => setWeight((prev) => (parseFloat(prev) + 2.5).toString())}
                onDecrement={() => setWeight((prev) => (parseFloat(prev) - 2.5).toString())}
              />
            </View>
          </View>
        </View>
        <View style={{ height: 24 }} />

        <Button
          label="Add to Workout"
          variant="gradientCta"
          size="md"
          width="full"
          icon={PlusCircle}
          onPress={handleAdd}
        />
      </View>
    </FullScreenModal>
  );
}
