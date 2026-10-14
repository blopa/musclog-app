import { BellOff, BellRing } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch, Text, View } from 'react-native';

import { DatePickerInput } from '@/components/modals/DatePickerInput';
import { DatePickerModal } from '@/components/modals/DatePickerModal';
import { TimePickerInput } from '@/components/modals/TimePickerInput';
import { TimePickerModal } from '@/components/modals/TimePickerModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { StepperInput } from '@/components/theme/StepperInput';
import { TextButton } from '@/components/theme/TextButton';
import { CYCLE_NOTIFICATION_STYLES, type CycleNotificationStyle } from '@/constants/settings';
import { useSnackbar } from '@/context/SnackbarContext';
import { SettingsService } from '@/database/services/SettingsService';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalState } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import {
  type CycleDeliveryStatus,
  CycleNotificationService,
} from '@/services/CycleNotificationService';
import { getCycleBackupPreparedAt } from '@/services/cycleRecovery';
import { cycleReminderContent, REMINDER_LABEL_KEYS } from '@/utils/cycle/cycleReminderCopy';
import {
  CYCLE_REMINDER_BASIS,
  type CycleReminderKind,
  DEFAULT_CYCLE_REMINDERS,
  DEFAULT_PILL_SCHEDULE,
  isPaused,
  nextReminder,
  planCycleReminders,
} from '@/utils/cycle/cycleReminders';
import { addCalendarDays } from '@/utils/cycle/dates';
import type { CycleReminderPreferences, PillSchedule } from '@/utils/cycle/types';
import { handleError } from '@/utils/handleError';

const STYLE_LABEL_KEYS: Record<CycleNotificationStyle, string> = {
  discreet: 'cycle.reminders.style.private',
  subtle: 'cycle.reminders.style.subtle',
  detailed: 'cycle.reminders.style.detailed',
};

/** The toggled reminders, in settings order, with their "why / when / how often" contract. */
const TOGGLES: {
  kind: CycleReminderKind;
  pref: 'period' | 'due' | 'late' | 'fertility' | 'daily' | 'endCheck';
  labelKey: string;
  whenKey: string;
  oftenKey: string;
}[] = [
  {
    kind: 'period-start',
    pref: 'period',
    labelKey: 'cycle.reminders.periodStart.label',
    whenKey: 'cycle.reminders.periodStart.when',
    oftenKey: 'cycle.reminders.oncePerCycle',
  },
  {
    kind: 'period-due',
    pref: 'due',
    labelKey: 'cycle.reminders.periodDue.label',
    whenKey: 'cycle.reminders.periodDue.when',
    oftenKey: 'cycle.reminders.oncePerCycle',
  },
  {
    kind: 'period-late',
    pref: 'late',
    labelKey: 'cycle.reminders.periodLate.label',
    whenKey: 'cycle.reminders.periodLate.when',
    oftenKey: 'cycle.reminders.atMostOncePerCycle',
  },
  {
    kind: 'fertile-window',
    pref: 'fertility',
    labelKey: 'cycle.reminders.fertileWindow.label',
    whenKey: 'cycle.reminders.fertileWindow.when',
    oftenKey: 'cycle.reminders.oncePerCycle',
  },
  {
    kind: 'daily-log',
    pref: 'daily',
    labelKey: 'cycle.reminders.dailyLog.label',
    whenKey: 'cycle.reminders.dailyLog.when',
    oftenKey: 'cycle.reminders.daily',
  },
  {
    kind: 'end-check',
    pref: 'endCheck',
    labelKey: 'cycle.reminders.endCheck.label',
    whenKey: 'cycle.reminders.endCheck.when',
    oftenKey: 'cycle.reminders.oncePerPeriod',
  },
];

const BASIS_KEYS = {
  estimate: 'cycle.reminders.basis.estimate',
  routine: 'cycle.reminders.basis.routine',
} as const;

/** Pack shapes offered for the pill reminder: active days + pill-free days. */
const PILL_PATTERNS = [
  { activeDays: 21, breakDays: 7, labelKey: 'cycle.reminders.pill.pattern21' },
  { activeDays: 24, breakDays: 4, labelKey: 'cycle.reminders.pill.pattern24' },
  { activeDays: 28, breakDays: 0, labelKey: 'cycle.reminders.pill.continuous' },
] as const;

const PAUSES = [
  { days: 7, labelKey: 'cycle.reminders.pause.week' },
  { days: 30, labelKey: 'cycle.reminders.pause.month' },
  { days: null, labelKey: 'cycle.reminders.pause.indefinite' },
] as const;

type Picker = 'time' | 'pillTime' | 'packStart' | null;

const isPattern = (pill: PillSchedule, pattern: (typeof PILL_PATTERNS)[number]) =>
  pill.activeDays === pattern.activeDays && pill.breakDays === pattern.breakDays;

const atTime = (hour: number, minute: number) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};

function Row({ label, detail, children }: { label: string; detail: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold text-text-primary">{label}</Text>
        <Text className="text-xs text-text-secondary">{detail}</Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Cycle reminders as a contract the person can read: for each one, when it fires, how often, and
 * whether its date is an estimate or a time they chose; the exact lock-screen wording in the chosen
 * style; whether a reminder can actually arrive; a pause; and a test. Permission is asked here,
 * when a reminder is turned on, never at launch.
 */
export function CycleReminderSettings() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { formatInteger } = useFormatAppNumber();
  const { showSnackbar } = useSnackbar();
  const { cycleNotificationStyle, cycleShowFertility, notifications, notificationsMenstrualCycle } =
    useSettings();
  const { config, updateConfig, timeline, activePeriod, guidance } = useMenstrualCycle();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const prefs = { ...DEFAULT_CYCLE_REMINDERS, ...config.reminders };
  const [status, setStatus] = useState<CycleDeliveryStatus | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [picker, setPicker] = useSubModalState<Picker>(true, null);
  // When the settings were opened; the plan below is a preview, not a clock.
  const [now] = useState(() => Date.now());

  const refreshStatus = useCallback(() => {
    void CycleNotificationService.getCycleDeliveryStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(refreshStatus, [refreshStatus, notifications, notificationsMenstrualCycle]);
  useEffect(() => {
    void getCycleBackupPreparedAt()
      .then(setLastBackup)
      .catch(() => undefined);
  }, []);

  const deliverable =
    status != null && status.permission === 'granted' && status.appEnabled && status.cycleEnabled;

  const fail = (context: string) => (error: unknown) =>
    handleError(error, context, {
      sendToSentry: false,
      snackbarMessage: t('errors.somethingWentWrong'),
    });

  /** Turning a reminder on is the moment to ask for permission, not before. */
  const ensureDeliverable = async () => {
    if (Platform.OS === 'web' || deliverable) {
      return;
    }

    const granted = await CycleNotificationService.enableCycleReminders();
    if (!granted) {
      showSnackbar('error', t('cycle.reminders.status.permissionDenied'));
    }

    refreshStatus();
  };

  const save = (patch: Partial<CycleReminderPreferences>, turningOn = false) => {
    // TODO: avoid IIFE
    void (async () => {
      await updateConfig({ reminders: patch });
      if (turningOn) {
        await ensureDeliverable();
      }
    })().catch(fail('CycleReminderSettings.save'));
  };

  const setStyle = (style: CycleNotificationStyle) => {
    // TODO: avoid IIFE
    void (async () => {
      await SettingsService.setCycleNotificationStyle(style);
      await CycleNotificationService.scheduleMenstrualCycleNotifications();
    })().catch(fail('CycleReminderSettings.style'));
  };

  const time = (hour: number, minute: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
      atTime(hour, minute)
    );
  const longDate = (ms: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
    }).format(ms);

  const planned = planCycleReminders(timeline, now, {
    preferences: prefs,
    activePeriod,
    backupDays: config.backupReminderDays,
    lastBackup,
  });
  const upcoming = nextReminder(planned);
  const paused = isPaused(prefs, now);
  const pill: PillSchedule = prefs.pill ?? {
    ...DEFAULT_PILL_SCHEDULE,
    enabled: false,
    packStart: new Date().setHours(0, 0, 0, 0),
  };

  // The preview shows every reminder that is on; with none on, the period heads-up as an example.
  const fertilityAvailable = cycleShowFertility && guidance.fertilityMeaningful;
  const enabledKinds: CycleReminderKind[] = [
    ...TOGGLES.filter(
      (row) => prefs[row.pref] === true && (row.kind !== 'fertile-window' || fertilityAvailable)
    ).map((row) => row.kind),
    ...(pill.enabled ? (['pill'] as const) : []),
  ];
  const previewKinds = enabledKinds.length > 0 ? enabledKinds : (['period-start'] as const);
  const sampleRange = {
    from: timeline?.prediction.earliest ?? addCalendarDays(now, 12),
    to: timeline?.prediction.latest ?? addCalendarDays(now, 15),
  };

  // Each distinct text once: in the private style every reminder reads the same.
  const previews = [
    ...new Map(
      previewKinds
        .map((kind) =>
          cycleReminderContent(
            {
              kind,
              range:
                kind === 'fertile-window'
                  ? {
                      from: timeline?.fertileEstimate?.start ?? addCalendarDays(now, 10),
                      to: timeline?.fertileEstimate?.end ?? addCalendarDays(now, 16),
                    }
                  : sampleRange,
            },
            cycleNotificationStyle,
            t,
            locale
          )
        )
        .map((content) => [`${content.title}|${content.body}`, content] as const)
    ).values(),
  ];

  const pausedLine = prefs.pause?.until
    ? t('cycle.reminders.status.pausedUntil', {
        date: new Intl.DateTimeFormat(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(prefs.pause.until),
      })
    : t('cycle.reminders.status.paused');

  let statusLine: string;
  if (Platform.OS === 'web') {
    statusLine = t('cycle.reminders.status.web');
  } else if (status && status.permission !== 'granted') {
    statusLine = t('cycle.reminders.status.noPermission');
  } else if (status && (!status.appEnabled || !status.cycleEnabled)) {
    statusLine = t('cycle.reminders.status.switchedOff');
  } else if (paused) {
    statusLine = pausedLine;
  } else if (upcoming) {
    statusLine = t('cycle.reminders.status.next', {
      date: longDate(upcoming.date.getTime()),
      reminder: t(REMINDER_LABEL_KEYS[upcoming.kind]),
    });
  } else {
    statusLine = t('cycle.reminders.status.none');
  }

  const renderPicker = () => {
    switch (picker) {
      case 'time':
        return (
          <TimePickerModal
            visible
            title={t('cycle.reminders.time')}
            selectedTime={atTime(prefs.hour, prefs.minute)}
            onClose={() => setPicker(null)}
            onTimeSelect={(d) => {
              setPicker(null);
              save({ hour: d.getHours(), minute: d.getMinutes() });
            }}
          />
        );
      case 'pillTime':
        return (
          <TimePickerModal
            visible
            title={t('cycle.reminders.pill.time')}
            selectedTime={atTime(pill.hour, pill.minute)}
            onClose={() => setPicker(null)}
            onTimeSelect={(d) => {
              setPicker(null);
              save({ pill: { ...pill, hour: d.getHours(), minute: d.getMinutes() } });
            }}
          />
        );
      case 'packStart':
        return (
          <DatePickerModal
            visible
            selectedDate={new Date(pill.packStart)}
            maxDate={new Date()}
            onClose={() => setPicker(null)}
            onDateSelect={(d) => {
              setPicker(null);
              save({ pill: { ...pill, packStart: new Date(d).setHours(0, 0, 0, 0) } });
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View className="gap-5">
      <View
        className="gap-3 rounded-2xl p-4"
        style={{
          backgroundColor:
            Platform.OS !== 'web' && status && !deliverable
              ? theme.colors.status.warning10
              : theme.colors.background.overlay,
        }}
      >
        <View className="flex-row items-center gap-3">
          {deliverable && !paused ? (
            <BellRing size={theme.iconSize.md} color={theme.colors.accent.primary} />
          ) : (
            <BellOff size={theme.iconSize.md} color={theme.colors.text.secondary} />
          )}
          <Text className="flex-1 text-sm text-text-primary">{statusLine}</Text>
        </View>
        {Platform.OS !== 'web' && status && !deliverable ? (
          <Button
            label={t('cycle.reminders.status.turnOn')}
            variant="accent"
            size="sm"
            width="full"
            onPress={() => void ensureDeliverable().catch(fail('CycleReminderSettings.enable'))}
          />
        ) : null}
        {Platform.OS !== 'web' && deliverable ? (
          <TextButton
            label={t('cycle.reminders.test')}
            onPress={() =>
              void CycleNotificationService.sendCycleTestNotification(cycleNotificationStyle)
                .then((sent) => {
                  if (sent) {
                    showSnackbar('success', t('cycle.reminders.testSent'));
                  }
                })
                .catch(fail('CycleReminderSettings.test'))
            }
          />
        ) : null}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-bold text-text-primary">
          {t('cycle.reminders.pause.title')}
        </Text>
        {paused ? (
          <>
            <Text className="text-sm text-text-primary">{pausedLine}</Text>
            <TextButton
              label={t('cycle.reminders.pause.resume')}
              onPress={() => save({ pause: null })}
            />
          </>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {PAUSES.map((p) => (
              <Chip
                key={p.labelKey}
                label={t(p.labelKey)}
                selected={false}
                onPress={() =>
                  save({ pause: { until: p.days == null ? null : addCalendarDays(now, p.days) } })
                }
              />
            ))}
          </View>
        )}
        <Text className="text-xs text-text-secondary">{t('cycle.reminders.pause.hint')}</Text>
      </View>

      <TimePickerInput
        label={t('cycle.reminders.time')}
        selectedTime={atTime(prefs.hour, prefs.minute)}
        onPress={() => setPicker('time')}
      />

      <View className="gap-4">
        {TOGGLES.map((row) => {
          const fertilityUnavailable = row.kind === 'fertile-window' && !fertilityAvailable;
          const estimate = CYCLE_REMINDER_BASIS[row.kind] === 'estimate';
          const estimatesHidden = estimate && guidance.suppressedReason != null;
          const detail = fertilityUnavailable
            ? t('cycle.reminders.fertileWindow.unavailable')
            : [
                t(row.whenKey, {
                  days: formatInteger(prefs.leadDays),
                  count: prefs.leadDays,
                  time: time(prefs.hour, prefs.minute),
                }),
                t(row.oftenKey),
                t(BASIS_KEYS[CYCLE_REMINDER_BASIS[row.kind]]),
                ...(estimatesHidden ? [t('cycle.reminders.notWhileSuppressed')] : []),
              ].join(' · ');

          const isOn = prefs[row.pref] === true && !fertilityUnavailable;

          return (
            <Row key={row.kind} label={t(row.labelKey)} detail={detail}>
              <Switch
                accessibilityLabel={t(row.labelKey)}
                value={isOn}
                disabled={fertilityUnavailable}
                onValueChange={(value) => save({ [row.pref]: value }, value)}
              />
            </Row>
          );
        })}
      </View>

      <StepperInput
        label={t('cycle.reminders.leadDays')}
        value={prefs.leadDays}
        unit={t('common.days.label')}
        onIncrement={() => save({ leadDays: Math.min(14, prefs.leadDays + 1) })}
        onDecrement={() => save({ leadDays: Math.max(0, prefs.leadDays - 1) })}
      />

      <View className="gap-3 rounded-2xl border border-border-light p-4">
        <Row
          label={t('cycle.reminders.pill.label')}
          detail={[
            t('cycle.reminders.pill.when', { time: time(pill.hour, pill.minute) }),
            t('cycle.reminders.basis.routine'),
            t('cycle.reminders.pill.notPaused'),
          ].join(' · ')}
        >
          <Switch
            accessibilityLabel={t('cycle.reminders.pill.label')}
            value={pill.enabled}
            onValueChange={(enabled) => save({ pill: { ...pill, enabled } }, enabled)}
          />
        </Row>
        {pill.enabled ? (
          <>
            <TimePickerInput
              label={t('cycle.reminders.pill.time')}
              selectedTime={atTime(pill.hour, pill.minute)}
              onPress={() => setPicker('pillTime')}
            />
            <View className="flex-row flex-wrap gap-2">
              {PILL_PATTERNS.map((pattern) => (
                <Chip
                  key={pattern.labelKey}
                  label={t(pattern.labelKey)}
                  selected={isPattern(pill, pattern)}
                  onPress={() =>
                    save({
                      pill: {
                        ...pill,
                        activeDays: pattern.activeDays,
                        breakDays: pattern.breakDays,
                      },
                    })
                  }
                />
              ))}
            </View>
            {pill.breakDays > 0 ? (
              <DatePickerInput
                label={t('cycle.reminders.pill.packStart')}
                selectedDate={new Date(pill.packStart)}
                onPress={() => setPicker('packStart')}
              />
            ) : null}
            <Text className="text-xs text-text-secondary">{t('cycle.reminders.pill.hint')}</Text>
          </>
        ) : null}
      </View>

      <StepperInput
        label={t('cycle.complete.backupDays')}
        value={config.backupReminderDays ?? 0}
        unit={t('common.days.label')}
        step={7}
        onIncrement={() =>
          void updateConfig({
            backupReminderDays: Math.min(365, (config.backupReminderDays ?? 0) + 7),
          }).catch(fail('CycleReminderSettings.backup'))
        }
        onDecrement={() =>
          void updateConfig({
            backupReminderDays: Math.max(0, (config.backupReminderDays ?? 0) - 7),
          }).catch(fail('CycleReminderSettings.backup'))
        }
      />

      <View className="gap-3">
        <Text className="text-sm font-bold text-text-primary">
          {t('cycle.reminders.style.title')}
        </Text>
        <Text className="text-xs text-text-secondary">{t('cycle.reminders.style.hint')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {CYCLE_NOTIFICATION_STYLES.map((style) => (
            <Chip
              key={style}
              label={t(STYLE_LABEL_KEYS[style])}
              selected={cycleNotificationStyle === style}
              onPress={() => setStyle(style)}
            />
          ))}
        </View>
        <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
          {t('cycle.reminders.preview')}
        </Text>
        {previews.map((content) => (
          <View
            key={`${content.title}|${content.body}`}
            className="gap-1 rounded-2xl border border-border-light bg-bg-card p-3"
            accessibilityLabel={`${content.title}. ${content.body}`}
          >
            <Text className="text-xs font-bold text-text-secondary">{content.title}</Text>
            <Text className="text-sm text-text-primary">{content.body}</Text>
          </View>
        ))}
        {Platform.OS === 'android' ? (
          <Text className="text-xs text-text-secondary">{t('cycle.reminders.lockScreenHint')}</Text>
        ) : null}
      </View>

      {renderPicker()}
    </View>
  );
}
