import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { NumericTextField } from '@/components/theme/NumericTextField';
import { SegmentedControl } from '@/components/theme/SegmentedControl';
import { UserMetricService } from '@/database/services/UserMetricService';
import { useSettings } from '@/hooks/useSettings';
import {
  localCalendarDayDate,
  localCalendarDayPlusDays,
  localDayStartMs,
} from '@/utils/calendarDate';
import { handleError } from '@/utils/handleError';
import { getDecimalSeparator, parseStrictLocalizedNumber } from '@/utils/localizedDecimalInput';
import { showSnackbar } from '@/utils/snackbarService';
import { getCurrentTimezone } from '@/utils/timezone';
import { displayToKg, kgToDisplay } from '@/utils/unitConversion';
import { getWeightUnitI18nKey } from '@/utils/units';
import type { VoiceAction } from '@/utils/voiceCommand/types';

export type VoiceWeighIn = Extract<VoiceAction, { kind: 'logWeight' }>;

type VoiceWeightSheetProps = {
  weighIn: VoiceWeighIn;
  /** Closed; `saved` says whether the weight was written. */
  onClose: (saved: boolean) => void;
};

/**
 * The confirmation of a spoken weigh-in: the weight, in the person's unit, and the day, both
 * editable, and a button that writes exactly one weight entry. Mounted only while a weigh-in waits.
 */
export function VoiceWeightSheet({ weighIn, onClose }: VoiceWeightSheetProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const { units } = useSettings();
  const separator = getDecimalSeparator(locale);
  const [draft, setDraft] = useState(() =>
    weighIn.weightKg === null
      ? ''
      : new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 }).format(
          kgToDisplay(weighIn.weightKg, units)
        )
  );
  const today = localCalendarDayDate(new Date());
  // The day said, and today and yesterday to choose between when it was one of them.
  const days = [today, localCalendarDayPlusDays(today, -1)];
  if (!days.some((day) => day.getTime() === weighIn.day.getTime())) {
    days.push(weighIn.day);
  }

  const [dayTime, setDayTime] = useState(() => weighIn.day.getTime());
  const [isSaving, setIsSaving] = useState(false);
  const value = parseStrictLocalizedNumber(draft, separator);
  const isValid = value !== null && value > 0;
  // An empty field is not an error yet: only a typed value that cannot be saved is outlined.
  const isInvalid = draft !== '' && !isValid;

  const dayLabel = (day: Date) => {
    if (day.getTime() === today.getTime()) {
      return t('common.today');
    }

    if (day.getTime() === days[1].getTime()) {
      return t('common.yesterday');
    }

    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(day);
  };

  const save = async () => {
    if (!isValid) {
      return;
    }

    setIsSaving(true);
    try {
      await UserMetricService.createMetric({
        type: 'weight',
        value: displayToKg(value, units),
        unit: 'kg',
        date: localDayStartMs(new Date(dayTime)),
        timezone: getCurrentTimezone(),
      });
      showSnackbar('success', t('voiceInput.command.weight.saved'));
      onClose(true);
    } catch (error) {
      await handleError(error, 'VoiceWeightSheet.save', {
        snackbarMessage: t('voiceInput.command.weight.saveError'),
      });
      setIsSaving(false);
    }
  };

  return (
    <BottomPopUp
      visible
      onClose={() => onClose(false)}
      title={t('voiceInput.command.weight.title')}
      footer={
        <Button
          label={t('common.save')}
          variant="gradientCta"
          size="md"
          width="full"
          disabled={!isValid || isSaving}
          loading={isSaving}
          onPress={() => void save()}
        />
      }
    >
      <View className="gap-4">
        <View className="flex-row items-center gap-3">
          <View className="min-w-0 flex-1">
            <NumericTextField
              size="hero"
              value={draft}
              onChangeText={setDraft}
              accessibilityLabel={t('voiceInput.command.weight.field')}
              placeholder={t('voiceInput.command.weight.field')}
              invalid={isInvalid}
              surface
            />
          </View>
          <Text className="shrink-0 text-xl font-semibold text-text-secondary">
            {t(getWeightUnitI18nKey(units))}
          </Text>
        </View>
        <SegmentedControl
          variant="pill"
          fullWidth
          options={days.map((day) => ({ value: String(day.getTime()), label: dayLabel(day) }))}
          value={String(dayTime)}
          onValueChange={(next) => setDayTime(Number(next))}
        />
      </View>
    </BottomPopUp>
  );
}
