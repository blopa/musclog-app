import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  current: number;
  total: number;
};

export function QuickSetupProgressBar({ current, total }: Props) {
  const theme = useTheme();

  return (
    <View className="flex-row gap-1.5 px-6 pt-4" accessibilityLabel={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < current ? theme.colors.accent.primary : theme.colors.border.light,
          }}
        />
      ))}
    </View>
  );
}
