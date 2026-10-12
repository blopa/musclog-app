import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type SessionExerciseNotesProps = {
  /** The note that follows this exercise into every workout (pinned). */
  exerciseNote: string | undefined;
  /** The note on this exercise in this session only. */
  sessionNote: string | undefined;
  onEdit: () => void;
};

/**
 * The exercise's notes on the session screen: the pinned exercise-wide one, the one for this
 * session, and a link to add or edit them — every part opens the same notes sheet.
 */
export function SessionExerciseNotes({
  exerciseNote,
  sessionNote,
  onEdit,
}: SessionExerciseNotesProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const note = (text: string, testID: string) => (
    <Pressable
      className="mt-3 rounded-lg p-3"
      style={{ backgroundColor: theme.colors.background.ink5 }}
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={t('workoutSession.notes.edit')}
      testID={testID}
    >
      <Text className="text-sm text-text-secondary" numberOfLines={3} ellipsizeMode="tail">
        {text}
      </Text>
    </Pressable>
  );

  return (
    <>
      {exerciseNote ? note(`📌 ${exerciseNote}`, 'exercise-note-pinned') : null}
      {sessionNote ? note(`📝 ${sessionNote}`, 'session-note') : null}
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        className="mt-3 self-start py-1"
        testID="notes-entry"
      >
        <Text className="text-sm font-medium text-accent-primary">
          {exerciseNote || sessionNote
            ? t('workoutSession.notes.edit')
            : t('workoutSession.notes.add')}
        </Text>
      </Pressable>
    </>
  );
}
