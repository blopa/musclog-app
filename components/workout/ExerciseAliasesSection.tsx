import { Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { Button } from '@/components/theme/Button';
import { IconButton } from '@/components/theme/IconButton';
import { TextInput } from '@/components/theme/TextInput';
import { useSnackbar } from '@/context/SnackbarContext';
import {
  type AddAliasResult,
  ExerciseAliasService,
  MAX_EXERCISE_ALIASES,
} from '@/database/services/ExerciseAliasService';
import { useTheme } from '@/hooks/useTheme';

type AliasRow = { id: string; alias: string };

type ExerciseAliasesSectionProps = {
  exerciseId: string;
};

const ADD_ERROR_KEYS = {
  duplicate: 'exercises.viewExercise.aliasDuplicate',
  empty: 'exercises.viewExercise.aliasEmpty',
  limit: 'exercises.viewExercise.aliasLimit',
  notFound: 'exercises.viewExercise.aliasFailed',
} as const satisfies Record<Extract<AddAliasResult, { ok: false }>['reason'], string>;

/**
 * Lists and edits the user's own names for an exercise ("BP" for bench press).
 *
 * Every change goes through `ExerciseAliasService`, which rewrites the exercise's search text in
 * the same write — this component never touches the database itself, so what it lists is exactly
 * what the search can find.
 */
export function ExerciseAliasesSection({ exerciseId }: ExerciseAliasesSectionProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ExerciseAliasService.getAliases(exerciseId)
      .then((rows) => {
        if (!cancelled) {
          setAliases(rows.map(({ id, alias }) => ({ id, alias })));
        }
      })
      .catch(() => {
        // The section is optional chrome: an unreadable list just renders empty.
      });

    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const handleAdd = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await ExerciseAliasService.addAlias(exerciseId, draft);
      if (result.ok) {
        setAliases((current) => [...current, { id: result.alias.id, alias: result.alias.alias }]);
        setDraft('');
        setError(null);
      } else {
        setError(t(ADD_ERROR_KEYS[result.reason], { count: MAX_EXERCISE_ALIASES }));
      }
    } catch {
      setError(t('exercises.viewExercise.aliasFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [draft, exerciseId, isSaving, t]);

  const handleRemove = useCallback(
    async (row: AliasRow) => {
      try {
        await ExerciseAliasService.removeAlias(row.id);
        setAliases((current) => current.filter((candidate) => candidate.id !== row.id));
        setError(null);
      } catch {
        showSnackbar('error', t('exercises.viewExercise.aliasFailed'));
      }
    },
    [showSnackbar, t]
  );

  return (
    <View className="px-4 pb-6 pt-2" testID="exercise-aliases-section">
      <Text className="mb-1 text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
        {t('exercises.viewExercise.aliasesTitle')}
      </Text>
      <Text className="mb-4 text-sm" style={{ color: theme.colors.text.secondary }}>
        {t('exercises.viewExercise.aliasesHint')}
      </Text>
      <GenericCard variant="flat">
        <View className="gap-4 p-4">
          {aliases.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {aliases.map((row) => (
                <View
                  key={row.id}
                  className="flex-row items-center gap-1 rounded-full border py-1 pl-3 pr-1"
                  style={{
                    backgroundColor: theme.colors.background.notificationCard,
                    borderColor: theme.colors.background.hairline,
                  }}
                >
                  <Text className="font-medium" style={{ color: theme.colors.text.primary }}>
                    {row.alias}
                  </Text>
                  <IconButton
                    icon={X}
                    size="sm"
                    variant="ghost"
                    color={theme.colors.text.secondary}
                    onPress={() => handleRemove(row)}
                    accessibilityLabel={t('exercises.viewExercise.aliasRemove', {
                      alias: row.alias,
                    })}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <TextInput
            label={t('exercises.viewExercise.aliasInputLabel')}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setError(null);
            }}
            placeholder={t('exercises.viewExercise.aliasPlaceholder')}
            selectTextOnFocus={false}
          />
          {error ? (
            <Text className="text-sm" style={{ color: theme.colors.status.error }}>
              {error}
            </Text>
          ) : null}
          <Button
            label={t('exercises.viewExercise.aliasAdd')}
            onPress={handleAdd}
            icon={Plus}
            variant="secondary"
            size="sm"
            width="auto"
            disabled={isSaving || draft.trim().length === 0}
            loading={isSaving}
            style={{ alignSelf: 'flex-start' }}
          />
        </View>
      </GenericCard>
    </View>
  );
}
