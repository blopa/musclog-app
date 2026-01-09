import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Minus,
  Plus,
  Search,
  User,
  Calendar,
  Clock,
  ChevronDown,
  Check,
} from 'lucide-react-native';
import { theme } from '../../theme';
import { Slider } from '../../components/theme/Slider';

export default function InputsTestScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('alex@musclog.fit');
  const [targetWeight, setTargetWeight] = useState(85.0);
  const [weight, setWeight] = useState(72);
  const [reps, setReps] = useState(12);
  const [selectedUnit, setSelectedUnit] = useState<'metric' | 'imperial'>('metric');
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

        {/* Standard Inputs */}
        <View className="mb-10 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Standard Inputs</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Text fields & States
            </Text>
          </View>
          <View className="flex-col gap-6">
            <View className="flex-col gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">Name (Default)</Text>
              <View className="h-14 w-full flex-row items-center rounded-lg border border-white/10 bg-bg-card px-4">
                <TextInput
                  className="flex-1 border-none bg-transparent p-0 text-text-primary placeholder:text-text-tertiary"
                  placeholder="Enter your name"
                  placeholderTextColor={theme.colors.text.tertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>
            <View className="flex-col gap-2">
              <Text className="ml-1 text-sm font-medium text-accent-primary">Email (Focused)</Text>
              <View
                className="h-14 w-full flex-row items-center rounded-lg border-2 border-accent-primary/50 bg-bg-card px-4"
                style={{
                  borderColor: `${theme.colors.accent.primary}80`,
                  shadowColor: theme.colors.accent.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 2,
                }}>
                <TextInput
                  className="flex-1 border-none bg-transparent p-0 text-text-primary"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Numerical Steppers */}
        <View className="mb-10 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Numerical Steppers</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Weight & Reps Adjusters
            </Text>
          </View>
          <View className="flex-col gap-4">
            <View className="flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card p-4">
              <View className="flex-col">
                <Text className="text-xs font-semibold uppercase tracking-tighter text-text-tertiary">
                  Target Weight
                </Text>
                <Text className="text-lg font-bold text-text-primary">
                  {targetWeight.toFixed(1)}{' '}
                  <Text className="font-normal text-text-tertiary">kg</Text>
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-bg-cardElevated active:scale-95"
                  onPress={() => setTargetWeight(Math.max(0, targetWeight - 0.5))}>
                  <Minus size={20} color={theme.colors.text.primary} />
                </Pressable>
                <Pressable
                  className="h-10 w-10 items-center justify-center rounded-lg bg-accent-primary active:scale-95"
                  onPress={() => setTargetWeight(targetWeight + 0.5)}>
                  <Plus size={20} color={theme.colors.text.black} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Specialized Numeric */}
        <View className="mb-10 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Specialized Numeric</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Workout Tracker & Goals
            </Text>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 bg-bg-card p-4">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Weight
              </Text>
              <TextInput
                className="w-full border-none bg-transparent p-0 text-center text-3xl font-black text-text-primary"
                value={weight.toString()}
                onChangeText={(text) => setWeight(parseInt(text) || 0)}
                keyboardType="numeric"
              />
              <Text className="text-xs font-medium text-accent-primary">LBS</Text>
            </View>
            <View className="flex-1 flex-col items-center gap-1 rounded-lg border border-white/10 bg-bg-card p-4">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Reps
              </Text>
              <TextInput
                className="w-full border-none bg-transparent p-0 text-center text-3xl font-black text-text-primary"
                value={reps.toString()}
                onChangeText={(text) => setReps(parseInt(text) || 0)}
                keyboardType="numeric"
              />
              <Text className="text-xs font-medium" style={{ color: theme.colors.status.purple }}>
                REPS
              </Text>
            </View>
          </View>
        </View>

        {/* Selection Controls */}
        <View className="mb-10 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Selection Controls</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Choices & Toggles
            </Text>
          </View>
          <View className="flex-col gap-6">
            <View className="flex-row rounded-lg bg-bg-card p-1">
              <Pressable
                className={`flex-1 rounded-md py-2 ${selectedUnit === 'metric' ? 'bg-bg-cardElevated' : ''}`}
                onPress={() => setSelectedUnit('metric')}>
                <Text
                  className={`text-center text-sm font-bold ${selectedUnit === 'metric' ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  Metric
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 rounded-md py-2 ${selectedUnit === 'imperial' ? 'bg-bg-cardElevated' : ''}`}
                onPress={() => setSelectedUnit('imperial')}>
                <Text
                  className={`text-center text-sm font-bold ${selectedUnit === 'imperial' ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  Imperial
                </Text>
              </Pressable>
            </View>
            <View className="flex-col gap-4">
              <Pressable
                className="flex-row items-center gap-3 active:opacity-90"
                onPress={() => setDailyReminder(!dailyReminder)}>
                <View className="h-6 w-6 items-center justify-center rounded border border-white/20 bg-bg-card">
                  {dailyReminder && <Check size={16} color={theme.colors.accent.primary} />}
                </View>
                <Text className="text-sm font-medium text-text-primary">Daily Reminder</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center gap-3 active:opacity-90"
                onPress={() => setBulkingPhase(!bulkingPhase)}>
                <View className="h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-bg-card">
                  {bulkingPhase && (
                    <View
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: theme.colors.accent.primary }}
                    />
                  )}
                </View>
                <Text className="text-sm font-medium text-text-primary">Bulking Phase</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Interactive Sliders */}
        <View className="mb-10 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Interactive Sliders</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Difficulty & Goals
            </Text>
          </View>
          <View className="rounded-lg border border-white/10 bg-bg-card p-6">
            <View className="mb-6 flex-row items-center justify-between">
              <Text className="text-sm font-medium text-text-secondary">Workout Difficulty</Text>
              <Text className="text-xl font-bold text-accent-primary">{difficulty}/10</Text>
            </View>
            <Slider value={difficulty} min={1} max={10} onChange={setDifficulty} />
          </View>
        </View>

        {/* Icons & Pickers */}
        <View className="mb-12 flex-col gap-4 px-6">
          <View>
            <Text className="text-xl font-bold text-text-primary">Icons & Pickers</Text>
            <Text className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Leading, Trailing & Triggers
            </Text>
          </View>
          <View className="flex-col gap-4">
            <View className="h-14 w-full flex-row items-center gap-3 rounded-lg border border-white/10 bg-bg-card px-4">
              <Search size={20} color={theme.colors.text.tertiary} />
              <TextInput
                className="flex-1 border-none bg-transparent p-0 text-text-primary placeholder:text-text-tertiary"
                placeholder="Search exercises..."
                placeholderTextColor={theme.colors.text.tertiary}
              />
            </View>
            <View className="flex-col gap-2">
              <Text className="ml-1 text-sm font-medium text-text-secondary">Full Name</Text>
              <View className="h-14 w-full flex-row items-center gap-3 rounded-lg border border-accent-primary/30 bg-bg-card px-4">
                <TextInput
                  className="flex-1 border-none bg-transparent p-0 text-text-primary"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <User size={20} color={`${theme.colors.accent.primary}66`} />
              </View>
            </View>
            <Pressable className="h-14 w-full flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card px-4 active:bg-white/5">
              <View className="flex-row items-center gap-3">
                <Calendar size={20} color={theme.colors.status.purple} />
                <Text className="font-medium text-text-primary">Monday, Oct 24</Text>
              </View>
              <ChevronDown size={20} color={theme.colors.text.tertiary} />
            </Pressable>
            <Pressable className="h-14 w-full flex-row items-center justify-between rounded-lg border border-white/10 bg-bg-card px-4 active:bg-white/5">
              <View className="flex-row items-center gap-3">
                <Clock size={20} color={theme.colors.accent.primary} />
                <Text className="font-medium text-text-primary">08:30 AM</Text>
              </View>
              <ChevronDown size={20} color={theme.colors.text.tertiary} />
            </Pressable>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
