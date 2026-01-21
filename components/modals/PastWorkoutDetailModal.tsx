import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Share2, MoreHorizontal, Trophy, Pencil, Trash2 } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { GenericCard } from '../cards/GenericCard';
import { LineChart, LineChartDataPoint } from '../LineChart';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../BottomPopUpMenu';

// Mock data - replace with actual data from props
const mockWorkoutData = {
  name: 'Upper Body Power',
  date: new Date('2024-08-24T18:30:00'),
  totalTime: 70, // minutes
  volume: 4250, // kg
  calories: 520,
  volumeTrend: {
    percentage: 12,
    data: [
      { x: 0, y: 80 },
      { x: 50, y: 70 },
      { x: 100, y: 75 },
      { x: 200, y: 60 },
      { x: 300, y: 40 },
      { x: 400, y: 25 },
    ] as LineChartDataPoint[],
    labels: ['Jul 15', 'Aug 01', 'Aug 12', 'TODAY'],
  },
  exercises: [
    {
      id: '1',
      name: 'Incline Bench Press (Dumbbell)',
      timeSpent: 12,
      iconColor: theme.colors.status.indigo600,
      iconBgColor: theme.colors.status.indigo10,
      sets: [
        {
          setNumber: 1,
          weight: '28 kg',
          reps: 12,
          partial: '-',
          rest: '90s',
          isHighlighted: false,
        },
        {
          setNumber: 2,
          weight: '32 kg',
          reps: 10,
          partial: '2',
          rest: '120s',
          isHighlighted: true,
        },
        {
          setNumber: 3,
          weight: '32 kg',
          reps: 8,
          partial: '4',
          rest: '150s',
          isHighlighted: false,
        },
      ],
    },
    {
      id: '2',
      name: 'Pull Ups (Weighted)',
      timeSpent: 15,
      iconColor: theme.colors.status.emerald,
      iconBgColor: theme.colors.status.emerald10,
      sets: [
        {
          setNumber: 1,
          weight: '+10 kg',
          reps: 8,
          partial: '-',
          rest: '60s',
          isHighlighted: false,
        },
        {
          setNumber: 2,
          weight: '+10 kg',
          reps: 8,
          partial: '-',
          rest: '60s',
          isHighlighted: false,
        },
      ],
    },
    {
      id: '3',
      name: 'Dumbbell Lateral Raise',
      timeSpent: 8,
      iconColor: theme.colors.status.warning,
      iconBgColor: theme.colors.status.warning10,
      sets: [
        {
          setNumber: 1,
          weight: '12 kg',
          reps: 15,
          partial: '5',
          rest: '45s',
          isHighlighted: false,
        },
      ],
    },
  ],
};

type PastWorkoutDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  workout?: typeof mockWorkoutData;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

export default function PastWorkoutDetailModal({
  visible,
  onClose,
  workout = mockWorkoutData,
  onEdit,
  onShare,
  onDelete,
}: PastWorkoutDetailModalProps) {
  const { t } = useTranslation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMM d • hh:mm a');
  };

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.edit'),
      description: t('workoutDetails.editDescription'),
      onPress: () => {
        onEdit?.();
      },
    },
    {
      icon: Share2,
      iconColor: theme.colors.text.primary,
      iconBgColor: theme.colors.text.primary20,
      title: t('workoutDetails.share'),
      description: t('workoutDetails.shareDescription'),
      onPress: () => {
        onShare?.();
      },
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('workoutDetails.delete'),
      description: t('workoutDetails.deleteDescription'),
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => {
        onDelete?.();
      },
    },
  ];

  const headerRight = (
    <Pressable
      className="h-10 w-10 items-center justify-center rounded-full border"
      style={{
        backgroundColor: theme.colors.background.card,
        borderColor: theme.colors.background.white5,
      }}
      onPress={() => setIsMenuVisible(true)}
    >
      <MoreHorizontal size={theme.iconSize.md} color={theme.colors.text.primary} />
    </Pressable>
  );

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={workout.name}
        subtitle={formatDate(workout.date)}
        headerRight={headerRight}
      >
      <View className="flex-1 gap-5 p-4">
        {/* Workout Summary Card with Gradient */}
        <View className="overflow-hidden rounded-xl">
          <LinearGradient
            colors={theme.colors.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              padding: theme.spacing.padding.lg,
              borderRadius: theme.borderRadius.xl,
            }}
          >
            <View className="flex-row gap-4">
              {/* Total Time */}
              <View className="flex-1 flex-col">
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ opacity: 0.8 }}
                >
                  {t('workoutDetail.totalTime')}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-2xl font-extrabold tracking-tight text-white">
                    {workout.totalTime}
                  </Text>
                  <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                    {t('common.min')}
                  </Text>
                </View>
              </View>

              {/* Volume */}
              <View
                className="flex-1 flex-col border-l pl-4"
                style={{ borderLeftColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ opacity: 0.8 }}
                >
                  {t('workoutDetail.volume')}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-2xl font-extrabold tracking-tight text-white">
                    {workout.volume.toLocaleString()}
                  </Text>
                  <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                    {t('workoutSession.kg')}
                  </Text>
                </View>
              </View>

              {/* Calories */}
              <View
                className="flex-1 flex-col border-l pl-4"
                style={{ borderLeftColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ opacity: 0.8 }}
                >
                  {t('workoutDetail.calories')}
                </Text>
                <View className="flex-row items-baseline gap-1">
                  <Text className="text-2xl font-extrabold tracking-tight text-white">
                    {workout.calories}
                  </Text>
                  <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                    {t('common.kcal')}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Volume Trend Card */}
        <GenericCard variant="card">
          <View style={{ padding: theme.spacing.padding.base }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-sm font-bold text-text-primary">{t('workoutDetail.volumeTrend')}</Text>
              <View
                className="rounded px-2 py-0.5"
                style={{ backgroundColor: theme.colors.accent.primary10 }}
              >
                <Text className="text-[10px] font-bold uppercase text-accent-primary">
                  {t('workoutDetail.volumeTrendPercentage', { percentage: workout.volumeTrend.percentage })}
                </Text>
              </View>
            </View>
            <LineChart
              data={workout.volumeTrend.data}
              height={128}
              chartWidth={400}
              chartHeight={100}
              lineColor={theme.colors.accent.primary}
              areaColor={theme.colors.accent.primary30}
              xAxisLabels={workout.volumeTrend.labels}
              marginTop={8}
              marginBottom={8}
            />
          </View>
        </GenericCard>

        {/* Exercises Section */}
        <View className="flex-col gap-4">
          <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary px-1">
            {t('workoutDetail.exercisesCount', { count: workout.exercises.length })}
          </Text>

          {workout.exercises.map((exercise) => (
            <GenericCard key={exercise.id} variant="card">
              {/* Exercise Header */}
              <View
                className="mb-0 flex-row items-center justify-between border-b pb-4"
                style={{
                  padding: theme.spacing.padding.base,
                  borderBottomColor: theme.colors.background.white5,
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: exercise.iconBgColor }}
                  >
                    {exercise.id === '2' ? (
                      <MaterialIcons
                        name="repeat"
                        size={theme.iconSize.md}
                        color={exercise.iconColor}
                      />
                    ) : (
                      <MaterialIcons
                        name="fitness-center"
                        size={theme.iconSize.md}
                        color={exercise.iconColor}
                      />
                    )}
                  </View>
                  <View>
                    <Text className="font-bold text-text-primary">{exercise.name}</Text>
                    <Text
                      className="text-[10px] font-medium text-text-tertiary"
                      style={{ marginTop: theme.spacing.gap.xs }}
                    >
                      {t('workoutDetail.minsSpent', { minutes: exercise.timeSpent })}
                    </Text>
                  </View>
                </View>
                <MaterialIcons
                  name="info"
                  size={theme.iconSize.sm}
                  color={theme.colors.text.tertiary}
                />
              </View>

              {/* Sets Table */}
              <View
                className="mt-0 overflow-hidden"
                style={{
                  paddingHorizontal: theme.spacing.padding.base,
                  paddingBottom: theme.spacing.padding.base,
                }}
              >
                {/* Table Header */}
                <View
                  className="flex-row border-b"
                  style={{
                    backgroundColor: theme.colors.background.white5,
                    borderBottomColor: theme.colors.background.white5,
                  }}
                >
                  <View className="w-12 items-center py-2">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      {t('workoutDetail.set')}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-2">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      {t('workoutDetail.weight')}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-2">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      {t('workoutDetail.reps')}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-2">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      {t('workoutDetail.partial')}
                    </Text>
                  </View>
                  <View className="flex-1 items-center py-2">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                      {t('workoutDetail.rest')}
                    </Text>
                  </View>
                </View>

                {/* Table Rows */}
                <View>
                  {exercise.sets.map((set, index) => (
                    <View
                      key={index}
                      className="flex-row items-center border-b"
                      style={{
                        backgroundColor: set.isHighlighted
                          ? theme.colors.accent.primary5
                          : 'transparent',
                        borderBottomColor: theme.colors.background.white5,
                      }}
                    >
                      <View className="w-12 items-center py-3">
                        <Text
                          className="font-bold"
                          style={{
                            color: set.isHighlighted
                              ? theme.colors.accent.primary
                              : theme.colors.text.tertiary,
                          }}
                        >
                          {set.setNumber}
                        </Text>
                      </View>
                      <View className="flex-1 items-center py-3">
                        <Text className="text-sm text-text-primary">{set.weight}</Text>
                      </View>
                      <View className="flex-1 items-center py-3">
                        <Text className="text-sm text-text-primary">{set.reps}</Text>
                      </View>
                      <View className="flex-1 items-center py-3">
                        <Text className="text-sm text-text-primary">{set.partial}</Text>
                      </View>
                      <View className="flex-1 items-center py-3">
                        <View className="flex-row items-center gap-1">
                          {set.isHighlighted && (
                            <Trophy size={12} color={theme.colors.accent.primary} />
                          )}
                          <Text className="text-xs text-text-tertiary">{set.rest}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </GenericCard>
          ))}

          {/* Bottom spacing */}
          <View className="h-8" />
        </View>
      </View>
    </FullScreenModal>

    <BottomPopUpMenu
      visible={isMenuVisible}
      onClose={() => setIsMenuVisible(false)}
      title={workout.name}
      subtitle={t('workoutDetails.subtitle')}
      items={menuItems}
    />
  </>
  );
}
