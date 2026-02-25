import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Check } from 'lucide-react-native';
import { Image, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { GenericCard } from './cards/GenericCard';
import { Button } from './theme/Button';

type ExerciseTransitionScreenProps = {
  totalTime?: string;
  completedExercise?: string;
  completedMessage?: string;
  nextExercise?: {
    name: string;
    muscleGroups: string;
    imageUri: string;
    targetSets: number;
    targetReps: string;
    restTime: number;
    equipment: string[];
  } | null;
  onStartNextExercise?: () => void;
};

export function ExerciseTransitionScreen({
  totalTime = '00:48:22',
  completedExercise = 'Incline Press',
  completedMessage = 'Great effort. Catch your breath.',
  nextExercise = null,
  onStartNextExercise,
}: ExerciseTransitionScreenProps) {
  const theme = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background.primary }}>
      {/* Header */}
      <View className="z-10 flex items-center justify-center px-4 py-6">
        <View className="flex flex-col items-center">
          <Text
            className="text-3xl font-bold tabular-nums leading-none tracking-tight text-gray-900 dark:text-white"
            style={{ color: theme.colors.text.primary }}
          >
            {totalTime}
          </Text>
          <Text
            className="text-primary mt-1 text-xs font-medium uppercase tracking-widest opacity-90"
            style={{ color: theme.colors.accent.primary }}
          >
            Total Time
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-6">
        {/* Completion Status */}
        <View className="flex flex-col items-center justify-center py-2">
          <View
            className="mb-3 rounded-full p-3"
            style={{ backgroundColor: theme.colors.accent.primary + '20' }}
          >
            <Check size={theme.iconSize['3xl']} color={theme.colors.accent.primary} />
          </View>
          <Text
            className="text-center text-2xl font-bold text-gray-900 dark:text-white"
            style={{ color: theme.colors.text.primary }}
          >
            {completedExercise} Complete!
          </Text>
          <Text
            className="text-center text-sm text-gray-500 dark:text-gray-400"
            style={{ color: theme.colors.text.secondary }}
          >
            {completedMessage}
          </Text>
        </View>

        {/* Up Next Divider */}
        <View className="mt-2 flex items-center gap-4">
          <View className="h-px flex-1" style={{ backgroundColor: theme.colors.border.default }} />
          <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Up Next
          </Text>
          <View className="h-px flex-1" style={{ backgroundColor: theme.colors.border.default }} />
        </View>

        {/* Next Exercise Card */}
        {nextExercise ? (
          <GenericCard variant="card">
            <View className="relative aspect-[4/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-800">
              <Image
                source={{ uri: nextExercise.imageUri }}
                className="absolute inset-0 h-full w-full"
                resizeMode="cover"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.3)', 'transparent']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 1 }}
                end={{ x: 0, y: 0 }}
                className="absolute inset-0"
              />
              <View className="absolute bottom-0 left-0 flex w-full flex-col items-start gap-1 p-5">
                <Text
                  className="text-3xl font-bold leading-tight text-white shadow-black drop-shadow-lg"
                  style={{
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 4,
                  }}
                >
                  {nextExercise.name}
                </Text>
                <Text
                  className="text-primary text-sm font-semibold uppercase tracking-wide drop-shadow-md"
                  style={{
                    color: theme.colors.accent.primary,
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  }}
                >
                  {nextExercise.muscleGroups}
                </Text>
              </View>
            </View>

            <View className="flex flex-col gap-4 p-5">
              {/* Target and Rest */}
              <View className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-white/5">
                <View className="flex flex-col">
                  <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Target
                  </Text>
                  <View className="flex items-baseline gap-1">
                    <Text
                      className="text-xl font-bold text-gray-900 dark:text-white"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.targetSets}
                    </Text>
                    <Text
                      className="text-sm text-gray-500 dark:text-gray-400"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Sets
                    </Text>
                    <Text className="mx-1 text-gray-300 dark:text-gray-600">•</Text>
                    <Text
                      className="text-xl font-bold text-gray-900 dark:text-white"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.targetReps}
                    </Text>
                    <Text
                      className="text-sm text-gray-500 dark:text-gray-400"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Reps
                    </Text>
                  </View>
                </View>
                <View className="flex flex-col items-end">
                  <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Rest
                  </Text>
                  <View className="flex items-baseline gap-1">
                    <Text
                      className="text-xl font-bold text-gray-900 dark:text-white"
                      style={{ color: theme.colors.text.primary }}
                    >
                      {nextExercise.restTime}
                    </Text>
                    <Text
                      className="text-sm text-gray-500 dark:text-gray-400"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      sec
                    </Text>
                  </View>
                </View>
              </View>

              {/* Equipment */}
              <View className="flex flex-col gap-2">
                <Text className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Equipment
                </Text>
                <View className="flex flex-wrap gap-2">
                  {nextExercise.equipment.map((item, index) => (
                    <View
                      key={index}
                      className="flex items-center gap-1.5 rounded-md border border-transparent bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-white/5 dark:bg-white/5 dark:text-gray-300"
                    >
                      <Text className="text-[16px]">{item.includes('Barbell') ? '🏋️' : '🪑'}</Text>
                      <Text
                        className="text-xs font-medium"
                        style={{ color: theme.colors.text.secondary }}
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
          <View className="flex items-center justify-center py-8">
            <Text className="text-center text-gray-500 dark:text-gray-400">
              Loading next exercise...
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View
        className="z-10 w-full px-5 pb-8 pt-4"
        style={{
          backgroundColor: theme.colors.background.primary,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.default,
        }}
      >
        <Button
          label="Start Next Exercise"
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
