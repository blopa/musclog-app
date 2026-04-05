import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight, Copy, Pencil, Share2, Trash2, Video, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, ScrollView, Text, View } from 'react-native';

import { useSnackbar } from '../../context/SnackbarContext';
import { database } from '../../database';
import type ExerciseModel from '../../database/models/Exercise';
import WorkoutTemplate from '../../database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '../../database/models/WorkoutTemplateExercise';
import { ExerciseService, WorkoutAnalytics } from '../../database/services';
import { useFormatAppNumber } from '../../hooks/useFormatAppNumber';
import { useNativeShareText } from '../../hooks/useNativeShareText';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '../../hooks/useTheme';
import { FALLBACK_EXERCISE_IMAGE } from '../../utils/exerciseImage';
import {
  getExerciseTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '../../utils/exerciseTranslation';
import { formatDisplayWeightKg } from '../../utils/formatDisplayWeight';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { SettingsCard } from '../cards/SettingsCard';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { ConfirmationModal } from './ConfirmationModal';
import type { DataLogModalVariant } from './DataLogModal';
import { FullScreenModal } from './FullScreenModal';
import { GenericEditModal } from './GenericEditModal';
import { getEditFields } from './GenericEditModal/entityEditConfig';
import type { EditFormValues } from './GenericEditModal/types';
import { useEditRecord } from './GenericEditModal/useEditRecord';

export type ViewExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  /** When only exerciseId is provided, exercise is fetched from the database. */
  exerciseId?: string | null;
  /** Pre-loaded exercise (e.g. from list). If both are provided, exerciseId is used to fetch fresh data when visible. */
  exercise?: ExerciseModel | null;
  onExerciseDeleted?: () => void;
  onExerciseUpdated?: () => void;
  onExerciseDuplicated?: () => void;
};

export default function ViewExerciseModal({
  visible,
  onClose,
  exerciseId,
  exercise: exerciseProp,
  onExerciseDeleted,
  onExerciseUpdated,
  onExerciseDuplicated,
}: ViewExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const { locale, formatRoundedDecimal } = useFormatAppNumber();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { shareText } = useNativeShareText();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [exercise, setExercise] = useState<ExerciseModel | null>(null);
  const [personalBest, setPersonalBest] = useState<{ value: number; unit: string } | null>(null);
  const [avgFrequency, setAvgFrequency] = useState<{ value: number; unit: string }>({
    value: 0,
    unit: 'perWeek',
  });
  const [workouts, setWorkouts] = useState<
    { id: string; name: string; subtitle: string; icon: typeof Zap }[]
  >([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dependencyWarning, setDependencyWarning] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);

  const resolvedId = exerciseId ?? exerciseProp?.id ?? null;

  const {
    initialValues: editInitialValues,
    isLoading: isLoadingEdit,
    error: editError,
    save: saveEdit,
  } = useEditRecord('exercise' as DataLogModalVariant, editRecordId, editModalVisible);
  const editFields = getEditFields('exercise');

  const loadExercise = useCallback(async () => {
    if (!resolvedId) {
      setExercise(exerciseProp ?? null);
      setIsLoadingData(false);
      return;
    }
    try {
      const fetched = await ExerciseService.getExerciseById(resolvedId);
      setExercise(fetched ?? exerciseProp ?? null);
    } catch {
      setExercise(exerciseProp ?? null);
    } finally {
      setIsLoadingData(false);
    }
  }, [resolvedId, exerciseProp]);

  const loadStatsAndWorkouts = useCallback(
    async (ex: ExerciseModel | null) => {
      if (!ex?.id) {
        setPersonalBest(null);
        setAvgFrequency({ value: 0, unit: 'perWeek' });
        setWorkouts([]);
        return;
      }
      try {
        const [pb, freq] = await Promise.all([
          WorkoutAnalytics.getPersonalBestForExercise(ex.id),
          WorkoutAnalytics.getAverageFrequencyPerWeek(ex.id),
        ]);

        setPersonalBest(pb ? { value: pb.weight, unit: pb.unit } : null);
        setAvgFrequency(freq);

        const templateExercises = await database
          .get<WorkoutTemplateExercise>('workout_template_exercises')
          .query(Q.where('exercise_id', ex.id), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        const templateIds = [...new Set(templateExercises.map((te) => te.templateId))];
        if (templateIds.length === 0) {
          setWorkouts([]);
          return;
        }

        const templates = await database
          .get<WorkoutTemplate>('workout_templates')
          .query(Q.where('id', Q.oneOf(templateIds)), Q.where('deleted_at', Q.eq(null)))
          .fetch();

        const workoutItems = templates.map((template) => ({
          id: template.id,
          name: template.name ?? t('workouts.unnamed'),
          subtitle: template.description
            ? template.description
            : t('exercises.viewExercise.usedInTemplatesShort'),
          icon: Zap,
        }));
        setWorkouts(workoutItems);
      } catch {
        setPersonalBest(null);
        setAvgFrequency({ value: 0, unit: 'perWeek' });
        setWorkouts([]);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setIsLoadingData(true);
    loadExercise();
  }, [visible, resolvedId, loadExercise]);

  useEffect(() => {
    if (!exercise) {
      return;
    }

    loadStatsAndWorkouts(exercise);
  }, [exercise, exercise?.id, loadStatsAndWorkouts]);

  const backgroundImage = exercise?.imageUrl?.trim()
    ? { uri: exercise.imageUrl }
    : FALLBACK_EXERCISE_IMAGE;

  const handleWatchTechnique = () => {
    const name = encodeURIComponent(exercise?.name ?? '');
    const url = `https://www.youtube.com/results?search_query=${name}+exercise+technique`;
    Linking.openURL(url).catch(() => {
      showSnackbar('error', t('common.error'), {
        subtitle: t('exercises.viewExercise.couldNotOpenLink'),
      });
    });
  };

  const handleWorkoutPress = (workoutId: string) => {
    onClose();
    router.navigate(`/workout/workouts?previewTemplateId=${workoutId}`);
  };

  const checkExerciseDependencies = async (id: string): Promise<string | null> => {
    try {
      const templateExercises = await database
        .get<WorkoutTemplateExercise>('workout_template_exercises')
        .query(Q.where('exercise_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const templateExerciseIds = templateExercises.map((te) => te.id);
      const templateSets =
        templateExerciseIds.length > 0
          ? await database
              .get('workout_template_sets')
              .query(
                Q.where('template_exercise_id', Q.oneOf(templateExerciseIds)),
                Q.where('deleted_at', Q.eq(null))
              )
              .fetch()
          : [];
      const logExercises = await database
        .get('workout_log_exercises')
        .query(Q.where('exercise_id', id), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const logExerciseIds = logExercises.map((le) => le.id);
      const logSets =
        logExerciseIds.length > 0
          ? await database
              .get('workout_log_sets')
              .query(
                Q.where('log_exercise_id', Q.oneOf(logExerciseIds)),
                Q.where('deleted_at', Q.eq(null))
              )
              .fetch()
          : [];

      if (templateSets.length > 0 || logSets.length > 0) {
        const parts = [];
        if (templateSets.length > 0) {
          parts.push(
            t('exercises.manageExerciseData.usedInTemplates', { count: templateSets.length })
          );
        }
        if (logSets.length > 0) {
          parts.push(t('exercises.manageExerciseData.usedInLogs', { count: logSets.length }));
        }
        return parts.join('. ');
      }
    } catch {
      // ignore
    }
    return null;
  };

  const handleEdit = () => {
    setIsMenuVisible(false);
    if (exercise?.id) {
      setEditRecordId(exercise.id);
      setEditModalVisible(true);
    }
  };

  const handleCloseEditModal = () => {
    setEditModalVisible(false);
    setEditRecordId(null);
  };

  const handleSaveEdit = async (values: EditFormValues) => {
    await saveEdit(values);
    if (exercise?.id) {
      const updated = await ExerciseService.getExerciseById(exercise.id);
      setExercise(updated ?? exercise);
    }
    onExerciseUpdated?.();
  };

  const handleShare = () => {
    setIsMenuVisible(false);
    const name = exercise?.name ?? '';
    const muscleGroup = exercise?.muscleGroup ?? '';
    const equipment = exercise?.equipmentType ?? '';
    const message = [name, muscleGroup, equipment].filter(Boolean).join(' · ');
    shareText(message, { title: name }).catch(() => {});
  };

  const handleDuplicate = async () => {
    setIsMenuVisible(false);
    if (!exercise?.id) {
      return;
    }
    try {
      await ExerciseService.duplicateExercise(exercise.id);
      showSnackbar('success', t('exercises.viewExercise.duplicateSuccess'));
      onExerciseDuplicated?.();
    } catch {
      showSnackbar('error', t('common.duplicateFailed'));
    }
  };

  const handleDeletePress = () => {
    setIsMenuVisible(false);
    if (!exercise?.id) {
      return;
    }
    checkExerciseDependencies(exercise.id).then((warning) => {
      setDependencyWarning(warning);
      setDeleteConfirmVisible(true);
    });
  };

  const handleConfirmDelete = async () => {
    if (!exercise?.id) {
      return;
    }
    setIsDeleting(true);
    try {
      await ExerciseService.deleteExercise(exercise.id);
      setDeleteConfirmVisible(false);
      onClose();
      onExerciseDeleted?.();
      showSnackbar('success', t('common.deleteSuccess'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.deleteFailed');
      showSnackbar('error', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const isAppExercise = exercise?.source === 'app';

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('exercises.viewExercise.editExercise'),
      description: t('exercises.viewExercise.editExerciseDescription'),
      onPress: handleEdit,
    },
    {
      icon: Share2,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('exercises.viewExercise.share'),
      description: t('exercises.viewExercise.shareDescription'),
      onPress: handleShare,
    },
    {
      icon: Copy,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('exercises.viewExercise.duplicate'),
      description: t('exercises.viewExercise.duplicateDescription'),
      onPress: handleDuplicate,
    },
    ...(!isAppExercise
      ? [
          {
            icon: Trash2,
            iconColor: theme.colors.status.error,
            iconBgColor: theme.colors.status.error20,
            title: t('exercises.viewExercise.delete'),
            description: t('exercises.viewExercise.deleteDescription'),
            titleColor: theme.colors.status.error,
            descriptionColor: theme.colors.status.error,
            onPress: handleDeletePress,
          } satisfies BottomPopUpMenuItem,
        ]
      : []),
  ];

  const displayName = exercise?.name ?? t('exercises.manageExerciseData.unknownExercise');
  const primaryMuscle =
    exercise?.muscleGroup != null ? t(getMuscleGroupTranslationKey(exercise.muscleGroup)) : '—';
  const equipment =
    exercise?.equipmentType != null
      ? t(getExerciseTypeTranslationKey(exercise.equipmentType))
      : '—';
  const mechanic =
    exercise?.mechanicType != null ? t(getExerciseTypeTranslationKey(exercise.mechanicType)) : '—';

  const workoutsWithTheme = workouts.map((w) => ({
    ...w,
    iconGradient: [theme.colors.status.indigo600, theme.colors.status.indigo600] as const,
  }));

  if (!visible) {
    return null;
  }

  return (
    <>
      <FullScreenModal
        visible={visible}
        onClose={onClose}
        title={displayName}
        headerRight={
          <MenuButton
            size="lg"
            color={theme.colors.text.white}
            onPress={() => setIsMenuVisible(true)}
            className="h-10 w-10"
          />
        }
      >
        {isLoadingData || !exercise ? (
          <View className="flex-1 items-center justify-center p-8">
            <Text style={{ color: theme.colors.text.secondary }}>
              {isLoadingData ? t('common.loading') : t('common.notFound')}
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View style={{ height: theme.size['384'], overflow: 'hidden', position: 'relative' }}>
              <Image
                source={backgroundImage}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  opacity: theme.colors.opacity.medium,
                }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={theme.colors.gradients.overlayDark}
                locations={[0, 0.7, 1]}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: theme.spacing.padding.xl,
                  zIndex: theme.zIndex.overlayLow,
                }}
              >
                <Button
                  label={t('exercises.viewExercise.watchTechnique')}
                  onPress={handleWatchTechnique}
                  icon={Video}
                  iconColor={theme.colors.accent.secondary}
                  variant="secondary"
                  size="sm"
                  width="auto"
                  style={{ alignSelf: 'flex-start' }}
                />
                <Text
                  className="mb-6 text-4xl font-bold"
                  style={{ color: theme.colors.text.white }}
                >
                  {displayName}
                </Text>
                <View className="mb-6 flex-row flex-wrap gap-3">
                  <LinearGradient
                    colors={theme.colors.gradients.blueEmerald}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 9999,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <Text
                      className="text-xs font-medium uppercase tracking-wide"
                      style={{ color: theme.colors.overlay.white80 }}
                    >
                      {t('exercises.viewExercise.primaryMuscle')}
                    </Text>
                    <Text className="font-bold" style={{ color: theme.colors.text.white }}>
                      {primaryMuscle}
                    </Text>
                  </LinearGradient>
                  <View
                    className="flex-row items-center gap-2 rounded-full border px-4 py-2"
                    style={{
                      backgroundColor: theme.colors.background.darkGreenVariant,
                      borderColor: theme.colors.background.gray700,
                    }}
                  >
                    <Text
                      className="text-xs font-medium uppercase tracking-wide"
                      style={{ color: theme.colors.overlay.white80 }}
                    >
                      {t('exercises.viewExercise.equipment')}
                    </Text>
                    <Text className="font-bold" style={{ color: theme.colors.text.white }}>
                      {equipment}
                    </Text>
                  </View>
                  <View
                    className="flex-row items-center gap-2 rounded-full border px-4 py-2"
                    style={{
                      backgroundColor: theme.colors.background.darkGreenVariant,
                      borderColor: theme.colors.background.gray700,
                    }}
                  >
                    <Text
                      className="text-xs font-medium uppercase tracking-wide"
                      style={{ color: theme.colors.overlay.white80 }}
                    >
                      {t('exercises.viewExercise.mechanic')}
                    </Text>
                    <Text className="font-bold" style={{ color: theme.colors.text.white }}>
                      {mechanic}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <View
              className="px-4 py-6"
              style={{ flexDirection: 'row', gap: theme.spacing.gap.base }}
            >
              <GenericCard variant="default" size="sm">
                <View className="p-6">
                  <Text
                    className="mb-2 text-xs font-medium uppercase tracking-wide"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {t('exercises.viewExercise.personalBest')}
                  </Text>
                  <View className="flex-row items-baseline gap-2">
                    <Text
                      className="text-5xl font-bold"
                      style={{ color: theme.colors.accent.secondary }}
                    >
                      {personalBest != null
                        ? formatDisplayWeightKg(locale, units, personalBest.value)
                        : '—'}
                    </Text>
                    <Text className="text-xl" style={{ color: theme.colors.text.secondary }}>
                      {personalBest
                        ? t(`exercises.units.${personalBest.unit}`)
                        : t('exercises.units.kg')}
                    </Text>
                  </View>
                </View>
              </GenericCard>
              <GenericCard variant="default" size="sm">
                <View className="p-6">
                  <Text
                    className="mb-2 text-xs font-medium uppercase tracking-wide"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {t('exercises.viewExercise.avgFrequency')}
                  </Text>
                  <View className="flex-row items-baseline gap-2">
                    <Text
                      className="text-5xl font-bold"
                      style={{ color: theme.colors.status.indigoLight }}
                    >
                      {formatRoundedDecimal(avgFrequency.value, 1)}
                    </Text>
                    <Text className="text-xl" style={{ color: theme.colors.text.secondary }}>
                      {t(`exercises.frequency.${avgFrequency.unit}`, {
                        value: formatRoundedDecimal(avgFrequency.value, 1),
                      })}
                    </Text>
                  </View>
                </View>
              </GenericCard>
            </View>

            <View className="px-4 py-4">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-2xl font-bold" style={{ color: theme.colors.text.white }}>
                  {t('exercises.viewExercise.workoutsUsingThis')}
                </Text>
                <View
                  className="rounded-full px-3 py-1.5"
                  style={{ backgroundColor: theme.colors.accent.secondary20 }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: theme.colors.accent.secondary }}
                  >
                    {workoutsWithTheme.length} {t('exercises.viewExercise.templates')}
                  </Text>
                </View>
              </View>
              <View style={{ gap: theme.spacing.gap.md }}>
                {workoutsWithTheme.map((workout) => (
                  <SettingsCard
                    key={workout.id}
                    icon={
                      <LinearGradient
                        colors={workout.iconGradient}
                        style={{
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: theme.borderRadius['2xl'],
                          overflow: 'hidden',
                        }}
                      >
                        <workout.icon
                          size={theme.iconSize['3xl']}
                          color={theme.colors.text.white}
                          fill="none"
                        />
                      </LinearGradient>
                    }
                    title={workout.name}
                    subtitle={workout.subtitle}
                    onPress={() => handleWorkoutPress(workout.id)}
                    rightIcon={
                      <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.secondary} />
                    }
                    iconContainerStyle={{
                      width: theme.size['16'],
                      height: theme.size['16'],
                      borderRadius: theme.borderRadius['2xl'],
                      padding: theme.spacing.padding.zero,
                      overflow: 'hidden',
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={{ height: theme.size['100'] }} />
          </ScrollView>
        )}

        <BottomPopUpMenu
          visible={isMenuVisible}
          onClose={() => setIsMenuVisible(false)}
          title={displayName}
          subtitle={t('exercises.viewExercise.exerciseOptions')}
          items={menuItems}
        />
      </FullScreenModal>

      <ConfirmationModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        onConfirm={handleConfirmDelete}
        title={t('exercises.viewExercise.delete')}
        message={t('exercises.manageExerciseData.deleteExerciseWarning')}
        confirmLabel={t('common.delete')}
        variant="destructive"
        isLoading={isDeleting}
        warning={dependencyWarning}
      />

      <GenericEditModal
        visible={editModalVisible}
        onClose={handleCloseEditModal}
        title={t('exercises.viewExercise.editExercise')}
        fields={editFields}
        initialValues={editInitialValues}
        onSave={handleSaveEdit}
        isLoading={isLoadingEdit}
        loadError={editError ?? undefined}
      />
    </>
  );
}
