import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout';
  isPressable?: boolean;
};

export function GenericCard({
  children,
  isPopular = false,
  isPressable = false,
  onPress,
  variant = 'default',
}: GenericCardProps) {
  const isWorkoutVariant = variant === 'workout';

  const getCardStyle = (pressed: boolean = false): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: '100%',
      overflow: 'hidden',
    };

    if (isWorkoutVariant) {
      return {
        ...baseStyle,
        borderRadius: 20,
        padding: 24,
        backgroundColor: theme.colors.background.darkGreen80,
        borderColor: theme.colors.background.white5,
        borderWidth: theme.borderWidth.thin,
        ...theme.shadows.lg,
      };
    }

    return {
      ...baseStyle,
      borderRadius: theme.borderRadius.xl,
      transform: [{ scale: pressed ? 0.98 : 1 }],
      ...(!isPopular && {
        backgroundColor: pressed
          ? theme.colors.background.cardDark
          : theme.colors.background.cardElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.background.white5,
        ...theme.shadows.md,
      }),
    };
  };

  const cardContent =
    isPopular && !isWorkoutVariant ? (
      <LinearGradient
        colors={theme.colors.gradients.cta}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 2 }}>
        {children}
      </LinearGradient>
    ) : (
      children
    );

  const cardInnerContent = (
    <>
      {isWorkoutVariant && (
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
      )}
      {cardContent}
    </>
  );

  if (isPressable && !isWorkoutVariant) {
    return (
      <Pressable
        className={
          isWorkoutVariant ? 'mb-8 w-full overflow-hidden rounded-[20px] border p-6' : undefined
        }
        onPress={onPress}
        style={({ pressed }) => getCardStyle(pressed)}>
        {cardInnerContent}
      </Pressable>
    );
  }

  return (
    <View
      className={
        isWorkoutVariant ? 'mb-8 w-full overflow-hidden rounded-[20px] border p-6' : undefined
      }
      style={getCardStyle()}>
      {cardInnerContent}
    </View>
  );
}
