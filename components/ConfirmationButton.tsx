import { Text, Pressable, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LucideIcon } from 'lucide-react-native';
import { theme } from '../theme';

type ConfirmationButtonSize = 'sm' | 'md' | 'lg';

type ConfirmationButtonWidth = 'full' | 'flex-1' | 'flex-2' | 'auto';

type ConfirmationButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: LucideIcon;
  size?: ConfirmationButtonSize;
  width?: ConfirmationButtonWidth;
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

export function ConfirmationButton({
  label,
  onPress,
  icon: Icon,
  size = 'md',
  width = 'auto',
  style,
}: ConfirmationButtonProps) {
  const config = sizeConfig[size];
  const widthClass = widthClasses[width];

  return (
    <Pressable
      className={`${widthClass} active:scale-[0.98] active:opacity-90`}
      style={[
        {
          borderRadius: config.borderRadius,
          ...config.shadow,
        },
        style,
      ]}
      onPress={onPress}>
      <LinearGradient
        colors={theme.colors.gradients.accent}
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
        {Icon && <Icon size={config.iconSize} color={theme.colors.text.black} />}
        <Text
          className="uppercase tracking-wide text-text-black"
          style={{
            fontSize: config.fontSize,
            fontWeight: config.fontWeight,
            marginLeft: Icon ? theme.spacing.gap.md : 0,
          }}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
