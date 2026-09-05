import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import { useTheme } from '@/hooks/useTheme';

import type { NoteListItemProps } from './noteListItem';

/**
 * The highlighted tile for the "Latest" section (the section header above it already says
 * so — see app/app/notes.tsx — so this card doesn't repeat it). Sits in a 2-column grid;
 * elevation + a faint accent rim carry the hierarchy against the flat `NoteRow`s below.
 */
export function NoteCard({ note, relativeTime, onPress, onMenuPress }: NoteListItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="flex-1 overflow-hidden active:opacity-80"
      style={{
        borderRadius: theme.borderRadius.xl,
        backgroundColor: theme.colors.background.cardElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.accent.primary20,
        ...theme.shadows.md,
      }}
    >
      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-end">
          <MenuButton size="sm" onPress={onMenuPress} className="-mr-1 -mt-1" />
        </View>

        {/* minHeight keeps a pair of one-line notes from collapsing into squat tiles. */}
        <View style={{ minHeight: theme.size['18'] }}>
          {note.title ? (
            <Text className="mb-1 text-sm font-bold text-text-primary" numberOfLines={1}>
              {note.title}
            </Text>
          ) : null}
          <Text className="text-sm leading-snug text-text-secondary" numberOfLines={4}>
            {note.body}
          </Text>
        </View>

        <Text className="text-xs text-text-tertiary">{relativeTime}</Text>
      </View>
    </Pressable>
  );
}
