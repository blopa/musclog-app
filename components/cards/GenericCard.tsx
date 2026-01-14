import { Pressable, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'workout' | 'highlighted' | 'card';
  backgroundVariant?: 'default' | 'dark-green' | 'gradient' | 'colorful-gradient';
  isPressable?: boolean;
  size?: 'sm' | 'default' | 'lg';
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
  size = 'default',
}: GenericCardProps) {
  // ============================================================================
  // Computed Values
  // ============================================================================
  const isWorkoutVariant = variant === 'workout';
  const isDefaultVariant = variant === 'default';
  const isCardVariant = variant === 'card';
  const effectiveBackgroundVariant = backgroundVariant ?? variant;
  const isDarkGreenBackground = effectiveBackgroundVariant === 'dark-green';
  const shouldShowPopularGradient = isPopular && !isWorkoutVariant && !isDefaultVariant;
  const shouldRenderAsPressable = isPressable && !isWorkoutVariant;
  const hasGradientBackground = effectiveBackgroundVariant === 'gradient';
  const hasColorfulGradientBackground = effectiveBackgroundVariant === 'colorful-gradient';

  // ============================================================================
  // Style Helpers
  // ============================================================================
  const getStructuralStyle = (pressed: boolean = false): ViewStyle => {
    // Small cards should use flex-1 instead of full width for row layouts
    const widthStyle: ViewStyle =
      size === 'sm' && !isWorkoutVariant
        ? { flex: 1 } // Allows cards to share space in a row
        : { width: '100%' };

    const baseStyle: ViewStyle = {
      ...widthStyle,
      overflow: 'hidden',
      transform: [{ scale: pressed ? 0.98 : 1 }],
    };

    if (isWorkoutVariant) {
      return {
        ...baseStyle,
        borderRadius: theme.borderRadius.xl,
        padding: 24,
      };
    }

    // Size-based border radius for non-workout variants
    const borderRadius =
      size === 'sm'
        ? theme.borderRadius.lg
        : size === 'lg'
          ? theme.borderRadius['2xl']
          : theme.borderRadius.xl;

    return {
      ...baseStyle,
      borderRadius,
    };
  };

  const getBackgroundStyle = (pressed: boolean = false): ViewStyle => {
    // Popular cards use gradient wrapper instead of background style
    if (shouldShowPopularGradient) {
      return {};
    }

    // Colorful gradient background uses LinearGradient, so no background style needed
    if (hasColorfulGradientBackground) {
      return {
        borderColor: theme.colors.border.default,
        borderWidth: theme.borderWidth.thin,
      };
    }

    // Default variant: matches FoodItemCard styling (overlay background with default border)
    if (isDefaultVariant) {
      return {
        backgroundColor: theme.colors.background.overlay,
        borderColor: theme.colors.border.default,
        borderWidth: theme.borderWidth.thin,
      };
    }

    // Card variant: matches HealthCategoryCard styling (card background with white5 border)
    if (isCardVariant) {
      return {
        backgroundColor: theme.colors.background.card,
        borderColor: theme.colors.background.white5,
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

    // Highlighted variant (or other variants): elevated card background with pressed state
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

    // Colorful gradient background wraps the content
    if (hasColorfulGradientBackground) {
      return (
        <LinearGradient
          colors={theme.colors.gradients.progress}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}>
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

  // Pressable card (works for any variant except workout)
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
      {hasGradientBackground ? (
        <>
          <View
            className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          />
          <View
            className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full blur-3xl"
            style={{ backgroundColor: theme.colors.accent.secondary10 }}
          />
        </>
      ) : undefined}
      {cardContent}
    </View>
  );
}
