import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { TextButton } from '@/components/theme/TextButton';
import { isUnderMinimumAppAge, MINIMUM_APP_AGE } from '@/utils/ageGate';

type BirthdayNotesProps = {
  birthday: Date | null;
  onClear: () => void;
};

/**
 * What goes under a birthday field once it is filled in: the app's age when the person is younger
 * (they are told, nothing is blocked) and the way to remove an answer that is optional.
 */
export function BirthdayNotes({ birthday, onClear }: BirthdayNotesProps) {
  const { t } = useTranslation();

  if (!birthday) {
    return null;
  }

  return (
    <>
      {isUnderMinimumAppAge(birthday) ? (
        <Text accessibilityRole="alert" className="text-sm text-status-warning">
          {t('common.ageGate.minimumApp', { age: MINIMUM_APP_AGE })}
        </Text>
      ) : null}
      <TextButton label={t('common.clear')} tone="muted" onPress={onClear} />
    </>
  );
}
