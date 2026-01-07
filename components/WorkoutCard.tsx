import { View, Text, Image, Pressable, ImageSourcePropType } from 'react-native';
import { Archive } from 'lucide-react-native';
import { theme } from '../theme';
import { StartWorkoutButton } from './StartWorkoutButton';

type WorkoutCardProps = {
  name: string;
  lastCompleted: string;
  exerciseCount: number;
  duration: string;
  image: ImageSourcePropType;
  onStart?: () => void;
  onArchive?: () => void;
};

export function WorkoutCard({
  name,
  lastCompleted,
  exerciseCount,
  duration,
  image,
  onStart,
  onArchive,
}: WorkoutCardProps) {
  return (
    <View className="rounded-3xl border border-border-light bg-bg-overlay p-5">
      <View className="mb-4 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="mb-2 text-sm" style={{ color: theme.colors.text.gray500 }}>
            Last: {lastCompleted}
          </Text>
          <Text className="mb-2 text-2xl font-bold text-text-primary">{name}</Text>
          <Text className="text-sm text-text-secondary">
            {exerciseCount} Exercises • {duration}
          </Text>
        </View>
        <View
          className="ml-4 h-20 w-20 overflow-hidden rounded-2xl"
          style={{ backgroundColor: theme.colors.background.iconDark }}>
          <Image source={image} className="h-full w-full" resizeMode="cover" />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Pressable className="flex-row items-center gap-2" onPress={onArchive}>
          <Archive size={16} color={theme.colors.text.secondary} />
          <Text className="text-sm text-text-secondary">Archive</Text>
        </Pressable>
        <StartWorkoutButton variant="secondary" onPress={onStart} />
      </View>
    </View>
  );
}
