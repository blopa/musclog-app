import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, LucideFootprints, PersonStanding, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { FullScreenModal } from './FullScreenModal';
import { Slider } from './theme/Slider';

type WorkoutType = 'strength' | 'cardio' | 'flexibility';

type TargetMuscle = 'full-body' | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';

type FilterWorkoutsModalProps = {
  visible: boolean;
  onClose: () => void;
  onApplyFilters?: (filters: {
    workoutType?: WorkoutType;
    targetMuscles: TargetMuscle[];
    duration: number;
  }) => void;
  onClearFilters?: () => void;
};

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

const targetMuscles: { id: TargetMuscle; label: string }[] = [
  { id: 'full-body', label: 'Full Body' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'legs', label: 'Legs' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
];

export function FilterWorkoutsModal({
  visible,
  onClose,
  onApplyFilters,
  onClearFilters,
}: FilterWorkoutsModalProps) {
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<WorkoutType | undefined>(
    'strength'
  );
  const [selectedMuscles, setSelectedMuscles] = useState<TargetMuscle[]>(['full-body']);
  const [duration, setDuration] = useState(90);

  const handleClear = () => {
    setSelectedWorkoutType(undefined);
    setSelectedMuscles([]);
    setDuration(90);
    onClearFilters?.();
  };

  const handleApply = () => {
    onApplyFilters?.({
      workoutType: selectedWorkoutType,
      targetMuscles: selectedMuscles,
      duration,
    });
    onClose();
  };

  const toggleMuscle = (muscle: TargetMuscle) => {
    setSelectedMuscles((prev) => {
      if (muscle === 'full-body') {
        // If clicking full-body, toggle it and clear others
        return prev.includes('full-body') ? [] : ['full-body'];
      } else {
        // If clicking another muscle, remove full-body and toggle the muscle
        const filtered = prev.filter((m) => m !== 'full-body');
        if (filtered.includes(muscle)) {
          return filtered.filter((m) => m !== muscle);
        } else {
          return [...filtered, muscle];
        }
      }
    });
  };

  const activeFilterCount =
    (selectedWorkoutType ? 1 : 0) + selectedMuscles.length + (duration !== 90 ? 1 : 0);

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title="Filter Workouts"
      headerRight={
        <Pressable onPress={handleClear}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.accent.primary,
            }}>
            Clear
          </Text>
        </Pressable>
      }
      footer={
        <View
          style={{
            paddingHorizontal: theme.spacing.padding.base,
            paddingTop: theme.spacing.padding.base,
            paddingBottom: theme.spacing.padding['2xl'],
            backgroundColor: theme.colors.background.primary,
            borderTopWidth: theme.borderWidth.thin,
            borderTopColor: theme.colors.border.light,
          }}>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.gap.base,
            }}>
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [
                {
                  flex: 1,
                  height: theme.size['14'],
                  borderRadius: theme.borderRadius.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.base,
                  fontWeight: theme.typography.fontWeight.bold,
                  color: theme.colors.text.secondary,
                }}>
                Clear Filters
              </Text>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                {
                  flex: 2,
                  height: theme.size['14'],
                  borderRadius: theme.borderRadius.xl,
                  overflow: 'hidden',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  ...theme.shadows.accentGlow,
                },
              ]}>
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.gap.sm,
                  paddingHorizontal: theme.spacing.padding.base,
                }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.white,
                  }}>
                  Apply Filters
                </Text>
                {activeFilterCount > 0 && (
                  <View
                    style={{
                      backgroundColor: theme.colors.background.black20,
                      borderRadius: theme.borderRadius.sm,
                      paddingHorizontal: theme.spacing.padding.sm,
                      paddingVertical: theme.spacing.padding.xs / 2,
                      minWidth: theme.size['6'],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        fontWeight: theme.typography.fontWeight.extrabold,
                        color: theme.colors.text.white,
                      }}>
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      }>
      <View
        style={{
          paddingHorizontal: theme.spacing.padding.base,
          paddingTop: theme.spacing.padding['6'],
          paddingBottom: theme.spacing.padding['3xl'],
          gap: theme.spacing.gap['2xl'],
        }}>
        {/* Workout Type Section */}
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
              const Icon = type.icon;
              const isSelected = selectedWorkoutType === type.id;
              return (
                <Pressable
                  key={type.id}
                  onPress={() => setSelectedWorkoutType(type.id)}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: theme.spacing.padding.base,
                      borderRadius: theme.borderRadius.md,
                      borderWidth: theme.borderWidth.thin,
                      borderColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.border.light,
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

        {/* Target Muscles Section */}
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
            TARGET MUSCLES
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.gap.sm,
            }}>
            {targetMuscles.map((muscle) => {
              const isSelected = selectedMuscles.includes(muscle.id);
              return (
                <Pressable
                  key={muscle.id}
                  onPress={() => toggleMuscle(muscle.id)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: theme.spacing.padding.base,
                      paddingVertical: theme.spacing.padding.sm,
                      borderRadius: theme.borderRadius.full,
                      backgroundColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.background.card,
                      borderWidth: theme.borderWidth.thin,
                      borderColor: isSelected
                        ? theme.colors.accent.primary
                        : theme.colors.border.light,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing.gap.xs,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                      ...(isSelected ? theme.shadows.accentGlow : {}),
                    },
                  ]}>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: isSelected
                        ? theme.typography.fontWeight.bold
                        : theme.typography.fontWeight.semibold,
                      color: isSelected ? theme.colors.text.black : theme.colors.text.secondary,
                    }}>
                    {muscle.label}
                  </Text>
                  {isSelected && (
                    <Check
                      size={theme.iconSize.xs}
                      color={theme.colors.text.black}
                      strokeWidth={theme.strokeWidth.thick}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Duration Section */}
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.padding.base,
              paddingHorizontal: theme.spacing.padding.xs,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
              DURATION
            </Text>
            <Text
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
                color: theme.colors.accent.primary,
                fontFamily: 'monospace',
              }}>
              Up to {formatDuration(duration)}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.background.card,
              padding: theme.spacing.padding['6'],
              borderRadius: theme.borderRadius.md,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
              ...theme.shadows.sm,
            }}>
            <Slider
              value={duration}
              min={10}
              max={120}
              step={10}
              onChange={setDuration}
              variant="solid"
              solidColor={theme.colors.accent.primary}
              trackColor={theme.colors.background.white10}
              thumbColor={theme.colors.accent.primary}
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: theme.spacing.padding.md,
              }}>
              {[10, 30, 60, 90, 120].map((value) => (
                <Text
                  key={value}
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.text.tertiary,
                  }}>
                  {formatDuration(value)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
