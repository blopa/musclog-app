import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Copy, Heart, Pencil, Share2, Trash2, Video, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { BottomPopUpMenu, BottomPopUpMenuItem } from '../BottomPopUpMenu';
import { GenericCard } from '../cards/GenericCard';
import { SettingsCard } from '../cards/SettingsCard';
import { Button } from '../theme/Button';
import { MenuButton } from '../theme/MenuButton';
import { FullScreenModal } from './FullScreenModal';

// TODO: Replace mock data with actual exercise data from props or API
const EXERCISE_STATIC = {
  name: 'Incline Dumbbell Press',
  primaryMuscle: 'Chest',
  equipment: 'Dumbbell',
  mechanic: 'Compound',
  personalBest: { value: 85, unit: 'KG' },
  avgFrequency: { value: 2.4, unit: 'x / wk' },
  workouts: [
    { id: '1', name: 'Push Day Hypertrophy', subtitle: 'Last performed 2 days ago', icon: Zap },
    { id: '2', name: 'Upper Body Blast', subtitle: 'Created on Oct 12, 2023', icon: Zap },
    { id: '3', name: 'Full Body Foundation', subtitle: 'Used in 12 sessions', icon: Heart },
  ],
};

type ViewExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
};

// TODO: use this modal in the app, not only in the test screen
export default function ViewExerciseModal({ visible, onClose }: ViewExerciseModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const EXERCISE_DATA = {
    ...EXERCISE_STATIC,
    workouts: EXERCISE_STATIC.workouts.map((w) => ({
      ...w,
      iconGradient: [theme.colors.status.indigo600, theme.colors.status.indigo600] as const,
    })),
  };

  // TODO: Load actual exercise images instead of using placeholder
  // For now, using a placeholder image - replace with actual exercise image
  const backgroundImage = require('../../assets/icon.png');

  const handleWatchTechnique = () => {
    // TODO: Navigate to technique video or open modal
    console.log('Watch technique');
  };

  const handleWorkoutPress = (workoutId: string) => {
    // TODO: Navigate to workout detail
    console.log('Navigate to workout:', workoutId);
  };

  const menuItems: BottomPopUpMenuItem[] = [
    {
      icon: Pencil,
      iconColor: theme.colors.accent.secondary, // Vibrant emerald/teal green
      iconBgColor: theme.colors.background.iconDarker, // Lighter shade of dark green
      title: t('exercises.viewExercise.editExercise'),
      description: t('exercises.viewExercise.editExerciseDescription'),
      onPress: () => {
        // TODO: Implement exercise editing functionality
        console.log('Edit exercise');
      },
    },
    {
      icon: Share2,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('exercises.viewExercise.share'),
      description: t('exercises.viewExercise.shareDescription'),
      onPress: () => {
        // TODO: Implement exercise sharing functionality
        console.log('Share exercise');
      },
    },
    {
      icon: Copy,
      iconColor: theme.colors.accent.secondary,
      iconBgColor: theme.colors.background.iconDarker,
      title: t('exercises.viewExercise.duplicate'),
      description: t('exercises.viewExercise.duplicateDescription'),
      onPress: () => {
        // TODO: Implement exercise duplication functionality
        console.log('Duplicate exercise');
      },
    },
    {
      icon: Trash2,
      iconColor: theme.colors.status.error,
      iconBgColor: theme.colors.status.error20,
      title: t('exercises.viewExercise.delete'),
      description: t('exercises.viewExercise.deleteDescription'),
      titleColor: theme.colors.status.error,
      descriptionColor: theme.colors.status.error,
      onPress: () => {
        // TODO: Implement exercise deletion functionality
        console.log('Delete exercise');
      },
    },
  ];

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={EXERCISE_DATA.name}
      headerRight={
        <MenuButton
          size="lg"
          color={theme.colors.text.white}
          onPress={() => setIsMenuVisible(true)}
          className="h-10 w-10"
        />
      }
    >
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section with Background Image */}
        <View style={{ height: theme.size['384'], overflow: 'hidden', position: 'relative' }}>
          {/* Background Image */}
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

          {/* Content Overlay */}
          <LinearGradient
            colors={theme.colors.gradients.overlayDark}
            locations={[0, 0.7, 1]}
            className="absolute bottom-0 left-0 right-0"
            style={{ padding: theme.spacing.padding.xl, zIndex: theme.zIndex.overlayLow }}
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

            <Text className="mb-6 text-4xl font-bold" style={{ color: theme.colors.text.white }}>
              {EXERCISE_DATA.name}
            </Text>

            {/* Tags */}
            <View className="mb-6 flex-row flex-wrap gap-3">
              <LinearGradient
                colors={theme.colors.gradients.blueEmerald}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="flex-row items-center gap-2 rounded-full px-4 py-2"
                style={{
                  borderRadius: theme.borderRadius.full,
                }}
              >
                <Text
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: theme.colors.overlay.white80 }}
                >
                  {t('exercises.viewExercise.primaryMuscle')}
                </Text>
                <Text className="font-bold" style={{ color: theme.colors.text.white }}>
                  {EXERCISE_DATA.primaryMuscle}
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
                  {EXERCISE_DATA.equipment}
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
                  {EXERCISE_DATA.mechanic}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Cards */}
        <View className="px-6 py-6" style={{ flexDirection: 'row', gap: theme.spacing.gap.base }}>
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
                  {EXERCISE_DATA.personalBest.value}
                </Text>
                <Text className="text-xl" style={{ color: theme.colors.text.secondary }}>
                  {EXERCISE_DATA.personalBest.unit}
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
                  {EXERCISE_DATA.avgFrequency.value}
                </Text>
                <Text className="text-xl" style={{ color: theme.colors.text.secondary }}>
                  {EXERCISE_DATA.avgFrequency.unit}
                </Text>
              </View>
            </View>
          </GenericCard>
        </View>

        {/* Workouts Section */}
        <View className="px-6 py-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-2xl font-bold" style={{ color: theme.colors.text.white }}>
              {t('exercises.viewExercise.workoutsUsingThis')}
            </Text>
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: theme.colors.accent.secondary20 }}
            >
              <Text className="text-xs font-bold" style={{ color: theme.colors.accent.secondary }}>
                {EXERCISE_DATA.workouts.length} {t('exercises.viewExercise.templates')}
              </Text>
            </View>
          </View>

          <View style={{ gap: theme.spacing.gap.md }}>
            {EXERCISE_DATA.workouts.map((workout) => (
              <SettingsCard
                key={workout.id}
                icon={
                  <LinearGradient
                    colors={workout.iconGradient}
                    className="h-full w-full items-center justify-center"
                    style={{ borderRadius: theme.borderRadius['2xl'] }}
                  >
                    <workout.icon
                      size={theme.iconSize['3xl']}
                      color={theme.colors.text.white}
                      fill={workout.id === '2' ? theme.colors.text.white : 'none'}
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

        {/* Bottom spacing for button */}
        <View style={{ height: theme.size['100'] }} />
      </ScrollView>

      {/* More Options Menu */}
      <BottomPopUpMenu
        visible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
        title={EXERCISE_DATA.name}
        subtitle={t('exercises.viewExercise.exerciseOptions')}
        items={menuItems}
      />
    </FullScreenModal>
  );
}
