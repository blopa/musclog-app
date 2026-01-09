import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { theme } from '../../../theme';
import { Slider } from '../../../components/theme/Slider';

export function InteractiveSliders() {
  const [difficulty, setDifficulty] = useState(8);

  return (
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
  );
}
