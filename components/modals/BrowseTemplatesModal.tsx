import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { addOpacityToHex } from '../../theme';
import { GenericCard } from '../cards/GenericCard';
import { FilterTabs } from '../FilterTabs';
import { TextInput } from '../theme/TextInput';
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

const mockTemplates: WorkoutTemplate[] = [
  {
    id: '1',
    title: '5-Day Hypertrophy Split',
    difficulty: 'Advanced',
    duration: '75 min',
    exercises: '8 Exercises',
    sets: '24 Sets',
    icon: 'fitness-center',
  },
  {
    id: '2',
    title: 'Full Body Foundation',
    difficulty: 'Beginner',
    duration: '45 min',
    exercises: '6 Exercises',
    sets: '18 Sets',
    icon: 'home',
  },
  {
    id: '3',
    title: 'HIIT Power Burn',
    difficulty: 'Intermediate',
    duration: '30 min',
    exercises: '12 Rounds',
    sets: '36 Sets',
    icon: 'timer',
  },
  {
    id: '4',
    title: 'Morning Mobility',
    difficulty: 'Beginner',
    duration: '15 min',
    exercises: '5 Moves',
    sets: '10 Sets',
    icon: 'favorite',
  },
];

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

  const filteredTemplates = mockTemplates.filter((template) => {
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
                className="flex-1 items-center justify-center"
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
                {template.difficulty}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text className="mb-4 text-lg font-bold text-text-primary">{template.title}</Text>

          {/* Stats */}
          <View className="flex-row items-center gap-6 border-t border-white/5 pt-3">
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                Duration
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="schedule" size={16} color={theme.colors.accent.primary} />
                <Text className="text-sm font-medium text-text-secondary">{template.duration}</Text>
              </View>
            </View>
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                Exercises
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
                Sets
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
      title="Browse Templates"
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
              placeholder="Search expert programs..."
              icon={<Search size={theme.iconSize.lg} color={theme.colors.text.tertiary} />}
            />
          </View>

          {/* Category Filter Tabs */}
          <FilterTabs
            tabs={[
              { id: 'All', label: 'All' },
              { id: 'Beginner', label: 'Beginner' },
              { id: 'Intermediate', label: 'Intermediate' },
              { id: 'Advanced', label: 'Advanced' },
              { id: 'Strength', label: 'Strength' },
              { id: 'Hypertrophy', label: 'Hypertrophy' },
              { id: 'Cardio', label: 'Cardio' },
            ]}
            activeTab={selectedCategory}
            onTabChange={setSelectedCategory}
            showContainer={false}
            containerClassName=""
            scrollViewContentContainerStyle={{ paddingHorizontal: 0 }}
          />
        </View>

        {/* Template List */}
        <View className="px-4 py-4 pb-28">{filteredTemplates.map(renderTemplateCard)}</View>
      </ScrollView>
    </FullScreenModal>
  );
}
