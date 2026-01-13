import React from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type WorkoutGenericCardProps = {
  children: React.ReactNode;
};

export function WorkoutGenericCard({ children }: WorkoutGenericCardProps) {
  return (
    <View
      className="mb-8 w-full overflow-hidden rounded-[20px] border p-6"
      style={{
        backgroundColor: theme.colors.background.darkGreen80,
        borderColor: theme.colors.background.white5,
        borderWidth: theme.borderWidth.thin,
        ...theme.shadows.lg,
      }}>
      {/* Top gradient line */}
      <LinearGradient
        colors={theme.colors.gradients.workoutStats}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: theme.size['1half'],
          opacity: 0.5,
        }}
      />

      {children}
    </View>
  );
}