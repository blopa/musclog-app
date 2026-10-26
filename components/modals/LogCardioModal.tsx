import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FilterTabs } from '@/components/FilterTabs';
import { Button } from '@/components/theme/Button';
import { StepperInput } from '@/components/theme/StepperInput';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { CARDIO_ACTIVITY_LABEL_KEYS } from '@/components/workout/restrictionLabelKeys';
import { useSnackbar } from '@/context/SnackbarContext';
import { CardioLogService } from '@/database/services/CardioLogService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { combineLocalDateAndTime } from '@/utils/calendarDate';
import { buildCardioDraft } from '@/utils/cardioDraft';
import { type CardioActivity, estimateCardioKcal } from '@/utils/cardioEnergy';
import { formatPace } from '@/utils/cardioFormat';
import { handleError } from '@/utils/handleError';
import { getDistanceUnitLabel } from '@/utils/unitConversion';

import { DatePickerInput } from './DatePickerInput';
import { DatePickerModal } from './DatePickerModal';
import { FullScreenModal } from './FullScreenModal';
import { TimePickerInput } from './TimePickerInput';
import { TimePickerModal } from './TimePickerModal';

type LogCardioModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Called after the log is saved, so the host can refresh whatever lists workouts. */
  onLogged?: () => void;
};

const DEFAULT_DISTANCE = 5;
const DEFAULT_MINUTES = 30;
const DISTANCE_STEP = 0.5;
const MINUTE_STEP = 5;
const MAX_WATCH_CALORIES = 20000;

/**
 * Logs a finished walk or run in a few taps: no session, no sets. The form holds display values
 * (km or mi); `buildCardioDraft` turns them into the metres and seconds the service stores, and the
 * pace and calorie preview are computed from that same draft, so what the user sees is what is saved.
 *
 * The host mounts this only while it is open, so every open starts from the defaults.
 */
export function LogCardioModal({ visible, onClose, onLogged }: LogCardioModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { units } = useSettings();
  const { locale } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();

  const [activity, setActivity] = useState<CardioActivity>('run');
  const [treadmill, setTreadmill] = useState(false);
  const [distance, setDistance] = useState(DEFAULT_DISTANCE);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [watchCalories, setWatchCalories] = useState(0);
  // Lazy initialisers: render must be pure, so "now" is read once, not on every render.
  const [endedDate, setEndedDate] = useState(() => new Date());
  const [endedTime, setEndedTime] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bodyMassKg, setBodyMassKg] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    UserMetricService.getUserBodyWeightKgForVolume()
      .then((kg) => {
        if (!cancelled) {
          setBodyMassKg(kg);
        }
      })
      .catch(() => {
        // Without a weight the estimate is simply unavailable; the log can still be saved.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const draft = useMemo(
    () => buildCardioDraft({ distance, hours, minutes, seconds, units }),
    [distance, hours, minutes, seconds, units]
  );
  const pace = draft.isValid ? formatPace(locale, draft.distanceM, draft.durationS, units) : null;
  const estimatedKcal = useMemo(
    () =>
      draft.isValid
        ? estimateCardioKcal({
            activity,
            distanceM: draft.distanceM,
            durationS: draft.durationS,
            bodyMassKg,
          })
        : 0,
    [activity, bodyMassKg, draft]
  );

  const handleSave = async () => {
    if (!draft.isValid) {
      setError(t('cardio.needsDistanceAndTime'));
      return;
    }

    const endedAt = combineLocalDateAndTime(endedDate, endedTime).getTime();
    if (endedAt > Date.now()) {
      setError(t('cardio.futureError'));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await CardioLogService.logCardioSession({
        activity,
        distanceM: draft.distanceM,
        durationS: draft.durationS,
        endedAt,
        workoutName: t(CARDIO_ACTIVITY_LABEL_KEYS[activity]),
        treadmill,
        caloriesOverride: watchCalories > 0 ? watchCalories : undefined,
      });
      showSnackbar(
        'success',
        t('cardio.saved', { activity: t(CARDIO_ACTIVITY_LABEL_KEYS[activity]) })
      );
      onLogged?.();
      onClose();
    } catch (err) {
      handleError(err, 'LogCardioModal.handleSave');
      setError(t('cardio.failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const unitLabel = getDistanceUnitLabel(units);

  const footer = (
    <Button
      label={t('cardio.save')}
      variant="gradientCta"
      size="md"
      width="full"
      icon={Check}
      onPress={handleSave}
      loading={isSaving}
      disabled={isSaving || !draft.isValid}
    />
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('cardio.title')}
      subtitle={t('cardio.subtitle')}
      footer={footer}
      scrollable
      closable={!isSaving}
    >
      <View className="mb-6 mt-6 gap-6 px-4" testID="log-cardio-form">
        <View>
          <Text
            className="mb-3 text-xs font-semibold"
            style={{ color: theme.colors.text.secondary }}
          >
            {t('cardio.activity')}
          </Text>
          <FilterTabs
            tabs={[
              { id: 'walk', label: t('cardio.walk') },
              { id: 'run', label: t('cardio.run') },
            ]}
            activeTab={activity}
            onTabChange={(id) => setActivity(id as CardioActivity)}
            showContainer={false}
            scrollViewContentContainerStyle={{ paddingHorizontal: theme.spacing.padding.zero }}
          />
        </View>

        <ToggleInput
          items={[
            {
              key: 'treadmill',
              label: t('cardio.treadmill'),
              value: treadmill,
              onValueChange: setTreadmill,
            },
          ]}
        />

        <StepperInput
          label={t('cardio.distanceInput', { unit: unitLabel })}
          value={distance}
          unit={unitLabel}
          step={DISTANCE_STEP}
          maxFractionDigits={2}
          onChangeValue={(value) => setDistance(Math.max(0, value))}
          onIncrement={() =>
            setDistance((value) => Math.round((value + DISTANCE_STEP) * 100) / 100)
          }
          onDecrement={() =>
            setDistance((value) => Math.max(0, Math.round((value - DISTANCE_STEP) * 100) / 100))
          }
        />

        <View className="gap-4">
          <Text className="text-xs font-semibold" style={{ color: theme.colors.text.secondary }}>
            {t('cardio.duration')}
          </Text>
          <StepperInput
            label={t('cardio.hours')}
            value={hours}
            maxFractionDigits={0}
            onChangeValue={(value) => setHours(Math.max(0, Math.round(value)))}
            onIncrement={() => setHours((value) => value + 1)}
            onDecrement={() => setHours((value) => Math.max(0, value - 1))}
          />
          <StepperInput
            label={t('cardio.minutes')}
            value={minutes}
            maxFractionDigits={0}
            step={MINUTE_STEP}
            onChangeValue={(value) => setMinutes(Math.max(0, Math.round(value)))}
            onIncrement={() => setMinutes((value) => value + MINUTE_STEP)}
            onDecrement={() => setMinutes((value) => Math.max(0, value - MINUTE_STEP))}
          />
          <StepperInput
            label={t('cardio.seconds')}
            value={seconds}
            maxFractionDigits={0}
            onChangeValue={(value) => setSeconds(Math.max(0, Math.round(value)))}
            onIncrement={() => setSeconds((value) => value + 1)}
            onDecrement={() => setSeconds((value) => Math.max(0, value - 1))}
          />
        </View>

        <View className="gap-3">
          <DatePickerInput
            selectedDate={endedDate}
            onPress={() => setShowDatePicker(true)}
            label={t('cardio.ended')}
            variant="default"
          />
          <TimePickerInput
            selectedTime={endedTime}
            onPress={() => setShowTimePicker(true)}
            hideLabel
            variant="default"
          />
        </View>

        <View
          className="gap-2 rounded-card p-4"
          style={{ backgroundColor: theme.colors.background.ink5 }}
          testID="cardio-preview"
        >
          <View className="flex-row justify-between">
            <Text style={{ color: theme.colors.text.secondary }}>{t('cardio.pace')}</Text>
            <Text className="font-bold" style={{ color: theme.colors.text.primary }}>
              {pace ?? t('cardio.noPace')}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text style={{ color: theme.colors.text.secondary }}>{t('cardio.estimate')}</Text>
            <Text className="font-bold" style={{ color: theme.colors.text.primary }}>
              {estimatedKcal > 0
                ? t('cardio.estimateValue', { kcal: estimatedKcal })
                : t('cardio.noPace')}
            </Text>
          </View>
          <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            {bodyMassKg > 0 ? t('cardio.estimateHint') : t('cardio.estimateNoWeight')}
          </Text>
        </View>

        <View className="gap-1">
          <StepperInput
            label={t('cardio.watchCalories')}
            value={watchCalories}
            maxFractionDigits={0}
            step={10}
            onChangeValue={(value) =>
              setWatchCalories(Math.min(MAX_WATCH_CALORIES, Math.max(0, Math.round(value))))
            }
            onIncrement={() =>
              setWatchCalories((value) => Math.min(MAX_WATCH_CALORIES, value + 10))
            }
            onDecrement={() => setWatchCalories((value) => Math.max(0, value - 10))}
          />
          <Text className="text-xs" style={{ color: theme.colors.text.tertiary }}>
            {t('cardio.watchHint')}
          </Text>
        </View>

        {error ? (
          <Text className="text-sm" style={{ color: theme.colors.status.error }}>
            {error}
          </Text>
        ) : null}
      </View>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={endedDate}
        onDateSelect={(date) => {
          setEndedDate(date);
          setShowDatePicker(false);
        }}
      />
      <TimePickerModal
        visible={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        selectedTime={endedTime}
        title={t('cardio.ended')}
        onTimeSelect={(time) => {
          setEndedTime(time);
          setShowTimePicker(false);
        }}
      />
    </FullScreenModal>
  );
}
