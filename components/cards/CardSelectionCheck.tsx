import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * The checkbox a list card shows in place of its menu button while a selection is running.
 * Same box as the copy-day picker's rows, so "selected" looks the same everywhere in the diary.
 */
export function CardSelectionCheck({ selected }: { selected: boolean }) {
  const theme = useTheme();

  return (
    <View
      className="h-6 w-6 flex-shrink-0 items-center justify-center rounded-inner border"
      style={{
        borderColor: selected ? theme.colors.accent.primary : theme.colors.background.ink20,
        backgroundColor: selected ? theme.colors.accent.primary10 : 'transparent',
      }}
    >
      {selected ? <Check size={theme.iconSize.sm} color={theme.colors.accent.primary} /> : null}
    </View>
  );
}
