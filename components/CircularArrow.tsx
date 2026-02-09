import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '../hooks/useTheme';

export function CircularArrow() {
  const theme = useTheme();

  return (
    <View
      className="h-8 w-8 items-center justify-center rounded-full"
      style={{ backgroundColor: theme.colors.background.iconDarker }}
    >
      <ChevronRight size={theme.iconSize.md} color={theme.colors.text.secondary} />
    </View>
  );
}
