import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useTheme } from '@/hooks/useTheme';
import { MAX_NOTE_LENGTH } from '@/utils/noteText';

export type ExerciseNotesSaveData = {
  /** What to remember about this exercise in this workout. Blank clears it. */
  sessionNote: string;
  /** What to remember about this exercise always. Blank clears it. */
  exerciseNote: string;
  /** Copy the workout note onto the template so the next start of it already has it. */
  alsoSaveToTemplate: boolean;
};

type ExerciseNotesSheetProps = {
  visible: boolean;
  onClose: () => void;
  exerciseName: string;
  initialSessionNote: string;
  initialExerciseNote: string;
  /** False when the block has no template to save to (an exercise added mid-session). */
  canSaveToTemplate: boolean;
  onSave: (data: ExerciseNotesSaveData) => Promise<void>;
};

/**
 * Both scopes of an exercise's notes in one place. "This workout" belongs to the session (and,
 * if asked, its template); "Always" follows the exercise into every workout. The sheet only
 * collects text — what is written where is decided by the caller, so a failed save can keep the
 * sheet open with the draft intact.
 */
export function ExerciseNotesSheet({
  visible,
  onClose,
  exerciseName,
  initialSessionNote,
  initialExerciseNote,
  canSaveToTemplate,
  onSave,
}: ExerciseNotesSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [sessionNote, setSessionNote] = useState(initialSessionNote);
  const [exerciseNote, setExerciseNote] = useState(initialExerciseNote);
  const [alsoSaveToTemplate, setAlsoSaveToTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ sessionNote, exerciseNote, alsoSaveToTemplate });
      onClose();
    } catch {
      setError(t('workoutSession.notes.failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('workoutSession.notes.title')}
      subtitle={exerciseName}
      footer={
        <Button
          label={t('workoutSession.notes.save')}
          onPress={handleSave}
          variant="accent"
          size="md"
          width="full"
          loading={isSaving}
          disabled={isSaving}
        />
      }
    >
      <View className="gap-5 pb-4" testID="exercise-notes-sheet">
        <View className="gap-2">
          <TextInput
            label={t('workoutSession.notes.thisWorkout')}
            value={sessionNote}
            onChangeText={(text) => setSessionNote(text.slice(0, MAX_NOTE_LENGTH))}
            placeholder={t('workoutSession.notes.thisWorkoutPlaceholder')}
            multiline
            numberOfLines={3}
            selectTextOnFocus={false}
          />
          {canSaveToTemplate ? (
            <ToggleInput
              items={[
                {
                  key: 'template',
                  label: t('workoutSession.notes.alsoTemplate'),
                  subtitle: t('workoutSession.notes.alsoTemplateHint'),
                  value: alsoSaveToTemplate,
                  onValueChange: setAlsoSaveToTemplate,
                },
              ]}
            />
          ) : null}
        </View>

        <View className="gap-2">
          <TextInput
            label={t('workoutSession.notes.always')}
            value={exerciseNote}
            onChangeText={(text) => setExerciseNote(text.slice(0, MAX_NOTE_LENGTH))}
            placeholder={t('workoutSession.notes.alwaysPlaceholder')}
            multiline
            numberOfLines={3}
            selectTextOnFocus={false}
          />
          <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            {t('workoutSession.notes.alwaysHint')}
          </Text>
        </View>

        {error ? (
          <Text className="text-sm" style={{ color: theme.colors.status.error }}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomPopUp>
  );
}
