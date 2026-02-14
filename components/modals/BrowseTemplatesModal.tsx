import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { FilterTabs } from '../FilterTabs';
import { FullScreenModal } from './FullScreenModal';

type WorkoutTemplate = {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  exercises: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const mockTemplates: WorkoutTemplate[] = [
  {
    id: '1',
    title: '5-Day Hypertrophy Split',
    difficulty: 'Advanced',
    duration: '75 min',
    exercises: '8 Exercises',
    icon: 'fitness-center',
  },
  {
    id: '2',
    title: 'Full Body Foundation',
    difficulty: 'Beginner',
    duration: '45 min',
    exercises: '6 Exercises',
    icon: 'home',
  },
  {
    id: '3',
    title: 'HIIT Power Burn',
    difficulty: 'Intermediate',
    duration: '30 min',
    exercises: '12 Rounds',
    icon: 'timer',
  },
  {
    id: '4',
    title: 'Morning Mobility',
    difficulty: 'Beginner',
    duration: '15 min',
    exercises: '5 Moves',
    icon: 'favorite',
  },
];

const categories = ['All', 'Strength', 'Hypertrophy', 'Cardio', 'Beginner'];

type BrowseTemplatesModalProps = {
  visible: boolean;
  onClose: () => void;
  onTemplateSelect?: (template: WorkoutTemplate) => void;
};

export function BrowseTemplatesModal({ visible, onClose, onTemplateSelect }: BrowseTemplatesModalProps) {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return {
          // TODO: use colors from theme
          bg: 'rgba(16, 185, 129, 0.1)',
          text: '#10b981',
          border: 'rgba(16, 185, 129, 0.2)',
        };
      case 'Intermediate':
        return {
          // TODO: use colors from theme
          bg: 'rgba(251, 191, 36, 0.1)',
          text: '#f59e0b',
          border: 'rgba(251, 191, 36, 0.2)',
        };
      case 'Advanced':
        return {
          // TODO: use colors from theme
          bg: 'rgba(239, 68, 68, 0.1)',
          text: '#ef4444',
          border: 'rgba(239, 68, 68, 0.2)',
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
    const matchesCategory = selectedCategory === 'All' || 
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
          <View className="flex-row items-start justify-between mb-4">
            <View className="w-12 h-12 rounded-full overflow-hidden">
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
              className="px-3 py-1 rounded-full border"
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
          <Text className="text-lg font-bold mb-4 text-text-primary">{template.title}</Text>

          {/* Stats */}
          <View className="flex-row items-center gap-6 pt-3 border-t border-white/5">
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] text-text-secondary uppercase font-semibold tracking-widest">
                Duration
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="schedule" size={16} color={theme.colors.accent.primary} />
                <Text className="text-sm font-medium text-text-secondary">{template.duration}</Text>
              </View>
            </View>
            <View className="flex-col gap-0.5">
              <Text className="text-[10px] text-text-secondary uppercase font-semibold tracking-widest">
                Exercises
              </Text>
              <View className="flex-row items-center gap-1.5">
                <MaterialIcons name="format-list-bulleted" size={16} color={theme.colors.accent.primary} />
                <Text className="text-sm font-medium text-text-secondary">{template.exercises}</Text>
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
        <View className="px-4 py-4 pb-28">
          {filteredTemplates.map(renderTemplateCard)}
        </View>
      </ScrollView>
    </FullScreenModal>
  );
}
