import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { MenuButton } from '../theme/MenuButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { GenericCard } from '../cards/GenericCard';
import { LineChart, LineChartDataPoint } from '../LineChart';
import { usePastWorkoutDetail } from '../../hooks/usePastWorkoutDetail';
import { PastWorkoutBottomMenu } from './PastWorkoutBottomMenu';
import { useSettings } from '../../hooks/useSettings';
import { getWeightUnitI18nKey } from '../../utils/units';

// Types
type WorkoutSet = {
  setNumber: number;
  weight: string;
  reps: number;
  partial: string;
  rest: string;
  isHighlighted: boolean;
};

type Exercise = {
  id: string;
  name: string;
  timeSpent: number;
  iconColor: string;
  iconBgColor: string;
  icon: any;
  sets: WorkoutSet[];
};

// Component: Workout Summary Card
type WorkoutSummaryCardProps = {
  totalTime: number;
  volume: number;
  calories: number;
  weightUnitKey: 'workoutSession.kg' | 'workoutSession.lb';
};

function WorkoutSummaryCard({
  totalTime,
  volume,
  calories,
  weightUnitKey,
}: WorkoutSummaryCardProps) {
  const { t } = useTranslation();

  return (
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
              <Text className="text-2xl font-extrabold tracking-tight text-white">{totalTime}</Text>
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
                {volume.toLocaleString()}
              </Text>
              <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                {t(weightUnitKey)}
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
              <Text className="text-2xl font-extrabold tracking-tight text-white">{calories}</Text>
              <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                {t('common.kcal')}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// Component: Volume Trend Card
type VolumeTrendCardProps = {
  percentage: number;
  data: LineChartDataPoint[];
  labels: string[];
};

function VolumeTrendCard({ percentage, data, labels }: VolumeTrendCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="card">
      <View style={{ padding: theme.spacing.padding.base }}>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-sm font-bold text-text-primary">
            {t('workoutDetail.volumeTrend')}
          </Text>
          <View
            className="rounded px-2 py-0.5"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <Text className="text-[10px] font-bold uppercase text-accent-primary">
              {t('workoutDetail.volumeTrendPercentage', { percentage })}
            </Text>
          </View>
        </View>
        <LineChart
          data={data}
          height={128}
          chartWidth={400}
          chartHeight={100}
          lineColor={theme.colors.accent.primary}
          areaColor={theme.colors.accent.primary30}
          xAxisLabels={labels}
          marginTop={8}
          marginBottom={8}
        />
      </View>
    </GenericCard>
  );
}

// Component: Set Row
type SetRowProps = {
  set: WorkoutSet;
};

function SetRow({ set }: SetRowProps) {
  return (
    <View
      className="flex-row items-center border-b"
      style={{
        backgroundColor: set.isHighlighted ? theme.colors.accent.primary5 : 'transparent',
        borderBottomColor: theme.colors.background.white5,
      }}
    >
      <View className="w-12 items-center py-3">
        <Text
          className="font-bold"
          style={{
            color: set.isHighlighted ? theme.colors.accent.primary : theme.colors.text.tertiary,
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
          {set.isHighlighted && <Trophy size={12} color={theme.colors.accent.primary} />}
          <Text className="text-xs text-text-tertiary">{set.rest}</Text>
        </View>
      </View>
    </View>
  );
}

// Component: Sets Table
type SetsTableProps = {
  sets: WorkoutSet[];
};

function SetsTable({ sets }: SetsTableProps) {
  const { t } = useTranslation();

  return (
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
        {sets.map((set, index) => (
          <SetRow key={index} set={set} />
        ))}
      </View>
    </View>
  );
}

// Component: Exercise Card
type ExerciseCardProps = {
  exercise: Exercise;
};

function ExerciseCard({ exercise }: ExerciseCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="card">
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
            {React.createElement(exercise.icon, {
              size: theme.iconSize.md,
              color: exercise.iconColor,
            })}
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
      </View>

      {/* Sets Table */}
      <SetsTable sets={exercise.sets} />
    </GenericCard>
  );
}

// Component: Exercises Section
type ExercisesSectionProps = {
  exercises: Exercise[];
};

function ExercisesSection({ exercises }: ExercisesSectionProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-col gap-4">
      <Text className="px-1 text-xs font-bold uppercase tracking-widest text-text-tertiary">
        {t('workoutDetail.exercisesCount', { count: exercises.length })}
      </Text>

      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} />
      ))}

      {/* Bottom spacing */}
      <View className="h-8" />
    </View>
  );
}

// Main Component
type PastWorkoutDetailModalProps = {
  visible: boolean;
  onClose: () => void;
  workoutId?: string;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

export default function PastWorkoutDetailModal({
  visible,
  onClose,
  workoutId,
  onEdit,
  onShare,
  onDelete,
}: PastWorkoutDetailModalProps) {
  const { t } = useTranslation();
  const { units } = useSettings();
  const weightUnitKey = getWeightUnitI18nKey(units);

  const { workout, isLoading, isMenuVisible, setIsMenuVisible } = usePastWorkoutDetail({
    visible,
    workoutId,
  });

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMM d • hh:mm a');
  };

  const headerRight = (
    <MenuButton
      size="md"
      color={theme.colors.text.primary}
      onPress={() => setIsMenuVisible(true)}
      className="h-10 w-10"
    />
  );

  if (!workout) {
    return (
      <FullScreenModal visible={visible} onClose={onClose} title="" scrollable={false}>
        <View className="flex-1 items-center justify-center">
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.accent.primary} />
          ) : (
            <Text className="text-text-secondary">
              {t('common.error', 'Error loading workout')}
            </Text>
          )}
        </View>
      </FullScreenModal>
    );
  }

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
          <WorkoutSummaryCard
            totalTime={workout.totalTime}
            volume={workout.volume}
            calories={workout.calories}
            weightUnitKey={weightUnitKey}
          />

          {workout.volumeTrend.data.length > 0 && (
            <VolumeTrendCard
              percentage={workout.volumeTrend.percentage}
              data={workout.volumeTrend.data}
              labels={workout.volumeTrend.labels}
            />
          )}

          <ExercisesSection exercises={workout.exercises} />
        </View>
      </FullScreenModal>

      <PastWorkoutBottomMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        workoutName={workout.name}
        onEdit={onEdit}
        onShare={onShare}
        onDelete={onDelete}
      />
    </>
  );
}
