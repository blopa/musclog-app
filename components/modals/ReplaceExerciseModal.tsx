import { Repeat, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';

import Exercise, { type MechanicType, type MuscleGroup } from '../../database/models/Exercise';
import { useReplaceExerciseExercises } from '../../hooks/useReplaceExerciseExercises';
import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { FilterTabs } from '../FilterTabs';
import { OptionsSelector, SelectorOption } from '../OptionsSelector';
import { Button } from '../theme/Button';

/**
 * Exercise data for replacement modal.
 * Uses Pick to extract only needed fields from Exercise model.
 */
export type ReplaceExerciseData = Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'mechanicType'> & {
  image?: any; // ImageSourcePropType
};

type ReplaceExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onReplace: (exercise: ReplaceExerciseData) => void;
  currentExercise?: string;
  exercises?: ReplaceExerciseData[];
};

function exerciseToReplaceData(exercise: Exercise): ReplaceExerciseData {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    mechanicType: exercise.mechanicType,
    image: undefined,
  };
}

export function ReplaceExerciseModal({
  visible,
  onClose,
  onReplace,
  currentExercise,
  exercises: exercisesProp,
}: ReplaceExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const muscleGroupForHook =
    selectedFilter === 'All' ? undefined : (selectedFilter.toLowerCase() as string);

  const {
    exercises: exercisesFromHook,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useReplaceExerciseExercises({
    visible: visible && exercisesProp === undefined,
    muscleGroup: muscleGroupForHook,
    searchTerm: searchQuery.trim() || undefined,
    initialLimit: 5,
    batchSize: 5,
  });

  const displayList: ReplaceExerciseData[] = useMemo(() => {
    if (exercisesProp !== undefined) {
      return exercisesProp.filter((e) => {
        const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter =
          selectedFilter === 'All' || e.muscleGroup.toLowerCase() === selectedFilter.toLowerCase();
        return matchesSearch && matchesFilter;
      });
    }
    return exercisesFromHook.map(exerciseToReplaceData);
  }, [exercisesProp, exercisesFromHook, searchQuery, selectedFilter]);

  const [selectedExercise, setSelectedExercise] = useState<string>('');

  useEffect(() => {
    if (displayList.length === 0) {
      setSelectedExercise('');
      return;
    }
    const ids = new Set(displayList.map((e) => e.id));
    if (!ids.has(selectedExercise)) {
      setSelectedExercise(displayList[0].id);
    }
  }, [displayList, selectedExercise]);

  const MUSCLE_GROUP_TABS = [
    { id: 'All', label: t('replaceExercise.muscleGroups.all') },
    { id: 'Chest', label: t('replaceExercise.muscleGroups.chest') },
    { id: 'Shoulders', label: t('replaceExercise.muscleGroups.shoulders') },
    { id: 'Triceps', label: t('replaceExercise.muscleGroups.triceps') },
  ];

  const handleReplace = () => {
    const exercise = displayList.find((e) => e.id === selectedExercise);
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
            disabled={!selectedExercise}
          />
        </View>
      }
    >
      <View>
        {/* Search and Filters Section */}
        <View
          className="gap-3"
          style={{
            backgroundColor: theme.colors.background.primary,
            paddingHorizontal: theme.spacing.padding.xl,
            paddingTop: theme.spacing.padding.base,
            paddingBottom: theme.spacing.padding.sm,
          }}
        >
          {/* Search Input */}
          <View className="relative">
            <View
              className="absolute inset-y-0 left-0 z-10 items-center justify-center pl-4"
              style={{ pointerEvents: 'none' }}
            >
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
                backgroundColor: theme.colors.background.secondaryDark,
                borderWidth: searchQuery ? theme.borderWidth.medium : 0,
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
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
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
          }}
        >
          <View>
            {isLoading && displayList.length === 0 ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={theme.colors.accent.primary} />
              </View>
            ) : displayList.length === 0 ? (
              <Text
                className="py-8 text-center"
                style={{
                  color: theme.colors.text.secondary,
                  fontSize: theme.typography.fontSize.base,
                }}
              >
                {t('replaceExercise.noExercisesMatch', 'No exercises match')}
              </Text>
            ) : (
              <>
                <OptionsSelector
                  title={t('replaceExercise.selectExercise')}
                  options={displayList.map((exercise) => {
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
                      description: `${exercise.muscleGroup} • ${exercise.mechanicType}`,
                      icon: IconComponent,
                      iconBgColor: theme.colors.background.iconDark,
                      iconColor: theme.colors.text.primary,
                    };

                    return option;
                  })}
                  selectedId={selectedExercise}
                  onSelect={(id) => setSelectedExercise(id)}
                />
                {exercisesProp === undefined && hasMore ? (
                  <View className="py-4">
                    <Button
                      label={
                        isLoadingMore
                          ? t('replaceExercise.loadingMore', 'Loading…')
                          : t('replaceExercise.loadMore', 'Load More')
                      }
                      onPress={loadMore}
                      size="sm"
                      variant="outline"
                      disabled={isLoadingMore}
                      loading={isLoadingMore}
                      width="full"
                      iconPosition="left"
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </BottomPopUpMenu>
  );
}
