import { View, Text, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Repeat, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { GenericCard } from './GenericCard';

type UpNextExerciseCardProps = {
  exercise: {
    name: string;
    weight: number;
    reps: number;
    sets: number;
    image: ImageSourcePropType;
  };
  onPress?: () => void;
};

export function UpNextExerciseCard({ exercise, onPress }: UpNextExerciseCardProps) {
  const { t } = useTranslation();

  return (
    <GenericCard variant="highlighted" isPressable={true} onPress={onPress} size="sm">
      <View className="flex-row items-center gap-4 p-4">
        {/* Exercise Image */}
        <View className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-overlay">
          <Image source={exercise.image} className="h-full w-full" resizeMode="cover" />
          <LinearGradient
            colors={['transparent', theme.colors.overlay.black60]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute',
              top: theme.spacing.padding.zero,
              left: theme.spacing.padding.zero,
              right: theme.spacing.padding.zero,
              bottom: theme.spacing.padding.zero,
            }}
          />
        </View>

        {/* Exercise Info */}
        <View className="min-w-0 flex-1 gap-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1" />
            <View className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5">
              <Text
                className="font-bold uppercase tracking-widest text-accent-primary"
                style={{ fontSize: theme.typography.fontSize.xs }}>
                {t('restTimer.upNext')}
              </Text>
            </View>
          </View>

          <Text className="mt-1 truncate text-lg font-bold leading-tight text-text-primary">
            {exercise.name}
          </Text>

          <View className="mt-1 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Dumbbell size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm" style={{ color: theme.colors.overlay.white60 }}>
                {exercise.weight}kg
              </Text>
            </View>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.overlay.white20 }}
            />
            <View className="flex-row items-center gap-1">
              <Repeat size={theme.iconSize.sm} color={theme.colors.text.secondary} />
              <Text className="text-sm" style={{ color: theme.colors.overlay.white60 }}>
                {exercise.reps} {t('restTimer.reps')}
              </Text>
            </View>
            <View
              className="h-1 w-1 rounded-full"
              style={{ backgroundColor: theme.colors.overlay.white20 }}
            />
            <Text className="text-sm font-medium" style={{ color: theme.colors.overlay.white80 }}>
              {exercise.sets} {t('restTimer.sets')}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <View className="self-center">
          <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
        </View>
      </View>
    </GenericCard>
  );
}
