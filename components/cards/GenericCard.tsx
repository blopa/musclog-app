import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout';
};

export function GenericCard({
  children,
  isPopular = false,
  onPress,
  variant = 'default',
}: GenericCardProps) {
  const isWorkoutVariant = variant === 'workout';

  if (isWorkoutVariant) {
    return (
      <View
        className="mb-8 w-full overflow-hidden rounded-[20px] border p-6"
        style={{
          backgroundColor: theme.colors.background.darkGreen80,
          borderColor: theme.colors.background.white5,
          borderWidth: theme.borderWidth.thin,
          ...theme.shadows.lg,
        }}>
        {/* Top gradient line */}
        <LinearGradient
          colors={theme.colors.gradients.workoutStats}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: theme.size['1half'],
            opacity: 0.5,
          }}
        />

        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: '100%',
          borderRadius: theme.borderRadius.xl,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        !isPopular && {
          backgroundColor: pressed
            ? theme.colors.background.cardDark
            : theme.colors.background.cardElevated,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.white5,
          ...theme.shadows.md,
        },
      ]}>
      {isPopular ? (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 2 }}>
          {children}
        </LinearGradient>
      ) : (
        children
      )}
    </Pressable>
  );
}
