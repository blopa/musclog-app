import { View, Text, Pressable, Image, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dumbbell, Repeat, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

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
    <Pressable className="relative rounded-xl active:opacity-90" onPress={onPress}>
      {/* Gradient border effect */}
      <View className="absolute -inset-[1px] overflow-hidden rounded-[13px]">
        <LinearGradient
          colors={[theme.colors.status.purple, theme.colors.accent.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, opacity: 0.4 }}
        />
      </View>

      <LinearGradient
        colors={['#1a2f2a', '#141a17', '#1a2520']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 12, padding: 16 }}>
        <View className="flex-row items-center gap-4">
          {/* Exercise Image */}
          <View className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-overlay">
            <Image source={exercise.image} className="h-full w-full" resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </View>

          {/* Exercise Info */}
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-start justify-between">
              <View className="flex-1" />
              <View className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-2 py-0.5">
                <Text className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
                  {t('restTimer.upNext')}
                </Text>
              </View>
            </View>

            <Text className="mt-1 truncate text-lg font-bold leading-tight text-white">
              {exercise.name}
            </Text>

            <View className="mt-1 flex-row items-center gap-3">
              <View className="flex-row items-center gap-1">
                <Dumbbell size={16} color={theme.colors.text.secondary} />
                <Text className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  {exercise.weight}kg
                </Text>
              </View>
              <View className="h-1 w-1 rounded-full bg-white/20" />
              <View className="flex-row items-center gap-1">
                <Repeat size={16} color={theme.colors.text.secondary} />
                <Text className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                  {exercise.reps} {t('restTimer.reps')}
                </Text>
              </View>
              <View className="h-1 w-1 rounded-full bg-white/20" />
              <Text className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                {exercise.sets} {t('restTimer.sets')}
              </Text>
            </View>
          </View>

          {/* Chevron */}
          <View className="self-center">
            <ChevronRight size={theme.iconSize.md} color={theme.colors.text.tertiary} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}
