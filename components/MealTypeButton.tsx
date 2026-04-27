import { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type MealTypeButtonProps = {
  icon: LucideIcon;
  label: string;
  iconBgColor: string;
  iconColor: string;
  onPress: () => void;
  span?: number;
};

export function MealTypeButton({
  icon: Icon,
  label,
  iconBgColor,
  iconColor,
  onPress,
  span = 1,
}: MealTypeButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      className={`${
        span === 2 ? 'flex-row' : 'flex-col'
      } active:bg-bg-card-elevated border-border-default bg-bg-overlay items-center justify-center gap-2 rounded-2xl border p-3 active:scale-95`}
      style={{ minHeight: theme.size['22'] }}
      onPress={onPress}
      {...(Platform.OS === 'android' && { unstable_pressDelay: 130 })}
    >
      <View
        className={`${span === 2 ? 'h-8 w-8' : 'h-10 w-10'} items-center justify-center rounded-full`}
        style={{ backgroundColor: iconBgColor }}
      >
        <Icon size={span === 2 ? theme.iconSize.sm : theme.iconSize.md} color={iconColor} />
      </View>
      <Text className="text-text-primary text-xs font-medium">{label}</Text>
    </Pressable>
  );
}
