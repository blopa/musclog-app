import { ChevronDown } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';

type TestPickerButtonProps = {
  label: string;
  icon: ReactNode;
  onPress: () => void;
};

export function PickerButton({ label, icon, onPress }: TestPickerButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      className="h-14 w-full overflow-hidden rounded-lg border border-white/10 bg-bg-card active:bg-white/5"
      onPress={onPress}
    >
      <View className="h-14 flex-row items-center justify-between px-4">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          {icon}
          <Text className="font-medium text-text-primary">{label}</Text>
        </View>
        <View className="shrink-0 justify-center pl-2">
          <ChevronDown size={theme.iconSize.lg} color={theme.colors.text.tertiary} />
        </View>
      </View>
    </Pressable>
  );
}
