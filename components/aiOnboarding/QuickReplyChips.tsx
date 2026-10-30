import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { choiceLabel, FIELD_CHOICES } from '@/components/aiOnboarding/fieldChoices';
import { Chip } from '@/components/theme/Chip';
import type { FieldKey } from '@/utils/aiOnboarding/contract';

type QuickReplyChipsProps = {
  /** The answer the assistant just asked about; chips appear only for choice questions. */
  field: FieldKey | undefined;
  /** Sends the chip's label as the person's reply. */
  onPick: (text: string) => void;
  disabled?: boolean;
};

/** One-tap answers for a question with a short list of options (gender, goals, days per week). */
export function QuickReplyChips({ field, onPick, disabled = false }: QuickReplyChipsProps) {
  const { t } = useTranslation();
  const choices = field ? FIELD_CHOICES[field] : undefined;
  if (!choices) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
      style={{ flexGrow: 0 }}
    >
      {choices.map((choice) => {
        const label = choiceLabel(choice, t);
        return (
          <Chip
            key={String(choice.value)}
            label={label}
            role="button"
            disabled={disabled}
            onPress={() => onPick(label)}
          />
        );
      })}
    </ScrollView>
  );
}
