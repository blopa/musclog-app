import { Pressable, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout';
  backgroundVariant?: 'default' | 'dark-green';
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
  backgroundVariant,
}: GenericCardProps) {
  const isWorkoutVariant = variant === 'workout';

  // Default backgroundVariant to match variant if not specified (backward compatibility)
  const effectiveBackgroundVariant = backgroundVariant ?? variant;
  const isDarkGreenBackground = effectiveBackgroundVariant === 'dark-green';

  // Structural style helpers (controlled by variant)
  const getStructuralStyle = (pressed: boolean = false): ViewStyle => {
    const baseStyle: ViewStyle = {
      width: '100%',
      overflow: 'hidden',
      transform: [{ scale: pressed ? 0.98 : 1 }],
    };

    if (isWorkoutVariant) {
      return {
        ...baseStyle,
        borderRadius: 20,
        padding: 24,
      };
    }

    return {
      ...baseStyle,
      borderRadius: theme.borderRadius.xl,
    };
  };

  // Background style helpers (controlled by backgroundVariant)
  const getBackgroundStyle = (pressed: boolean = false): ViewStyle => {
    // Popular cards don't have background/border (they use gradient wrapper)
    if (isPopular && !isWorkoutVariant) {
      return {};
    }

    if (isDarkGreenBackground) {
      return {
        backgroundColor: theme.colors.background.darkGreen80,
        borderColor: theme.colors.background.white5,
        borderWidth: theme.borderWidth.thin,
        ...theme.shadows.lg,
      };
    }

    // Default background
    return {
      backgroundColor: pressed
        ? theme.colors.background.cardDark
        : theme.colors.background.cardElevated,
      borderWidth: theme.borderWidth.thin,
      borderColor: theme.colors.background.white5,
      ...theme.shadows.md,
    };
  };

  const getCardStyle = (pressed: boolean = false): ViewStyle => {
    return {
      ...getStructuralStyle(pressed),
      ...getBackgroundStyle(pressed),
    };
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
    // Popular gradient wrapper only applies to default variant
    if (isPopular && !isWorkoutVariant) {
      return renderPopularGradientWrapper();
    }
    return children;
  };

  const renderCardInnerContent = () => (
    <>
      {/* Gradient overlay is controlled by variant, not backgroundVariant */}
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
