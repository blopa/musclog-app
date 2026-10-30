import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  type AnswerFormatters,
  FIELD_LABEL_KEYS,
  formatAnswer,
} from '@/components/aiOnboarding/fieldChoices';
import { ReviewFieldEditor } from '@/components/aiOnboarding/ReviewFieldEditor';
import { Chip } from '@/components/theme/Chip';
import { ListRow } from '@/components/theme/ListRow';
import type { Units } from '@/constants/settings';
import { useTheme } from '@/hooks/useTheme';
import type { FieldKey, OnboardingAnswersDraft } from '@/utils/aiOnboarding/contract';

type ReviewFieldRowProps = {
  field: FieldKey;
  draft: OnboardingAnswersDraft;
  units: Units;
  formatters: AnswerFormatters;
  onChange: (draft: OnboardingAnswersDraft) => void;
  /** A required answer is missing or was rejected: the row is outlined until it is fixed. */
  needsAttention?: boolean;
  /** Profile mode: the saved value, and whether this change will be applied. */
  comparison?: { current: string | null; changed: boolean; kept: boolean; onToggle: () => void };
};

/**
 * One answer on the review. Tapping it opens the matching editor beneath it, so the person can fix
 * a value where they see it instead of going back through a conversation or a form.
 */
export function ReviewFieldRow({
  field,
  draft,
  units,
  formatters,
  onChange,
  needsAttention = false,
  comparison,
}: ReviewFieldRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const answer = formatAnswer(field, draft, formatters);

  return (
    <View
      style={
        needsAttention
          ? { borderWidth: 1.5, borderColor: theme.colors.status.error, borderRadius: 8 }
          : undefined
      }
    >
      <ListRow
        variant="grouped"
        title={t(FIELD_LABEL_KEYS[field])}
        value={answer ?? t('aiOnboarding.review.notSet')}
        subtitle={
          comparison?.changed
            ? t('aiOnboarding.review.currentValue', {
                value: comparison.current ?? t('aiOnboarding.review.notSet'),
              })
            : undefined
        }
        trailing={
          comparison ? (
            <Chip
              label={
                comparison.kept ? t('aiOnboarding.review.apply') : t('aiOnboarding.review.skip')
              }
              role="checkbox"
              selected={comparison.kept}
              onPress={comparison.onToggle}
            />
          ) : undefined
        }
        onPress={() => setEditing((open) => !open)}
        accessibilityLabel={t(FIELD_LABEL_KEYS[field])}
      />
      {needsAttention ? (
        <Text
          className="px-4 pb-2"
          style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.xs }}
        >
          {t('aiOnboarding.review.needed')}
        </Text>
      ) : null}
      {editing ? (
        <ReviewFieldEditor
          field={field}
          draft={draft}
          units={units}
          onChange={onChange}
          onDone={() => setEditing(false)}
        />
      ) : null}
    </View>
  );
}
