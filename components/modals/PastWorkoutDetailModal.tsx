import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Edit, RefreshCw, Trophy } from 'lucide-react-native';
import { createElement, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, Share, Text, View } from 'react-native';

import { database } from '../../database';
import Exercise from '../../database/models/Exercise';
import WorkoutLog from '../../database/models/WorkoutLog';
import { EnrichedWorkoutLogSet, WorkoutService } from '../../database/services';
import { useDateFnsLocale } from '../../hooks/useDateFnsLocale';
import { useEditWorkoutSets } from '../../hooks/useEditWorkoutSets';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { usePastWorkoutDetail } from '../../hooks/usePastWorkoutDetail';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { healthConnectService } from '../../services/healthConnect';
import { writeWorkoutToHealthConnect } from '../../services/healthConnectWorkout';
import { XAxisLabel } from '../../utils/chartUtils';
import { captureException } from '../../utils/sentry';
import { showSnackbar } from '../../utils/snackbarService';
import { displayToKg } from '../../utils/unitConversion';
import { getWeightUnitI18nKey } from '../../utils/units';
import type { WorkoutExercise, WorkoutSet } from '../../utils/workoutDetail';
import { GenericCard } from '../cards/GenericCard';
import { LineChart, LineChartDataPoint } from '../charts/LineChart';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import EditPastWorkoutDataModal from './EditPastWorkoutDataModal';
import { FullScreenModal } from './FullScreenModal';
import { PastWorkoutBottomMenu } from './PastWorkoutBottomMenu';
import { WorkoutSessionHistoryModal } from './WorkoutSessionHistoryModal';

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
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

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
            style={{ borderLeftColor: theme.colors.background.white2 }}
          >
            <Text
              className="text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ opacity: 0.8 }}
            >
              {t('workoutDetail.volume')}
            </Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-white">
                {formatInteger(volume)}
              </Text>
              <Text className="text-xs font-medium text-white" style={{ opacity: 0.8 }}>
                {t(weightUnitKey)}
              </Text>
            </View>
          </View>

          {/* Calories */}
          <View
            className="flex-1 flex-col border-l pl-4"
            style={{ borderLeftColor: theme.colors.background.white2 }}
          >
            <Text
              className="text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ opacity: 0.8 }}
            >
              {t('workoutDetail.calories')}
            </Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-2xl font-extrabold tracking-tight text-white">
                {formatInteger(calories)}
              </Text>
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
  labels: XAxisLabel[];
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

function VolumeTrendCard({
  percentage,
  data,
  labels,
  onInteractionStart,
  onInteractionEnd,
}: VolumeTrendCardProps) {
  const theme = useTheme();
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
          onInteractionStart={onInteractionStart}
          onInteractionEnd={onInteractionEnd}
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
  const theme = useTheme();
  return (
    <View
      className="flex-row items-center border-b"
      style={{
        backgroundColor: set.isHighlighted ? theme.colors.accent.primary5 : 'transparent',
        borderBottomColor: theme.colors.background.white5,
      }}
    >
      <View className="w-12 items-center py-3">
        <View className="flex-row items-center gap-1">
          {set.isHighlighted ? <Trophy size={12} color={theme.colors.accent.primary} /> : null}
          <Text
            className="font-bold"
            style={{
              color: set.isHighlighted ? theme.colors.accent.primary : theme.colors.text.tertiary,
            }}
          >
            {set.setNumber}
          </Text>
        </View>
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
        <Text className="text-sm text-text-primary">{set.repsInReserve}</Text>
      </View>
    </View>
  );
}

// Component: Sets Table
type SetsTableProps = {
  sets: WorkoutSet[];
};

function SetsTable({ sets }: SetsTableProps) {
  const theme = useTheme();
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
            {t('workoutDetail.rir')}
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
  exercise: WorkoutExercise;
  onEdit?: (exerciseId?: string) => void;
  onClose?: () => void;
};

function ExerciseCard({ exercise, onEdit, onClose }: ExerciseCardProps) {
  const theme = useTheme();
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
            {createElement(exercise.icon, {
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
        <MenuButton
          size="md"
          color={theme.colors.text.primary}
          onPress={() => {
            onEdit?.(exercise.id);
          }}
          icon={Edit}
          className="h-10 w-10"
        />
      </View>

      {/* Sets Table */}
      <SetsTable sets={exercise.sets} />
    </GenericCard>
  );
}

// Component: Exercises Section
type ExercisesSectionProps = {
  exercises: WorkoutExercise[];
  onEdit?: (exerciseId?: string) => void;
  onClose?: () => void;
};

function ExercisesSection({ exercises, onEdit, onClose }: ExercisesSectionProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-col gap-4">
      <Text className="px-1 text-xs font-bold uppercase tracking-widest text-text-tertiary">
        {t('workoutDetail.exercisesCount', { count: exercises.length })}
      </Text>

      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} onEdit={onEdit} onClose={onClose} />
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
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();
  const { units } = useSettings();
  const { formatInteger } = useFormatAppNumber();
  const weightUnitKey = getWeightUnitI18nKey(units);
  const scrollViewRef = useRef<ScrollView>(null);

  const { workout, isLoading, isMenuVisible, setIsMenuVisible, rawSets, externalId, reload } =
    usePastWorkoutDetail({
      visible,
      workoutId,
    });

  const { isSaving: isSavingSets, error: saveError, saveSets } = useEditWorkoutSets();
  const [isSavingToHC, setIsSavingToHC] = useState(false);

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewWorkoutData, setPreviewWorkoutData] = useState<{
    workoutLog: WorkoutLog;
    sets: EnrichedWorkoutLogSet[];
    exercises: Exercise[];
  } | null>(null);

  const handleShare = async () => {
    if (!workout) {
      return;
    }

    try {
      const message = t('workoutDetail.shareMessage', {
        volume: formatInteger(workout.volume),
        unit: t(weightUnitKey),
        calories: formatInteger(workout.calories),
      });

      await Share.share({ message });
    } catch (err) {
      console.error('Failed to share workout:', err);
    }
  };

  const handleSaveToHealthConnect = async () => {
    if (!workoutId) {
      return;
    }

    setIsSavingToHC(true);
    try {
      const hasWrite = await healthConnectService.hasPermissionForRecordType(
        'ExerciseSession',
        'write'
      );

      if (!hasWrite) {
        const { denied } = await healthConnectService.requestPermissions([
          { accessType: 'write', recordType: 'ExerciseSession' },
        ]);

        if (denied.length > 0) {
          setIsSavingToHC(false);
          return;
        }
      }

      const {
        workoutLog: log,
        sets,
        exercises,
      } = await WorkoutService.getWorkoutWithDetails(workoutId);

      const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
      const byExercise = new Map<string, (typeof sets)[number][]>();
      for (const set of sets) {
        const eid = set.exerciseId ?? '';
        if (!byExercise.has(eid)) {
          byExercise.set(eid, []);
        }
        byExercise.get(eid)!.push(set);
      }
      const segmentItems = Array.from(byExercise.entries()).map(([exerciseId, exerciseSets]) => ({
        exerciseName: exerciseMap.get(exerciseId)?.name ?? 'Exercise',
        totalReps: exerciseSets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
        sets: exerciseSets.map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 })),
      }));

      const hcRecordId = await writeWorkoutToHealthConnect({
        workoutName: log.workoutName,
        startedAt: log.startedAt,
        completedAt: log.completedAt!,
        totalVolume: log.totalVolume ?? undefined,
        caloriesBurned: log.caloriesBurned ?? undefined,
        workoutType: log.type ?? undefined,
        segmentItems,
      });

      if (hcRecordId) {
        await database.write(async () => {
          await log.update((l) => {
            l.externalId = hcRecordId;
          });
        });
      }
    } catch (err) {
      console.error('Failed to save workout to Health Connect:', err);
      captureException(err, {
        data: { context: 'PastWorkoutDetailModal.handleSaveToHealthConnect' },
      });
      showSnackbar('error', t('errors.somethingWentWrong'));
    } finally {
      setIsSavingToHC(false);
    }
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMM d • hh:mm a', { locale: dateFnsLocale });
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
            <Text className="text-text-secondary">{t('common.error')}</Text>
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
        scrollViewRef={scrollViewRef}
      >
        <View className="flex-1 gap-5 p-4">
          {saveError ? (
            <View
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: theme.colors.status.errorSolid + '20' }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: theme.colors.status.errorSolid }}
              >
                {t('workoutDetail.saveError')}
              </Text>
            </View>
          ) : null}

          <WorkoutSummaryCard
            totalTime={workout.totalTime}
            volume={workout.volume}
            calories={workout.calories}
            weightUnitKey={weightUnitKey}
          />

          {Platform.OS === 'android' && !externalId ? (
            <Button
              label={t('workoutDetail.syncToHealthConnect')}
              icon={RefreshCw}
              variant="outline"
              width="full"
              size="sm"
              loading={isSavingToHC}
              onPress={handleSaveToHealthConnect}
            />
          ) : null}

          {workout.volumeTrend.data.length > 0 ? (
            <VolumeTrendCard
              percentage={workout.volumeTrend.percentage}
              data={workout.volumeTrend.data}
              labels={workout.volumeTrend.labels}
              onInteractionStart={() =>
                scrollViewRef.current?.setNativeProps({ scrollEnabled: false })
              }
              onInteractionEnd={() =>
                scrollViewRef.current?.setNativeProps({ scrollEnabled: true })
              }
            />
          ) : null}

          <ExercisesSection
            exercises={workout.exercises}
            onEdit={(exerciseId?: string) => {
              if (!exerciseId || isSavingSets) {
                return;
              }

              setEditingExerciseId(exerciseId);
              setIsEditModalVisible(true);
            }}
            onClose={onClose}
          />
        </View>
      </FullScreenModal>

      <PastWorkoutBottomMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        workoutName={workout.name}
        onEdit={onEdit}
        onShare={handleShare}
        onDelete={onDelete ? onDelete : undefined}
        onPreview={async () => {
          if (!workoutId) {
            return;
          }

          try {
            const data = await WorkoutService.getWorkoutWithDetails(workoutId);
            setPreviewWorkoutData(data);
            console.log('ON PREVIEW CLICKED', data, 11, workoutId);
            setIsPreviewModalVisible(true);
          } catch (error) {
            console.error('Error loading workout for preview:', error);
          }
        }}
      />
      {editingExerciseId ? (
        <EditPastWorkoutDataModal
          visible={isEditModalVisible}
          onClose={() => setIsEditModalVisible(false)}
          onSave={async (updatedSets) => {
            if (!workoutId) {
              return;
            }

            // Determine original setOrder slots for this exercise
            const originalSets = (rawSets || [])
              .filter((rs) => rs.exerciseId === editingExerciseId)
              .sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0));

            // Track which sets were deleted
            const deletedSetIds = originalSets
              .filter((os) => !updatedSets.some((us) => us.id === os.id))
              .map((os) => os.id);

            // Assign consecutive order numbers (0, 1, 2, 3, ...) to all remaining sets
            const updates = updatedSets.map((s, idx) => {
              // Check if this is a new set (temporary ID from Date.now())
              const isNew = !rawSets?.some((rs) => rs.id === s.id);
              return {
                setId: s.id,
                exerciseId: isNew ? editingExerciseId : undefined,
                reps: s.reps,
                weight: displayToKg(s.weight, units),
                partials: s.partialReps,
                restTimeAfter: s.rest,
                repsInReserve: s.repsInReserve,
                isNew,
                setOrder: idx, // Consecutive order: 0, 1, 2, 3, ...
              };
            });
            try {
              await saveSets(workoutId, updates as any, deletedSetIds);
              // reload handled reactively by subscription, but keep reload for safety
              await reload();
            } catch (err) {
              console.error('Failed to save edited sets:', err);
              captureException(err, { data: { context: 'PastWorkoutDetailModal.saveEditedSets' } });
              showSnackbar('error', t('errors.somethingWentWrong'));
            }
          }}
          workoutId={workoutId!}
          exerciseId={editingExerciseId}
          initialSets={(rawSets || [])
            .filter((s) => s.exerciseId === editingExerciseId)
            .sort((a, b) => (a.setOrder ?? 0) - (b.setOrder ?? 0))
            .map((s) => ({
              id: s.id,
              weight: s.weight,
              reps: s.reps,
              partialReps: s.partials ?? 0,
              rest: s.restTimeAfter ?? 0,
              repsInReserve: s.repsInReserve ?? 0,
            }))}
        />
      ) : null}

      {previewWorkoutData ? (
        <WorkoutSessionHistoryModal
          visible={isPreviewModalVisible}
          onClose={() => {
            setIsPreviewModalVisible(false);
            setPreviewWorkoutData(null);
          }}
          workoutLog={previewWorkoutData.workoutLog}
          sets={previewWorkoutData.sets}
          exercises={previewWorkoutData.exercises}
          shouldShowTimer={false}
        />
      ) : null}
    </>
  );
}
