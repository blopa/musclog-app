import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import { WeightUnitOverridePicker } from '@/components/workout/WeightUnitOverridePicker';
import { ExerciseUserSettingsService } from '@/database/services/ExerciseUserSettingsService';
import { useExerciseUserSettings } from '@/hooks/useExerciseUserSettings';
import { useTheme } from '@/hooks/useTheme';
import { MAX_NOTE_LENGTH } from '@/utils/noteText';
import type { WeightUnitOverride } from '@/utils/unitConversion';

type ExerciseUserSettingsSectionProps = {
  exerciseId: string;
};

/**
 * The user's own settings for one exercise: the unit its weights are shown in and a note that is
 * pinned above the set in every workout. The unit applies the moment it is tapped; the note is
 * saved with its button, because a half-typed cue should not be written on every keystroke.
 */
export function ExerciseUserSettingsSection({ exerciseId }: ExerciseUserSettingsSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { get, isLoading } = useExerciseUserSettings();
  const stored = get(exerciseId);
  const [draft, setDraft] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show what is on disk until the user starts typing; their draft is never overwritten after that.
  const noteValue = isDirty ? draft : (stored.note ?? '');

  const chooseUnit = async (unit: WeightUnitOverride | null) => {
    setError(null);
    try {
      await ExerciseUserSettingsService.setWeightUnit(exerciseId, unit);
    } catch {
      setError(t('exercises.viewExercise.preferences.failed'));
    }
  };

  const saveNote = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await ExerciseUserSettingsService.setNote(exerciseId, draft);
      setIsDirty(false);
    } catch {
      setError(t('exercises.viewExercise.preferences.failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="px-4 pb-6 pt-2" testID="exercise-user-settings-section">
      <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
        {t('exercises.viewExercise.preferences.title')}
      </Text>
      <Text className="mb-4 text-sm" style={{ color: theme.colors.text.secondary }}>
        {t('exercises.viewExercise.preferences.hint')}
      </Text>
      <GenericCard variant="flat">
        <View className="gap-4 p-4">
          <WeightUnitOverridePicker
            label={t('exercises.viewExercise.preferences.unitLabel')}
            defaultLabel={t('exercises.viewExercise.preferences.unitDefault')}
            value={stored.weightUnit ?? null}
            onChange={(unit) => void chooseUnit(unit)}
            disabled={isLoading}
          />

          <TextInput
            label={t('exercises.viewExercise.preferences.noteLabel')}
            value={noteValue}
            onChangeText={(text) => {
              setDraft(text.slice(0, MAX_NOTE_LENGTH));
              setIsDirty(true);
              setError(null);
            }}
            placeholder={t('exercises.viewExercise.preferences.notePlaceholder')}
            multiline
            numberOfLines={3}
            selectTextOnFocus={false}
          />
          {error ? (
            <Text className="text-sm" style={{ color: theme.colors.status.error }}>
              {error}
            </Text>
          ) : null}
          <Button
            label={t('exercises.viewExercise.preferences.noteSave')}
            onPress={saveNote}
            variant="secondary"
            size="sm"
            width="auto"
            disabled={!isDirty || isSaving}
            loading={isSaving}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      </GenericCard>
    </View>
  );
}
