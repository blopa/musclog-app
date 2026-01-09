import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { theme } from '../../../theme';

export function SelectionControls() {
  const [selectedUnit, setSelectedUnit] = useState<'metric' | 'imperial'>('metric');
  const [dailyReminder, setDailyReminder] = useState(true);
  const [bulkingPhase, setBulkingPhase] = useState(true);

  return (
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
  );
}
