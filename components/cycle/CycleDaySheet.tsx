import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { MoodSelectorCard } from '@/components/cards/MoodSelectorCard';
import { CycleObservationInputs } from '@/components/cycle/CycleObservationInputs';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { TextInput } from '@/components/theme/TextInput';
import {
  BLEEDING_LABEL_KEYS,
  EMOTIONAL_SYMPTOM_KEYS,
  ENERGY_LEVEL_LABEL_KEYS,
  type EnergyLevel,
  PHYSICAL_SYMPTOM_KEYS,
  SEVERITY_LABEL_KEYS,
} from '@/constants/cycle';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useStartPeriodPrompt } from '@/hooks/useStartPeriodPrompt';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import {
  blankDayLog,
  BLEEDING_LEVELS,
  parseQuickLog,
  setSymptomSeverity,
  toggleSymptom,
  withNoSymptoms,
} from '@/utils/cycle/dayLog';
import {
  type ObservationDraft,
  observationDraft,
  resolveObservationDraft,
} from '@/utils/cycle/observationDraft';
import { cycleSymptomLabel } from '@/utils/cycle/preferences';
import type { CycleDayLogDto, SymptomSeverity } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';
import { celsiusToDisplay, getTemperatureUnitLabel } from '@/utils/unitConversion';

type CycleDaySheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Local midnight ms of the day being logged. */
  day: number;
};

const PAIN_VALUES = Array.from({ length: 11 }, (_, i) => i);
const ENERGY_VALUES: EnergyLevel[] = [1, 2, 3, 4, 5];
const SEVERITIES: SymptomSeverity[] = [1, 2, 3];
const NOTE_MAX_LENGTH = 500;

type Draft = Omit<CycleDayLogDto, 'id' | 'timezone' | 'observations'> & {
  observations: ObservationDraft;
  /** Null = no mood that day. Only written back when `moodTouched`. */
  mood: number | null;
  moodTouched: boolean;
  showAllSymptoms: boolean;
};

/**
 * Everything about one day in one place: bleeding, symptoms with an optional severity, pain,
 * energy, mood and a note. "No symptoms today" is a real answer, kept distinct from not having
 * logged at all, and emptying the form and saving removes the record rather than leaving the old
 * one behind.
 */
export function CycleDaySheet({ visible, onClose, day }: CycleDaySheetProps) {
  const { t, i18n } = useTranslation();
  const { formatDecimal } = useFormatAppNumber();
  const { cycleQuickLogRaw, units } = useSettings();
  const { dayLogs, moods, moodsLoading, moodsError, saveDayLog, guidance, config } =
    useMenstrualCycle();
  const promptStartPeriod = useStartPeriodPrompt();
  const existing = dayLogs.find((log) => log.date === day);

  const draftFor = (): Draft => {
    const log = existing ?? blankDayLog(day);

    return {
      ...log,
      observations: observationDraft(log.observations, units),
      mood: moods.find((m) => m.date === day)?.value ?? null,
      moodTouched: false,
      showAllSymptoms: false,
    };
  };

  // The form is a snapshot taken when the sheet opens (or moves to another day), not a
  // subscription: a database emission while typing must not overwrite the draft. Adjusting state
  // during render is React's sanctioned way to reset on a prop change, without an effect.
  const [session, setSession] = useState<{ day: number; open: boolean }>({ day, open: false });
  const [draft, setDraft] = useState<Draft>(draftFor);
  if (visible && (!session.open || session.day !== day)) {
    setSession({ day, open: true });
    setDraft(draftFor());
  } else if (!visible && session.open) {
    setSession({ day, open: false });
  }

  // Mood arrives with the cycle data; until it has, the field takes the loaded value as long as
  // the person has not chosen one themselves.
  const loadedMood = moods.find((m) => m.date === day)?.value ?? null;
  if (!draft.moodTouched && !moodsLoading && draft.mood !== loadedMood) {
    setDraft({ ...draft, mood: loadedMood });
  }

  const [isSaving, setIsSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useSubModalVisibility(visible);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const pinned = config.quickLog ?? parseQuickLog(cycleQuickLogRaw);
  const allOptions = [
    ...PHYSICAL_SYMPTOM_KEYS,
    ...EMOTIONAL_SYMPTOM_KEYS,
    ...(config.customSymptoms ?? []).map((name) => ({ key: '', value: `custom:${name}` })),
  ];
  const pinnedOptions = allOptions.filter((o) => pinned.includes(o.value));
  // Pinned symptoms first; a person with none pinned still sees a short starter list. A symptom
  // already logged stays visible however the list is narrowed.
  const shortList = pinnedOptions.length > 0 ? pinnedOptions : allOptions.slice(0, 8);
  const visibleOptions = draft.showAllSymptoms
    ? allOptions
    : allOptions.filter(
        (o) => shortList.includes(o) || draft.symptoms.some((s) => s.key === o.value)
      );
  const labelFor = (value: string, labelKey: string) =>
    labelKey ? t(labelKey) : cycleSymptomLabel(value, t);

  const dateLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(day);

  const handleSave = async () => {
    let observations;
    try {
      observations = resolveObservationDraft(
        draft.observations,
        config,
        existing?.observations,
        units
      );
    } catch {
      handleError(new Error('invalid_observations'), 'CycleDaySheet.validation', {
        sendToSentry: false,
        snackbarMessage: t('cycle.personalize.invalidObservation'),
      });
      return;
    }

    setIsSaving(true);
    try {
      const { bleeding, symptoms, noSymptoms, pain, energy, note } = draft;
      // An untouched mood is left alone (undefined), so a mood that failed to load can never be
      // overwritten and never stops the rest of the day from saving.
      await saveDayLog(
        { date: day, bleeding, symptoms, noSymptoms, pain, energy, note, observations },
        draft.moodTouched ? draft.mood : undefined
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
    setConfirmClear(false);
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

  let moodHint = t('cycle.personalize.sharedMoodHint');
  if (moodsError) {
    moodHint = t('cycle.daySheet.moodUnavailable');
  } else if (moodsLoading) {
    moodHint = t('cycle.personalize.loadingMood');
  }

  const ratedSymptoms = draft.symptoms;

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
            onPress={() => void handleSave()}
            variant="accent"
            width="flex-1"
            loading={isSaving}
          />
        </View>
      }
    >
      <View className="gap-6 pb-4">
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
                selected={draft.bleeding === level}
                onPress={() => update({ bleeding: draft.bleeding === level ? null : level })}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">{t('cycle.symptomsTitle')}</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('cycle.daySheet.noSymptoms')}
              selected={draft.noSymptoms}
              role="checkbox"
              onPress={() => update(withNoSymptoms(draft, !draft.noSymptoms))}
            />
            {visibleOptions.map((option) => (
              <Chip
                key={option.value}
                label={labelFor(option.value, option.key)}
                selected={draft.symptoms.some((s) => s.key === option.value)}
                role="checkbox"
                onPress={() =>
                  update({
                    symptoms: toggleSymptom(draft.symptoms, option.value),
                    noSymptoms: false,
                  })
                }
              />
            ))}
          </View>
          <TextButton
            label={
              draft.showAllSymptoms
                ? t('cycle.daySheet.fewerSymptoms')
                : t('cycle.daySheet.moreSymptoms')
            }
            onPress={() => update({ showAllSymptoms: !draft.showAllSymptoms })}
          />
          {ratedSymptoms.length > 0 ? (
            <View className="gap-3 rounded-xl bg-bg-overlay p-3">
              <Text className="text-xs text-text-secondary">
                {t('cycle.daySheet.severityOptional')}
              </Text>
              {ratedSymptoms.map((symptom) => {
                const option = allOptions.find((o) => o.value === symptom.key);
                return (
                  <View key={symptom.key} className="gap-2">
                    <Text className="text-sm font-semibold text-text-primary">
                      {labelFor(symptom.key, option?.key ?? '')}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {SEVERITIES.map((severity) => (
                        <Chip
                          key={severity}
                          label={t(SEVERITY_LABEL_KEYS[severity])}
                          selected={symptom.severity === severity}
                          onPress={() =>
                            update({
                              symptoms: setSymptomSeverity(draft.symptoms, symptom.key, severity),
                            })
                          }
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-base font-bold text-text-primary">{t('cycle.daySheet.pain')}</Text>
          <Text className="text-xs text-text-secondary">{t('cycle.daySheet.painScale')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAIN_VALUES.map((value) => (
              <Chip
                key={value}
                label={String(value)}
                selected={draft.pain === value}
                onPress={() => update({ pain: draft.pain === value ? null : value })}
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
                label={t(ENERGY_LEVEL_LABEL_KEYS[value])}
                selected={draft.energy === value}
                onPress={() => update({ energy: draft.energy === value ? null : value })}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-xs text-text-secondary">{moodHint}</Text>
          <MoodSelectorCard
            disabled={moodsLoading || moodsError || isSaving}
            value={draft.mood ?? -1}
            onChange={(value) => update({ mood: value, moodTouched: true })}
          />
          {draft.mood != null && !moodsError ? (
            <TextButton
              label={t('cycle.personalize.clearMood')}
              onPress={() => update({ mood: null, moodTouched: true })}
            />
          ) : null}
        </View>

        {(existing?.observations?.health ?? []).map((observation) => (
          <Text
            key={`${observation.source}:${observation.id}`}
            className="text-xs text-text-secondary"
          >
            {t('cycle.complete.importedValue', {
              source: observation.source === 'healthkit' ? 'Apple Health' : 'Health Connect',
              value:
                observation.kind === 'bleeding'
                  ? t(BLEEDING_LABEL_KEYS[observation.value as keyof typeof BLEEDING_LABEL_KEYS])
                  : `${formatDecimal(celsiusToDisplay(Number(observation.value), units), 2)} ${getTemperatureUnitLabel(units)}`,
            })}
          </Text>
        ))}
        <CycleObservationInputs
          config={config}
          value={draft.observations}
          onChange={(observations) => update({ observations })}
        />
        <TextInput
          label={t('cycle.daySheet.note')}
          value={draft.note}
          onChangeText={(note) => update({ note })}
          placeholder={t('cycle.daySheet.notePlaceholder')}
          multiline
          numberOfLines={3}
          maxLength={NOTE_MAX_LENGTH}
          selectTextOnFocus={false}
        />

        {existing || loadedMood != null ? (
          <TextButton
            label={t('cycle.personalize.clearDayAndMood')}
            tone="danger"
            onPress={() => setConfirmClear(true)}
          />
        ) : null}
      </View>

      <ConfirmationModal
        visible={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void handleClear()}
        title={t('cycle.daySheet.clearTitle')}
        message={t('cycle.daySheet.clearMessage')}
        confirmLabel={t('cycle.daySheet.clearConfirm')}
        variant="destructive"
      />
    </BottomPopUp>
  );
}
