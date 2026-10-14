import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput as RNTextInput, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MoodSelectorCard } from '@/components/cards/MoodSelectorCard';
import { CycleObservationInputs } from '@/components/cycle/CycleObservationInputs';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import {
  BLEEDING_LABEL_KEYS,
  EMOTIONAL_SYMPTOM_KEYS,
  PHYSICAL_SYMPTOM_KEYS,
  SEVERITY_LABEL_KEYS,
} from '@/constants/cycle';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useStartPeriodPrompt } from '@/hooks/useStartPeriodPrompt';
import { useTheme } from '@/hooks/useTheme';
import { localCalendarDayDate } from '@/utils/calendarDate';
import {
  blankDayLog,
  BLEEDING_LEVELS,
  parseQuickLog,
  stepSymptom,
  withNoSymptoms,
} from '@/utils/cycle/dayLog';
import { loadDayMood } from '@/utils/cycle/dayMood';
import {
  type ObservationDraft,
  observationDraft,
  resolveObservationDraft,
} from '@/utils/cycle/observationDraft';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';
import type { BleedingLevel, DaySymptom } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

type CycleDaySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Local midnight ms of the day being logged. */
  day: number;
};

const PAIN_VALUES = Array.from({ length: 11 }, (_, i) => i);
const ENERGY_VALUES = [1, 2, 3, 4, 5];

/**
 * Everything about one day in one place: bleeding, symptoms with severity, pain, energy, mood and
 * a note. "No symptoms today" is a real answer, kept distinct from not having logged at all, and
 * emptying the form and saving removes the record rather than leaving the old one behind.
 */
export function CycleDaySheet({ visible, onClose, day }: CycleDaySheetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { cycleQuickLogRaw } = useSettings();
  const { dayLogs, saveDayLog, guidance, config } = useMenstrualCycle();
  const promptStartPeriod = useStartPeriodPrompt();

  const [bleeding, setBleeding] = useState<BleedingLevel | null>(null);
  const [symptoms, setSymptoms] = useState<DaySymptom[]>([]);
  const [noSymptoms, setNoSymptoms] = useState(false);
  const [pain, setPain] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);
  const [moodError, setMoodError] = useState(false);
  const [observations, setObservations] = useState<ObservationDraft>({});
  const [moodTouched, setMoodTouched] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const existing = dayLogs.find((log) => log.date === day);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const log = existing ?? { ...blankDayLog(day) };
      setBleeding(log.bleeding);
      setSymptoms(log.symptoms);
      setNoSymptoms(log.noSymptoms);
      setPain(log.pain);
      setEnergy(log.energy);
      setNote(log.note);
      setMoodTouched(false);
      setMood(null);
      setMoodLoading(true);
      setMoodError(false);
      setObservations(observationDraft(log.observations));
      setShowAll(false);
      void loadDayMood(localCalendarDayDate(new Date(day)))
        .then((m) => {
          if (!cancelled) {
            setMood(m?.value ?? null);
            setMoodLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMoodLoading(false);
            setMoodError(true);
          }
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // Reloaded when the sheet opens or the day changes, not when other days' logs update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, day]);

  const pinned = config.quickLog ?? parseQuickLog(cycleQuickLogRaw);
  const allOptions = [
    ...PHYSICAL_SYMPTOM_KEYS,
    ...EMOTIONAL_SYMPTOM_KEYS,
    ...(config.customSymptoms ?? []).map((name) => ({ key: '', value: `custom:${name}` })),
  ];
  const pinnedOptions = allOptions.filter((o) => pinned.includes(o.value));
  // Pinned symptoms first; a person with none pinned still sees a short starter list.
  let visibleOptions = pinnedOptions.length > 0 ? pinnedOptions : allOptions.slice(0, 8);
  if (showAll) {
    visibleOptions = allOptions;
  }

  const dateLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(day);

  const symptomLabel = (key: string, labelKey: string) => {
    const current = symptoms.find((s) => s.key === key);
    const severity = current?.severity ? ` · ${t(SEVERITY_LABEL_KEYS[current.severity])}` : '';

    return `${labelKey ? t(labelKey) : cycleSymptomLabel(key, t)}${severity}`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let resolved;
      try {
        resolved = resolveObservationDraft(observations, config, existing?.observations);
      } catch {
        handleError(new Error('invalid_observations'), 'CycleDaySheet.validation', {
          sendToSentry: false,
          snackbarMessage: t('cycle.personalize.invalidObservation'),
        });
        return;
      }

      await saveDayLog(
        { date: day, bleeding, symptoms, noSymptoms, pain, energy, note, observations: resolved },
        moodTouched ? mood : undefined
      );

      promptStartPeriod(day, bleeding);

      onClose();
    } catch (error) {
      handleError(error, 'CycleDaySheet.save', {
        sendToSentry: false,
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      await saveDayLog({ ...blankDayLog(day) }, null);
      onClose();
    } catch (error) {
      handleError(error, 'CycleDaySheet.clear', {
        snackbarMessage: t('errors.somethingWentWrong'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  let moodStatus = '';
  if (moodLoading) {
    moodStatus = t('cycle.personalize.loadingMood');
  } else if (mood == null) {
    moodStatus = t('cycle.personalize.moodUnlogged');
  }

  return (
    <BottomPopUp
      visible={visible}
      onClose={onClose}
      title={t('cycle.daySheet.title')}
      subtitle={dateLabel}
      footer={
        <View className="flex-row gap-4">
          <Button label={t('common.cancel')} onPress={onClose} variant="outline" width="flex-1" />
          <Button
            label={t('common.save')}
            onPress={handleSave}
            variant="accent"
            width="flex-1"
            loading={isSaving}
            disabled={moodLoading || moodError}
          />
        </View>
      }
    >
      <View className="gap-6 pb-4">
        {
          <View className="gap-2">
            <Text className="text-base font-bold text-text-primary">
              {t(
                guidance.hidePeriodActions
                  ? 'cycle.personalize.unexpectedBleeding'
                  : 'cycle.flowIntensity'
              )}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {BLEEDING_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={t(BLEEDING_LABEL_KEYS[level])}
                  selected={bleeding === level}
                  onPress={() => setBleeding(bleeding === level ? null : level)}
                />
              ))}
            </View>
          </View>
        }

        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">{t('cycle.symptomsTitle')}</Text>
          <Text className="text-xs text-text-tertiary">{t('cycle.daySheet.severityHint')}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('cycle.daySheet.noSymptoms')}
              selected={noSymptoms}
              role="checkbox"
              onPress={() => {
                const next = withNoSymptoms({ symptoms, noSymptoms }, !noSymptoms);
                setSymptoms(next.symptoms);
                setNoSymptoms(next.noSymptoms);
              }}
            />
            {visibleOptions.map((option) => (
              <Chip
                key={option.value}
                label={symptomLabel(option.value, option.key)}
                selected={symptoms.some((s) => s.key === option.value)}
                role="checkbox"
                onPress={() => {
                  setSymptoms(stepSymptom(symptoms, option.value));
                  setNoSymptoms(false);
                }}
              />
            ))}
          </View>
          <TextButton
            label={showAll ? t('cycle.daySheet.fewerSymptoms') : t('cycle.daySheet.moreSymptoms')}
            onPress={() => setShowAll(!showAll)}
          />
        </View>

        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">{t('cycle.daySheet.pain')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAIN_VALUES.map((value) => (
              <Chip
                key={value}
                label={String(value)}
                selected={pain === value}
                onPress={() => setPain(pain === value ? null : value)}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">
            {t('cycle.daySheet.energy')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {ENERGY_VALUES.map((value) => (
              <Chip
                key={value}
                label={t(`cycle.daySheet.energyLevel.${value}`)}
                selected={energy === value}
                onPress={() => setEnergy(energy === value ? null : value)}
              />
            ))}
          </View>
        </View>

        <Text className="text-xs text-text-secondary">{t('cycle.personalize.sharedMoodHint')}</Text>
        {moodError ? (
          <Text className="text-sm text-text-secondary">{t('errors.somethingWentWrong')}</Text>
        ) : null}
        <Text className="text-xs text-text-secondary">{moodStatus}</Text>
        <MoodSelectorCard
          disabled={moodLoading || moodError || isSaving}
          value={mood ?? -1}
          onChange={(value) => {
            setMood(value);
            setMoodTouched(true);
          }}
        />

        {mood != null ? (
          <TextButton
            label={t('cycle.personalize.clearMood')}
            onPress={() => {
              setMood(null);
              setMoodTouched(true);
            }}
          />
        ) : null}
        {(existing?.observations?.health ?? []).map((observation) => (
          <Text
            key={`${observation.source}:${observation.id}`}
            className="text-xs text-text-secondary"
          >
            {t('cycle.complete.importedValue', {
              source: observation.source === 'healthkit' ? 'Apple Health' : 'Health Connect',
              value:
                observation.kind === 'bleeding'
                  ? t(`cycle.calendar.bleeding.${observation.value}`)
                  : new Intl.NumberFormat(i18n.resolvedLanguage ?? i18n.language, {
                      maximumFractionDigits: 2,
                    }).format(Number(observation.value)) + ' °C',
            })}
          </Text>
        ))}
        <CycleObservationInputs config={config} value={observations} onChange={setObservations} />
        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">{t('cycle.daySheet.note')}</Text>
          <RNTextInput
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={500}
            placeholder={t('cycle.daySheet.notePlaceholder')}
            placeholderTextColor={theme.colors.text.tertiary}
            accessibilityLabel={t('cycle.daySheet.note')}
            style={{
              minHeight: 72,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.colors.border.default,
              padding: 12,
              color: theme.colors.text.primary,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {existing || mood != null ? (
          <TextButton
            label={t('cycle.personalize.clearDayAndMood')}
            tone="danger"
            onPress={() => void handleClear()}
          />
        ) : null}
      </View>
    </BottomPopUp>
  );
}
