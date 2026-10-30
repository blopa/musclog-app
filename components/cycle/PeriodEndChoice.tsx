import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { DatePickerInput } from '@/components/modals/DatePickerInput';
import { Chip } from '@/components/theme/Chip';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { localCalendarDayDate } from '@/utils/calendarDate';
import type { EndChoice } from '@/utils/cycle/periodEnd';
import type { PeriodEndKind } from '@/utils/cycle/types';

type PeriodEndChoiceProps = {
  value: EndChoice;
  onChange: (choice: EndChoice) => void;
  usualDuration: number;
  /** Used as the shown date until an end date is picked. */
  startDate: number;
  /** "Still going" only makes sense for the most recent period. */
  allowOpen: boolean;
  /** The parent owns the one date picker (a modal may not contain sibling modals). */
  onPickDate: () => void;
};

/**
 * How a period ended, as an explicit choice. "Usual length" is offered but labelled as an
 * estimate and stored as one, so a guessed end is never mistaken for a recorded one.
 */
export function PeriodEndChoice({
  value,
  onChange,
  usualDuration,
  startDate,
  allowOpen,
  onPickDate,
}: PeriodEndChoiceProps) {
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();

  const choices: { kind: PeriodEndKind; label: string }[] = [
    ...(allowOpen ? [{ kind: 'open' as const, label: t('cycle.end.open') }] : []),
    { kind: 'logged', label: t('cycle.end.onDate') },
    { kind: 'unknown', label: t('cycle.end.unknown') },
    {
      kind: 'estimated',
      label: t('cycle.end.usualLength', {
        count: usualDuration,
        days: formatInteger(usualDuration),
      }),
    },
  ];

  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-text-primary">{t('cycle.end.title')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {choices.map((choice) => (
          <Chip
            key={choice.kind}
            label={choice.label}
            selected={value.kind === choice.kind}
            onPress={() => onChange({ kind: choice.kind, date: value.date })}
          />
        ))}
      </View>
      {value.kind === 'logged' ? (
        <DatePickerInput
          label={t('cycle.periodLog.endDateLabel')}
          selectedDate={localCalendarDayDate(new Date(value.date ?? startDate))}
          onPress={onPickDate}
        />
      ) : null}
      {value.kind === 'estimated' ? (
        <Text className="text-xs text-text-tertiary">{t('cycle.end.estimatedHint')}</Text>
      ) : null}
      {value.kind === 'unknown' ? (
        <Text className="text-xs text-text-tertiary">{t('cycle.end.unknownHint')}</Text>
      ) : null}
    </View>
  );
}
