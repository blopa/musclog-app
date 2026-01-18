import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Search, SlidersHorizontal, Dumbbell, Trophy, Square, Activity } from 'lucide-react-native';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { useTranslation } from 'react-i18next';
import { GenericCard } from '../cards/GenericCard';
import { PastWorkoutsHistoryFilterMenu } from './PastWorkoutsHistoryFilterMenu';

// Mock data matching the HTML example
const WORKOUT_HISTORY_DATA = [
  {
    month: 'August 2023',
    workouts: [
      {
        id: '1',
        name: 'Upper Body Power',
        date: 'Aug 24 • 06:30 PM',
        iconBgColor: theme.colors.status.indigo600,
        iconBgOpacity: theme.colors.status.indigo10,
        icon: Dumbbell,
        prCount: 4,
        stats: [
          { label: 'Duration', value: '70 min' },
          { label: 'Volume', value: '4,250 kg' },
          { label: 'Calories', value: '520 kcal' },
        ],
      },
      {
        id: '2',
        name: 'Morning Trail Run',
        date: 'Aug 22 • 07:15 AM',
        iconBgColor: theme.colors.status.emerald,
        iconBgOpacity: theme.colors.status.emerald10,
        icon: Activity,
        prCount: null,
        stats: [
          { label: 'Duration', value: '35 min' },
          { label: 'Distance', value: '5.2 km' },
          { label: 'Calories', value: '380 kcal' },
        ],
      },
      {
        id: '3',
        name: 'Leg Day / Squats',
        date: 'Aug 20 • 05:45 PM',
        iconBgColor: theme.colors.accent.primary,
        iconBgOpacity: theme.colors.accent.primary10,
        icon: Square,
        prCount: 1,
        stats: [
          { label: 'Duration', value: '55 min' },
          { label: 'Volume', value: '6,800 kg' },
          { label: 'Calories', value: '410 kcal' },
        ],
      },
    ],
  },
  {
    month: 'July 2023',
    workouts: [
      {
        id: '4',
        name: 'Full Body Blast',
        date: 'July 30 • 12:00 PM',
        iconBgColor: theme.colors.status.warning,
        iconBgOpacity: theme.colors.status.warning10,
        icon: Dumbbell,
        prCount: null,
        stats: [
          { label: 'Duration', value: '45 min' },
          { label: 'Volume', value: '3,100 kg' },
          { label: 'Calories', value: '330 kcal' },
        ],
      },
    ],
  },
];

type WorkoutHistoryModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function PastWorkoutsHistoryModal({ visible, onClose }: WorkoutHistoryModalProps) {
  const { t } = useTranslation();
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('pastWorkoutHistory.title')}
      scrollable={false}>
      <View className="flex-1">
        {/* Header */}
        <View
          className="px-4 pb-4 pt-4"
          style={{
            backgroundColor: theme.colors.background.darkBackground,
          }}>
          {/* Search and Filter */}
          <View className="flex-row items-center gap-2">
            <View className="relative flex-1">
              <View
                style={{
                  position: 'absolute',
                  left: theme.spacing.padding.md,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  zIndex: 1,
                }}>
                <Search size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              </View>
              <TextInput
                className="h-11 w-full pl-10 pr-4"
                placeholder="Search sessions..."
                placeholderTextColor={theme.colors.text.secondary}
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.background.white5,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.primary,
                  height: 44,
                }}
              />
            </View>
            <Pressable
              className="h-11 w-11 items-center justify-center border"
              style={{
                backgroundColor: theme.colors.background.card,
                borderColor: theme.colors.background.white5,
                borderRadius: theme.borderRadius.md,
              }}
              onPress={() => setIsFilterMenuVisible(true)}>
              <SlidersHorizontal size={theme.iconSize.sm} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Main Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-1 gap-6 p-4">
            {WORKOUT_HISTORY_DATA.map((section, sectionIndex) => (
              <View key={section.month}>
                {/* Month Header */}
                <Text
                  className="mb-3 px-1 font-bold uppercase tracking-widest"
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    color:
                      sectionIndex === WORKOUT_HISTORY_DATA.length - 1
                        ? theme.colors.text.secondary
                        : theme.colors.text.secondary,
                    opacity: sectionIndex === WORKOUT_HISTORY_DATA.length - 1 ? 0.8 : 1,
                  }}>
                  {section.month}
                </Text>

                {/* Workout Cards */}
                <View className="flex-col gap-3">
                  {section.workouts.map((workout, workoutIndex) => {
                    const Icon = workout.icon;
                    const isLastMonth = sectionIndex === WORKOUT_HISTORY_DATA.length - 1;
                    const opacity = isLastMonth ? 0.8 : 1;

                    return (
                      <View
                        key={workout.id}
                        style={{
                          opacity,
                        }}>
                        <GenericCard
                          variant="card"
                          isPressable={true}
                          onPress={() => {
                            // Handle press if needed
                          }}>
                          <View className="flex-col gap-4 p-4">
                            {/* Card Header */}
                            <View className="flex-row items-start justify-between">
                              <View className="flex-row items-center gap-3">
                                <View
                                  className="h-12 w-12 items-center justify-center rounded-lg"
                                  style={{
                                    backgroundColor: workout.iconBgOpacity,
                                  }}>
                                  <Icon size={theme.iconSize.xl} color={workout.iconBgColor} />
                                </View>
                                <View>
                                  <Text
                                    className="font-bold"
                                    style={{
                                      fontSize: theme.typography.fontSize.base,
                                      color: theme.colors.text.primary,
                                    }}>
                                    {workout.name}
                                  </Text>
                                  <Text
                                    className="text-xs"
                                    style={{
                                      color: theme.colors.text.gray400,
                                    }}>
                                    {workout.date}
                                  </Text>
                                </View>
                              </View>
                              {workout.prCount && (
                                <View
                                  className="flex-row items-center gap-1 rounded px-2 py-0.5"
                                  style={{
                                    backgroundColor: theme.colors.status.emerald400_10,
                                  }}>
                                  <Trophy
                                    size={theme.iconSize.xs}
                                    color={theme.colors.status.emeraldLight}
                                  />
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: theme.typography.fontWeight.bold,
                                      color: theme.colors.status.emeraldLight,
                                      textTransform: 'uppercase',
                                      letterSpacing: theme.typography.letterSpacing.wider,
                                    }}>
                                    {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Stats Grid */}
                            <View className="flex-row gap-2">
                              {workout.stats.map((stat, statIndex) => (
                                <View
                                  key={statIndex}
                                  className="flex-1 rounded-lg p-2"
                                  style={{
                                    backgroundColor: theme.colors.background.white5,
                                  }}>
                                  <Text
                                    className="text-center"
                                    style={{
                                      fontSize: theme.typography.fontSize.xs,
                                      color: theme.colors.text.gray400,
                                    }}>
                                    {stat.label}
                                  </Text>
                                  <Text
                                    className="text-center font-bold"
                                    style={{
                                      fontSize: theme.typography.fontSize.sm,
                                      color: theme.colors.text.primary,
                                    }}>
                                    {stat.value}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        </GenericCard>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Filter Menu */}
      <PastWorkoutsHistoryFilterMenu
        visible={isFilterMenuVisible}
        onClose={() => setIsFilterMenuVisible(false)}
        onApplyFilters={(filters) => {
          console.log('Filters applied:', filters);
        }}
        onClearFilters={() => {
          console.log('Filters cleared');
        }}
      />
    </FullScreenModal>
  );
}
