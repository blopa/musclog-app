import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image } from 'react-native';
import { Search, Check, Repeat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { BottomPopUpMenu } from './BottomPopUpMenu';

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
  type: string;
  image?: any; // ImageSourcePropType
};

type ReplaceExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onReplace: (exercise: Exercise) => void;
  currentExercise?: string;
  exercises?: Exercise[];
};

const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: '1',
    name: 'Flat Dumbbell Press',
    muscleGroup: 'Chest',
    type: 'Compound',
  },
  {
    id: '2',
    name: 'Barbell Bench Press',
    muscleGroup: 'Chest',
    type: 'Compound',
  },
  {
    id: '3',
    name: 'Cable Crossover',
    muscleGroup: 'Chest',
    type: 'Isolation',
  },
  {
    id: '4',
    name: 'Dumbbell Flys',
    muscleGroup: 'Chest',
    type: 'Isolation',
  },
];

const MUSCLE_GROUPS = ['All', 'Chest', 'Shoulders', 'Triceps'];

export function ReplaceExerciseModal({
  visible,
  onClose,
  onReplace,
  currentExercise,
  exercises = DEFAULT_EXERCISES,
}: ReplaceExerciseModalProps) {
  const { t } = useTranslation();
  const [selectedExercise, setSelectedExercise] = useState<string>(exercises[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const filteredExercises = exercises.filter((exercise) => {
    const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || exercise.muscleGroup === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleReplace = () => {
    const exercise = exercises.find((e) => e.id === selectedExercise);
    if (exercise) {
      onReplace(exercise);
      onClose();
    }
  };

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title="Replace Exercise"
      maxHeight="85%"
      footer={
        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 rounded-xl border border-border-light"
            style={{
              backgroundColor: theme.colors.background.overlay,
              paddingVertical: theme.spacing.padding.lg,
            }}
            onPress={onClose}>
            <Text
              className="text-center uppercase tracking-wide text-text-secondary"
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
              }}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            className="flex-[2] flex-row items-center justify-center gap-2 rounded-xl bg-accent-primary"
            style={{
              paddingVertical: theme.spacing.padding.lg,
            }}
            onPress={handleReplace}>
            <Repeat size={theme.iconSize.md} color={theme.colors.text.black} />
            <Text
              className="text-text-black uppercase tracking-wide"
              style={{
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.bold,
              }}>
              Replace
            </Text>
          </Pressable>
        </View>
      }>
      <View className="flex-1">
        {/* Search and Filters Section */}
        <View
          className="gap-3"
          style={{
            backgroundColor: theme.colors.background.primary,
            paddingHorizontal: theme.spacing.padding.xl,
            paddingTop: theme.spacing.padding.base,
            paddingBottom: theme.spacing.padding.sm,
          }}>
          {/* Search Input */}
          <View className="relative">
            <View
              className="absolute inset-y-0 left-0 z-10 items-center justify-center pl-4"
              pointerEvents="none">
              <Search
                size={theme.iconSize.lg}
                color={searchQuery ? theme.colors.accent.primary : theme.colors.text.secondary}
              />
            </View>
            <TextInput
              placeholder="Search exercises..."
              placeholderTextColor={theme.colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="w-full rounded-xl pl-12 pr-4"
              style={{
                backgroundColor: theme.colors.background.cardDark,
                borderWidth: searchQuery ? 2 : 0,
                borderColor: searchQuery ? theme.colors.accent.primary : 'transparent',
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.base,
                borderRadius: theme.borderRadius.xl,
                paddingVertical: theme.spacing.padding.md,
              }}
            />
          </View>

          {/* Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row"
            contentContainerStyle={{ gap: theme.spacing.gap.sm }}>
            {MUSCLE_GROUPS.map((group) => {
              const isActive = selectedFilter === group;
              return (
                <Pressable
                  key={group}
                  onPress={() => setSelectedFilter(group)}
                  className="rounded-lg border"
                  style={{
                    backgroundColor: isActive
                      ? theme.colors.accent.primary20
                      : theme.colors.background.cardDark,
                    borderColor: isActive
                      ? theme.colors.accent.primary40
                      : 'transparent',
                    borderRadius: theme.borderRadius.lg,
                    paddingHorizontal: theme.spacing.padding.md,
                    paddingVertical: theme.spacing.padding.sm,
                  }}>
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: isActive ? theme.colors.accent.primary : theme.colors.text.secondary,
                    }}>
                    {group}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Exercise List Section */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          style={{
            backgroundColor: theme.colors.background.primary,
            paddingHorizontal: theme.spacing.padding.xl,
          }}
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding.xl,
            paddingTop: theme.spacing.padding.sm,
          }}>
          <View className="gap-2">
            {filteredExercises.map((exercise) => {
              const isSelected = selectedExercise === exercise.id;

              return (
                <Pressable
                  key={exercise.id}
                  onPress={() => setSelectedExercise(exercise.id)}
                  className="w-full flex-row items-center justify-between"
                  style={{
                    backgroundColor: isSelected
                      ? theme.colors.accent.primary10
                      : theme.colors.background.cardDark,
                    borderWidth: theme.borderWidth.thin,
                    borderColor: isSelected
                      ? theme.colors.accent.primary40
                      : 'transparent',
                    borderRadius: theme.borderRadius.xl,
                    padding: theme.spacing.padding.base,
                    ...theme.shadows.sm,
                  }}>
                  <View className="flex-1 flex-row items-center gap-3">
                    {/* Exercise Image/Icon */}
                    <View
                      className="items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: theme.colors.background.iconDark,
                        width: theme.iconSize['2xl'],
                        height: theme.iconSize['2xl'],
                      }}>
                      {exercise.image ? (
                        <Image
                          source={exercise.image}
                          className="h-full w-full rounded-lg"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="h-full w-full rounded-lg opacity-80" />
                      )}
                    </View>

                    {/* Exercise Info */}
                    <View className="flex-1">
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.base,
                          fontWeight: theme.typography.fontWeight.bold,
                          color: isSelected ? theme.colors.text.primary : theme.colors.text.primary,
                        }}>
                        {exercise.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.text.secondary,
                          marginTop: theme.spacing.gap.xs / 2,
                        }}>
                        {exercise.muscleGroup} • {exercise.type}
                      </Text>
                    </View>
                  </View>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        backgroundColor: theme.colors.accent.primary,
                        width: theme.iconSize.md,
                        height: theme.iconSize.md,
                      }}>
                      <Check size={14} color={theme.colors.text.black} strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </BottomPopUpMenu>
  );
}
