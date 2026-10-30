import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  choiceLabel,
  FIELD_CHOICES,
  OPTIONAL_FIELDS,
} from '@/components/aiOnboarding/fieldChoices';
import { DatePickerInput } from '@/components/modals/DatePickerInput';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { TextInput } from '@/components/theme/TextInput';
import type { Units } from '@/constants/settings';
import { useTheme } from '@/hooks/useTheme';
import {
  AGE_MAX,
  AGE_MIN,
  type FieldKey,
  type OnboardingAnswersDraft,
} from '@/utils/aiOnboarding/contract';
import { clearField, editField, type FieldEdit } from '@/utils/aiOnboarding/edit';
import {
  formatLocalCalendarDayIso,
  localCalendarDayDate,
  parseLocalCalendarDate,
} from '@/utils/calendarDate';
import { cmToDisplay, kgToDisplay } from '@/utils/unitConversion';
import { getHeightUnit, getWeightUnit } from '@/utils/units';

type ReviewFieldEditorProps = {
  field: FieldKey;
  draft: OnboardingAnswersDraft;
  units: Units;
  onChange: (draft: OnboardingAnswersDraft) => void;
  onDone: () => void;
};

const TEXT_FIELDS = ['fullName', 'heightCm', 'weightKg', 'bodyFatPercent'] as const;
type TextField = (typeof TEXT_FIELDS)[number];
const isTextField = (field: FieldKey): field is TextField =>
  (TEXT_FIELDS as readonly string[]).includes(field);

/** The unit shown beside a text field, or nothing for a name. */
function unitLabel(field: TextField, units: Units): string | undefined {
  switch (field) {
    case 'heightCm':
      return getHeightUnit(units);
    case 'weightKg':
      return getWeightUnit(units);
    case 'bodyFatPercent':
      return '%';
    case 'fullName':
      return undefined;
  }
}

/** A measurement as the text field starts out: in the person's unit, one decimal at most. */
function initialText(field: TextField, draft: OnboardingAnswersDraft, units: Units): string {
  switch (field) {
    case 'fullName':
      return draft.fullName ?? '';
    case 'heightCm':
      return draft.heightCm === undefined
        ? ''
        : String(Math.round(cmToDisplay(draft.heightCm, units) * 10) / 10);
    case 'weightKg':
      return draft.weightKg === undefined
        ? ''
        : String(Math.round(kgToDisplay(draft.weightKg, units) * 10) / 10);
    case 'bodyFatPercent':
      return draft.bodyFatPercent === undefined ? '' : String(draft.bodyFatPercent);
  }
}

/**
 * The control that edits one answer in place. Every edit goes through `editField`, the same
 * validator an import uses, so the screen cannot accept a value the other routes would refuse.
 */
export function ReviewFieldEditor({
  field,
  draft,
  units,
  onChange,
  onDone,
}: ReviewFieldEditorProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(() =>
    isTextField(field) ? initialText(field, draft, units) : ''
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const apply = (edit: FieldEdit): boolean => {
    const result = editField(draft, edit, new Date());
    if (!result.ok) {
      setError(
        result.code === 'outOfRange'
          ? t('aiOnboarding.review.errors.outOfRange')
          : t('aiOnboarding.review.errors.invalid')
      );
      return false;
    }

    setError(null);
    onChange(result.draft);
    return true;
  };

  const choices = FIELD_CHOICES[field];
  let body: ReactNode = null;
  if (choices) {
    body = (
      <View className="flex-row flex-wrap gap-2">
        {choices.map((choice) => (
          <Chip
            key={String(choice.value)}
            label={choiceLabel(choice, t)}
            selected={draft[field] === choice.value}
            onPress={() => {
              if (apply({ field, value: choice.value } as FieldEdit)) {
                onDone();
              }
            }}
          />
        ))}
      </View>
    );
  } else if (isTextField(field)) {
    const unit = unitLabel(field, units);
    body = (
      <View className="gap-3">
        <TextInput
          label=""
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          keyboardType={field === 'fullName' ? 'default' : 'numeric'}
          icon={
            unit ? (
              <Text
                style={{
                  color: theme.colors.text.tertiary,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                {unit}
              </Text>
            ) : undefined
          }
        />
        <Button
          label={t('aiOnboarding.review.save')}
          variant="accent"
          size="sm"
          width="full"
          onPress={() => {
            const edit = (
              field === 'heightCm' || field === 'weightKg'
                ? { field, text, units }
                : { field, text }
            ) as FieldEdit;
            if (apply(edit)) {
              onDone();
            }
          }}
        />
      </View>
    );
  } else if (field === 'birthDate') {
    const selected = draft.birthDate
      ? localCalendarDayDate(parseLocalCalendarDate(draft.birthDate))
      : localCalendarDayDate(new Date(1990, 0, 1));
    const thisYear = new Date().getFullYear();
    body = (
      <>
        <DatePickerInput hideLabel selectedDate={selected} onPress={() => setPickerOpen(true)} />
        <DatePickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          selectedDate={selected}
          minYear={thisYear - AGE_MAX}
          maxYear={thisYear - AGE_MIN}
          onDateSelect={(date) => {
            setPickerOpen(false);
            if (apply({ field: 'birthDate', isoDate: formatLocalCalendarDayIso(date) })) {
              onDone();
            }
          }}
        />
      </>
    );
  }

  return (
    <View className="gap-3 px-4 pb-4">
      {body}
      {error ? (
        <Text style={{ color: theme.colors.status.error, fontSize: theme.typography.fontSize.sm }}>
          {error}
        </Text>
      ) : null}
      {OPTIONAL_FIELDS.has(field) && draft[field] !== undefined ? (
        <TextButton
          label={t('aiOnboarding.review.remove')}
          tone="danger"
          onPress={() => {
            onChange(clearField(draft, field));
            onDone();
          }}
        />
      ) : null}
    </View>
  );
}
