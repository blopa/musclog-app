import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { CardVariant, resolveCardSurface } from './cardSurface';

export type { CardVariant };

type GenericCardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** 'flat' (default) for almost every card; 'raised' for the one emphasis
   *  card on a screen; 'hero' is reserved for DailySummaryCard. See
   *  cardSurface.ts for the full contract. */
  variant?: CardVariant;
  isPressable?: boolean;
  /** Row layouts where the card shares horizontal space with siblings
   *  (flex: 1 instead of the default full-width). */
  fill?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * GenericCard - the app's one card surface. See cardSurface.ts for the two
 * styles plus the DailySummaryCard gradient exception.
 */
export function GenericCard({
  children,
  onPress,
  variant = 'flat',
  isPressable = false,
  fill = false,
  containerStyle,
}: GenericCardProps) {
  const theme = useTheme();
  const surface = resolveCardSurface(variant, theme);
  const isHero = variant === 'hero';

  const cardStyle: ViewStyle = {
    ...(fill ? { flex: 1 } : { width: '100%' }),
    overflow: 'hidden',
    borderRadius: surface.borderRadius,
    backgroundColor: surface.backgroundColor,
    borderColor: surface.borderColor,
    borderWidth: surface.borderWidth,
    ...surface.shadow,
  };

  const content = isHero ? (
    <LinearGradient
      colors={theme.colors.gradients.colorfulCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  ) : (
    children
  );

  if (isPressable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          containerStyle,
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[cardStyle, containerStyle]}>{content}</View>;
}
