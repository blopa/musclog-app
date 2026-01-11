import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Check, Dumbbell, LucideFootprints, PersonStanding } from 'lucide-react-native';
import { theme } from '../theme';

type WorkoutType = 'strength' | 'cardio' | 'flexibility';

type WorkoutTypeOption = {
  id: WorkoutType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  iconBgColor: string;
  iconColor: string;
};

const workoutTypes: WorkoutTypeOption[] = [
  {
    id: 'strength',
    label: 'Strength',
    description: 'Weights, Bodyweight',
    icon: Dumbbell,
    iconBgColor: theme.colors.status.indigo10,
    iconColor: theme.colors.status.indigo,
  },
  {
    id: 'cardio',
    label: 'Cardio',
    description: 'Running, Cycling, HIIT',
    icon: LucideFootprints,
    iconBgColor: theme.colors.status.emerald10,
    iconColor: theme.colors.status.emerald,
  },
  {
    id: 'flexibility',
    label: 'Flexibility',
    description: 'Yoga, Stretching',
    icon: PersonStanding,
    iconBgColor: theme.colors.status.purple10,
    iconColor: theme.colors.status.purple,
  },
];

type Props = {
  selected?: WorkoutType;
  onSelect: (id: WorkoutType) => void;
};

export function WorkoutTypeSelector({ selected, onSelect }: Props) {
  return (
    <View>
      <Text
        style={{
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: theme.spacing.padding.base,
          paddingHorizontal: theme.spacing.padding.xs,
        }}>
        WORKOUT TYPE
      </Text>
      <View style={{ gap: theme.spacing.gap.md }}>
        {workoutTypes.map((type) => {
          const Icon = type.icon as any;
          const isSelected = selected === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => onSelect(type.id)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.base,
                  borderRadius: theme.borderRadius.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
                  backgroundColor: isSelected
                    ? theme.colors.accent.primary10
                    : theme.colors.background.card,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...(isSelected ? theme.shadows.accentGlow : {}),
                },
              ]}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.gap.base,
                }}>
                <View
                  style={{
                    width: theme.size['10'],
                    height: theme.size['10'],
                    borderRadius: theme.borderRadius.full,
                    backgroundColor: type.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon size={theme.iconSize.lg} color={type.iconColor} />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.primary,
                    }}>
                    {type.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.xs,
                      color: theme.colors.text.secondary,
                      marginTop: theme.spacing.padding.xs / 4,
                    }}>
                    {type.description}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  width: theme.size['6'],
                  height: theme.size['6'],
                  borderRadius: theme.borderRadius.full,
                  borderWidth: theme.borderWidth.medium,
                  borderColor: isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.border.default,
                  backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {isSelected && (
                  <Check
                    size={theme.iconSize.xs}
                    color={theme.colors.text.black}
                    strokeWidth={theme.strokeWidth.thick}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
