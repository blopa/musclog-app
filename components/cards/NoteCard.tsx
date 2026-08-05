import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { MenuButton } from '@/components/theme/MenuButton';
import type Note from '@/database/models/Note';
import { useTheme } from '@/hooks/useTheme';

export type NoteCardProps = {
  note: Note;
  /** Pre-formatted by the screen so locale/`t` resolve in one place. */
  relativeTime: string;
  onPress: () => void;
  onMenuPress: () => void;
};

/**
 * The highlighted "Latest" tile. Sits in a 2-column grid; elevation + a faint accent rim carry
 * the hierarchy against the flat `NoteRow`s below.
 */
export function NoteCard({ note, relativeTime, onPress, onMenuPress }: NoteCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

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
        <View className="flex-row items-start justify-between">
          <View
            className="flex-row items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ backgroundColor: theme.colors.accent.primary10 }}
          >
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: theme.colors.accent.primary }}
            />
            <Text
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: theme.colors.accent.primary }}
            >
              {t('notes.latestBadge')}
            </Text>
          </View>
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
