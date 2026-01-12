import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image } from 'react-native';
import { Search, Check, Repeat } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { Button } from '../theme/Button';
import { FilterTabs } from '../FilterTabs';
import { OptionsSelector, SelectorOption } from '../OptionsSelector';

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

  const MUSCLE_GROUP_TABS = [
    { id: 'All', label: t('replaceExercise.muscleGroups.all') },
    { id: 'Chest', label: t('replaceExercise.muscleGroups.chest') },
    { id: 'Shoulders', label: t('replaceExercise.muscleGroups.shoulders') },
    { id: 'Triceps', label: t('replaceExercise.muscleGroups.triceps') },
  ];

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
      title={t('replaceExercise.title')}
      maxHeight="85%"
      footer={
        <View className="flex-row items-stretch gap-3">
          <Button
            label={t('replaceExercise.cancel')}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
          />
          <Button
            label={t('replaceExercise.replace')}
            icon={Repeat}
            size="sm"
            width="flex-2"
            onPress={handleReplace}
          />
        </View>
      }>
      <View>
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
              style={{ pointerEvents: 'none' }}>
              <Search
                size={theme.iconSize.lg}
                color={searchQuery ? theme.colors.accent.primary : theme.colors.text.secondary}
              />
            </View>
            <TextInput
              placeholder={t('replaceExercise.searchPlaceholder')}
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
          <FilterTabs
            tabs={MUSCLE_GROUP_TABS}
            activeTab={selectedFilter}
            onTabChange={setSelectedFilter}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>

        {/* Exercise List Section (uses OptionsSelector) */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{
            backgroundColor: theme.colors.background.primary,
            paddingHorizontal: theme.spacing.padding.xl,
          }}
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding.xl,
            paddingTop: theme.spacing.padding.sm,
          }}>
          <View>
            <OptionsSelector
              title={t('replaceExercise.selectExercise')}
              options={filteredExercises.map((exercise) => {
                const IconComponent = (props: { size: number; color: string }) => {
                  const size = props.size;
                  const sx = {
                    width: size,
                    height: size,
                    borderRadius: theme.borderRadius.md,
                    overflow: 'hidden' as const,
                    backgroundColor: theme.colors.background.iconDark,
                  };

                  return exercise.image ? (
                    <Image source={exercise.image} style={sx} resizeMode="cover" />
                  ) : (
                    <View style={sx} />
                  );
                };

                const option: SelectorOption<string> = {
                  id: exercise.id,
                  label: exercise.name,
                  description: `${exercise.muscleGroup} • ${exercise.type}`,
                  icon: IconComponent,
                  iconBgColor: theme.colors.background.iconDark,
                  iconColor: theme.colors.text.primary,
                };

                return option;
              })}
              selectedId={selectedExercise}
              onSelect={(id) => setSelectedExercise(id)}
            />
          </View>
        </ScrollView>
      </View>
    </BottomPopUpMenu>
  );
}
