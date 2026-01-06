import { View, Text, Pressable } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type ScanButtonProps = {
  icon: LucideIcon;
  label: string;
  variant?: 'default' | 'gradient';
  onPress?: () => void;
};

export function ScanButton({ icon: Icon, label, variant = 'default', onPress }: ScanButtonProps) {
  const content = (
    <View className="flex-row items-center justify-center gap-3">
      <Icon
        size={theme.iconSize.md}
        color={variant === 'gradient' ? theme.colors.text.primary : theme.colors.accent.secondary}
      />
      <Text className="text-lg font-semibold text-text-primary">{label}</Text>
    </View>
  );

  if (variant === 'gradient') {
    return (
      <Pressable
        className="relative flex-1 rounded-2xl border border-emerald-900/30 py-4"
        onPress={onPress}>
        <LinearGradient
          colors={theme.colors.gradients.button}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0 rounded-2xl"
        />
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      className="flex-1 flex-row items-center justify-center gap-3 rounded-2xl border border-border-default bg-bg-overlay py-4"
      onPress={onPress}>
      {content}
    </Pressable>
  );
}
