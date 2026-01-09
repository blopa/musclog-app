import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { theme } from '../../../theme';

export function SpecializedNumeric() {
  const [weight, setWeight] = useState(72);
  const [reps, setReps] = useState(12);

  return (
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
            style={{ borderWidth: 0 }}
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
            style={{ borderWidth: 0 }}
          />
          <Text className="text-xs font-medium" style={{ color: theme.colors.status.purple }}>
            REPS
          </Text>
        </View>
      </View>
    </View>
  );
}
