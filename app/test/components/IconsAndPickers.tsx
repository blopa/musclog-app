import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Search, User, Calendar, Clock, ChevronDown } from 'lucide-react-native';
import { theme } from '../../../theme';

export function IconsAndPickers() {
  const [fullName, setFullName] = useState('Alex Johnson');

  return (
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
            className="flex-1 border-none bg-transparent p-0 text-text-primary"
            placeholder="Search exercises..."
            placeholderTextColor={theme.colors.text.tertiary}
            style={{ borderWidth: 0 }}
          />
        </View>
        <View className="flex-col gap-2">
          <Text className="ml-1 text-sm font-medium text-text-secondary">Full Name</Text>
          <View className="h-14 w-full flex-row items-center gap-3 rounded-lg border border-accent-primary/30 bg-bg-card px-4">
            <TextInput
              className="flex-1 border-none bg-transparent p-0 text-text-primary"
              value={fullName}
              onChangeText={setFullName}
              style={{ borderWidth: 0 }}
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
  );
}
