import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { useTheme } from '@/hooks/useTheme';

import type { NoteCardProps } from './NoteCard';

/**
 * The flat "Earlier" row. Deliberately recedes against the elevated `NoteCard` tiles: no border,
 * no shadow, a step-down radius, timestamp above the text, and a tighter clamp.
 */
export function NoteRow({ note, relativeTime, onPress, onMenuPress }: NoteCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden bg-bg-card active:opacity-80"
      style={{ borderRadius: theme.borderRadius.lg }}
    >
      <View className="flex-row items-start justify-between p-4">
        <View className="min-w-0 flex-1">
          <Text className="mb-1 text-xs text-text-tertiary">{relativeTime}</Text>
          {note.title ? (
            <Text className="mb-0.5 text-sm font-bold text-text-primary" numberOfLines={1}>
              {note.title}
            </Text>
          ) : null}
          <Text className="text-sm leading-snug text-text-secondary" numberOfLines={2}>
            {note.body}
          </Text>
        </View>
        <View className="shrink-0 pl-2">
          <MenuButton size="sm" onPress={onMenuPress} className="-mr-1 -mt-1" />
        </View>
      </View>
    </Pressable>
  );
}
