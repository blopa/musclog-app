import { ArrowLeft, Calendar, Clock, Search, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MacroInput } from '../../components/MacroInput';
import { OptionsSelector } from '../../components/OptionsSelector';
import { CheckRadioBox } from '../../components/theme/CheckRadioBox';
import NewNumericalInput from '../../components/theme/NewNumericalInput';
import { NumericInput } from '../../components/theme/NumericInput';
import { OptionsMultiSelector } from '../../components/theme/OptionsMultiSelector/OptionsMultiSelector';
import { PickerButton } from '../../components/theme/PickerButton';
import { SegmentedControl } from '../../components/theme/SegmentedControl';
import { Slider } from '../../components/theme/Slider';
import { StepperInlineInput } from '../../components/theme/StepperInlineInput';
import { StepperInput } from '../../components/theme/StepperInput';
import { TextInput } from '../../components/theme/TextInput';
import { ToggleInput } from '../../components/theme/ToggleInput';
import { theme } from '../../theme';
import { TestSection } from './components/TestSection';

export default function InputsTestScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('alex@musclog.fit');
  const [targetWeight, setTargetWeight] = useState(85.0);
  const [weight, setWeight] = useState('72');
  const [reps, setReps] = useState('12');
  const [selectedUnit, setSelectedUnit] = useState('metric');
  const [dailyReminder, setDailyReminder] = useState(true);
  const [bulkingPhase, setBulkingPhase] = useState(true);
  const [difficulty, setDifficulty] = useState(8);
  const [fullName, setFullName] = useState('Alex Johnson');
  const [bodyMetric, setBodyMetric] = useState(70);
  const [newNumeric, setNewNumeric] = useState(5);
  const [singleSelection, setSingleSelection] = useState<string | number | undefined>('1');
  const [multiSelection, setMultiSelection] = useState<(string | number)[]>(['a']);

  const sampleOptions = [
    {
      id: '1',
      label: 'Option One',
      description: 'Single select first option',
      icon: User,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
    },
    {
      id: '2',
      label: 'Option Two',
      description: 'Single select second option',
      icon: Search,
      iconBgColor: theme.colors.status.purple13,
      iconColor: theme.colors.status.purple,
    },
  ];

  const sampleMultiOptions = [
    {
      id: 'a',
      label: 'Apple',
      description: 'Select apples',
      icon: Search,
      iconBgColor: theme.colors.status.purple13,
      iconColor: theme.colors.status.purple,
    },
    {
      id: 'b',
      label: 'Banana',
      description: 'Select bananas',
      icon: User,
      iconBgColor: theme.colors.accent.primary10,
      iconColor: theme.colors.accent.primary,
    },
    {
      id: 'c',
      label: 'Cherry',
      description: 'Select cherries',
      icon: Calendar,
      iconBgColor: theme.colors.status.purple13,
      iconColor: theme.colors.status.purple,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-bg-primary/90 px-4 pb-2 pt-4">
        <Pressable className="h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft size={theme.iconSize.xl} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="flex-1 pr-12 text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
          Design System
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pb-2 pt-6">
          <Text
            className="font-extrabold leading-tight tracking-tight text-text-primary"
            style={{ fontSize: theme.typography.fontSize['3xl'] }}
          >
            Input Components
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Comprehensive data entry patterns for the Musclog app, following Material 3 and 12px
            rounded aesthetics.
          </Text>
        </View>

        <View className="h-8" />

        <TestSection title="Options Selectors" subtitle="Single and Multi select demos">
          <OptionsSelector
            title="Single Choice"
            options={sampleOptions}
            selectedId={singleSelection as any}
            onSelect={(id) => setSingleSelection(id)}
          />

          <View style={{ height: theme.spacing.gap.md }} />

          <OptionsMultiSelector
            title="Multiple Choice"
            options={sampleMultiOptions}
            selectedIds={multiSelection as any}
            onChange={(ids) => setMultiSelection(ids as any)}
          />
        </TestSection>

        <TestSection title="Standard Inputs" subtitle="Text fields & States">
          <TextInput
            label="Name (Default)"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
          />
          <TextInput
            label="Name (Mandatory)"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            required
          />
          <TextInput
            label="Email (Tap to focus)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </TestSection>

        <TestSection title="Numerical Steppers" subtitle="Weight & Reps Adjusters">
          <StepperInlineInput
            label="Target Weight"
            value={targetWeight}
            onIncrement={() => setTargetWeight((v) => v + 0.5)}
            onDecrement={() => setTargetWeight((v) => Math.max(0, v - 0.5))}
            onChangeValue={setTargetWeight}
            unit="kg"
          />
        </TestSection>

        <TestSection title="Numerical Steppers" subtitle="Weight & Reps Adjusters">
          <StepperInput
            label="Weight (KG)"
            value={targetWeight}
            onIncrement={() => setTargetWeight((v) => v + 0.5)}
            onDecrement={() => setTargetWeight((v) => Math.max(0, v - 0.5))}
            onChangeValue={setTargetWeight}
            unit="kg"
          />
        </TestSection>

        <TestSection title="Specialized Numeric" subtitle="Workout Tracker & Goals">
          <View className="flex-row gap-4">
            <NumericInput
              label="Weight"
              value={weight}
              onChangeText={setWeight}
              unit="LBS"
              onIncrement={() => setWeight(String((parseInt(weight) || 0) + 1))}
              onDecrement={() => setWeight(String(Math.max(0, (parseInt(weight) || 0) - 1)))}
            />
            <NumericInput
              label="Reps"
              value={reps}
              onChangeText={setReps}
              unit="REPS"
              unitColor={theme.colors.status.purple}
              onIncrement={() => setReps(String((parseInt(reps) || 0) + 1))}
              onDecrement={() => setReps(String(Math.max(0, (parseInt(reps) || 0) - 1)))}
            />
          </View>
          <View className="h-4" />
          <NewNumericalInput
            label="New Numerical"
            value={newNumeric}
            onChange={setNewNumeric}
            min={0}
            step={1}
          />
        </TestSection>

        <TestSection title="Selection Controls" subtitle="Choices & Toggles">
          <SegmentedControl
            options={[
              { label: 'Metric', value: 'metric' },
              { label: 'Imperial', value: 'imperial' },
            ]}
            value={selectedUnit}
            onValueChange={setSelectedUnit}
          />
          <View className="flex-col gap-4">
            <CheckRadioBox
              label="Daily Reminder"
              value={dailyReminder}
              onValueChange={setDailyReminder}
              type="checkbox"
            />
            <CheckRadioBox
              label="Bulking Phase"
              value={bulkingPhase}
              onValueChange={setBulkingPhase}
              type="radio"
            />
          </View>
        </TestSection>

        <TestSection title="Interactive Sliders" subtitle="Difficulty & Goals">
          <View
            className="rounded-lg border bg-bg-card p-6"
            style={{ borderColor: theme.colors.background.white10 }}
          >
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-secondary">Workout Difficulty</Text>
              <Text className="text-xl font-bold text-accent-primary">{difficulty}/10</Text>
            </View>
            <Slider value={difficulty} min={1} max={10} onChange={setDifficulty} />
          </View>
        </TestSection>

        <TestSection title="Icons & Pickers" subtitle="Leading, Trailing & Triggers">
          <TextInput
            label=""
            value=""
            onChangeText={() => {}}
            placeholder="Search exercises..."
            icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
          />
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            icon={<User size={theme.iconSize.lg} color={theme.colors.accent.primary40} />}
          />
          <PickerButton
            label="Monday, Oct 24"
            icon={<Calendar size={theme.iconSize.lg} color={theme.colors.status.purple} />}
            onPress={() => {}}
          />
          <PickerButton
            label="08:30 AM"
            icon={<Clock size={theme.iconSize.lg} color={theme.colors.accent.primary} />}
            onPress={() => {}}
          />
        </TestSection>

        <TestSection title="Toggle Input" subtitle="Demo for ToggleInput component">
          <ToggleInput
            items={[
              {
                key: '1',
                label: 'Enable Notifications',
                subtitle: 'Receive daily updates',
                value: dailyReminder,
                onValueChange: setDailyReminder,
              },
              {
                key: '2',
                label: 'Bulking Phase',
                subtitle: 'Focus on muscle gain',
                value: bulkingPhase,
                onValueChange: setBulkingPhase,
              },
            ]}
          />
        </TestSection>

        <TestSection title="Macro Inputs" subtitle="Testing MacroInput component">
          <View className="flex-row gap-4">
            <MacroInput
              label="Protein"
              value={weight}
              onChange={setWeight}
              topRightElement={<Text className="text-xs text-text-secondary">g</Text>}
              variant="success"
              size="half"
            />
            <MacroInput
              label="Carbs"
              value={reps}
              onChange={setReps}
              topRightElement={<Text className="text-xs text-text-secondary">g</Text>}
              variant="warning"
              size="half"
            />
          </View>
          <View className="h-4" />
          <MacroInput
            label="Fats"
            value={name}
            onChange={setName}
            topRightElement={<Text className="text-xs text-text-secondary">g</Text>}
            variant="error"
            size="full"
          />
        </TestSection>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
