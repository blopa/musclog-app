import { Dumbbell, Repeat, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';

import { BottomPopUpMenu } from '@/components/BottomPopUpMenu';
import { FilterTabs } from '@/components/FilterTabs';
import { OptionsSelector, SelectorOption } from '@/components/OptionsSelector';
import { Button } from '@/components/theme/Button';
import Exercise from '@/database/models/Exercise';
import { useExercises } from '@/hooks/useExercises';
import { useTheme } from '@/hooks/useTheme';
import {
  getMechanicTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';

/**
 * Exercise data for replacement modal.
 * Uses Pick to extract only needed fields from Exercise model.
 */
export type ReplaceExerciseData = Pick<Exercise, 'id' | 'name' | 'muscleGroup' | 'mechanicType'> & {
  imageUrl?: string;
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
    imageUrl: exercise.imageUrl?.trim() || undefined,
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
  } = useExercises({
    mode: 'list',
    visible: visible && exercisesProp === undefined,
    muscleGroup: muscleGroupForHook,
    searchTerm: searchQuery.trim() || undefined,
    initialLimit: 5,
    batchSize: 5,
    enableReactivity: false,
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
      scrollable={false}
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
      <View style={{ flex: 1 }}>
        {/* Sticky: Search and Filters */}
        <View className="gap-3" style={{ paddingBottom: theme.spacing.padding.sm }}>
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

        {/* Scrollable: Exercise list only */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: theme.spacing.padding.xl,
            paddingTop: theme.spacing.padding.sm,
          }}
        >
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
              {t('replaceExercise.noExercisesMatch')}
            </Text>
          ) : (
            <>
              <OptionsSelector
                title={t('replaceExercise.selectExercise')}
                options={displayList.map((exercise) => {
                  const muscleGroupI18nKey = getMuscleGroupTranslationKey(exercise.muscleGroup);
                  const mechanicTypeI18nKey = getMechanicTypeTranslationKey(exercise.mechanicType);

                  const option: SelectorOption<string> = {
                    id: exercise.id,
                    label: exercise.name,
                    description: `${t(muscleGroupI18nKey)} • ${t(mechanicTypeI18nKey)}`,
                    icon: Dumbbell,
                    iconBgColor: theme.colors.background.iconDark,
                    iconColor: theme.colors.text.primary,
                    imageUrl: exercise.imageUrl,
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
                        ? t('replaceExercise.loadingMore')
                        : t('replaceExercise.loadMore')
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
        </ScrollView>
      </View>
    </BottomPopUpMenu>
  );
}
