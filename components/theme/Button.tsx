import { Text, Pressable, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { theme } from '../../theme';

type ThemeButtonSize = 'sm' | 'md' | 'lg';

type ThemeButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ThemeButtonVariant = 'accent' | 'discard';

type ThemeButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  size?: ThemeButtonSize;
  width?: ThemeButtonWidth;
  variant?: ThemeButtonVariant;
  className?: string;
  style?: ViewStyle;
};

const sizeConfig = {
  sm: {
    paddingVertical: theme.spacing.padding.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.sm,
    gap: theme.spacing.gap.sm,
    shadow: theme.shadows.md,
  },
  md: {
    paddingVertical: theme.spacing.padding.lg,
    borderRadius: theme.borderRadius.xl,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.md,
    gap: theme.spacing.gap.md,
    shadow: theme.shadows.accentGlow,
  },
  lg: {
    paddingVertical: theme.spacing.padding.xl,
    borderRadius: theme.borderRadius['2xl'],
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    iconSize: theme.iconSize.lg,
    gap: theme.spacing.gap.md,
    shadow: theme.shadows.accentGlowLarge,
  },
};

const widthClasses = {
  full: 'w-full',
  'flex-1': 'flex-1',
  'flex-2': 'flex-[2]',
  auto: '',
};

export function Button({
  label,
  onPress,
  icon: Icon,
  size = 'md',
  width = 'auto',
  variant = 'accent',
  style,
}: ThemeButtonProps) {
  const config = sizeConfig[size];
  const widthClass = widthClasses[width];

  // Determine colors and styles based on variant
  const isRedVariant = variant === 'discard';
  const gradientColors: readonly [string, string, ...string[]] = isRedVariant
    ? ([theme.colors.rose.brand, theme.colors.rose.brand] as const)
    : theme.colors.gradients.accent;
  const textColor = isRedVariant ? theme.colors.text.white : theme.colors.text.black;
  const iconColor = isRedVariant ? theme.colors.text.white : theme.colors.text.black;
  const shadow = isRedVariant ? theme.shadows.roseGlow : config.shadow;

  return (
    <Pressable
      className={`${widthClass} active:scale-[0.98] active:opacity-90`}
      style={[
        {
          borderRadius: config.borderRadius,
          ...shadow,
        },
        style,
      ]}
      onPress={onPress}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          borderRadius: config.borderRadius,
          paddingVertical: config.paddingVertical,
          paddingHorizontal: theme.spacing.padding.base,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {Icon && <Icon size={config.iconSize} color={iconColor} />}
        <Text
          className={`uppercase tracking-wide ${isRedVariant ? 'text-white' : 'text-text-black'}`}
          style={{
            fontSize: config.fontSize,
            fontWeight: config.fontWeight,
            marginLeft: Icon ? theme.spacing.gap.md : 0,
            color: textColor,
          }}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
