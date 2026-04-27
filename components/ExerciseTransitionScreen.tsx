import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { GenericCard } from './cards/GenericCard';
import { Button } from './theme/Button';

type ExerciseTransitionScreenProps = {
  totalTime?: string;
  completedExercise?: string;
  completedMessage?: string;
  nextExercise: {
    name: string;
    muscleGroups: string;
    imageUri: string;
    targetSets: number;
    targetReps: string;
    targetWeight: string;
    restTime: number;
    equipment: string[];
  } | null;
  onStartNextExercise?: () => void;
};

const defaultPlaceholderImage = require('../assets/icon.png');

export function ExerciseTransitionScreen({
  totalTime = '00:00:00',
  completedExercise = '',
  completedMessage,
  nextExercise,
  onStartNextExercise,
}: ExerciseTransitionScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const imageSource =
    nextExercise?.imageUri && nextExercise.imageUri.trim() !== ''
      ? { uri: nextExercise.imageUri }
      : defaultPlaceholderImage;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
      {/* Header: Total Time */}
      <View className="z-10 flex items-center justify-center px-4 pb-2 pt-6">
        <Text
          className="text-4xl font-bold tabular-nums leading-none tracking-tight"
          style={{ color: theme.colors.text.primary }}
        >
          {totalTime}
        </Text>
        <Text
          className="mt-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{ color: theme.colors.accent.primary }}
        >
          {t('exerciseTransition.totalTime')}
        </Text>
      </View>

      {/* Main Content - scrollable to avoid broken layout on small screens */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: theme.spacing.padding.lg,
          paddingBottom: theme.spacing.padding.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Completion Status */}
        <View className="items-center justify-center py-4">
          <View
            className="mb-3 rounded-full p-3"
            style={{ backgroundColor: theme.colors.accent.primary + '20' }}
          >
            <Check size={theme.iconSize['3xl']} color={theme.colors.accent.primary} />
          </View>
          <Text
            className="text-center text-2xl font-bold"
            style={{ color: theme.colors.text.primary }}
          >
            {completedExercise} {t('exerciseTransition.completeSuffix')}
          </Text>
          <Text className="mt-1 text-center text-sm" style={{ color: theme.colors.text.secondary }}>
            {completedMessage ?? t('exerciseTransition.completedMessage')}
          </Text>
        </View>

        {/* Up Next Divider */}
        <View className="mt-2 flex-row items-center gap-4">
          <View className="h-px flex-1" style={{ backgroundColor: theme.colors.border.default }} />
          <Text
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('exerciseTransition.upNext')}
          </Text>
          <View className="h-px flex-1" style={{ backgroundColor: theme.colors.border.default }} />
        </View>

        {/* Next Exercise Card */}
        {nextExercise ? (
          <GenericCard
            variant="card"
            containerStyle={{ marginTop: theme.spacing.margin.base, overflow: 'hidden' as const }}
          >
            <View className="relative aspect-[4/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-800">
              <Image
                source={imageSource}
                className="absolute inset-0 h-full w-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={[
                  theme.colors.background.black90,
                  theme.colors.background.black40,
                  'transparent',
                ]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                className="absolute inset-0"
              />
              <View className="absolute bottom-0 left-0 right-0 flex flex-col items-start gap-1 p-5">
                <Text
                  className="text-2xl font-bold leading-tight text-white"
                  style={{
                    textShadowColor: theme.colors.overlay.black90,
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  }}
                >
                  {nextExercise.name}
                </Text>
                <Text
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{
                    color: theme.colors.accent.primary,
                    textShadowColor: theme.colors.overlay.black60,
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {nextExercise.muscleGroups}
                </Text>
              </View>
            </View>

            <View
              className="flex flex-col gap-4 p-5"
              style={{ backgroundColor: theme.colors.background.primary }}
            >
              {/* Target and Rest - same row as design */}
              <View
                className="flex-row items-start justify-between border-b pb-4"
                style={{ borderBottomColor: theme.colors.border.default }}
              >
                <View className="flex flex-col">
                  <Text
                    className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {t('exerciseTransition.target')}
                  </Text>
                  <View className="flex-row flex-wrap items-baseline gap-1">
                    <Text
                      className="text-xl font-bold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.targetSets}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('exerciseTransition.sets')}
                    </Text>
                    <Text className="mx-1" style={{ color: theme.colors.text.secondary }}>
                      •
                    </Text>
                    <Text
                      className="text-xl font-bold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.targetReps}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('exerciseTransition.reps')}
                    </Text>
                    {nextExercise.targetWeight !== '—' ? (
                      <>
                        <Text className="mx-1" style={{ color: theme.colors.text.secondary }}>
                          •
                        </Text>
                        <Text
                          className="text-xl font-bold"
                          style={{ color: theme.colors.text.primary }}
                        >
                          {nextExercise.targetWeight}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <View className="flex flex-col items-end">
                  <Text
                    className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: theme.colors.text.secondary }}
                  >
                    {t('exerciseTransition.rest')}
                  </Text>
                  <View className="flex-row items-baseline gap-1">
                    <Text
                      className="text-xl font-bold"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.restTime}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {t('exerciseTransition.sec')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Equipment */}
              <View className="flex flex-col gap-2">
                <Text
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {t('exerciseTransition.equipment')}
                </Text>
                <View className="flex flex-wrap gap-2">
                  {nextExercise.equipment.map((item, index) => (
                    <View
                      key={index}
                      className="flex-row items-center gap-1.5 rounded-lg border px-3 py-2"
                      style={{
                        borderColor: theme.colors.border.default,
                        backgroundColor:
                          theme.colors.background.secondary ?? theme.colors.background.primary,
                      }}
                    >
                      <Text className="text-base">
                        {item.toLowerCase().includes('barbell') ? '🏋️' : '🪑'}
                      </Text>
                      <Text
                        className="text-xs font-medium"
                        style={{ color: theme.colors.text.primary }}
                      >
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </GenericCard>
        ) : (
          <View className="items-center justify-center py-8">
            <Text className="text-center" style={{ color: theme.colors.text.secondary }}>
              {t('exerciseTransition.loadingNextExercise')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer - gradient CTA per design */}
      <View
        className="z-10 w-full px-5 pb-8 pt-4"
        style={{
          backgroundColor: theme.colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.default,
        }}
      >
        <Button
          label={t('exerciseTransition.startNextExercise')}
          icon={ArrowRight}
          iconPosition="right"
          variant="gradientCta"
          size="lg"
          width="full"
          onPress={onStartNextExercise}
        />
      </View>
    </View>
  );
}
