import { Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

type GenericCardProps = {
  children: React.ReactNode;
  isPopular: boolean;
  onPress: () => void;
};

export function GenericCard({ children, isPopular, onPress }: GenericCardProps) {
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
