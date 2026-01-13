import { Pressable, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout' | 'highlighted';
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
  // ============================================================================
  // Computed Values
  // ============================================================================
  const isWorkoutVariant = variant === 'workout';
  const isDefaultVariant = variant === 'default';
  const effectiveBackgroundVariant = backgroundVariant ?? variant;
  const isDarkGreenBackground = effectiveBackgroundVariant === 'dark-green';
  const shouldShowPopularGradient = isPopular && !isWorkoutVariant && !isDefaultVariant;
  const shouldRenderAsPressable = isPressable && !isWorkoutVariant;

  // ============================================================================
  // Style Helpers
  // ============================================================================
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

  const getBackgroundStyle = (pressed: boolean = false): ViewStyle => {
    // Popular cards use gradient wrapper instead of background style
    if (shouldShowPopularGradient) {
      return {};
    }

    // Food variant: matches FoodItemCard styling
    if (isDefaultVariant) {
      return {
        backgroundColor: theme.colors.background.overlay,
        borderColor: theme.colors.border.default,
        borderWidth: theme.borderWidth.thin,
      };
    }

    if (isDarkGreenBackground) {
      return {
        backgroundColor: theme.colors.background.darkGreen80,
        borderColor: theme.colors.background.white5,
        borderWidth: theme.borderWidth.thin,
        ...theme.shadows.lg,
      };
    }

    // Default background with pressed state
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

  // ============================================================================
  // Render Helpers
  // ============================================================================
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

  const renderCardContent = () => {
    // Popular cards get wrapped in a gradient border
    if (shouldShowPopularGradient) {
      return (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 2 }}>
          {children}
        </LinearGradient>
      );
    }
    return children;
  };

  // ============================================================================
  // Main Render
  // ============================================================================
  const cardContent = (
    <>
      {isWorkoutVariant && renderWorkoutGradientOverlay()}
      {renderCardContent()}
    </>
  );

  // Pressable card (only for highlighted variant, not workout)
  if (shouldRenderAsPressable) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => getCardStyle(pressed)}>
        {cardContent}
      </Pressable>
    );
  }

  // Static card
  const workoutClassName = isWorkoutVariant
    ? 'mb-8 w-full overflow-hidden rounded-[20px] border p-6'
    : undefined;

  return (
    <View className={workoutClassName} style={getCardStyle()}>
      {cardContent}
    </View>
  );
}
