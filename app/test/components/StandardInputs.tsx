import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { theme } from '../../../theme';

export function StandardInputs() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('alex@musclog.fit');

  return (
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
                style={{ outline: 'none', borderWidth: 0 }}
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
              style={{ outline: 'none', borderWidth: 0 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
