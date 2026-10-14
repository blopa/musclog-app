import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { CycleHealthSettings } from '@/components/cycle/CycleHealthSettings';
import { CyclePreferences } from '@/components/cycle/CyclePreferences';
import { CycleReminderSettings } from '@/components/cycle/CycleReminderSettings';
import { CycleSharingSettings } from '@/components/cycle/CycleSharingSettings';
import { type CycleSetupData, EditCycleSetupData } from '@/components/EditCycleSetupData';
import { CycleLockGate } from '@/components/lock/CycleLockGate';
import { CyclePortabilityModal } from '@/components/modals/CyclePortabilityModal';
import { DataSettingsModal } from '@/components/modals/DataSettingsModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import type { AppLockMode } from '@/constants/settings';
import { useAppLock } from '@/context/AppLockContext';
import { useSnackbar } from '@/context/SnackbarContext';
import { deleteBackup, getStoredBackups } from '@/database/preMigrationBackup';
import { SettingsService } from '@/database/services/SettingsService';
import { useCycleMoods } from '@/hooks/useCycleMoods';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { useSettings } from '@/hooks/useSettings';
import { useSubModalState, useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import {
  exportDayLogsCsv,
  exportPeriodsCsv,
  shareAppointmentSummary,
  type SummaryRangeMonths,
} from '@/services/cycleExport';
import { NotificationService } from '@/services/NotificationService';
import { canEnableAppLock, isAppLockSupported } from '@/utils/appLock';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { CycleContextModal } from './CycleContextModal';
import { FullScreenModal } from './FullScreenModal';

type CycleSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Confirm = 'fertility' | 'delete' | 'backups' | null;

const RANGES: SummaryRangeMonths[] = [3, 6, 12];
const LOCK_MODES: { mode: AppLockMode; labelKey: string }[] = [
  { mode: 'off', labelKey: 'cycle.settings.lock.off' },
  { mode: 'cycle', labelKey: 'cycle.settings.lock.cycle' },
  { mode: 'app', labelKey: 'cycle.settings.lock.app' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Everything about the cycle that is a preference rather than a log entry: usual lengths, what is
 * shown (predictions, the optional fertility estimate), how reminders read, who can open it, and
 * getting data out or removing it for good.
 */
export function CycleSettingsModal({ visible, onClose }: CycleSettingsModalProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { unlock } = useAppLock();
  const { cycleShowPredictions, cycleShowFertility, cycleNotificationStyle, appLockMode } =
    useSettings();
  const {
    cycle,
    pausedCycle,
    config,
    updateConfig,
    deactivateTracking,
    resumeTracking,
    deleteAllData,
    periods,
    history,
    dayLogs,
    contexts,
    predictionStats,
    nowMs,
  } = useMenstrualCycle();
  const [form, setForm] = useState<Partial<CycleSetupData>>({});
  const [isSaving, setIsSaving] = useState(false);
  // Both reset when this modal closes, so a ghost sub-modal can't reappear on the next open.
  const [contextOpen, setContextOpen] = useSubModalVisibility(visible);
  const [confirm, setConfirm] = useSubModalState<Confirm>(visible, null);
  const [backupCount, setBackupCount] = useState(0);
  const [months, setMonths] = useState<SummaryRangeMonths>(6);
  const [isExporting, setIsExporting] = useState(false);

  const [portabilityOpen, setPortabilityOpen] = useSubModalVisibility(visible);
  const [dataOpen, setDataOpen] = useSubModalVisibility(visible);
  const { moods, isLoading: moodsLoading, error: moodsError } = useCycleMoods(visible);
  const tracked = cycle ?? pausedCycle;
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const guarded = async (context: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      handleError(error, context, { snackbarMessage: t('errors.somethingWentWrong') });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    await guarded('CycleSettingsModal.save', async () => {
      await updateConfig({
        ...config,
        fallbackCycleLength: form.cycleLength ?? config.fallbackCycleLength,
        cycleLengthKnown: form.cycleLengthKnown ?? config.cycleLengthKnown,
        fallbackPeriodDuration: form.periodDuration ?? config.fallbackPeriodDuration,
      });
      onClose();
    });
    setIsSaving(false);
  };

  const changeLock = async (mode: AppLockMode) => {
    if (mode === appLockMode) {
      return;
    }

    await guarded('CycleSettingsModal.lock', async () => {
      if (mode !== 'off' && !(await canEnableAppLock())) {
        showSnackbar('error', t('cycle.settings.lock.noCredential'));

        return;
      }

      // Changing the lock is itself behind the lock.
      if (!(await unlock())) {
        return;
      }

      await SettingsService.setAppLockMode(mode);
    });
  };

  const runExport = (context: string, action: () => Promise<void>) => {
    setIsExporting(true);
    void guarded(context, action).finally(() => setIsExporting(false));
  };

  const confirmDeleteAll = async () => {
    await guarded('CycleSettingsModal.deleteAll', async () => {
      if (!(await authenticateForDangerousAction(t('cycle.settings.delete.prompt')))) {
        return;
      }

      await deleteAllData();
      const backups = await getStoredBackups();
      if (backups.length > 0) {
        setBackupCount(backups.length);
        setConfirm('backups');

        return;
      }

      setConfirm(null);
      onClose();
    });
  };

  const confirmDeleteBackups = async () => {
    await guarded('CycleSettingsModal.deleteBackups', async () => {
      for (const backup of await getStoredBackups()) {
        await deleteBackup(backup.uri);
      }

      setConfirm(null);
      onClose();
    });
  };

  const confirmCopy = {
    fertility: {
      title: t('cycle.settings.fertility.explainTitle'),
      message: t('cycle.settings.fertility.explainMessage'),
      confirmLabel: t('cycle.settings.fertility.enable'),
      variant: 'primary' as const,
      onConfirm: async () => {
        await guarded('CycleSettingsModal.fertility', () =>
          SettingsService.setCycleShowFertility(true)
        );
        setConfirm(null);
      },
    },
    delete: {
      title: t('cycle.settings.delete.title'),
      message: t('cycle.settings.delete.message'),
      confirmLabel: t('cycle.settings.delete.confirm'),
      variant: 'destructive' as const,
      onConfirm: confirmDeleteAll,
    },
    backups: {
      title: t('cycle.settings.delete.backupsTitle'),
      message: t('cycle.settings.delete.backupsMessage', { count: backupCount }),
      confirmLabel: t('cycle.settings.delete.backupsConfirm'),
      variant: 'destructive' as const,
      onConfirm: confirmDeleteBackups,
    },
  };
  const active = confirm ? confirmCopy[confirm] : null;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('cycle.settings.title')}
      subtitle={t('cycle.settings.subtitle')}
      footer={
        cycle ? (
          <Button
            label={t('cycle.settings.save')}
            onPress={handleSave}
            variant="accent"
            size="md"
            width="full"
            loading={isSaving}
          />
        ) : undefined
      }
    >
      <CycleLockGate>
        <View className="gap-8 px-4 py-4">
          {tracked ? (
            <>
              {cycle ? (
                <Section title={t('cycle.settings.sectionUsual')}>
                  {/* key forces remount on each open so the form resets to the saved values */}
                  <EditCycleSetupData
                    key={
                      visible
                        ? `${config.fallbackCycleLength}-${config.fallbackPeriodDuration}`
                        : 'closed'
                    }
                    initialData={{
                      cycleLength: config.fallbackCycleLength,
                      cycleLengthKnown: config.cycleLengthKnown,
                      periodDuration: config.fallbackPeriodDuration,
                    }}
                    onFormChange={setForm}
                    showDatePicker={false}
                    showContext={false}
                  />
                  <Text className="text-xs text-text-tertiary">
                    {t('cycle.settings.usualHint')}
                  </Text>
                  <Button
                    label={t('cycle.settings.changeContext')}
                    variant="outline"
                    onPress={() => setContextOpen(true)}
                  />
                </Section>
              ) : null}

              <Section title={t('cycle.personalize.title')}>
                <CyclePreferences />
                <CycleHealthSettings />
              </Section>
              <Section title={t('cycle.settings.sectionShown')}>
                <ToggleInput
                  items={[
                    {
                      key: 'predictions',
                      label: t('cycle.settings.showPredictions'),
                      subtitle: t('cycle.settings.showPredictionsHint'),
                      value: cycleShowPredictions,
                      onValueChange: (value) =>
                        void guarded('CycleSettingsModal.predictions', () =>
                          SettingsService.setCycleShowPredictions(value)
                        ),
                    },
                    {
                      key: 'fertility',
                      label: t('cycle.settings.showFertility'),
                      subtitle: t('cycle.settings.showFertilityHint'),
                      value: cycleShowFertility,
                      onValueChange: (value) => {
                        if (value) {
                          setConfirm('fertility');
                        } else {
                          void guarded('CycleSettingsModal.fertility', () =>
                            SettingsService.setCycleShowFertility(false)
                          );
                        }
                      },
                    },
                  ]}
                />
              </Section>

              <Section title={t('cycle.settings.sectionReminders')}>
                <CycleReminderSettings />
                <Text className="text-xs text-text-tertiary">
                  {t('cycle.settings.reminderHint')}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    label={t('cycle.settings.reminderDiscreet')}
                    selected={cycleNotificationStyle === 'discreet'}
                    onPress={() =>
                      void guarded('CycleSettingsModal.style', async () => {
                        await SettingsService.setCycleNotificationStyle('discreet');
                        await NotificationService.scheduleMenstrualCycleNotifications();
                      })
                    }
                  />
                  <Chip
                    label={t('cycle.settings.reminderDetailed')}
                    selected={cycleNotificationStyle === 'detailed'}
                    onPress={() =>
                      void guarded('CycleSettingsModal.style', async () => {
                        await SettingsService.setCycleNotificationStyle('detailed');
                        await NotificationService.scheduleMenstrualCycleNotifications();
                      })
                    }
                  />
                </View>
              </Section>
            </>
          ) : (
            <Section title={t('cycle.settings.sectionTracking')}>
              <Text className="text-sm text-text-secondary">{t('cycle.noData.description')}</Text>
              <Button
                label={t('cycle.noData.start')}
                variant="accent"
                onPress={() => {
                  onClose();
                  router.navigate({
                    pathname: '/app/onboarding/cycle-setup',
                    params: { nextRoute: encodeURIComponent('/app/cycle') },
                  } as never);
                }}
              />
            </Section>
          )}

          {isAppLockSupported ? (
            <Section title={t('cycle.settings.sectionPrivacy')}>
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.lockHint')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {LOCK_MODES.map(({ mode, labelKey }) => (
                  <Chip
                    key={mode}
                    label={t(labelKey)}
                    selected={appLockMode === mode}
                    onPress={() => void changeLock(mode)}
                  />
                ))}
              </View>
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.privacyNote')}</Text>
            </Section>
          ) : null}

          {tracked ? (
            <Section title={t('cycle.settings.sectionExport')}>
              <CycleSharingSettings />
              <Button
                label={t('cycle.portability.title')}
                variant="outline"
                onPress={() => setPortabilityOpen(true)}
              />
              <Button
                label={t('cycle.portability.fullBackup')}
                variant="outline"
                onPress={() => setDataOpen(true)}
              />
              <Text className="text-xs text-text-secondary">
                {t('cycle.portability.fullBackupHint')}
              </Text>
              <Button
                label={t('cycle.settings.exportPeriods')}
                variant="outline"
                disabled={isExporting || moodsLoading || moodsError}
                onPress={() =>
                  runExport('CycleSettingsModal.exportPeriods', () =>
                    exportPeriodsCsv(periods, history)
                  )
                }
              />
              <Button
                label={t('cycle.settings.exportDays')}
                variant="outline"
                disabled={isExporting || moodsLoading || moodsError}
                onPress={() =>
                  runExport('CycleSettingsModal.exportDays', () => exportDayLogsCsv(dayLogs, moods))
                }
              />
              <Text className="mt-2 text-sm font-bold text-text-primary">
                {t('cycle.settings.summaryTitle')}
              </Text>
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.summaryHint')}</Text>
              <View className="flex-row flex-wrap gap-2">
                {RANGES.map((range) => (
                  <Chip
                    key={range}
                    label={t('cycle.settings.summaryRange', { count: range })}
                    selected={months === range}
                    onPress={() => setMonths(range)}
                  />
                ))}
              </View>
              <Button
                label={t('cycle.settings.summaryCreate')}
                variant="outline"
                disabled={isExporting || moodsLoading || moodsError}
                onPress={() =>
                  runExport('CycleSettingsModal.summary', () =>
                    shareAppointmentSummary({
                      t,
                      locale,
                      months,
                      nowMs,
                      data: { periods, history, stats: predictionStats, dayLogs, contexts, moods },
                    })
                  )
                }
              />
            </Section>
          ) : null}

          {tracked ? (
            <Section title={t('cycle.settings.sectionManage')}>
              {cycle ? (
                <TextButton
                  label={t('cycle.settings.pause')}
                  onPress={() =>
                    void guarded('CycleSettingsModal.pause', async () => {
                      await deactivateTracking();
                      onClose();
                    })
                  }
                />
              ) : (
                <TextButton
                  label={t('cycle.noData.resume')}
                  onPress={() => void guarded('CycleSettingsModal.resume', resumeTracking)}
                />
              )}
              <Text className="text-xs text-text-tertiary">{t('cycle.settings.pauseHint')}</Text>
              <TextButton
                label={t('cycle.settings.delete.action')}
                tone="danger"
                onPress={() => setConfirm('delete')}
              />
            </Section>
          ) : null}
        </View>
      </CycleLockGate>

      {portabilityOpen ? (
        <CyclePortabilityModal visible onClose={() => setPortabilityOpen(false)} />
      ) : null}
      <DataSettingsModal visible={dataOpen} onClose={() => setDataOpen(false)} />
      <CycleContextModal visible={contextOpen} onClose={() => setContextOpen(false)} />

      {active ? (
        <ConfirmationModal
          visible
          onClose={() => setConfirm(null)}
          onConfirm={active.onConfirm}
          title={active.title}
          message={active.message}
          confirmLabel={active.confirmLabel}
          variant={active.variant}
        />
      ) : null}
    </FullScreenModal>
  );
}
