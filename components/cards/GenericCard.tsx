import { Pressable, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout';
  isPressable?: boolean;
};

/**
 * GenericCard - A flexible card component with support for different variants
 * and interactive states.
 */
export function GenericCard({
  children,
  isPopular = false,
  isPressable = false,
  onPress,
  variant = 'default',
}: GenericCardProps) {
  const isWorkoutVariant = variant === 'workout';

  // Style helpers
  const getWorkoutCardStyle = (): ViewStyle => ({
    width: '100%',
    overflow: 'hidden',
    borderRadius: 20,
    padding: 24,
    backgroundColor: theme.colors.background.darkGreen80,
    borderColor: theme.colors.background.white5,
    borderWidth: theme.borderWidth.thin,
    ...theme.shadows.lg,
  });

  const getDefaultCardStyle = (pressed: boolean = false): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: '100%',
      overflow: 'hidden',
      borderRadius: theme.borderRadius.xl,
      transform: [{ scale: pressed ? 0.98 : 1 }],
    };

    // Popular cards don't have background/border (they use gradient wrapper)
    if (isPopular) {
      return baseStyle;
    }

    // Regular cards have background, border, and shadow
    return {
      ...baseStyle,
      backgroundColor: pressed
        ? theme.colors.background.cardDark
        : theme.colors.background.cardElevated,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.background.white5,
      ...theme.shadows.md,
    };
  };

  const getCardStyle = (pressed: boolean = false): ViewStyle => {
    return isWorkoutVariant ? getWorkoutCardStyle() : getDefaultCardStyle(pressed);
  };

  // Content rendering helpers
  const renderWorkoutGradientOverlay = () => (
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
  );

  const renderPopularGradientWrapper = () => (
    <LinearGradient
      colors={theme.colors.gradients.cta}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: 2 }}>
      {children}
    </LinearGradient>
  );

  const renderCardContent = () => {
    if (isPopular && !isWorkoutVariant) {
      return renderPopularGradientWrapper();
    }
    return children;
  };

  const renderCardInnerContent = () => (
    <>
      {isWorkoutVariant && renderWorkoutGradientOverlay()}
      {renderCardContent()}
    </>
  );

  // Render pressable card (only for default variant)
  if (isPressable && !isWorkoutVariant) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => getCardStyle(pressed)}>
        {renderCardInnerContent()}
      </Pressable>
    );
  }

  // Render static card
  const workoutClassName = isWorkoutVariant
    ? 'mb-8 w-full overflow-hidden rounded-[20px] border p-6'
    : undefined;

  return (
    <View className={workoutClassName} style={getCardStyle()}>
      {renderCardInnerContent()}
    </View>
  );
}
