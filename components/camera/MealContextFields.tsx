import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Chip } from '@/components/theme/Chip';
import { TextInput } from '@/components/theme/TextInput';
import { MEAL_CONTEXT_TAGS } from '@/constants/mealContextTags';
import { useTheme } from '@/hooks/useTheme';

type MealContextFieldsProps = {
  description: string;
  onDescriptionChange: (value: string) => void;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  maxLength?: number;
  numberOfLines?: number;
  tags: string[];
  onToggleTag: (tagLabel: string) => void;
  tagsLabel: string;
  /** Optional fields placed between the description input and the quick-tag chips. */
  middleSlot?: ReactNode;
};

/**
 * Shared meal context description input and quick-tag chips used by both the pre-photo
 * AI context sheet and the detailed meal photo sheet.
 */
export function MealContextFields({
  description,
  onDescriptionChange,
  descriptionLabel,
  descriptionPlaceholder,
  maxLength,
  numberOfLines = 3,
  tags,
  onToggleTag,
  tagsLabel,
  middleSlot,
}: MealContextFieldsProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.gap.lg }}>
      <TextInput
        label={descriptionLabel}
        placeholder={descriptionPlaceholder}
        value={description}
        maxLength={maxLength}
        multiline
        numberOfLines={numberOfLines}
        onChangeText={onDescriptionChange}
      />
      {middleSlot}
      <View style={{ gap: theme.spacing.gap.sm }}>
        <Text className="text-sm font-semibold text-text-secondary">{tagsLabel}</Text>
        <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.sm }}>
          {MEAL_CONTEXT_TAGS.map((tag) => {
            const label = t(tag.labelKey);

            return (
              <Chip
                key={tag.id}
                role="checkbox"
                label={label}
                selected={tags.includes(label)}
                onPress={() => onToggleTag(label)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
