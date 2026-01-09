import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, User, Search, Calendar, Clock } from 'lucide-react-native';
import { theme } from '../../theme';
import { TestSection } from './components/TestSection';
import { TextInput } from '../../components/theme/TextInput';
import { StepperInlineInput } from '../../components/theme/StepperInlineInput';
import { NumericInput } from '../../components/theme/NumericInput';
import { SegmentedControl } from '../../components/theme/SegmentedControl';
import { Toggle } from '../../components/theme/Toggle';
import { PickerButton } from '../../components/theme/PickerButton';
import { Slider } from '../../components/theme/Slider';
import StepperInput from '../../components/theme/StepperInput';

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

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between bg-bg-primary/90 px-4 pb-2 pt-4">
        <Pressable className="h-12 w-12 shrink-0 items-center justify-center rounded-full active:bg-white/10">
          <ArrowLeft size={24} color={theme.colors.text.primary} />
        </Pressable>
        <Text className="flex-1 pr-12 text-center text-lg font-bold leading-tight tracking-tight text-text-primary">
          Design System
        </Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View className="px-6 pb-2 pt-6">
          <Text className="text-[32px] font-extrabold leading-tight tracking-tight text-text-primary">
            Input Components
          </Text>
          <Text className="pt-3 text-base font-normal leading-relaxed text-text-secondary">
            Comprehensive data entry patterns for the Musclog app, following Material 3 and 12px
            rounded aesthetics.
          </Text>
        </View>

        <View className="h-8" />

        <TestSection title="Standard Inputs" subtitle="Text fields & States">
          <TextInput
            label="Name (Default)"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
          />
          <TextInput
            label="Email (Focused)"
            value={email}
            onChangeText={setEmail}
            focused={true}
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
            <Toggle
              label="Daily Reminder"
              value={dailyReminder}
              onValueChange={setDailyReminder}
              type="checkbox"
            />
            <Toggle
              label="Bulking Phase"
              value={bulkingPhase}
              onValueChange={setBulkingPhase}
              type="radio"
            />
          </View>
        </TestSection>

        <TestSection title="Interactive Sliders" subtitle="Difficulty & Goals">
          <View className="rounded-lg border border-white/10 bg-bg-card p-6">
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
            icon={<Search size={20} color={theme.colors.text.tertiary} />}
          />
          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            icon={<User size={20} color={`${theme.colors.accent.primary}66`} />}
          />
          <PickerButton
            label="Monday, Oct 24"
            icon={<Calendar size={20} color={theme.colors.status.purple} />}
            onPress={() => {}}
          />
          <PickerButton
            label="08:30 AM"
            icon={<Clock size={20} color={theme.colors.accent.primary} />}
            onPress={() => {}}
          />
        </TestSection>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
