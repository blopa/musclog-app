import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { theme } from '../../../theme';

export function NumericalSteppers() {
  const [targetWeight, setTargetWeight] = useState(85.0);

  return (
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
            <View className="flex-row items-center">
              <TextInput
                className="w-16 border-none bg-transparent p-0 text-lg font-bold text-text-primary"
                value={targetWeight.toFixed(1)}
                onChangeText={(text) => {
                  const val = parseFloat(text);
                  if (!isNaN(val)) setTargetWeight(val);
                }}
                keyboardType="numeric"
                style={{ outline: 'none', borderWidth: 0 }}
              />
              <Text className="font-normal text-text-tertiary"> kg</Text>
            </View>
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
  );
}
