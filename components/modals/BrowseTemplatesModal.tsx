import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { FilterTabs } from '@/components/FilterTabs';
import { TextInput } from '@/components/theme/TextInput';
import workoutTemplatesEnUS from '@/data/workoutTemplatesEnUS.json';
import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

import { FullScreenModal } from './FullScreenModal';

type WorkoutTemplate = {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  exercises: string;
  sets: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

// Raw template type as found in workoutTemplatesEnUS.json
export type RawWorkoutTemplate = {
  title: string;
  description?: string;
  difficulty?: string;
  duration?: number | string;
  exercises?:
    | { exerciseId?: number; day?: number; sets?: number; reps?: number }[]
    | number
    | string;
  sets?: number;
  icon?: string;
};

/**
 * Extracts the template index from a normalized template ID
 * ID format: template-${idx}-${title}
 */
export function getRawTemplateById(templateId: string): RawWorkoutTemplate | null {
  // Extract index from ID format: template-${idx}-${title}
  const match = templateId.match(/^template-(\d+)-/);
  if (!match) {
    return null;
  }

  const index = parseInt(match[1], 10);
  const templates = workoutTemplatesEnUS as RawWorkoutTemplate[];

  if (index < 0 || index >= templates.length) {
    return null;
  }

  return templates[index];
}

const getNormalizedTemplates = (t: TFunction) => {
  // Normalize imported JSON format to the UI-friendly WorkoutTemplate shape
  const normalizedTemplates: WorkoutTemplate[] = (workoutTemplatesEnUS as RawWorkoutTemplate[]).map(
    (item, idx) => {
      const title =
        item.title || t('workouts.browseTemplatesModal.templateName', { number: idx + 1 });
      const difficulty = (item.difficulty as any) || 'Beginner';

      // Duration: number (minutes) -> "NN min", otherwise keep string
      const duration =
        typeof item.duration === 'number'
          ? `${item.duration} ${t('common.min')}`
          : typeof item.duration === 'string'
            ? item.duration
            : '';

      // Exercises: if array -> use translation with count, if number -> use translation with count, otherwise string
      let exercisesText = '';
      let totalSets = 0;
      if (Array.isArray(item.exercises)) {
        // Use i18next pluralization by passing `count` so translations can handle singular/plural forms.
        const count = item.exercises.length;
        exercisesText = t('workouts.browseTemplatesModal.stats.exercisesQty', { count });
        totalSets = item.exercises.reduce((sum, e) => sum + (e.sets || 0), 0);
      } else if (typeof item.exercises === 'number') {
        // Use i18next pluralization for numbers too
        exercisesText = t('workouts.browseTemplatesModal.stats.exercisesQty', {
          count: item.exercises,
        });
      } else if (typeof item.exercises === 'string') {
        exercisesText = item.exercises;
      }

      // If JSON provides top-level sets, or we computed totalSets from exercises array, use that
      if (!totalSets && typeof item.sets === 'number') {
        totalSets = item.sets;
      }

      const setsText = totalSets
        ? t('workouts.browseTemplatesModal.stats.setsQty', { count: totalSets })
        : '';

      const iconKey = (item.icon || 'fitness-center') as keyof typeof MaterialIcons.glyphMap;

      const id = `template-${idx}-${title.replace(/\s+/g, '-').toLowerCase()}`;

      return {
        id,
        title,
        difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)
          ? (difficulty as any)
          : 'Beginner',
        duration,
        exercises: exercisesText,
        sets: setsText,
        icon: iconKey,
      } as WorkoutTemplate;
    }
  );

  return normalizedTemplates;
};

type BrowseTemplatesModalProps = {
  visible: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: WorkoutTemplate) => void;
};

export function BrowseTemplatesModal({
  visible,
  onClose,
  onTemplateSelect,
}: BrowseTemplatesModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return {
          bg: theme.colors.status.emerald10,
          text: theme.colors.status.emerald,
          border: theme.colors.status.emerald20,
        };
      case 'Intermediate':
        return {
          bg: theme.colors.status.amber10,
          text: theme.colors.status.amber,
          border: addOpacityToHex(theme.colors.status.amber, 0.2),
        };
      case 'Advanced':
        return {
          bg: theme.colors.status.error10,
          text: theme.colors.status.error,
          border: theme.colors.status.error20,
        };
      default:
        return {
          bg: theme.colors.background.overlay,
          text: theme.colors.text.secondary,
          border: theme.colors.border.default,
        };
    }
  };

  const normalizedTemplates = getNormalizedTemplates(t);

  const filteredTemplates = normalizedTemplates.filter((template) => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' ||
      template.difficulty === selectedCategory ||
      template.title.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const renderTemplateCard = (template: WorkoutTemplate) => {
    const difficultyColors = getDifficultyColor(template.difficulty);

    return (
      <GenericCard
        key={template.id}
        variant="card"
        isPressable
        onPress={() => onTemplateSelect?.(template)}
        containerStyle={{ marginBottom: theme.spacing.padding.md }}
      >
        <View className="p-4">
          {/* Header with icon and difficulty */}
          <View className="mb-4 flex-row items-start justify-between">
            <View className="h-12 w-12 overflow-hidden rounded-full">
              <LinearGradient
                colors={theme.colors.gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 48,
                  overflow: 'hidden',
                }}
              >
                <MaterialIcons name={template.icon} size={24} color="white" />
              </LinearGradient>
            </View>
            <View
              className="rounded-full border px-3 py-1"
              style={{
                backgroundColor: difficultyColors.bg,
                borderColor: difficultyColors.border,
              }}
            >
              <Text
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: difficultyColors.text }}
              >
                {t(`workouts.browseTemplatesModal.tabs.${template.difficulty.toLowerCase()}`)}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text className="mb-4 text-lg font-bold text-text-primary">{template.title}</Text>

          {/* Stats */}
          <View className="flex-row items-center gap-6 border-t border-white/5 pt-3">
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                {t('workouts.browseTemplatesModal.stats.duration')}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="schedule" size={16} color={theme.colors.accent.primary} />
                <Text className="text-sm font-medium text-text-secondary">{template.duration}</Text>
              </View>
            </View>
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                {t('workouts.browseTemplatesModal.stats.exercises')}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons
                  name="format-list-bulleted"
                  size={16}
                  color={theme.colors.accent.primary}
                />
                <Text className="text-sm font-medium text-text-secondary">
                  {template.exercises}
                </Text>
              </View>
            </View>
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                {t('workouts.browseTemplatesModal.stats.sets')}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons
                  name="fitness-center"
                  size={16}
                  color={theme.colors.accent.primary}
                />
                <Text className="text-sm font-medium text-text-secondary">{template.sets}</Text>
              </View>
            </View>
          </View>
        </View>
      </GenericCard>
    );
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.browseTemplatesModal.title')}
      scrollable={false}
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="bg-bg-primary px-4 pb-4 pt-6">
          {/* Search Bar */}
          <View className="mb-5">
            <TextInput
              label=""
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('workouts.browseTemplatesModal.searchPlaceholder') as string}
              icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
            />
          </View>

          {/* Category Filter Tabs */}
          <FilterTabs
            tabs={[
              { id: 'All', label: t('workouts.browseTemplatesModal.tabs.all') },
              { id: 'Beginner', label: t('workouts.browseTemplatesModal.tabs.beginner') },
              { id: 'Intermediate', label: t('workouts.browseTemplatesModal.tabs.intermediate') },
              { id: 'Advanced', label: t('workouts.browseTemplatesModal.tabs.advanced') },
              { id: 'Strength', label: t('workouts.browseTemplatesModal.tabs.strength') },
              { id: 'Hypertrophy', label: t('workouts.browseTemplatesModal.tabs.hypertrophy') },
              { id: 'Cardio', label: t('workouts.browseTemplatesModal.tabs.cardio') },
            ]}
            activeTab={selectedCategory}
            onTabChange={setSelectedCategory}
            showContainer={false}
            containerClassName=""
            scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>

        {/* Template List */}
        <View className="gap-2 px-4 py-4 pb-28">{filteredTemplates.map(renderTemplateCard)}</View>
      </ScrollView>
    </FullScreenModal>
  );
}
