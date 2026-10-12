import { Pin, StickyNote } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** `pinned` is the exercise-wide note; `session` is the note on this session's block. */
export type SessionNote = { kind: 'pinned' | 'session'; text: string };

/**
 * The notes under an exercise header, shared by Guided and Inline so they cannot drift. Each line
 * carries a Lucide icon like the rest of the app instead of an emoji, which renders differently on
 * every platform and cannot follow the theme.
 */
export function ExerciseNotes({ notes, onPress }: { notes: SessionNote[]; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!notes.length) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('workoutSession.notes.edit')}
      onPress={onPress}
      className="gap-1 rounded-lg bg-bg-overlay p-3"
    >
      {notes.map((note) => {
        const Icon = note.kind === 'pinned' ? Pin : StickyNote;
        return (
          <View key={`${note.kind}:${note.text}`} className="flex-row items-start gap-2">
            <View className="pt-0.5">
              <Icon size={theme.iconSize.xs} color={theme.colors.text.tertiary} />
            </View>
            <Text className="flex-1 text-sm text-text-secondary" numberOfLines={3}>
              {note.text}
            </Text>
          </View>
        );
      })}
    </Pressable>
  );
}
